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
    let client: ReviewerClient

    var connection: ConnectionState = .starting
    var workspace: WorkspaceInfo?
    var status: RepoStatus?
    var branches: [BranchInfo] = []
    var remoteBranches: [RemoteBranchInfo] = []
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
    /// page alone, and the pane is a keystroke or a rail click away. It
    /// comes up on Branches, the leftmost surface, until a surface is
    /// picked; from then on it returns to the one it was left on.
    var bottomExpanded = false
    var bottomTab: BottomPaneTab = .branches
    var bottomHeight: CGFloat = 280
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
    /// The settings window's own: the theme, and who the app works as.
    let settings: AppSettings
    @ObservationIgnored private var shiftTaps: ShiftTapMonitor?

    init(client: ReviewerClient = ReviewerClient(baseURL: ServerLauncher.shared.baseURL)) {
        self.client = client
        let source = SpaSource.resolve()
        page = IslandHost(kind: .code, href: Href.browsePath, source: source, apiBaseURL: client.baseURL)
        services = DevServices(client: client)
        threads = Threads(client: client)
        pullRequests = PullRequests(client: client)
        chats = Chats(client: client)
        reviewHandoff = ReviewHandoff(client: client, chats: chats)
        history = CommitHistory(client: client)
        palette = CommandPalette(client: client)
        catalog = RepoCatalog(client: client)
        settings = AppSettings(client: client)
        palette.onOpen = { [weak self] path, line in self?.show(file: path, line: line) }
        palette.onIntent = { [weak self] path in self?.page.send(TreeAction.intent(path)) }
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
        page.onTreeReported = { [weak self] listing in
            self?.sidebar.take(listing)
            self?.treeReported()
        }
        page.onTreeStateReported = { [weak self] state in
            self?.sidebar.take(state)
            self?.treeReported()
        }
        page.onSessionsReported = { [weak self] list in
            if let list { self?.sessions = list }
        }
        page.onHistoryRequested = { [weak self] path in self?.showHistory(of: path) }
        page.onReviewReported = { [weak self] review in self?.reviewHandoff.take(review) }
        page.onOpenRequested = { [weak self] target in self?.open(target) }
        page.onOpenDirectory = { [weak self] in self?.askForProjectFolder() }
        catalog.onChanged = { [weak self] in self?.publishWidgetFeed() }
        ProjectLinks.shared.handler = { [weak self] request in self?.open(link: request) }
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
    /// How many times the settings window has been asked for from outside
    /// the menu bar — the palette — which the workspace window answers the
    /// same way (see `ContentView`).
    private(set) var settingsRequests = 0

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
            workspace = try await client.workspace()
        } catch {
            notices.post(.error, error.localizedDescription)
        }
        await refreshProjectState()
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
        case .history(let path):
            showHistory(of: path)
        case .commit(let message, let paths, let push):
            commit(message: message, paths: paths, andPush: push)
        case .discard(let paths):
            discard(paths: paths)
        default:
            page.send(action)
        }
    }

    /// The composer's Commit: the chosen paths under the message, then the
    /// push when asked for — one notice for the run, the way the web app
    /// reports it: a commit that landed is said so even when the push after
    /// it did not, since the work is safe and only the remote is behind.
    /// The notice stays the attempt until the sidebar has caught up — a
    /// push is a push while git is working, and a commit is a commit until
    /// the files it took are gone from the tree, which is the refresh, not
    /// the server's answer; settled any earlier, "Committed" would stand
    /// over a composer still holding the committed files.
    func commit(message: String, paths: [String], andPush push: Bool) {
        Task {
            let id = notices.post(.loading, "Committing…")
            let sha: String
            do {
                sha = try await client.commit(message: message, paths: paths)
            } catch {
                notices.settle(id, failed: "Commit failed", with: error)
                return
            }
            var pushFailure: Error?
            if push {
                notices.settle(id, .loading, "Committed \(sha), pushing…")
                do {
                    _ = try await client.push()
                } catch {
                    pushFailure = error
                }
            }
            await refreshShowingTree()
            if let pushFailure {
                notices.settle(id, failed: "Committed \(sha), but push failed", with: pushFailure)
            } else {
                notices.settle(id, .success, push ? "Committed \(sha) and pushed" : "Committed \(sha)")
            }
        }
    }

    /// The tree's Discard, already confirmed by the outline's own prompt.
    func discard(paths: [String]) {
        Task {
            let named = paths.count == 1 ? "changes in \(paths[0])" : "changes in \(paths.count) files"
            await notices.run("Discarding \(named)…", done: "Discarded \(named)", failed: "Discard failed") {
                try await client.discard(paths: paths)
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

    /// A project opens on its browse page — the tree of what it holds —
    /// whatever the last one was showing.
    @discardableResult
    func openProject(path: String) async -> Bool {
        do {
            workspace = try await client.openProject(path: path)
            services.reset()
            threads.reset()
            bottomExpanded = false
            // Everything the page holds is the project just left — its files,
            // its branch, the strip of files it had open — so it is told to
            // re-ask before it is sent anywhere. Arriving on the browse page
            // still answering for the old repository is how one project's
            // file ends up opened in another's; the refresh at the end of
            // this comes too late for that, being several round trips away.
            page.refresh()
            showOnCodeTab(Href.browsePath)
            await refresh()
            projectOpens += 1
            catalog.load()
            return true
        } catch {
            lastError = error.localizedDescription
            return false
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
        if workspace?.project == path {
            if request.run { runProject() }
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
        ProjectWidgetFeed.publish(rows: catalog.rows, favorites: catalog.favorites, current: workspace?.project)
    }

    /// The opener's Open and Run: the project opened, then every one of its
    /// dev commands started, with the Run surface up to show them coming up.
    func openProjectAndRun(path: String) async {
        guard await openProject(path: path) else { return }
        runProject()
    }

    /// The running half of Open and run, for the project already open:
    /// every dev command started, with the Run surface up to show them.
    func runProject() {
        Task {
            await services.startAll()
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
        page.send(action)
    }

}
