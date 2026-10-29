// The sidebar: the code page's file tree, drawn natively from what the
// page reports (see `SidebarTree`) in the layout the web sidebar gives that
// surface — the project's files as an outline on the browse page, and on a
// diff the changed files under a search, with the commit composer beneath
// them while the changes are your own — on the system's own sidebar, the
// full-height column of glass, beside the rail (see `ContentView`), under
// the branch picker, which stands over the tree the way the web header's
// does: the branch you are on is what the tree beneath it is a tree of. On
// the merge-requests surface the column holds the list of them instead
// (see `PullRequestList`), the one open taking the page beside it, its
// overview over its files and its diff (see `PullRequestPage`); on the sessions surface it holds
// the sessions list (see `SessionsList`) — every project's, so no branch
// names it, and the picker stands down with the tree. The project picker stands in the sidebar's
// run of the toolbar, beside its toggle (see `ContentView`); the rail that
// moves the page between the surfaces stands down the sidebar's leading
// edge (see `AppRail`). The sidebar follows the page, and a file or
// a session picked in it is carried to the page.
import SwiftUI

struct SidebarView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let layout = model.sidebarLayout
        Group {
            if model.hasProject {
                TreeColumn(layout: layout)
            } else {
                Color.clear
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // The surface changing takes the keyboard off whichever search the
        // column held, at once: the outgoing field is on screen for the
        // length of the crossfade, and would otherwise keep the strokes
        // meant for the one coming in.
        .onChange(of: layout) { PaneSearchField.releaseKeyboard() }
    }
}

/// The layout the sidebar's column is in. It is read from the page's
/// address alone (see `AppModel.sidebarLayout`), not from what the page has
/// reported so far: a surface change reaches the shell as a run of separate
/// messages — the list or the tree of the new surface, the address, the old
/// surface's tree taken down — and a column that followed those one by one
/// changed shape in as many steps as they happened to land in frames, an
/// animated step here and a bare one there. The address moves once, and
/// everything that goes with it moves in that one motion; the tree and the
/// list are drawn from the last picture the page gave until it gives the
/// next (see `SidebarTree.take`, `AppModel.sessions`).
enum SidebarLayout: Equatable {
    /// The merge requests, listed; the one open stands beside the sidebar.
    case pulls
    /// The file tree: the project's, or with `changes` the changed files
    /// under a search, with the commit composer beneath while they are
    /// your own.
    case files(changes: Bool)
    case sessions
    /// A page with nothing for the sidebar to hold.
    case nothing
}

/// What the system lets the sidebar's column be. Shared with the tab row,
/// which gives the column's widest back to the bar before the column comes
/// out to take it (see `SessionTabRow`).
enum SidebarWidths {
    static let min: CGFloat = 240
    static let ideal: CGFloat = 320
    static let max: CGFloat = 560
}

/// The one motion the sidebar's layouts move with, as a surface goes from
/// the project's tree to the diff's changes and back: a short ease, the
/// system sidebar's own tempo, and none at all when the user asked for
/// less motion.
///
/// Nothing in the column is resized under it. The column is native lists
/// and an outline, and resizing one re-tiles its rows: a band sliding in
/// over the tree, or the rail sliding out beside the list, had the system
/// lay the whole column out again every frame of the move, a frame's worth
/// of work each, and the motion stuttered. So a move is laid out once, at
/// its end, and only drawn — a fade, a band's own slide, and a slide back
/// from where the layout's last change left things (see `slid(_:by:)`) —
/// and a page the column has shown is kept up behind the one in front
/// (see `TreeColumn`), so going back to it builds nothing.
enum SidebarMotion {
    static var change: Animation? {
        NSWorkspace.shared.accessibilityDisplayShouldReduceMotion ? nil : .easeOut(duration: 0.22)
    }
}

/// A view laid out where a change has already put it, drawn from where it
/// stood before, easing over: `progress` is what animates, `settled` is
/// where the layout already is, and `distance` is how far the layout moves
/// the view as the change goes on. The view is laid out once, at the end,
/// and only its drawing moves.
private struct LayoutSlide: GeometryEffect {
    var progress: CGFloat
    let settled: CGFloat
    let distance: CGSize

    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    func effectValue(size: CGSize) -> ProjectionTransform {
        let lag = progress - settled
        return ProjectionTransform(CGAffineTransform(translationX: lag * distance.width, y: lag * distance.height))
    }
}

extension View {
    /// The view slid back from where it stood before `on` last changed —
    /// `distance` being how far turning it on moves it in the layout — at
    /// the sidebar's tempo, and only drawn there: nothing is laid out again
    /// as it goes.
    func slid(_ on: Bool, by distance: CGSize) -> some View {
        animation(SidebarMotion.change) {
            $0.modifier(LayoutSlide(progress: on ? 1 : 0, settled: on ? 1 : 0, distance: distance))
        }
    }
}

/// The band along the island's top: the title of what the tree is a tree
/// of — the repository over the branch it is on, the whole width the
/// sidebar has, the way Xcode titles a project over its branch — and the
/// one way to another repository or branch. What the changes are measured
/// from is not the tree's identity but a scope over its list, and stands
/// in the changes' filter row (see `ChangesHeader`). Over the tree only —
/// the sessions list is not one branch's.
private struct SidebarHeader: View {
    var body: some View {
        BranchPicker(look: .title)
            .padding(.horizontal, SidebarInsets.side)
            .frame(height: 44)
    }
}

/// The one line the sidebar's bands keep from its edges — the title, the
/// changes' filter row, and the tree's row highlights — so they stand flush
/// with one another down the column.
enum SidebarInsets {
    static let side: CGFloat = 10
}

/// The layout for the surface the page is on — the merge requests, its
/// tree, or its sessions — or nothing while the page is on neither: a dock
/// surface with the window to itself. The branch picker heads the tree and
/// the merge requests, and not the sessions list, which is not one
/// branch's.
///
/// A page once shown is kept up behind the one in front rather than put
/// away, and going back to it is a crossfade of what is already drawn. A
/// page made afresh is a native list or outline built, filled and tiled
/// row by row, in the very frame its fade starts — the frame the motion
/// lost. The file tree is the one page in both of its forms — the
/// project's and the changes — since it swaps its bands around the same
/// outline (see `FilesLayout`) rather than being another view.
private struct TreeColumn: View {
    let layout: SidebarLayout

    @State private var visited: Set<SidebarPage> = []
    /// The form the file tree was last shown in, which it keeps while
    /// another page is in front of it.
    @State private var lastChanges = false

    var body: some View {
        let front = SidebarPage(layout)
        let kept = front.map { visited.union([$0]) } ?? visited
        let changes = layout.changes ?? lastChanges
        ZStack {
            ForEach(SidebarPage.allCases.filter(kept.contains), id: \.self) { page in
                content(of: page, changes: changes)
                    .kept(inFront: page == front)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onChange(of: layout, initial: true) { _, layout in
            if let page = SidebarPage(layout) { visited.insert(page) }
            if let changes = layout.changes { lastChanges = changes }
        }
    }

    @ViewBuilder
    private func content(of page: SidebarPage, changes: Bool) -> some View {
        switch page {
        case .pulls:
            VStack(spacing: 0) {
                SidebarHeader()
                PullRequestList()
            }
        case .files:
            VStack(spacing: 0) {
                SidebarHeader()
                FilesLayout(changes: changes)
            }
        case .sessions:
            SessionsList()
        }
    }
}

/// The pages the column keeps — the layouts that hold something.
private enum SidebarPage: CaseIterable, Hashable {
    case pulls, files, sessions

    init?(_ layout: SidebarLayout) {
        switch layout {
        case .pulls: self = .pulls
        case .files: self = .files
        case .sessions: self = .sessions
        case .nothing: return nil
        }
    }
}

private extension SidebarLayout {
    var changes: Bool? {
        guard case .files(let changes) = self else { return nil }
        return changes
    }
}

extension EnvironmentValues {
    /// Whether the sidebar page a view stands on is the one in front, or
    /// one kept up behind it (see `TreeColumn`).
    @Entry var sidebarPageInFront = true
}

private extension View {
    /// A kept page, faded in front or out behind: out of reach of the
    /// pointer and of VoiceOver while it is behind.
    func kept(inFront: Bool) -> some View {
        animation(SidebarMotion.change) { $0.opacity(inFront ? 1 : 0) }
            .allowsHitTesting(inFront)
            .accessibilityHidden(!inFront)
            .zIndex(inFront ? 1 : 0)
            .environment(\.sidebarPageInFront, inFront)
    }
}

/// The file tree in the web sidebar's two layouts, as one: the project as
/// an outline on the browse page, and on a diff the changed files under a
/// search over them, with the commit composer beneath while they are your
/// own. The outline is the same one in both — a surface change swaps the
/// tree in it, crossfading (see `FileTreeOutline`), rather than the outline
/// itself — and the search band and the composer slide in and out around
/// it. The outline takes its new place at once and is drawn sliding over
/// from the old one, so a band coming never resizes it frame by frame.
private struct FilesLayout: View {
    @Environment(AppModel.self) private var model
    /// Whether the tree is the changed files rather than the project's —
    /// the surface's word (see `SidebarLayout`), so the bands move with the
    /// address; the listing they stand around follows on its own.
    let changes: Bool

    /// The search band's height as last laid out: how far the outline
    /// moves as the band comes and goes. A guess until the band is first
    /// drawn.
    @State private var searchBandHeight: CGFloat = 42

    var body: some View {
        @Bindable var tree = model.sidebar
        VStack(spacing: 0) {
            Band(edge: .top, shown: changes) {
                ChangesHeader(query: $tree.query, wantsKeyboard: $tree.filterWantsKeyboard, scoped: true)
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { searchBandHeight = $0 }
            }
            FileTreeOutline()
                .overlay {
                    ZStack {
                        if tree.isEmpty {
                            TreePlaceholder(loading: tree.isLoading, empty: empty)
                                .transition(.opacity)
                        }
                    }
                    .animation(SidebarMotion.change, value: tree.isEmpty)
                }
                .slid(changes, by: CGSize(width: 0, height: searchBandHeight))
            Band(edge: .bottom, shown: tree.commit != nil) {
                if let commit = tree.workspaceCommit {
                    CommitComposer(composer: commit, project: composerScope)
                }
            }
        }
        .clipped()
    }

    /// What the tree says with no rows: no files on the browse page; over
    /// your changes, that they are clean — or that the filter matched none.
    private var empty: TreeEmpty {
        let tree = model.sidebar
        guard changes else { return .noFiles }
        if tree.isSearching { return .noMatch(tree.query.trimmingCharacters(in: .whitespaces)) }
        return .clean(against: tree.comparison?.against)
    }

    /// What the composer keeps its message under: the workspace, while the
    /// changes are several repositories', or the one repository's.
    private var composerScope: String {
        if model.sidebar.isMultiRoot, let workspace = model.workspace {
            return workspace.workspace.map { "workspace:\($0.id)" } ?? workspace.roots.map(\.path).joined(separator: "\n")
        }
        return model.sidebar.listing?.projectPath ?? ""
    }
}

/// A band at an edge of the file tree, sliding in from that edge and back
/// out. The motion is the band's alone: the room it takes is given at once
/// rather than animated, so the outline beside it is laid out once, not
/// every frame of the slide.
private struct Band<Content: View>: View {
    let edge: Edge
    let shown: Bool
    @ViewBuilder let content: () -> Content

    var body: some View {
        ZStack {
            if shown {
                content()
                    .transition(.move(edge: edge).combined(with: .opacity))
            }
        }
        .animation(SidebarMotion.change, value: shown)
    }
}

/// The search over the changed files — the field the merge-requests list
/// and the bottom pane's bars stand their searches in (see
/// `MinimalSearchField`), so every column searches alike.
struct ChangesHeader: View {
    @Binding var query: String
    @Binding var wantsKeyboard: Bool
    /// Whether the compare picker stands at the row's trailing edge — over
    /// your own changes, where what they are measured from is yours to
    /// pick, the way Finder's scope bar stands over its results.
    var scoped = false
    @Environment(AppModel.self) private var model

    var body: some View {
        HStack(spacing: 6) {
            MinimalSearchField(prompt: "Filter changed files", text: $query, takesKeyboard: $wantsKeyboard)
            if scoped, let comparison = model.sidebar.comparison {
                ComparePicker(comparison: comparison)
                    .transition(.opacity)
            }
        }
        .animation(SidebarMotion.change, value: model.sidebar.comparison == nil)
        .sidebarSearchBand()
    }
}

/// The room a sidebar search stands in, whichever surface it heads — the
/// changes, the merge requests, the sessions — so the column's head keeps
/// its shape as the surface under it changes.
extension View {
    func sidebarSearchBand() -> some View {
        padding(.horizontal, SidebarInsets.side)
            .padding(.top, 8)
            .padding(.bottom, 6)
    }
}

/// What an empty tree says — a glyph, a title, and a short line on why —
/// at the sidebar's own scale, the way Xcode's navigators say an empty
/// list: quiet enough that a clean tree reads as rest, not as a problem.
/// The glyph is what the list would hold, as Mail's empty mailbox wears a
/// tray — a change wears the Review rail's ±, not a verdict like a tick.
struct TreeEmpty {
    let title: String
    let symbol: String
    var detail: String? = nil

    static let noFiles = TreeEmpty(title: "No Files", symbol: "folder")
    static let noChanges = TreeEmpty(title: "No Changes", symbol: CodeSurface.review.symbol)

    /// Nothing to commit or review, and against what.
    static func clean(against: String?) -> TreeEmpty {
        TreeEmpty(
            title: "No Changes", symbol: CodeSurface.review.symbol,
            detail: against.map { "Nothing differs from \($0)" } ?? "Nothing to commit")
    }

    static func noMatch(_ query: String) -> TreeEmpty {
        TreeEmpty(title: "No Results", symbol: "magnifyingglass", detail: "Nothing matches “\(query)”")
    }
}

struct TreePlaceholder: View {
    let loading: Bool
    let empty: TreeEmpty

    var body: some View {
        Group {
            if loading {
                Orb(size: 16, label: "Loading")
            } else {
                VStack(spacing: 6) {
                    Image(systemName: empty.symbol)
                        .font(.system(size: 18, weight: .regular))
                        .foregroundStyle(.secondary)
                        .padding(.bottom, 2)
                    Text(empty.title)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.primary.opacity(0.85))
                    if let detail = empty.detail {
                        Text(detail)
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(.horizontal, 24)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
