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
import ReviewerShared
import WebKit

enum ConnectionState: Equatable {
    case starting
    case ready
    case failed(String)
}

@MainActor
@Observable
final class AppModel {
    /// The server, unscoped — for what is about no one repository: the
    /// workspace itself, the index of repositories, the sessions.
    let server: ReviewerClient
    /// Where the window's code runs — the server above; this Mac until
    /// cloud environments are.
    let environment = ReviewerEnvironment.thisMac
    /// A new workspace asked for from outside the opener — the toolbar
    /// chip's popover — which the opener takes up when it comes up (see
    /// `RepoOpener`).
    var newWorkspaceAsked = false

    var connection: ConnectionState = .starting
    var workspace: WorkspaceInfo?
    /// Every repository of the workspace, in its order, each live at once.
    private(set) var roots: [RootModel] = []
    /// The repository the page is on — the one the window's own
    /// single-repository surfaces act on, as JetBrains acts on the
    /// repository of the file in front: the branch chip, the commit
    /// chords, the history, the palette's git commands. It follows the
    /// page's address (see `Href.repo(of:)`).
    private(set) var focusedRootPath: String?
    var branchPrompt: BranchPrompt?
    /// A refusal that stops a window from going on — a project that would
    /// not open — as an alert; everything that merely failed is a notice.
    var lastError: String?
    /// What the window has to say in passing — what a git action came to,
    /// a request refused — stacked over the islands (see `NoticeStack`).
    let notices = Notices()

    /// The window tabs as the island last reported them, for the menu bar.
    private(set) var windowTabs: WindowTabStrip = .empty
    /// The code page's file tree, as it last reported it, with the sidebar's
    /// own folds, search and selection over it.
    let sidebar = SidebarTree()
    /// The sessions list, as the page last reported it — on the sessions
    /// surface, where the sidebar draws this in the tree's place — and kept
    /// as it stood once the page leaves the surface and takes the list
    /// down, so the sidebar's list fades out whole (see `SidebarLayout`);
    /// the surface reports a fresh list on the way back in.
    private(set) var sessions: ShellSessions?
    /// The sessions surface itself — the conversation, the composer — drawn
    /// by the shell in the page's place while the island is on it, read
    /// from the server by the shell itself.
    let chats: Chats
    /// The review the page is holding for a hand-off, and the assign bar
    /// the shell floats over the page for it in the web bar's place.
    let reviewHandoff: ReviewHandoff
    /// The width of the files a pull request touches, down the left of its
    /// diff on its page (see `PullRequestPage`); the rule beside them
    /// resizes it.
    var pullTreeWidth: CGFloat = 280
    /// Bumped each time a comment is followed from the assign bar, for a
    /// pull request's page to scroll its overview away and show the diff
    /// the page is scrolling to the comment in.
    private(set) var commentJumps = 0
    /// Whether the system's sidebar column is out; the split view's own
    /// toggle and the View menu both move it.
    var sidebarShown = true
    /// The pane stays put away until asked for: a project opens on its
    /// page alone, and the pane is a keystroke or a rail click away. It
    /// comes up on Branches, the leftmost surface, until a surface is
    /// picked; from then on it returns to the one it was left on.
    var bottomExpanded = false
    var bottomTab: BottomPaneTab = .branches
    var bottomHeight: CGFloat = 280
    /// The SPA's routed page, with the window tabs along its top.
    let page: IslandHost
    /// The bottom pane's History: the commit log, its filters and the
    /// commit picked out of it.
    let history: CommitHistory
    /// The palette — ⌘E's commands, a file by name, a grep of the working
    /// tree, the git actions and the branches.
    let palette: CommandPalette
    /// The repositories the machine holds, for the opener to list.
    let catalog: RepoCatalog
    /// The settings window's own: the theme, and who the app works as.
    let settings: AppSettings
    /// The app's own actions that move HEAD and re-read the project once
    /// they are through — while any is running, the watcher's word that
    /// HEAD moved is already answered for.
    @ObservationIgnored var headMovesInFlight = 0
    /// Each repository's compare-picker answer as its review page's address
    /// last held it, and the branch it was picked on — what the rail's
    /// Review goes back to, so a trip to Browse does not hand the diff back
    /// to the aim.
    @ObservationIgnored private var reviewComparisons: [String: (branch: String, target: String)] = [:]
    /// The branch each repository was last read on — what a fresh read is
    /// measured against to tell that the branch has moved under the review.
    @ObservationIgnored private var lastCheckouts: [String: String] = [:]
    /// What the window's per-repository surfaces stand on while nothing is
    /// open — never watched, never read.
    @ObservationIgnored private let detachedRoot: RootModel

    init(client: ReviewerClient = ReviewerClient(baseURL: ServerLauncher.shared.baseURL)) {
        server = client
        let source = SpaSource.resolve()
        page = IslandHost(kind: .code, href: Href.browsePath, source: source, apiBaseURL: client.baseURL)
        detachedRoot = RootModel(root: WorkspaceRoot(path: "", name: "", branch: nil), client: client)
        chats = Chats(client: client)
        reviewHandoff = ReviewHandoff(client: client, chats: chats)
        history = CommitHistory(client: client)
        palette = CommandPalette(client: client)
        catalog = RepoCatalog(client: client)
        settings = AppSettings(client: client)
        palette.onOpen = { [weak self] path, line in self?.open(paletteFile: path, line: line) }
        palette.onIntent = { [weak self] path in
            guard let self, let (root, file) = locate(paletteFile: path), root === focusedRoot else { return }
            page.send(TreeAction.intent(file))
        }
        palette.scopesSource = { [weak self] in self?.paletteScopes ?? [] }
        palette.onCheckout = { [weak self] ref in self?.checkout(ref) }
        palette.commandSource = { [weak self] in self?.paletteCommands() ?? [] }
        palette.branchSource = { [weak self] in self?.paletteBranches() ?? [] }
        page.onNavigated = { [weak self] href in
            self?.focus(onPageAt: href)
            self?.chats.follow(href: href)
            self?.rememberComparison(on: href)
        }
        chats.onListChanged = { [weak self] in self?.page.send(SessionAction.refetch) }
        page.onWindowTabsReported = { [weak self] strip in self?.take(strip) }
        page.onTreeReported = { [weak self] listing in
            self?.sidebar.take(listing)
            self?.treeReported()
        }
        page.onTreeStateReported = { [weak self] state in
            self?.sidebar.take(state)
            self?.treeReported()
        }
        page.onSessionsReported = { [weak self] list in
            // The page reports on every change to what it holds, and most
            // reports carry the list as it already stands; the sidebar is
            // only invalidated by one that moved something.
            if let list, list != self?.sessions { self?.sessions = list }
        }
        page.onHistoryRequested = { [weak self] path in self?.showHistory(of: path) }
        page.onReviewReported = { [weak self] review in self?.reviewHandoff.take(review) }
        page.onOpenRequested = { [weak self] target in self?.open(target) }
        page.onOpenDirectory = { [weak self] in self?.askForProjectFolder() }
        catalog.onChanged = { [weak self] in self?.publishWidgetFeed() }
        ProjectLinks.shared.handler = { [weak self] request in self?.open(link: request) }
    }

    var hasProject: Bool { !(workspace?.roots.isEmpty ?? true) }

    // MARK: roots

    /// The repository the page is on, or nil while nothing is open.
    var focusedRoot: RootModel? {
        roots.first { $0.path == focusedRootPath } ?? roots.first
    }

    /// The focused root, or a detached stand-in while nothing is open, for
    /// the surfaces that read one repository's state unconditionally.
    var focused: RootModel { focusedRoot ?? detachedRoot }

    /// The server, about the focused root — what every action of the
    /// window's single-repository surfaces is sent through.
    var client: ReviewerClient { focused.client }

    var status: RepoStatus? {
        get { focused.status }
        set { focused.status = newValue }
    }

    var branches: [BranchInfo] {
        get { focused.branches }
        set { focused.branches = newValue }
    }

    var remoteBranches: [RemoteBranchInfo] {
        get { focused.remoteBranches }
        set { focused.remoteBranches = newValue }
    }

    var services: DevServices { focused.services }

    /// The repository whose dev command the Run pane has picked — the one
    /// its output and its Add stand for; the focused root until one is.
    var runRootPath: String?
    var runRoot: RootModel { root(at: runRootPath) ?? focused }
    var threads: Threads { focused.threads }
    var pullRequests: PullRequests { focused.pullRequests }

    func root(at path: String?) -> RootModel? {
        guard let path else { return nil }
        return roots.first { $0.path == path }
    }

    /// The roots as the workspace now lists them: one already open is kept
    /// as it stands — its terminals attached, its dev commands' output
    /// streaming — a new one opened and watched, and one that left closed.
    private func syncRoots() {
        let open = workspace?.roots ?? []
        let kept = open.map { root -> RootModel in
            if let existing = roots.first(where: { $0.path == root.path }) {
                existing.remember(branch: root.branch)
                return existing
            }
            let model = RootModel(root: root, client: server)
            model.onHeadMoved = { [weak self] root in
                Task { await self?.followHead(of: root) }
            }
            model.onWorktreeChanged = { [weak self] root in self?.worktreeChanged(in: root) }
            model.onListingChanged = { [weak self] _ in self?.publishRootsToSidebar() }
            model.startWatching()
            return model
        }
        for gone in roots where !kept.contains(where: { $0 === gone }) {
            gone.close()
            reviewComparisons[gone.path] = nil
            lastCheckouts[gone.path] = nil
        }
        roots = kept
        if root(at: focusedRootPath) == nil { focus(on: kept.first?.path) }
        publishRootsToSidebar()
    }

    /// The sidebar's tree told how the workspace's repositories now stand.
    private func publishRootsToSidebar() {
        sidebar.take(roots: roots.map(\.treeRoot))
    }

    /// The page moved: the root it is on now is the focused one. An address
    /// that names none is the workspace's first.
    private func focus(onPageAt href: String) {
        focus(on: Href.repo(of: href) ?? roots.first?.path)
    }

    /// The window's single-repository surfaces turned to `path`: the
    /// history, the palette, the composer and the settings read it from
    /// now on, each starting over on it rather than showing what the last
    /// root answered.
    private func focus(on path: String?) {
        guard path != focusedRootPath else { return }
        focusedRootPath = path
        let scoped = client
        history.client = scoped
        palette.client = scoped
        chats.client = scoped
        reviewHandoff.client = scoped
        settings.client = scoped
        palette.projectChanged()
        history.projectChanged(project: focusedRoot?.path, head: status?.branch)
        sidebar.focusChanged(to: focusedRoot?.path)
    }

    /// A file of `root` changed on disk: its status and changed files read
    /// again, and the page told, when it is on that root.
    private func worktreeChanged(in root: RootModel) {
        if root === focusedRoot { page.worktreeChanged() }
        Task { await root.refreshWorktree() }
    }

    /// The server has answered, and remembers no open project: the window
    /// to be on is the welcome, not the workspace (see `ReviewerApp`).
    var awaitingProject: Bool { workspace != nil && !hasProject }

    /// How many projects have been opened this run — the opener window
    /// watches it, since a project opened over one already open changes
    /// nothing else it could watch.
    private(set) var projectOpens = 0
    /// How many times the opener has been asked for — ⌘O, the palette —
    /// which the workspace window answers by bringing it up, being the one
    /// with a scene to open (see `ContentView`).
    private(set) var openerRequests = 0
    /// How many times the settings window has been asked for from outside
    /// the menu bar — the palette — which the workspace window answers the
    /// same way (see `ContentView`).
    private(set) var settingsRequests = 0
    /// How many times the branch switcher has been asked for — ⇧⌘B, the
    /// palette — which the branch picker in front answers by opening its
    /// popover (see `BranchPicker`).
    private(set) var branchPickerRequests = 0
    /// The last thing the commit composer was asked to do from the menu bar
    /// or the palette — draft, commit, commit and push — which it answers
    /// with the files it has chosen, its message and its agent, all of
    /// them its own (see `CommitComposer`).
    private(set) var commitComposerRequest: CommitComposerRequest?

    // MARK: lifecycle

    func bootstrap() async {
        connection = .starting
        do {
            try await ServerLauncher.shared.ensureRunning()
            connection = .ready
            settings.paintThemes()
            if let request = linkedRequest, let path = request.path {
                linkedRequest = nil
                if request.run {
                    await openProjectAndRun(path: path)
                } else {
                    await openProject(path: path)
                }
            } else {
                await refresh()
                // A window the widget's Open and run opened beside this one
                // comes up on its project already (REVIEWER_REPO, see
                // `ServerLauncher.launchInstance`); the running is this
                // side's to start once the project is there.
                if hasProject, ProcessInfo.processInfo.environment["REVIEWER_RUN"] == "1" { runProject() }
            }
            catalog.load()
        } catch {
            connection = .failed(error.localizedDescription)
        }
    }

    /// Re-reads everything project-shaped, and tells the islands to. Cheap
    /// enough to call after any action that could have changed the branch or
    /// the sessions — a project switch, ⌘R.
    func refresh() async {
        do {
            workspace = try await server.workspace()
            syncRoots()
        } catch {
            notices.post(.error, error.localizedDescription)
        }
        await refreshProjectState()
        page.refresh()
    }

    /// One repository re-read after an action of its own — a checkout, a
    /// commit — and the page with it when it is on that one; the rest of
    /// the workspace has not moved.
    func refresh(root: RootModel) async {
        await root.refresh()
        resetComparisonIfCheckoutMoved()
        guard root === focusedRoot else { return }
        palette.projectChanged()
        history.projectChanged(project: root.path, head: root.branch)
        page.refresh()
    }

    /// A refresh that is over only once the page has reported the tree it
    /// re-read — for an action whose notice should land with the sidebar
    /// rather than seconds ahead of it (see `commit`).
    func refreshShowingTree() async {
        let seen = treeReports
        await refresh()
        await treeReport(after: seen)
    }

    /// How many times the page has reported its tree — counted rather than
    /// merely waited on, so a report that lands while the refresh is still
    /// running is not waited past.
    @ObservationIgnored private var treeReports = 0
    /// Those waiting on the page's next word about its tree, by the ticket
    /// each was given, so a wait that times out resumes only its own.
    @ObservationIgnored private var treeReportWaiters: [UUID: CheckedContinuation<Void, Never>] = [:]

    /// How long a wait on the tree holds before giving up: a page that
    /// reports nothing — one refreshed while it is loading, one whose tree
    /// the refresh left untouched — must not hold a notice loading forever.
    private static let treeReportWait: Duration = .seconds(5)

    /// The page's first report of its tree, or of what moves under it,
    /// since `seen` — the listing and the composer's changes the sidebar
    /// draws.
    private func treeReport(after seen: Int) async {
        guard treeReports == seen else { return }
        let ticket = UUID()
        let clock = Task { [weak self] in
            try? await Task.sleep(for: Self.treeReportWait)
            guard !Task.isCancelled else { return }
            self?.treeReportWaiters.removeValue(forKey: ticket)?.resume()
        }
        await withCheckedContinuation { continuation in
            treeReportWaiters[ticket] = continuation
        }
        clock.cancel()
    }

    private func treeReported() {
        treeReports += 1
        let waiting = treeReportWaiters
        treeReportWaiters.removeAll()
        for continuation in waiting.values { continuation.resume() }
    }

    /// HEAD moved under a repository outside the app — a checkout in a
    /// terminal: that repository re-read as after one of its own, unless the
    /// move is already being answered for, or a refresh has since read it.
    private func followHead(of root: RootModel) async {
        guard headMovesInFlight == 0, await root.headMoved() else { return }
        await refresh(root: root)
    }

    private func refreshProjectState() async {
        palette.projectChanged()
        guard hasProject else {
            history.projectChanged(project: nil, head: nil)
            return
        }
        await withTaskGroup(of: Void.self) { group in
            for root in roots {
                group.addTask { await root.refresh() }
            }
        }
        resetComparisonIfCheckoutMoved()
        history.projectChanged(project: focusedRoot?.path, head: status?.branch)
        await chats.refresh()
    }

    /// The page at a code address: what every native control that reaches
    /// for a code surface goes through. The strip hands the window to the
    /// Code tab as the page arrives there, the way it does for a link. An
    /// address that names no repository is the focused root's.
    func showOnCodeTab(_ href: String) {
        page.navigate(to: Href.scoped(href, to: focusedRootPath))
    }

    /// The page at a code address of `root` — the way to another repository
    /// of the workspace, which the page's arrival makes the focused one.
    func showOnCodeTab(_ href: String, in root: RootModel) {
        page.navigate(to: Href.moved(href, to: root.path))
    }

    /// The page turned to another repository, on the surface it is on: the
    /// same page of `root`, or its browse page where the surface is one
    /// repository's own thing — a pull request, a commit.
    func focus(root: RootModel) {
        guard root !== focusedRoot else { return }
        // Sessions are no one repository's page: the conversation stays
        // where it is, and only what a new session starts in moves.
        if onSessions { return page.navigate(to: Href.moved(page.href, to: root.path)) }
        let surface = codeSurface ?? .browse
        showOnCodeTab(surface == .review ? reviewHref(for: root.path) : surface.href, in: root)
    }

    func browse(file: String, line: Int?) {
        showOnCodeTab(Href.browseTab(file, line: line))
    }

    // MARK: palette scopes

    /// Each repository's key, the way the tree names its files, while the
    /// workspace holds more than one.
    private var rootKeys: [String: String] {
        roots.count > 1 ? SidebarTree.rootKeys(for: roots.map(\.treeRoot)) : [:]
    }

    /// The palette reaches into every repository of the workspace.
    private var paletteScopes: [PaletteScope] {
        let keys = rootKeys
        guard !keys.isEmpty else { return [PaletteScope(key: nil, client: client)] }
        return roots.map { PaletteScope(key: keys[$0.path], client: $0.client) }
    }

    /// A file the palette lists: its repository and its path there.
    private func locate(paletteFile path: String) -> (RootModel, String)? {
        let keys = rootKeys
        guard !keys.isEmpty else { return focusedRoot.map { ($0, path) } }
        let key = String(path.prefix { $0 != "/" })
        guard let root = roots.first(where: { keys[$0.path] == key }) else { return nil }
        return (root, String(path.dropFirst(key.count + 1)))
    }

    /// A file picked in the palette, opened in its own repository.
    private func open(paletteFile path: String, line: Int?) {
        guard let (root, file) = locate(paletteFile: path) else { return }
        if root === focusedRoot {
            browse(file: file, line: line)
        } else {
            showOnCodeTab(Href.browseTab(file, line: line), in: root)
        }
    }

    // MARK: palette

    /// ⌘E: the command list, or with it already up, away again.
    func showCommands() {
        guard hasProject else { return }
        palette.toggleCommands()
    }

    func findFile() {
        guard hasProject else { return }
        palette.open(.files)
    }

    /// The page's empty pane lists the gestures with their chords; a click
    /// on one does what the chord does.
    func open(_ target: OpenTarget) {
        switch target {
        case .commands: showCommands()
        case .files: findFile()
        case .text: findInFiles()
        case .settings: showSettings()
        }
    }

    /// ⌘⇧F: the grep, opening on whatever the page has highlighted, so the
    /// chord over a word searches for it.
    func findInFiles() {
        guard hasProject else { return }
        Task {
            palette.open(.text, seed: Self.seed(fromSelection: await page.selectedText()))
        }
    }

    /// What ⌘F finds on the page the window is on: over a diff — your own
    /// changes, or a pull request's — the files it touches, by the filter
    /// over them; on the browse page, the open file, by the page's own find
    /// bar. Elsewhere there is nothing for it to find.
    var findTarget: FindTarget? {
        guard hasProject else { return nil }
        if reviewingPull != nil { return .changedFiles }
        switch sidebarLayout {
        case .files(changes: true): return .changedFiles
        case .files(changes: false): return .openFile
        case .pulls, .sessions, .nothing: return nil
        }
    }

    /// ⌘F. Over a diff the filter takes the keyboard, starting from whatever
    /// the page has highlighted, the way ⌘⇧F seeds its box — the sidebar
    /// brought out first if it was put away. A pull request's files stand
    /// beside its diff rather than in the sidebar, so they need no column.
    func find() {
        switch findTarget {
        case .changedFiles:
            Task {
                let seed = Self.seed(fromSelection: await page.selectedText())
                if !seed.isEmpty { sidebar.query = seed }
                if reviewingPull == nil && !sidebarShown { toggleSidebar() }
                sidebar.filterWantsKeyboard = true
            }
        case .openFile:
            page.find()
        case nil:
            return
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

    /// ⌃⌘S — the system's own chord for it — from the View menu, the
    /// palette and the bar's toggle: the column put away, or brought back.
    /// Asked of the window's split view controller, as the split's own
    /// toggle asks it, so the column slides at AppKit's pace and on its
    /// curve — flipping the switch alone moved it with none of that — and
    /// the split hands the result back through the column binding. Aimed at
    /// the controller rather than sent up the responder chain, which only
    /// reaches it from a view inside the split: not from the palette's
    /// field, nor with nothing focused. The switch is flipped here only
    /// when there is no split to ask.
    func toggleSidebar() {
        if let split = (NSApp.keyWindow ?? NSApp.mainWindow)?.contentView.flatMap(Self.splitController(in:)) {
            split.toggleSidebar(nil)
        } else {
            sidebarShown.toggle()
        }
    }

    private static func splitController(in view: NSView) -> NSSplitViewController? {
        if let split = view as? NSSplitView, let controller = split.delegate as? NSSplitViewController {
            return controller
        }
        return view.subviews.lazy.compactMap(splitController(in:)).first
    }

    /// Which page the window is on — its address without the query, which
    /// says what is picked there, not where it is.
    var pagePath: String {
        URLComponents(string: page.href)?.path ?? page.href
    }

    /// The sidebar's rail: which of the code surfaces the page is on, as
    /// its address says.
    var codeSurface: CodeSurface? {
        CodeSurface.forHref(page.href)
    }

    /// A rail button: the Code tab, on that surface — and the tree with it,
    /// since the page reports the tree of whatever surface it is on.
    func show(surface: CodeSurface) {
        showOnCodeTab(surface == .review ? reviewHref(for: focusedRootPath) : surface.href)
    }

    /// The review page of the repository at `path`, read against what it
    /// was last read against there.
    private func reviewHref(for path: String?) -> String {
        guard let path, let comparison = reviewComparisons[path] else { return Href.review }
        var components = URLComponents()
        components.path = Href.review
        components.queryItems = [URLQueryItem(name: "target", value: comparison.target)]
        return components.string ?? Href.review
    }

    /// Only the review page's own address says what the diff is read
    /// against; one without a target leaves it to the aim again.
    private func rememberComparison(on href: String) {
        guard let components = URLComponents(string: href), components.path == Href.review,
              let root = root(at: Href.repo(of: href)) ?? roots.first else { return }
        reviewComparisons[root.path] = components.queryItems?
            .first { $0.name == "target" }?.value
            .map { (branch: root.branch ?? "", target: $0) }
    }

    /// A comparison — picked, or the aim answering for want of one — was for
    /// the branch its repository was on; once checkout moves there, its
    /// review drops back to what is uncommitted, so the new branch's aim
    /// does not answer either. The web header does this itself, but the
    /// island draws no header. A read that could not say which branch is
    /// checked out moves nothing.
    private func resetComparisonIfCheckoutMoved() {
        for root in roots {
            guard let branch = root.status?.branch else { continue }
            defer { lastCheckouts[root.path] = branch }
            guard let last = lastCheckouts[root.path], last != branch else { continue }
            reviewComparisons[root.path] = (branch: branch, target: "")
            if root === focusedRoot, URLComponents(string: page.href)?.path == Href.review {
                readChanges(against: nil)
            }
        }
    }

    /// Whether the page is anywhere inside Sessions — the composer, a
    /// conversation, the landing — where the shell draws the page natively
    /// and the sidebar holds the list.
    var onSessions: Bool {
        let path = URLComponents(string: page.href)?.path ?? ""
        return path == SessionsPage.sessionsPath || path.hasPrefix("\(SessionsPage.sessionsPath)/")
    }

    /// What the sidebar's column holds, by the page's address: the merge
    /// requests, the tree in one of its two forms, the sessions, or nothing
    /// — the one reading the sidebar lays itself out from, whatever the page
    /// has reported so far (see `SidebarLayout`). The merge requests are
    /// read ahead of the tree: the page reports a tree for the pull request
    /// it is on, and on that surface the tree stands beside the sidebar.
    var sidebarLayout: SidebarLayout {
        if onSessions { return .sessions }
        switch codeSurface {
        case .reviews: return .pulls
        case .browse: return .files(changes: false)
        case .review: return .files(changes: true)
        case nil: return .nothing
        }
    }

    /// Whether the rail stands. Its buttons are the code surfaces' and the
    /// bottom pane's; on the sessions surface the web rail carries the
    /// list's own controls instead, and here those stand at the head of
    /// the sidebar's list (see `SessionsList`), so the column has nothing
    /// left to hold and collapses — the way the web rail leaves the
    /// composer to the window on ⌘T.
    var railShown: Bool { !onSessions }

    /// The sidebar acted on a row of the page's tree — see `TreeAction`. A
    /// file's history is the pane's own to show, and the git actions are
    /// run here against the server, so their notices are the window's;
    /// what is left is the page's to carry out.
    func act(onTree action: TreeAction) {
        switch action {
        case .select(let id):
            open(treeRow: id)
        case .intent(let id):
            // Only the page's own repository can be read ahead: a row of
            // another is a move of the whole page, made on the click.
            if let (root, path) = sidebar.locate(id), root == focusedRootPath {
                page.send(TreeAction.intent(path))
            }
        case .history(let id):
            guard let (path, file) = sidebar.locate(id), let root = root(at: path) else { return }
            if root !== focusedRoot { showOnCodeTab(Href.browseTab(file, line: nil), in: root) }
            showHistory(of: file, in: root)
        case .commit(let message, let ids, let push):
            commit(message: message, paths: ids, andPush: push)
        case .discard(let ids):
            discard(paths: ids)
        case .draft(let ids, let agent):
            // The draft is the page's, of its repository's chosen files.
            page.send(TreeAction.draft(paths: paths(in: focusedRoot, of: ids), agent: agent))
        case .draftSettled:
            page.send(action)
        }
    }

    /// A row of the tree picked: the page on that file — the page's own
    /// repository's, or another's, which the page's arrival focuses. Over
    /// a diff the file is opened in that repository's diff; a repository's
    /// header turns the page to it.
    private func open(treeRow id: String) {
        guard let (path, file) = sidebar.locate(id), let root = root(at: path) else { return }
        if file.isEmpty { return focus(root: root) }
        if root === focusedRoot { return page.send(TreeAction.select(file)) }
        if sidebarLayout == .files(changes: true) {
            var components = URLComponents()
            components.path = Href.review
            components.queryItems = [URLQueryItem(name: "path", value: file)]
            showOnCodeTab(components.string ?? Href.review, in: root)
        } else {
            showOnCodeTab(Href.browseTab(file, line: nil), in: root)
        }
    }

    /// The tree's rows grouped by the repository each is in, in the
    /// workspace's order — what a commit or a discard over several is.
    private func byRoot(_ ids: [String]) -> [(root: RootModel, paths: [String])] {
        var grouped: [String: [String]] = [:]
        for id in ids {
            guard let (root, path) = sidebar.locate(id), !path.isEmpty else { continue }
            grouped[root, default: []].append(path)
        }
        return roots.compactMap { root in grouped[root.path].map { (root, $0) } }
    }

    private func paths(in root: RootModel?, of ids: [String]) -> [String] {
        byRoot(ids).first { $0.root === root }?.paths ?? []
    }

    /// The composer's Commit: the chosen paths under the message, then the
    /// push when asked for — one notice for the run, the way the web app
    /// reports it: a commit that landed is said so even when the push after
    /// it did not, since the work is safe and only the remote is behind.
    /// Files of several repositories make a commit in each, under the one
    /// message, the way a JetBrains commit across roots does — each pushed
    /// when asked, and the notice naming them. The notice stays the attempt
    /// until the sidebar has caught up — a push is a push while git is
    /// working, and a commit is a commit until the files it took are gone
    /// from the tree, which is the refresh, not the server's answer;
    /// settled any earlier, "Committed" would stand over a composer still
    /// holding the committed files.
    func commit(message: String, paths ids: [String], andPush push: Bool) {
        let groups = byRoot(ids)
        guard !groups.isEmpty else { return }
        let named = groups.count > 1
        Task {
            let id = notices.post(.loading, "Committing…")
            var landed: [String] = []
            var pushFailure: Error?
            for group in groups {
                let label = named ? "\(group.root.name) " : ""
                do {
                    let sha = try await group.root.client.commit(message: message, paths: group.paths)
                    landed.append("\(label)\(sha)")
                } catch {
                    let done = landed.isEmpty ? "" : " after committing \(landed.joined(separator: ", "))"
                    notices.settle(id, failed: "Commit\(named ? " in \(group.root.name)" : "") failed\(done)", with: error)
                    await refreshShowingTree()
                    return
                }
                if push {
                    notices.settle(id, .loading, "Committed \(landed.joined(separator: ", ")), pushing…")
                    do {
                        _ = try await group.root.client.push()
                    } catch {
                        pushFailure = pushFailure ?? error
                    }
                }
            }
            let summary = landed.joined(separator: ", ")
            await refreshShowingTree()
            if let pushFailure {
                notices.settle(id, failed: "Committed \(summary), but push failed", with: pushFailure)
            } else {
                notices.settle(id, .success, push ? "Committed \(summary) and pushed" : "Committed \(summary)")
            }
        }
    }

    /// The tree's Discard, already confirmed by the outline's own prompt —
    /// in each repository the rows are in.
    func discard(paths ids: [String]) {
        let groups = byRoot(ids)
        let count = groups.reduce(0) { $0 + $1.paths.count }
        guard count > 0 else { return }
        Task {
            let named = count == 1 ? "changes in \(groups[0].paths[0])" : "changes in \(count) files"
            await notices.run("Discarding \(named)…", done: "Discarded \(named)", failed: "Discard failed") {
                for group in groups {
                    try await group.root.client.discard(paths: group.paths)
                }
                return nil
            }
            await refresh()
        }
    }

    /// The sidebar acted on a row of the page's sessions list — see
    /// `SessionAction`. A pick sends the page to that session, the way a
    /// file picked in the tree is carried to the page.
    func act(onSessions action: SessionAction) {
        page.send(action)
    }

    /// A session just started natively: the page on its conversation. The
    /// tab follows the address — a session's own tab keeps it, the Sessions
    /// tab shows it — the way the web composer's navigate is followed.
    func show(chat: Chat) {
        page.navigate(to: Href.scoped(SessionsPage.href(of: chat.id), to: focusedRootPath))
    }

    // MARK: merge requests

    /// The pull request the page is reading, by its address — as the list
    /// has it, or by its number alone until the list answers. Nil on every
    /// other page, the merge requests with none picked included.
    var reviewingPull: PullRequestInfo? {
        Href.pullNumber(of: page.href).map { pullRequests.pull(numbered: $0) }
    }

    /// A row of the sidebar's list picked: the page on that pull request's
    /// diff, the overview and its files standing up beside it.
    func show(pull: PullRequestInfo) {
        showOnCodeTab(Href.pull(pull.number))
    }

    /// Back to the list with nothing picked — where a merged or closed pull
    /// request leaves the window, since nothing on its page is true any
    /// more, and where the merged row disappearing is worth seeing.
    func leavePull() {
        showOnCodeTab(Href.reviews)
    }

    /// The pull request's page on GitHub, in the default browser — the
    /// window having no address bar to come back with.
    func open(pull: PullRequestInfo) {
        guard let url = URL(string: pull.url) else { return }
        NSWorkspace.shared.open(url)
    }

    func copyLink(of pull: PullRequestInfo) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(pull.url, forType: .string)
    }

    /// Fetch the pull request's head and check it out as its local branch;
    /// the branch changing under the diff, everything is re-read after.
    func checkout(pull: PullRequestInfo) {
        Task {
            headMovesInFlight += 1
            defer { headMovesInFlight -= 1 }
            await notices.run("Checking out #\(pull.number)…", done: "Checked out \(pull.localBranch)", failed: "Checkout of #\(pull.number) failed") {
                _ = try await pullRequests.checkout(pull, as: pull.localBranch)
                return nil
            }
            await refresh()
        }
    }

    /// Land the pull request on GitHub, already confirmed by the overview.
    /// Once it has gone through, its page is left for the list.
    func merge(pull: PullRequestInfo, method: MergeMethod) {
        Task {
            let merged = await notices.run("Merging #\(pull.number)…", done: "Merged #\(pull.number)", failed: "Merge of #\(pull.number) failed") {
                try await pullRequests.merge(pull, method: method)
            }
            if merged { leavePull() }
            await pullRequests.reload()
        }
    }

    /// Close the pull request without merging it, already confirmed by the
    /// overview; the closed one leaves the open list the way a merged one
    /// does, and so does its page.
    func close(pull: PullRequestInfo) {
        Task {
            let closed = await notices.run("Closing #\(pull.number)…", done: "Closed #\(pull.number)", failed: "Could not close #\(pull.number)") {
                try await pullRequests.close(pull)
            }
            if closed { leavePull() }
            await pullRequests.reload()
        }
    }


    // MARK: project

    /// A repository opened on its own, as a workspace of one.
    @discardableResult
    func openProject(path: String) async -> Bool {
        await open { try await self.server.openProject(path: path) }
    }

    /// Every repository of a saved workspace opened side by side.
    @discardableResult
    func openWorkspace(id: String) async -> Bool {
        await open { try await self.server.openWorkspace(id: id) }
    }

    /// A workspace opens on its first repository's browse page — the tree of
    /// what it holds — whatever the last one was showing.
    private func open(_ opening: () async throws -> WorkspaceInfo) async -> Bool {
        do {
            workspace = try await opening()
            syncRoots()
            bottomExpanded = false
            // Everything the page holds is the workspace just left — its
            // files, its branch, the strip of files it had open — so it is
            // told to re-ask before it is sent anywhere. Arriving on the
            // browse page still answering for the old repository is how one
            // project's file ends up opened in another's; the refresh at the
            // end of this comes too late for that, being several round trips
            // away.
            page.refresh()
            if let first = roots.first { showOnCodeTab(Href.browsePath, in: first) }
            await refresh()
            projectOpens += 1
            catalog.load()
            return true
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    /// The open workspace's repositories replaced — one added beside the
    /// others, one taken out, the order changed. A saved workspace keeps
    /// them, so it opens the same way next time.
    func setRoots(_ paths: [String]) async {
        do {
            workspace = try await server.setRoots(paths)
            syncRoots()
            await refresh()
            catalog.load()
        } catch {
            notices.post(.error, error.localizedDescription)
        }
    }

    /// A repository opened beside the ones already open.
    func addRoot(_ path: String) async {
        let open = workspace?.roots.map(\.path) ?? []
        guard !open.contains(path) else { return }
        await setRoots(open + [path])
    }

    /// A repository taken out of the workspace; its dev commands stop.
    func removeRoot(_ root: RootModel) async {
        let rest = roots.map(\.path).filter { $0 != root.path }
        guard !rest.isEmpty else { return }
        if root === focusedRoot, let next = roots.first(where: { $0 !== root }) {
            showOnCodeTab(Href.browsePath, in: next)
        }
        await setRoots(rest)
    }

    /// The folder panel, for a repository to open beside the others.
    func chooseRootToAdd() {
        guard let path = askForProjectFolder() else { return }
        Task { await addRoot(path) }
    }

    /// A new workspace of `roots`, kept under `name` — opened at once when
    /// asked, as the opener's New workspace does.
    @discardableResult
    func createWorkspace(name: String, roots: [String], open: Bool) async -> Bool {
        do {
            let created = try await catalog.createWorkspace(name: name, roots: roots)
            return open ? await openWorkspace(id: created.id) : true
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    /// The window's ask for a name to keep the repositories open now under
    /// — the File menu's Save as workspace (see `SaveWorkspaceSheet`).
    private(set) var saveWorkspaceRequests = 0

    func askToSaveWorkspace() {
        guard hasProject, workspace?.workspace == nil else { return }
        saveWorkspaceRequests += 1
    }

    /// The repositories open now kept as a workspace, and that workspace
    /// made the open one, so later changes to the roots are kept with it.
    func saveWorkspace(named name: String) async {
        let paths = roots.map(\.path)
        do {
            let created = try await catalog.createWorkspace(name: name, roots: paths)
            workspace = try await server.openWorkspace(id: created.id)
            syncRoots()
        } catch {
            notices.post(.error, error.localizedDescription)
        }
    }

    /// A project named by a `reviewer://open` link — a click on the widget.
    /// A window holds one project, so a link that names another one while
    /// this window has its own opens a window beside it rather than taking
    /// this one away: several projects at once is what the widget is for.
    /// An empty window takes the project itself — the app launched by the
    /// click is that window, and its link is held for `bootstrap` while
    /// the server is still coming up. The project already open here stays
    /// where it is, and only runs if that is what the click asked for. A
    /// bare launch brings the app forward and no more.
    func open(link request: ProjectLink.Request) {
        NSApp.activate()
        guard let path = request.path else { return }
        guard connection == .ready else {
            linkedRequest = request
            return
        }
        if let root = root(at: path) {
            if request.run { run(root) }
        } else if hasProject {
            openProjectInNewWindow(path: path, run: request.run)
        } else {
            Task {
                if request.run {
                    await openProjectAndRun(path: path)
                } else {
                    await openProject(path: path)
                }
            }
        }
    }

    /// What a link asked for before the server was up (see `open(link:)`).
    private var linkedRequest: ProjectLink.Request?

    /// The widget's feed: the catalog's rows and stars, and the open
    /// project (see `ProjectWidgetFeed`).
    private func publishWidgetFeed() {
        ProjectWidgetFeed.publish(rows: catalog.rows, favorites: catalog.favorites, current: roots.first?.path)
    }

    /// The opener's Open and Run: the project opened, then every one of its
    /// dev commands started, with the Run surface up to show them coming up.
    func openProjectAndRun(path: String) async {
        guard await openProject(path: path) else { return }
        runProject()
    }

    /// The running half of Open and run, for the workspace already open:
    /// every dev command of every repository started, with the Run surface
    /// up to show them — the environment the workspace is, up at once.
    func runProject() {
        Task {
            await withTaskGroup(of: Void.self) { group in
                for root in roots {
                    group.addTask { await root.services.startAll() }
                }
            }
            show(bottomTab: .run)
        }
    }

    /// One repository's dev commands started, with the Run surface up.
    func run(_ root: RootModel) {
        Task {
            await root.services.startAll()
            show(bottomTab: .run)
        }
    }

    /// The opener: every repository the machine holds, to pick one from.
    func showOpener() {
        openerRequests += 1
    }

    /// The settings window, as ⌘, brings it up.
    func showSettings() {
        settingsRequests += 1
    }

    /// ⇧⌘B, the TUI's branch switcher: the popover of the branch chip on
    /// screen — the sidebar's, or the session bar's. With neither in view —
    /// the sidebar put away, a page with no sidebar — the palette's branch
    /// list stands in, rather than a popover hanging off nothing.
    func showBranchPicker() {
        guard hasProject else { return }
        if branchChipShown {
            branchPickerRequests += 1
        } else {
            palette.open(.branches)
        }
    }

    private var branchChipShown: Bool {
        switch sidebarLayout {
        case .pulls, .files: sidebarShown
        case .sessions: chats.page != nil && chats.page != .landing
        case .nothing: false
        }
    }

    /// Whether the commit chords have a composer to answer them: your own
    /// changes, with the commit composer under them.
    var hasCommitComposer: Bool {
        sidebarLayout == .files(changes: true) && sidebar.commit != nil
    }

    /// ⌃G, ⌘K, ⌥⌘K — the chords the TUI shares — handed to the commit
    /// composer, the sidebar brought out first if it was put away, so what
    /// they do is seen happening.
    func ask(commitComposer action: CommitComposerRequest.Action) {
        guard hasCommitComposer else { return }
        if !sidebarShown { toggleSidebar() }
        commitComposerRequest = CommitComposerRequest(action: action, serial: (commitComposerRequest?.serial ?? 0) + 1)
    }

    /// `path` in a Reviewer window of its own — a second instance of the
    /// app with a server of its own, since a server holds one project.
    func openProjectInNewWindow(path: String, run: Bool = false) {
        do {
            try ServerLauncher.shared.launchInstance(project: path, run: run)
        } catch {
            notices.post(.error, error.localizedDescription)
        }
    }

    /// The folder panel, for a repository the index does not list.
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
        panel.prompt = "Open repository"
        panel.message = "Choose a git repository."
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

    /// The strip as the island last drew it.
    private func take(_ strip: WindowTabStrip) {
        windowTabs = strip
    }

    func newSession() {
        guard hasProject else {
            notices.post(.info, "Open a project before starting an agent session")
            return
        }
        page.send(WindowTabAction.newSession)
    }

    func closeCurrentTab() {
        page.send(WindowTabAction.closeActive)
    }

    func select(tabId: String) {
        page.send(WindowTabAction.select(id: tabId))
    }

    func closeTab(id: String) {
        page.send(WindowTabAction.close(id: id))
    }

    /// A tab dropped on one side of `toId`, dragged along the toolbar (see
    /// `SessionTab`). A tab dropped where it already stands is no move, and
    /// the strip on the other side would answer it with the same strip back;
    /// the toolbar does not ask.
    func moveTab(id: String, beside toId: String, after: Bool) {
        guard id != toId else { return }
        page.send(WindowTabAction.move(id: id, toId: toId, after: after))
    }

    func selectNextTab(offset: Int) {
        page.send(WindowTabAction.step(offset))
    }

    /// ⌘G: across to the other way of working — Sessions from Code, Code
    /// from Sessions or a conversation — the strip's own rule for which.
    func switchMode() {
        guard windowTabs.canSwitchMode else { return }
        page.send(WindowTabAction.mode)
    }

    // MARK: bottom pane

    /// ⌘B: the pane put away, or brought back on the surface it was on.
    /// The island's find-usages drawer is the page's own and stays as it is.
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

    // MARK: history

    /// One file's past, from wherever it is asked for — the tree's menu, the
    /// page's own path bar: the History surface up, narrowed to that file.
    func showHistory(of path: String) {
        history.show(historyOf: path)
        show(bottomTab: .history)
    }

    /// One file's past in `root` — the history turned to that repository
    /// first, ahead of the page's arrival there, so it asks the right one.
    func showHistory(of path: String, in root: RootModel) {
        focus(on: root.path)
        showHistory(of: path)
    }

    /// The history turned to another repository of the workspace, the page
    /// with it — the pane's repository picker.
    func showHistory(in root: RootModel) {
        focus(root: root)
        focus(on: root.path)
        show(bottomTab: .history)
    }

    /// A commit picked out of the history: the page on its diff. A history
    /// narrowed to a file opens the commit on that file.
    func show(commit: CommitInfo) {
        showOnCodeTab(Href.commit(commit.sha, history: history.query.path))
    }

    /// A file of the selected commit: the commit's diff, on that file.
    func show(commitFile path: String) {
        guard let sha = history.selectedSha else { return }
        history.selectedFile = path
        showOnCodeTab(Href.commit(sha, path: path))
    }

    // MARK: review

    /// The assign bar acted on the page's review — see `ReviewAction`. All
    /// of it is the page's to carry out: the hand-off, the jump to a
    /// comment, a comment taken off the review.
    func act(onReview action: ReviewAction) {
        if case .open = action { commentJumps += 1 }
        page.send(action)
    }

}

/// What ⌘F reaches for — see `AppModel.findTarget`.
enum FindTarget {
    /// The filter over the files a diff touches.
    case changedFiles
    /// The find bar over the file the browse page has open.
    case openFile
}

/// One ask of the commit composer; the serial tells two of the same apart.
struct CommitComposerRequest: Equatable {
    enum Action {
        case draft
        case commit
        case commitAndPush
    }

    let action: Action
    let serial: Int
}
