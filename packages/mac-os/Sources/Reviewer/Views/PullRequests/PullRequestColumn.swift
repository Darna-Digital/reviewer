// The pull request's own column, standing between the sidebar's list and
// the diff while one is open: two islands, one over the other — its
// overview (see `PullRequestOverview`), and under it the files it touches,
// the same native outline the sidebar draws the tree in on the other
// surfaces (see `FileTreeOutline`), under the changed-files search. The
// tree is still what the page island reports for the pull request
// (`ShellTree`, in review mode); on this surface the sidebar is the list's,
// so the tree stands here instead, beside the diff it names files in. The
// web app's three columns — the pull request, its files, its diff — with
// the first two native and the third the island, and the list beside them
// all. The seam between the two islands sets how tall the files stand; the
// seam after the column sets how wide it is.
import SwiftUI

struct PullRequestColumn: View {
    let pull: PullRequestInfo
    @Environment(AppModel.self) private var model

    static let widths: ClosedRange<CGFloat> = 240...560
    private static let fileHeights: ClosedRange<CGFloat> = 120...800

    var body: some View {
        @Bindable var model = model
        VStack(spacing: 0) {
            PullRequestOverview(pull: pull)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .island()
            IslandSeam(between: .rows, size: $model.pullFilesHeight, range: Self.fileHeights)
            PullFiles()
                .frame(height: model.pullFilesHeight)
                .island()
        }
        .frame(width: model.pullColumnWidth)
    }
}

/// The files the pull request touches: the changed-files layout the
/// sidebar wears on the diff — the search over them, then
/// the outline — with nothing to commit, since the changes are somebody
/// else's.
private struct PullFiles: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var tree = model.sidebar
        VStack(spacing: 0) {
            ChangesHeader(query: $tree.query)
                .padding(.top, 6)
            if tree.mode == .review {
                FileTreeOutline()
                    .overlay {
                        if tree.isEmpty {
                            TreePlaceholder(loading: tree.listing?.loading ?? false, empty: "No changes")
                        }
                    }
            } else {
                // The page is on its way to the pull request and has not
                // reported its files yet.
                TreePlaceholder(loading: true, empty: "No changes")
            }
        }
    }
}
