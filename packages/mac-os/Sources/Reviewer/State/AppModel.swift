// The window's model: the connection to the server, the open project, the
// window tabs and which one holds the window, the page island the tabs
// show, the sidebar's tree and the pane's own native surfaces. One instance
// per app — the same server serves every window, and a single tab list is
// what the strip, the launchpad and the menu commands all act on.
//
// The model is the one that navigates: a tab chosen here is an address the
// page island is sent to. The island reports back where it went, which is
// how a tab remembers its place, and what it is showing — its open files,
// its tree — which is what the native chrome around it draws.
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
    /// The code page's file tree, as it last reported it, with the sidebar's
    /// own folds, search and selection over it.
    let sidebar = SidebarTree()

    var bottomExpanded = true
    var bottomTab: BottomPaneTab = .terminal
    var bottomHeight: CGFloat = 280

    /// The SPA's routed page — the tab in front is where it is pointed.
    let page: IslandHost
    let threads: Threads
    let services: DevServices
    /// The search dialog — a file by name, or a grep of the working tree.
    let search: QuickSearch
    @ObservationIgnored private var shiftTaps: ShiftTapMonitor?

    init(client: ReviewerClient = ReviewerClient(baseURL: ServerLauncher.shared.baseURL)) {
        self.client = client
        let source = SpaSource.resolve()
        page = IslandHost(kind: .code, href: WindowTab.code.href, source: source, apiBaseURL: client.baseURL)
        services = DevServices(client: client)
        threads = Threads(client: client)
        search = QuickSearch(client: client)
        search.onOpen = { [weak self] path, line in self?.show(file: path, line: line) }
        // The web app keeps the gesture out of its inputs; here the one
        // input it could land in is the dialog's own box, where two Shifts
        // in a row are typing, not a request to switch lists.
        shiftTaps = ShiftTapMonitor { [weak self] in
            guard let self, !search.isShown else { return }
            findFile()
        }
        page.onNavigated = { [weak self] href in self?.pageNavigated(to: href) }
        page.onFileTabsReported = { [weak self] strip in self?.fileTabs = strip }
        page.onTreeReported = { [weak self] listing in self?.sidebar.take(listing) }
        page.onTreeStateReported = { [weak self] state in self?.sidebar.take(state) }
        page.onOpenDirectory = { [weak self] in self?.askForProjectFolder() }
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
        page.refresh()
    }

    private func refreshProjectState() async {
        search.projectChanged(scope: (workspace?.repos.count ?? 0) > 1 ? .project : .repo)
        guard hasProject else {
            status = nil
            branches = []
            remoteBranches = []
            return
        }
        status = try? await client.repoStatus()
        await loadBranches()
        await services.load()
        await threads.load()
    }

    /// The Code tab, at an address: what every native control that reaches
    /// for a code surface goes through.
    func showOnCodeTab(_ href: String) {
        guard let index = tabs.firstIndex(where: { $0.id == WindowTab.code.id }) else { return }
        tabs[index].href = href
        selectedTabId = WindowTab.code.id
    }

    /// A file, at a line: where a search result opens. In place when the
    /// page already shows files — reading a pull request stays a review —
    /// and otherwise on the diff, which can show any file.
    func show(file: String, line: Int?) {
        let base = CodeSurface.forHref(page.href) != nil ? page.href : Href.review
        showOnCodeTab(Href.file(file, line: line, on: base))
    }

    // MARK: search

    func findFile() {
        guard hasProject, !launchpadShown else { return }
        search.open(.files)
    }

    /// ⌘⇧F: the grep, opening on whatever the page has highlighted, so the
    /// chord over a word searches for it.
    func findInFiles() {
        guard hasProject, !launchpadShown else { return }
        Task {
            let selected = try? await page.webView.evaluateJavaScript("window.getSelection().toString()") as? String
            search.open(.text, seed: Self.seed(fromSelection: selected ?? ""))
        }
    }

    /// The part of a selection that can seed the box: one line of it,
    /// trimmed, and short enough to be a phrase. A paragraph dragged out of
    /// a file is not a query, and seeding it would throw away what the box
    /// held.
    static func seed(fromSelection selected: String) -> String {
        let trimmed = selected.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed.count <= 200, !trimmed.contains(where: \.isNewline) else { return "" }
        return trimmed
    }

    // MARK: sidebar

    /// The sidebar's rail: which of the code surfaces the page is on, as
    /// its address says.
    var codeSurface: CodeSurface? {
        CodeSurface.forHref(page.href)
    }

    /// A rail button: the Code tab, on that surface — and the tree with it,
    /// since the page reports the tree of whatever surface it is on.
    func show(surface: CodeSurface) {
        showOnCodeTab(surface.href)
    }

    /// The sidebar acted on a row of the page's tree — see `TreeAction`.
    func act(onTree action: TreeAction) {
        page.send(action)
    }

    // MARK: project

    func openProject(path: String) async {
        do {
            workspace = try await client.openProject(path: path)
            closeUnpinnedTabs()
            snapshots = [:]
            services.reset()
            threads.reset()
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

    /// A rail button: the surface it names, or with that surface already
    /// up, the pane put away — the click that opened it closes it.
    func toggle(bottomTab tab: BottomPaneTab) {
        if bottomExpanded && bottomTab == tab {
            bottomExpanded = false
        } else {
            show(bottomTab: tab)
        }
    }

}
