// The window's model: the connection to the server, the open project, the
// page island, the sidebar's tree and the pane's own native surfaces. One
// instance per app — the same server serves every window.
//
// The window tabs are the island's own strip (see `WindowTabStrip`), so the
// model does not switch them: what it does is send the page to an address
// when a native control reaches for a code surface — the rail, a search
// result, a commit in the history — and the strip hands the window to the
// tab that owns it. The island reports back where it went, and what it is
// showing — its tree, its tabs — which is what the native chrome around it
// draws and names.
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
    var branches: [BranchInfo] = []
    var remoteBranches: [RemoteBranchInfo] = []
    var branchPrompt: BranchPrompt?
    var lastError: String?

    /// The window tabs as the island last reported them, for the menu bar.
    private(set) var windowTabs: WindowTabStrip = .empty
    /// The code page's file tree, as it last reported it, with the sidebar's
    /// own folds, search and selection over it.
    let sidebar = SidebarTree()
    var sidebarShown = true
    var sidebarWidth: CGFloat = 280
    var launchpadShown = false
    /// The last picture of each tab, taken as it was left, for the launchpad.
    private(set) var snapshots: [String: NSImage] = [:]

    var bottomExpanded = true
    var bottomTab: BottomPaneTab = .terminal
    var bottomHeight: CGFloat = 280

    /// The SPA's routed page, with the window tabs along its top.
    let page: IslandHost
    let threads: Threads
    let services: DevServices
    /// The search dialog — a file by name, or a grep of the working tree.
    let search: QuickSearch
    @ObservationIgnored private var shiftTaps: ShiftTapMonitor?

    init(client: ReviewerClient = ReviewerClient(baseURL: ServerLauncher.shared.baseURL)) {
        self.client = client
        let source = SpaSource.resolve()
        page = IslandHost(kind: .code, href: Href.review, source: source, apiBaseURL: client.baseURL)
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
        page.onWindowTabsReported = { [weak self] strip in self?.take(strip) }
        page.onTreeReported = { [weak self] listing in self?.sidebar.take(listing) }
        page.onTreeStateReported = { [weak self] state in self?.sidebar.take(state) }
        page.onOpenDirectory = { [weak self] in self?.askForProjectFolder() }
    }

    var hasProject: Bool { workspace?.project != nil }

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
        do {
            workspace = try await client.workspace()
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

    /// The page at a code address: what every native control that reaches
    /// for a code surface goes through. The strip hands the window to the
    /// Code tab as the page arrives there, the way it does for a link.
    func showOnCodeTab(_ href: String) {
        page.navigate(to: href)
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

    func toggleSidebar() {
        sidebarShown.toggle()
    }


    // MARK: project

    func openProject(path: String) async {
        do {
            workspace = try await client.openProject(path: path)
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

    /// Whether Close Tab has anything to close: the pinned tabs stay.
    var canCloseTab: Bool {
        windowTabs.active?.pinned == false
    }

    /// The strip as the island last drew it. A tab gone from it takes its
    /// picture with it.
    private func take(_ strip: WindowTabStrip) {
        windowTabs = strip
        let open = Set(strip.tabs.map(\.id))
        snapshots = snapshots.filter { open.contains($0.key) }
    }

    func newSession() {
        guard hasProject else {
            lastError = "open a project before starting an agent session"
            return
        }
        leaveTab { $0.send(WindowTabAction.newSession) }
    }

    func closeCurrentTab() {
        page.send(WindowTabAction.closeActive)
    }

    func select(tabId: String) {
        leaveTab { $0.send(WindowTabAction.select(id: tabId)) }
    }

    func closeTab(id: String) {
        page.send(WindowTabAction.close(id: id))
    }

    func selectNextTab(offset: Int) {
        leaveTab { $0.send(WindowTabAction.step(offset)) }
    }

    /// ⌘1–9: the session in that slot, the pinned tabs not counted.
    func select(sessionSlot slot: Int) {
        leaveTab { $0.send(WindowTabAction.session(slot: slot)) }
    }

    func toggleLaunchpad() {
        if !launchpadShown { snapshotActiveTab() }
        launchpadShown.toggle()
    }

    /// Leaving a tab takes its picture first, so the launchpad shows it as
    /// it was; then the strip is asked to switch, and the launchpad — which
    /// the ask may have come from — is put away.
    private func leaveTab(_ switching: @escaping (IslandHost) -> Void) {
        let leaving = windowTabs.activeId
        launchpadShown = false
        Task {
            snapshots[leaving] = try? await page.webView.takeSnapshot(configuration: nil)
            switching(page)
        }
    }

    private func snapshotActiveTab() {
        let id = windowTabs.activeId
        Task { snapshots[id] = try? await page.webView.takeSnapshot(configuration: nil) }
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
