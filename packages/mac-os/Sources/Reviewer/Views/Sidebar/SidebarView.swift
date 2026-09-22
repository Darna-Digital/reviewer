// The sidebar: the code page's file tree, drawn natively from what the
// page reports (see `SidebarTree`) in the layout the web sidebar gives that
// surface — the project's files as an outline on the browse page, and on a
// diff the changed files under a search, with the commit composer beneath
// them while the changes are your own — on the system's own sidebar, the
// full-height column of glass, beside the rail (see `ContentView`), under
// the branch picker, which stands over the tree the way the web header's
// does: the branch you are on is what the tree beneath it is a tree of. On
// the merge-requests surface the column holds the list of them instead
// (see `PullRequestList`), the one open standing beside the sidebar with
// its files (see `PullRequestColumn`); on the sessions surface it holds
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
        VStack(spacing: 0) {
            if model.hasProject && layout != .sessions {
                SidebarHeader()
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
            if model.hasProject {
                TreeColumn(layout: layout)
                    .frame(maxWidth: .infinity)
            } else {
                Spacer()
            }
        }
        .animation(SidebarMotion.change, value: layout)
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

/// The one motion the sidebar's layouts move with, as a surface goes from
/// the project's tree to the diff's changes and back: a short ease, the
/// system sidebar's own tempo, and none at all when the user asked for
/// less motion.
enum SidebarMotion {
    static var change: Animation? {
        NSWorkspace.shared.accessibilityDisplayShouldReduceMotion ? nil : .easeOut(duration: 0.22)
    }
}

/// The band along the island's top: the web header's 36pt around a 28pt
/// chip, with the branch picker leading it and, while the changes are your
/// own, the compare picker at the trailing edge — the branch the tree is a
/// tree of, and what its changes are measured from, each at its own width
/// and the room between them the sidebar's to give. The web app puts the
/// compare picker at the head of the band over the diff; the shell's
/// sidebar is where its commit view keeps its controls. Over the tree only
/// — the sessions list is not one branch's.
private struct SidebarHeader: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        HStack(spacing: 4) {
            BranchPicker()
            Spacer(minLength: 0)
            if let comparison = model.sidebar.comparison {
                ComparePicker(comparison: comparison)
                    .transition(.opacity)
            }
        }
        .padding(.horizontal, 4)
        .frame(height: 36)
        .animation(SidebarMotion.change, value: model.sidebar.comparison == nil)
    }
}

/// The layout for the surface the page is on — the merge requests, its
/// tree, or its sessions — or nothing while the page is on neither: a dock
/// surface with the window to itself. One layout crossfades to the next in
/// place: stacked, so the one going keeps its frame under the one coming
/// rather than sharing a column with it and shoving it down for the length
/// of the fade. The file tree is the one layout in both of its forms — the
/// project's and the changes — since it swaps its bands around the same
/// outline (see `FilesLayout`) rather than being another view.
private struct TreeColumn: View {
    let layout: SidebarLayout

    var body: some View {
        ZStack {
            switch layout {
            case .pulls:
                PullRequestList()
            case .files(let changes):
                FilesLayout(changes: changes)
            case .sessions:
                SessionsList()
            case .nothing:
                Color.clear
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// The file tree in the web sidebar's two layouts, as one: the project as
/// an outline on the browse page, and on a diff the changed files under a
/// search over them, with the commit composer beneath while they are your
/// own. The outline is the same one in both — a surface change swaps the
/// tree in it, crossfading (see `FileTreeOutline`), rather than the outline
/// itself — and the search band and the composer slide in and out around
/// it, the outline giving them room as they come.
private struct FilesLayout: View {
    @Environment(AppModel.self) private var model
    /// Whether the tree is the changed files rather than the project's —
    /// the surface's word (see `SidebarLayout`), so the bands move with the
    /// address; the listing they stand around follows on its own.
    let changes: Bool

    var body: some View {
        @Bindable var tree = model.sidebar
        VStack(spacing: 0) {
            if changes {
                ChangesHeader(query: $tree.query)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
            FileTreeOutline()
                .overlay {
                    if tree.isEmpty {
                        TreePlaceholder(loading: tree.isLoading, empty: changes ? "No changes" : "No files")
                        .transition(.opacity)
                    }
                }
            if let commit = tree.commit {
                CommitComposer(composer: commit, project: tree.listing?.projectPath ?? "")
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .clipped()
        .animation(
            SidebarMotion.change,
            value: Arrangement(changes: changes, composing: tree.commit != nil, empty: tree.isEmpty))
    }

    /// What the column is made of, so that a change to any of it moves the
    /// whole at once and nothing else — a keystroke in the search, a status
    /// arriving — does.
    private struct Arrangement: Equatable {
        let changes: Bool
        let composing: Bool
        let empty: Bool
    }
}

/// The search over the changed files.
struct ChangesHeader: View {
    @Binding var query: String

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
            TextField("Filter changed files", text: $query)
                .textFieldStyle(.plain)
                .font(.system(size: 12))
            if !query.isEmpty {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(.tertiary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 7)
        .frame(height: 24)
        .background(.quaternaryWash(0.5), in: RoundedRectangle(cornerRadius: 6))
        .padding(.horizontal, 10)
        .padding(.top, 2)
        .padding(.bottom, 6)
    }
}

struct TreePlaceholder: View {
    let loading: Bool
    let empty: String

    var body: some View {
        VStack {
            Spacer()
            if loading {
                Orb(size: 16, label: "Loading")
            } else {
                Text(empty)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}
