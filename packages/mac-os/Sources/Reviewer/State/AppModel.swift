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
    /// The sessions list, as the page last reported it — while it is on the
    /// sessions surface, where the sidebar draws this in the tree's place.
    private(set) var sessions: ShellSessions?
    var sidebarShown = true
    var sidebarWidth: CGFloat = 280
    /// The launchpad — out or in, how far it pushes the page, the pull
    /// moving it — and the trackpad's ways into it, heard app-wide.
    let launchpad = Launchpad()
    @ObservationIgnored private var launchpadGestures: LaunchpadGestureMonitor?
    /// The last picture of each tab, taken as it was left, for the launchpad.
    private(set) var snapshots: [String: NSImage] = [:]

    var bottomExpanded = true
    var bottomTab: BottomPaneTab = .terminal
    var bottomHeight: CGFloat = 280
    /// The git dock under the page island, as it last reported itself: the
    /// other thing that can stand at the foot of the window, one at a time
    /// with the pane above.
    private(set) var dock: DockState = .down

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
        // Whichever way the launchpad is asked for — the chord, the button,
        // a swipe, a seam pulled — the tab being left is photographed as it
        // comes out, so its card shows the page as it was.
        launchpad.onShow = { [weak self] in self?.snapshotActiveTab() }
        launchpadGestures = LaunchpadGestureMonitor(launchpad: launchpad) { [weak self] gesture in
            self?.hear(gesture)
        }
        page.onWindowTabsReported = { [weak self] strip in self?.take(strip) }
        page.onTreeReported = { [weak self] listing in self?.sidebar.take(listing) }
        page.onTreeStateReported = { [weak self] state in self?.sidebar.take(state) }
        page.onSessionsReported = { [weak self] list in self?.sessions = list }
        page.onDockReported = { [weak self] state in self?.take(dock: state) }
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
        let base = CodeSurface.forHref(page.href)?.opensFiles == true ? page.href : Href.review
        showOnCodeTab(Href.file(file, line: line, on: base))
    }

    // MARK: search

    func findFile() {
        guard hasProject, !launchpad.isShown else { return }
        search.open(.files)
    }

    /// ⌘⇧F: the grep, opening on whatever the page has highlighted, so the
    /// chord over a word searches for it.
    func findInFiles() {
        guard hasProject, !launchpad.isShown else { return }
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

    /// The sidebar acted on a row of the page's sessions list — see
    /// `SessionAction`. A pick sends the page to that session, the way a
    /// file picked in the tree is carried to the page.
    func act(onSessions action: SessionAction) {
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
        launchpad.cards = strip.tabs.count
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
        guard hasProject else { return }
        launchpad.toggle()
    }

    /// The trackpad over the bar, or over the panel — see
    /// `LaunchpadGestureMonitor`. Nothing to lay out without a project, so
    /// the gestures wait for one as the button and the chord do.
    private func hear(_ gesture: LaunchpadGesture) {
        guard hasProject else { return }
        switch gesture {
        case .swipeDown: launchpad.open()
        case .swipeUp: launchpad.close()
        case .pullBegan: launchpad.beginPull()
        case .pulled(let travel): launchpad.pull(travel: travel)
        case .pullEnded: launchpad.endPull()
        }
    }

    /// Leaving a tab takes its picture first, so the launchpad shows it as
    /// it was; then the strip is asked to switch, and the launchpad — which
    /// the ask may have come from — is put away.
    private func leaveTab(_ switching: @escaping (IslandHost) -> Void) {
        let leaving = windowTabs.activeId
        launchpad.close()
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

    /// ⌘B: the pane put away, or brought back on the surface it was on —
    /// and the island's dock down with that, the foot being one thing's.
    func toggleBottomPane() {
        if bottomExpanded {
            bottomExpanded = false
        } else {
            show(bottomTab: bottomTab)
        }
    }

    func show(bottomTab tab: BottomPaneTab) {
        bottomTab = tab
        bottomExpanded = true
        if dock.isUp { page.send(DockAction.close) }
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

    // MARK: dock

    /// A rail button for one of the dock's surfaces: the web rail's own
    /// press, sent to the island that keeps the dock — it opens the surface,
    /// or with that surface already up puts the drawer away — and the pane
    /// put away first, so the two never stack at the foot of the window.
    func toggle(dock surface: DockSurface) {
        bottomExpanded = false
        page.send(DockAction.pick(surface))
    }

    /// The island says what its dock shows. Up — by the rail, or by the page
    /// itself, a find-usages opened from a file — it takes the foot of the
    /// window from the pane.
    private func take(dock state: DockState) {
        dock = state
        if state.isUp { bottomExpanded = false }
    }

}
