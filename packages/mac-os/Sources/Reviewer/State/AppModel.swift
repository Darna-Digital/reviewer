// The window's model: the connection to the server, the open project and its
// file tree, the agent sessions, and the tab strip. One instance per app —
// the same server serves every window, and a single tab list is what the
// sidebar, the strip and the menu commands all act on.
import AppKit
import Foundation
import Observation

enum ConnectionState: Equatable {
    case starting
    case ready
    case failed(String)
}

@MainActor
@Observable
final class AppModel {
    let client: ReviewerClient

    var connection: ConnectionState = .starting
    var workspace: WorkspaceInfo?
    var status: RepoStatus?
    var fileTree: [FileNode] = []
    var chats: [ChatSummary] = []
    var catalog: ChatModelCatalog?
    var isLoadingFiles = false
    var lastError: String?

    var tabs: [EditorTab] = []
    var selectedTabId: String?

    private(set) var openFiles: [String: OpenFile] = [:]
    private(set) var sessions: [String: ChatSession] = [:]

    init(client: ReviewerClient = ReviewerClient(baseURL: ServerLauncher.shared.baseURL)) {
        self.client = client
    }

    var hasProject: Bool { workspace?.project != nil }
    var selectedTab: EditorTab? { tabs.first { $0.id == selectedTabId } }

    var currentFile: OpenFile? {
        guard case .file(let path)? = selectedTab?.kind else { return nil }
        return openFiles[path]
    }

    var currentSession: ChatSession? {
        guard case .chat(let id)? = selectedTab?.kind else { return nil }
        return sessions[id]
    }

    // MARK: lifecycle

    func bootstrap() async {
        connection = .starting
        do {
            try await ServerLauncher.shared.ensureRunning()
            connection = .ready
            await refresh()
        } catch {
            connection = .failed(error.localizedDescription)
        }
    }

    /// Re-reads everything project-shaped. Cheap enough to call after any
    /// action that could have changed the tree or the branch — a save, an
    /// agent turn ending, a project switch.
    func refresh() async {
        async let workspaceInfo = client.workspace()
        async let chatPage = client.chats()
        do {
            workspace = try await workspaceInfo
            chats = try await chatPage.items
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
        await refreshProjectState()
        if catalog == nil {
            catalog = try? await client.modelCatalog()
        }
    }

    private func refreshProjectState() async {
        guard hasProject else {
            fileTree = []
            status = nil
            return
        }
        isLoadingFiles = true
        defer { isLoadingFiles = false }
        // The status is per selected root and the tree is per project, so
        // one failing must not blank the other.
        status = try? await client.repoStatus()
        do {
            let files = try await loadFiles()
            fileTree = FileTree.build(paths: files.paths, gitStatus: files.gitStatus)
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// The file endpoints resolve paths from the project folder. With one
    /// root that folder *is* the repository, so the repo-relative listing is
    /// the right one; a multi-root project needs every root's files named
    /// from the parent, which is what the project-wide listing gives. Same
    /// split the web app makes with `useMultiRepo`.
    private func loadFiles() async throws -> FilesPayload {
        let isMultiRepo = (workspace?.repos.count ?? 0) > 1
        return try await isMultiRepo ? client.projectFiles() : client.files()
    }

    // MARK: project

    func openProject(path: String) async {
        do {
            workspace = try await client.openProject(path: path)
            closeAllTabs()
            await refresh()
        } catch {
            lastError = error.localizedDescription
        }
    }

    func chooseProject() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.prompt = "Open Project"
        panel.message = "Choose a folder holding one or more git repositories."
        if let home = workspace?.home {
            panel.directoryURL = URL(fileURLWithPath: home)
        }
        guard panel.runModal() == .OK, let url = panel.url else { return }
        Task { await openProject(path: url.path) }
    }

    // MARK: tabs

    func activate(tabId: String) {
        if tabId.hasPrefix("file:") {
            openFile(path: String(tabId.dropFirst("file:".count)))
        } else if tabId.hasPrefix("chat:") {
            openChat(id: String(tabId.dropFirst("chat:".count)))
        }
    }

    func openFile(path: String) {
        let tab = EditorTab(kind: .file(path: path))
        if openFiles[path] == nil {
            let file = OpenFile(path: path, client: client)
            openFiles[path] = file
            Task { await file.load() }
        }
        show(tab)
    }

    func openChat(id: String) {
        let tab = EditorTab(kind: .chat(id: id))
        if sessions[id] == nil {
            let session = ChatSession(id: id, client: client)
            sessions[id] = session
            session.open()
        }
        show(tab)
    }

    func newChat() async {
        guard hasProject else {
            lastError = "open a project before starting an agent session"
            return
        }
        do {
            let chat = try await client.createChat(NewChat())
            chats.insert(summary(of: chat), at: 0)
            openChat(id: chat.id)
        } catch {
            lastError = error.localizedDescription
        }
    }

    func deleteChat(id: String) async {
        do {
            try await client.deleteChat(id: id)
            closeTab(id: EditorTab.chatId(id))
            chats.removeAll { $0.id == id }
        } catch {
            lastError = error.localizedDescription
        }
    }

    func closeTab(id: String) {
        guard let index = tabs.firstIndex(where: { $0.id == id }) else { return }
        let tab = tabs.remove(at: index)
        switch tab.kind {
        case .file(let path):
            openFiles[path] = nil
        case .chat(let chatId):
            sessions[chatId]?.close()
            sessions[chatId] = nil
        }
        if selectedTabId == id {
            // Fall back to the neighbour on the left, the way Xcode does, so
            // closing the last tab of a run lands you on the one you came from.
            selectedTabId = tabs[safe: max(0, index - 1)]?.id
        }
    }

    func closeCurrentTab() {
        guard let id = selectedTabId else { return }
        closeTab(id: id)
    }

    func closeAllTabs() {
        for tab in tabs { closeTab(id: tab.id) }
    }

    func selectNextTab(offset: Int) {
        guard !tabs.isEmpty, let current = tabs.firstIndex(where: { $0.id == selectedTabId }) else {
            selectedTabId = tabs.first?.id
            return
        }
        let next = (current + offset + tabs.count) % tabs.count
        selectedTabId = tabs[next].id
    }

    func saveCurrentFile() async {
        guard let file = currentFile else { return }
        await file.save()
        await refreshProjectState()
    }

    func moveTab(from source: IndexSet, to destination: Int) {
        tabs.move(fromOffsets: source, toOffset: destination)
    }

    private func show(_ tab: EditorTab) {
        if !tabs.contains(tab) { tabs.append(tab) }
        selectedTabId = tab.id
    }

    private func summary(of chat: Chat) -> ChatSummary {
        ChatSummary(
            id: chat.id, origin: chat.origin, title: chat.title, provider: chat.provider,
            model: chat.model, branch: chat.branch, createdAt: chat.createdAt,
            updatedAt: chat.updatedAt, seenAt: chat.seenAt, messageCount: chat.messages.count,
            lastMessage: chat.messages.last?.text, turnState: chat.latestTurn?.state)
    }
}

extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
