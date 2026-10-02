// A pull request, as one page in the island's place: its overview across
// the whole width at the top (see `PullRequestOverview`), and under it the
// files it touches beside its diff — scrolled as one, the way GitHub's own
// page reads. The files and the diff stand at the page's own height, so
// once the overview has gone by they fill the page exactly: the tree held
// down the left, the diff scrolling beside it, and the bar over the two
// naming the pull request the overview took away with it. The wheel is
// handed between the page and the two scrollers in it as each gesture
// starts (see `ScrollHandoff`).
//
// The page was a column of its own before — overview over files, between
// the list and the diff — which left the diff the window less three
// columns. The overview reads better wide and is read once, at the start;
// the diff is what the room is for.
//
// The tree is still what the page island reports for the pull request
// (`ShellTree`, in review mode); on this surface the sidebar is the list's,
// so the tree stands here instead, beside the diff it names files in.
import SwiftUI

struct PullRequestPage<Diff: View>: View {
    let pull: PullRequestInfo
    @ViewBuilder let diff: Diff
    @Environment(AppModel.self) private var model
    @State private var handoff = ScrollHandoff()

    static var treeWidths: ClosedRange<Double> { 200...520 }

    var body: some View {
        GeometryReader { viewport in
            ScrollView(.vertical) {
                VStack(spacing: 0) {
                    PullRequestOverview(pull: pull, width: viewport.size.width)
                    workbench
                        .frame(height: viewport.size.height)
                }
            }
            // The page's own scroller would stand over the diff's at the
            // trailing edge, and the bar tells where the page is anyway.
            .scrollIndicators(.never)
        }
        .onAppear {
            handoff.pageAtTop = { [page = model.page] in page.scrolledToTop }
        }
        .onChange(of: pull.number) { handoff.resetToTop() }
    }

    private var workbench: some View {
        VStack(spacing: 0) {
            ThemedDivider()
            PullFilesBar(pull: pull, overviewGone: handoff.overviewGone) { handoff.scrollToTop() }
            ThemedDivider()
            HStack(spacing: 0) {
                PullFiles()
                    .frame(width: treeWidth.wrappedValue)
                ColumnResizeHandle(width: treeWidth, range: Self.treeWidths, edge: .trailing) { _ in }
                diff
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(ScrollHandoffAnchor(handoff: handoff))
    }

    private var treeWidth: Binding<Double> {
        Binding(get: { Double(model.pullTreeWidth) }, set: { model.pullTreeWidth = CGFloat($0) })
    }
}

/// The band over the files and the diff. Under the overview it heads them —
/// the files changed and their size; with the overview gone it stands at
/// the top of the page in its place, naming the pull request the page is
/// on, with the way back up to the rest of it.
private struct PullFilesBar: View {
    let pull: PullRequestInfo
    let overviewGone: Bool
    let backToOverview: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            ZStack(alignment: .leading) {
                if overviewGone {
                    HStack(spacing: 6) {
                        PullStateIcon(pull: pull, size: 12)
                        Text(pull.title)
                            .font(.system(size: 12, weight: .semibold))
                            .lineLimit(1)
                            .truncationMode(.tail)
                        Text("#\(pull.number)")
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundStyle(.secondary)
                    }
                    .transition(.opacity.combined(with: .offset(y: 4)))
                } else {
                    HStack(spacing: 6) {
                        Text("Files changed")
                            .font(.system(size: 12, weight: .semibold))
                        if pull.changedFiles > 0 {
                            Text("\(pull.changedFiles)")
                                .font(.system(size: 10, weight: .medium))
                                .monospacedDigit()
                                .padding(.horizontal, 6)
                                .padding(.vertical, 1)
                                .background(.quaternaryWash(0.7), in: Capsule())
                        }
                    }
                    .transition(.opacity.combined(with: .offset(y: -4)))
                }
            }
            Spacer(minLength: 12)
            if pull.changedFiles > 0 {
                LineCounts(pull: pull)
                    .font(.system(size: 11))
            }
            if overviewGone {
                Button(action: backToOverview) {
                    Label("Overview", systemImage: "chevron.up")
                        .font(.system(size: 11))
                }
                .buttonStyle(.borderless)
                .help("Back to the pull request's overview")
                .transition(.opacity)
            }
        }
        .padding(.horizontal, 12)
        .frame(height: 34)
        .frame(maxWidth: .infinity)
    }
}

/// The lines added and taken away, in the colours the diff draws them in.
struct LineCounts: View {
    let pull: PullRequestInfo

    var body: some View {
        HStack(spacing: 4) {
            Text("+\(pull.additions)").foregroundStyle(.green)
            Text("−\(pull.deletions)").foregroundStyle(.red)
        }
        .monospacedDigit()
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
