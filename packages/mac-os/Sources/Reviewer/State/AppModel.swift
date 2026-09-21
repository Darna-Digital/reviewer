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
    /// The project's merge requests, read by the shell itself: the list the
    /// sidebar draws on that surface, and the overview beside a pull
    /// request's diff.
    let pullRequests: PullRequests
    /// The review the page is holding for a hand-off, and the assign bar
    /// the shell floats over the page for it in the web bar's place.
    let reviewHandoff: ReviewHandoff
    /// The width of the pull request's own column — its overview over its
    /// files — between the sidebar and the diff, and the height of the
    /// files under the overview; both resized by the seams beside them.
    var pullColumnWidth: CGFloat = 320
    var pullFilesHeight: CGFloat = 300
    /// Whether the system's sidebar column is out; the split view's own
    /// toggle and the View menu both move it.
    var sidebarShown = true
    /// The pane stays put away until asked for: a project opens on its
    /// page alone, and the pane is a keystroke or a rail click away.
    var bottomExpanded = false
    var bottomTab: BottomPaneTab = .terminal
    var bottomHeight: CGFloat = 280
    /// The find-usages drawer under the page island, as it last reported
    /// itself: the other thing that can stand at the foot of the window,
    /// one at a time with the pane above.
    private(set) var dock: DockState = .down

    /// The SPA's routed page, with the window tabs along its top.
    let page: IslandHost
    let threads: Threads
    let services: DevServices
    /// The bottom pane's History: the commit log, its filters and the
    /// commit picked out of it.
    let history: CommitHistory
    /// The palette — ⌘K's commands, a file by name, a grep of the working
    /// tree, the git actions and the branches.
    let palette: CommandPalette
    /// The repositories the machine holds, for the opener to list.
    let catalog: RepoCatalog
    @ObservationIgnored private var shiftTaps: ShiftTapMonitor?

    init(client: ReviewerClient = ReviewerClient(baseURL: ServerLauncher.shared.baseURL)) {
        self.client = client
        let source = SpaSource.resolve()
        page = IslandHost(kind: .code, href: Href.review, source: source, apiBaseURL: client.baseURL)
        services = DevServices(client: client)
        threads = Threads(client: client)
        pullRequests = PullRequests(client: client)
        chats = Chats(client: client)
        reviewHandoff = ReviewHandoff(client: client, chats: chats)
        history = CommitHistory(client: client)
        palette = CommandPalette(client: client)
        catalog = RepoCatalog(client: client)
        palette.onOpen = { [weak self] path, line in self?.show(file: path, line: line) }
        palette.onCheckout = { [weak self] ref in self?.checkout(ref) }
        palette.commandSource = { [weak self] in self?.paletteCommands() ?? [] }
        palette.branchSource = { [weak self] in self?.paletteBranches() ?? [] }
        // The web app keeps the gesture out of its inputs; here the one
        // input it could land in is the palette's own box, where two Shifts
        // in a row are typing, not a request to switch lists.
        shiftTaps = ShiftTapMonitor { [weak self] in
            guard let self, !palette.isShown else { return }
            findFile()
        }
        page.onNavigated = { [weak self] href in self?.chats.follow(href: href) }
        chats.onListChanged = { [weak self] in self?.page.send(SessionAction.refetch) }
        page.onWindowTabsReported = { [weak self] strip in self?.take(strip) }
        page.onTreeReported = { [weak self] listing in self?.sidebar.take(listing) }
        page.onTreeStateReported = { [weak self] state in self?.sidebar.take(state) }
        page.onSessionsReported = { [weak self] list in
            if let list { self?.sessions = list }
        }
        page.onDockReported = { [weak self] state in self?.take(dock: state) }
        page.onHistoryRequested = { [weak self] path in self?.showHistory(of: path) }
        page.onReviewReported = { [weak self] review in self?.reviewHandoff.take(review) }
        page.onOpenDirectory = { [weak self] in self?.askForProjectFolder() }
    }

    var hasProject: Bool { workspace?.project != nil }

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
        palette.projectChanged()
        guard hasProject else {
            status = nil
            branches = []
            remoteBranches = []
            history.projectChanged(project: nil, head: nil)
            await pullRequests.projectChanged(github: nil)
            return
        }
        status = try? await client.repoStatus()
        history.projectChanged(project: workspace?.project, head: status?.branch)
        await loadBranches()
        await services.load()
        await threads.load()
        let repo = try? await client.repoInfo()
        await pullRequests.projectChanged(github: repo?.github)
        await chats.refresh()
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
        let base = CodeSurface.opensFiles(page.href) ? page.href : Href.review
        showOnCodeTab(Href.file(file, line: line, on: base))
    }

    /// A file a reply links to: on the browse page, at the line, whatever
    /// the Code tab was showing — the agent names files as they are in the
    /// working tree, which is what the browse page reads.
    func browse(file: String, line: Int?) {
        showOnCodeTab(Href.file(file, line: line, on: Href.browsePath))
    }

    // MARK: palette

    /// ⌘K: the command list, or with it already up, away again.
    func showCommands() {
        guard hasProject else { return }
        palette.toggleCommands()
    }

    func findFile() {
        guard hasProject else { return }
        palette.open(.files)
    }

    /// ⌘⇧F: the grep, opening on whatever the page has highlighted, so the
    /// chord over a word searches for it.
    func findInFiles() {
        guard hasProject else { return }
        Task {
            let selected = try? await page.webView.evaluateJavaScript("window.getSelection().toString()") as? String
            palette.open(.text, seed: Self.seed(fromSelection: selected ?? ""))
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

    /// ⌃⌘S — the system's own chord for it — from the View menu and the
    /// palette: the column put away, or brought back.
    func toggleSidebar() {
        sidebarShown.toggle()
    }

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

    /// Whether the page is anywhere inside Sessions — the composer, a
    /// conversation, the landing, a cloud run — where the shell draws the
    /// page natively and the sidebar holds the list.
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
    /// file's history is the pane's own to show; everything else is the
    /// page's to carry out.
    func act(onTree action: TreeAction) {
        if case .history(let path) = action {
            showHistory(of: path)
            return
        }
        page.send(action)
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
        page.navigate(to: SessionsPage.href(of: chat.id))
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
            do {
                _ = try await pullRequests.checkout(pull, as: pull.localBranch)
            } catch {
                lastError = error.localizedDescription
            }
            await refresh()
        }
    }

    /// Land the pull request on GitHub, already confirmed by the overview.
    /// Once it has gone through, its page is left for the list.
    func merge(pull: PullRequestInfo, method: MergeMethod) {
        Task {
            do {
                _ = try await pullRequests.merge(pull, method: method)
                leavePull()
            } catch {
                lastError = error.localizedDescription
            }
            await pullRequests.reload()
        }
    }

    /// Close the pull request without merging it, already confirmed by the
    /// overview; the closed one leaves the open list the way a merged one
    /// does, and so does its page.
    func close(pull: PullRequestInfo) {
        Task {
            do {
                _ = try await pullRequests.close(pull)
                leavePull()
            } catch {
                lastError = error.localizedDescription
            }
            await pullRequests.reload()
        }
    }


    // MARK: project

    @discardableResult
    func openProject(path: String) async -> Bool {
        do {
            workspace = try await client.openProject(path: path)
            services.reset()
            threads.reset()
            bottomExpanded = false
            await refresh()
            projectOpens += 1
            return true
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    /// The opener's Open and Run: the project opened, then every one of its
    /// dev commands started, with the Run surface up to show them coming up.
    func openProjectAndRun(path: String) async {
        guard await openProject(path: path) else { return }
        await services.startAll()
        show(bottomTab: .run)
    }

    /// The opener: every repository the machine holds, to pick one from.
    func showOpener() {
        openerRequests += 1
    }

    /// `path` in a Reviewer window of its own — a second instance of the
    /// app with a server of its own, since a server holds one project.
    func openProjectInNewWindow(path: String) {
        do {
            try ServerLauncher.shared.launchInstance(project: path)
        } catch {
            lastError = error.localizedDescription
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
        panel.prompt = "Open Repository"
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
            lastError = "open a project before starting an agent session"
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

    // MARK: history

    /// One file's past, from wherever it is asked for — the tree's menu, the
    /// page's own path bar: the History surface up, narrowed to that file.
    func showHistory(of path: String) {
        history.show(historyOf: path)
        show(bottomTab: .history)
    }

    /// A commit picked out of the history: the page on its diff. A history
    /// narrowed to a file opens the commit on that file.
    func show(commit: CommitInfo) {
        showOnCodeTab(Href.commit(commit.sha, path: history.query.path))
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
        page.send(action)
    }

    // MARK: dock

    /// The island says whether its find-usages drawer is up. Up — opened by
    /// the page from a symbol in its code — it takes the foot of the window
    /// from the pane.
    private func take(dock state: DockState) {
        dock = state
        if state.isUp { bottomExpanded = false }
    }

}
