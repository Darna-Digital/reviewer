// The window's model: the connection to the server, the open project, the
// window tabs and which one holds the window, the two islands the tabs and
// the bottom pane show, and the pane's own native surfaces. One instance per
// app — the same server serves every window, and a single tab list is what
// the strip, the launchpad and the menu commands all act on.
//
// Islands cannot share a JavaScript heap, so everything two of them would
// both need lives here, and the model is the one that navigates: a tab
// chosen here is an address the page island is sent to, a pane tab chosen
// here is one the dock island is sent to. The islands report back where
// they went, which is how a tab remembers its place.
import AppKit
import Foundation
import Observation
import WebKit

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
    var chats: [ChatSummary] = []
    var branches: [BranchInfo] = []
    var remoteBranches: [RemoteBranchInfo] = []
    var branchPrompt: BranchPrompt?
    var lastError: String?

    var tabs: [WindowTab] = [.code, .git, .sessions]
    var selectedTabId: String = WindowTab.code.id {
        didSet { tabSelectionChanged(from: oldValue) }
    }
    var launchpadShown = false
    /// The last picture of each tab, taken as it was left, for the launchpad.
    private(set) var snapshots: [String: NSImage] = [:]
    /// The code page's open files, as it last reported them; nil while it
    /// shows no strip — a diff, a merge request, another tab's page.
    private(set) var fileTabs: FileTabStrip?

    var bottomExpanded = true
    var bottomTab: BottomPaneTab = .terminal {
        didSet { showBottomTabInDockIsland() }
    }
    var bottomHeight: CGFloat = 280

    /// The SPA's routed page — the tab in front is where it is pointed.
    let page: IslandHost
    /// The SPA's dock surfaces — history, branches, find, threads — pointed
    /// at whichever the bottom pane is on.
    let dock: IslandHost
    /// The SPA's file tree — the project, or the changed files — in the
    /// native sidebar, kept on the same code page as the page island.
    let tree: IslandHost
    let terminal = TerminalSession()
    let services: DevServices

    init(client: ReviewerClient = ReviewerClient(baseURL: ServerLauncher.shared.baseURL)) {
        self.client = client
        let source = SpaSource.resolve()
        page = IslandHost(kind: .code, href: WindowTab.code.href, source: source, apiBaseURL: client.baseURL)
        dock = IslandHost(kind: .dock, href: BottomPaneTab.history.dockHref!, source: source, apiBaseURL: client.baseURL)
        tree = IslandHost(kind: .tree, href: Href.browsePath, source: source, apiBaseURL: client.baseURL)
        services = DevServices(client: client)
        page.onNavigated = { [weak self] href in self?.pageNavigated(to: href) }
        page.onFileTabsReported = { [weak self] strip in self?.fileTabs = strip }
        dock.onNavigated = { [weak self] href in self?.dockNavigated(to: href) }
        tree.onNavigated = { [weak self] href in self?.treeNavigated(to: href) }
        for island in [page, dock, tree] {
            island.onOpenDirectory = { [weak self] in self?.askForProjectFolder() }
        }
    }

    var hasProject: Bool { workspace?.project != nil }
    var selectedTab: WindowTab? { tabs.first { $0.id == selectedTabId } }

    func title(of tab: WindowTab) -> String {
        switch tab.kind {
        case .code: return "Code"
        case .git: return "Git"
        case .sessions: return "Sessions"
        case .newSession: return "New Session"
        case .session(let id):
            let title = chats.first { $0.id == id }?.title ?? ""
            return title.isEmpty ? "Session" : title
        }
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

    /// Re-reads everything project-shaped, and tells the islands to. Cheap
    /// enough to call after any action that could have changed the branch or
    /// the sessions — a project switch, ⌘R.
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
        for island in [page, dock, tree] { island.refresh() }
    }

    private func refreshProjectState() async {
        guard hasProject else {
            status = nil
            branches = []
            remoteBranches = []
            return
        }
        status = try? await client.repoStatus()
        await loadBranches()
        await services.load()
    }

    /// The Code tab, at an address: what every native control that reaches
    /// for a code surface goes through.
    func showOnCodeTab(_ href: String) {
        guard let index = tabs.firstIndex(where: { $0.id == WindowTab.code.id }) else { return }
        tabs[index].href = href
        selectedTabId = WindowTab.code.id
    }

    // MARK: sidebar

    /// The sidebar's rail: which of the code surfaces the page is on, as
    /// its address says.
    var codeSurface: CodeSurface? {
        CodeSurface.forHref(page.href)
    }

    /// A rail button: the Code tab, on that surface — and the tree with it.
    func show(surface: CodeSurface) {
        showOnCodeTab(surface.href)
    }

    /// The tree moved — a file picked, a folder's file opened — and the page
    /// shows what it names. Same page, so the same address.
    private func treeNavigated(to href: String) {
        guard Href.isCodePage(href), page.href != href else { return }
        showOnCodeTab(href)
    }

    /// The page moved on a code surface — and the tree, being the same page
    /// down to its first column, is sent along so its selection and its mode
    /// (the project, or the changes) follow.
    private func keepTreeWithPage(_ href: String) {
        guard Href.isCodePage(href), tree.href != href else { return }
        tree.navigate(to: href)
    }

    // MARK: project

    func openProject(path: String) async {
        do {
            workspace = try await client.openProject(path: path)
            closeUnpinnedTabs()
            snapshots = [:]
            terminal.stop()
            services.reset()
            await refresh()
        } catch {
            lastError = error.localizedDescription
        }
    }

    func chooseProject() {
        guard let path = askForProjectFolder() else { return }
        Task { await openProject(path: path) }
    }

    /// The folder panel on its own, so an island's project picker can raise
    /// the same one and open what it chose through the server itself.
    func askForProjectFolder() -> String? {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.prompt = "Open Project"
        panel.message = "Choose a folder holding one or more git repositories."
        if let home = workspace?.home {
            panel.directoryURL = URL(fileURLWithPath: home)
        }
        guard panel.runModal() == .OK, let url = panel.url else { return nil }
        return url.path
    }

    // MARK: tabs

    func newSession() {
        guard hasProject else {
            lastError = "open a project before starting an agent session"
            return
        }
        show(.newSession())
    }

    func select(tabId: String) {
        guard tabs.contains(where: { $0.id == tabId }) else { return }
        selectedTabId = tabId
        launchpadShown = false
    }

    func select(slot: Int) {
        guard tabs.indices.contains(slot - 1) else { return }
        select(tabId: tabs[slot - 1].id)
    }

    func closeTab(id: String) {
        guard let index = tabs.firstIndex(where: { $0.id == id }), !tabs[index].isPinned else { return }
        tabs.remove(at: index)
        snapshots[id] = nil
        if selectedTabId == id {
            // Fall back to the neighbour on the left, the way Xcode does, so
            // closing the last tab of a run lands you on the one you came from.
            selectedTabId = tabs[max(0, index - 1)].id
        }
    }

    func closeCurrentTab() {
        closeTab(id: selectedTabId)
    }

    func closeUnpinnedTabs() {
        for tab in tabs where !tab.isPinned { closeTab(id: tab.id) }
    }

    func selectNextTab(offset: Int) {
        guard let current = tabs.firstIndex(where: { $0.id == selectedTabId }) else { return }
        let next = (current + offset + tabs.count) % tabs.count
        selectedTabId = tabs[next].id
    }

    func moveTab(from source: IndexSet, to destination: Int) {
        tabs.move(fromOffsets: source, toOffset: destination)
    }

    func toggleLaunchpad() {
        if !launchpadShown { snapshotCurrentTab() }
        launchpadShown.toggle()
    }

    private func show(_ tab: WindowTab) {
        if !tabs.contains(where: { $0.id == tab.id }) { tabs.append(tab) }
        selectedTabId = tab.id
    }

    /// Leaving a tab takes its picture first, so the launchpad shows it as
    /// it was; then the page is sent where the new tab points.
    private func tabSelectionChanged(from previous: String) {
        guard let tab = selectedTab else { return }
        if previous != tab.id, let index = tabs.firstIndex(where: { $0.id == previous }) {
            let leaving = tabs[index].id
            Task {
                snapshots[leaving] = try? await page.webView.takeSnapshot(configuration: nil)
                page.navigate(to: tab.href)
            }
        } else if page.href != tab.href {
            page.navigate(to: tab.href)
        }
    }

    private func snapshotCurrentTab() {
        let id = selectedTabId
        Task { snapshots[id] = try? await page.webView.takeSnapshot(configuration: nil) }
    }

    /// The page moved — a link, a file, a session picked in the list. The
    /// tab in front remembers the place, unless the place belongs to another
    /// pinned tab — a link out of a diff into the git mode — in which case
    /// that tab takes it and the window; and a session composed in a fresh
    /// tab becomes that session's tab the moment the composer lands on it.
    private func pageNavigated(to href: String) {
        keepTreeWithPage(href)
        guard var index = tabs.firstIndex(where: { $0.id == selectedTabId }) else { return }
        let owner = WindowTab.owner(of: href)
        if tabs[index].isPinned, tabs[index].kind != owner,
            let owning = tabs.firstIndex(where: { $0.kind == owner })
        {
            index = owning
            tabs[index].href = href
            selectedTabId = tabs[index].id
        }
        tabs[index].href = href
        if case .newSession = tabs[index].kind, let id = Href.sessionId(in: href) {
            let session = WindowTab.session(id: id)
            if let existing = tabs.firstIndex(where: { $0.id == session.id }) {
                tabs.remove(at: index)
                selectedTabId = tabs[existing < index ? existing : existing - 1].id
            } else {
                tabs[index] = session
                selectedTabId = session.id
            }
        }
        if href.hasPrefix(Href.sessions) {
            Task { chats = (try? await client.chats().items) ?? chats }
        }
    }

    // MARK: file tabs

    /// The strip belongs to the Code tab: another tab's page is on its way in
    /// while the code page's last report is still standing.
    var fileTabStrip: FileTabStrip? {
        guard selectedTabId == WindowTab.code.id, let strip = fileTabs, !strip.tabs.isEmpty else { return nil }
        return strip
    }

    func act(onFileTab action: FileTabAction) {
        page.send(action)
    }

    // MARK: bottom pane

    func toggleBottomPane() {
        bottomExpanded.toggle()
    }

    func show(bottomTab tab: BottomPaneTab) {
        bottomTab = tab
        bottomExpanded = true
    }

    /// The dock reached for the page — a commit picked out of History, a
    /// branch compared — which in the browser is the one window moving. Here
    /// it is the Code tab's to show, and the dock is put back on its surface.
    private func dockNavigated(to href: String) {
        guard BottomPaneTab.forDockHref(href) == nil else { return }
        if let index = tabs.firstIndex(where: { $0.id == WindowTab.code.id }) {
            tabs[index].href = href
        }
        selectedTabId = WindowTab.code.id
        if let back = bottomTab.dockHref { dock.navigate(to: back) }
    }

    private func showBottomTabInDockIsland() {
        guard let href = bottomTab.dockHref, dock.href != href else { return }
        dock.navigate(to: href)
    }

    /// The Terminal's shell, in the project folder; nil before one is open.
    var terminalDirectory: String? {
        workspace?.current ?? workspace?.project
    }
}
