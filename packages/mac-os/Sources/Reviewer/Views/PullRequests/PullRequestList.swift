// The merge requests as a native source list, standing in the sidebar
// while the page is on that surface — where the tree stands on the others
// — drawn from what the shell reads itself (see `PullRequests`): every open
// pull request, under its repository across a workspace, each row its title over who
// wrote it and where it comes from, with what CI said and whether anything
// is in the way at the trailing edge, the web list's own facts in the
// sidebar's two lines. The web list's search and its branch-and-time filter
// stand at the head, as the sessions list has them.
//
// Picking a row sends the page to that pull request's diff, under its
// overview and beside its files (see `PullRequestPage`); the row stays picked while the page is on it, so
// the list is the way between pull requests, as Mail's is between
// messages. The picked row wears the tree's own quiet wash rather than the
// accent blue (see `TreeSelection`), the rows being drawn by hand as the
// commit's file list draws its own, so the sidebar's two lists read as
// one; the arrow keys still step between them. The context menu is the
// overview's own — check out, open on GitHub, copy the link.
import SwiftUI

struct PullRequestList: View {
    @Environment(AppModel.self) private var model
    /// The row highlighted: the page's, until a click moves it ahead of the
    /// page's answer — a list that waited for the round trip would flash the
    /// old row back under the pointer first.
    @State private var selected: PullPick?

    private var sections: [PullRequestSection] { model.pullSections }
    /// Whether each repository's rows stand under its own header.
    private var spansWorkspace: Bool { model.roots.count > 1 }
    private var shown: [(section: PullRequestSection, pull: PullRequestInfo)] {
        sections.flatMap { section in section.rows.map { (section, $0) } }
    }

    var body: some View {
        let sources = sections.map(\.pulls)
        VStack(spacing: 0) {
            PullListHeader()
            if sources.isEmpty || !sources.contains(where: \.hasGitHub) {
                PullListPlaceholder(
                    symbol: "point.3.connected.trianglepath.dotted", title: "No GitHub remote",
                    detail: spansWorkspace
                        ? "None of this workspace's repositories is on GitHub, so there are no merge requests to read here."
                        : "This project is not on GitHub, so there are no merge requests to read here.")
            } else if !spansWorkspace, let error = sources.first?.error {
                PullListPlaceholder(symbol: "exclamationmark.triangle", title: "Could not load merge requests", detail: error)
            } else if sources.allSatisfy({ $0.pulls.isEmpty }) && sources.contains(where: \.loading) {
                Spacer()
                Orb(size: 16, label: "Loading")
                Spacer()
            } else if sources.allSatisfy({ $0.pulls.isEmpty && $0.error == nil }) {
                PullListPlaceholder(
                    symbol: "arrow.triangle.pull", title: "No open merge requests",
                    detail: "When a branch is pushed and opened for review, it shows up here with its files and comments.")
            } else if sections.allSatisfy({ $0.rows.isEmpty && $0.pulls.error == nil }) {
                PullListPlaceholder(symbol: "line.3.horizontal.decrease", title: "Nothing matches") {
                    Button("Clear filters") { model.pullFilter = PullFilter() }
                }
            } else {
                rows
            }
        }
        .onChange(of: model.reviewingPullPick, initial: true) { _, reviewing in selected = reviewing }
    }

    private var rows: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(sections) { section in
                    if spansWorkspace {
                        // A repository with nothing to show stands no header,
                        // the way the changes tree lists only roots with
                        // something in them; one that failed says so.
                        if let error = section.pulls.error {
                            RepositoryHeader(name: section.root.name)
                            Text(error)
                                .font(.system(size: 11))
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                                .padding(.horizontal, 8)
                                .padding(.bottom, 4)
                        } else if !section.rows.isEmpty {
                            RepositoryHeader(name: section.root.name)
                        }
                    }
                    ForEach(section.rows) { pull in
                        let pick = PullPick(root: section.root.path, number: pull.number)
                        PullRow(pull: pull, selected: selected == pick) { self.pick(pull, in: section) }
                            .contextMenu { PullRowMenu(pull: pull, root: section.root) }
                    }
                }
            }
            .padding(.horizontal, 10)
            .padding(.top, spansWorkspace ? 0 : 6)
            .padding(.bottom, 8)
        }
        .focusable()
        .focusEffectDisabled()
        .onKeyPress(.upArrow) { step(-1) }
        .onKeyPress(.downArrow) { step(1) }
    }

    private func pick(_ pull: PullRequestInfo, in section: PullRequestSection) {
        let pick = PullPick(root: section.root.path, number: pull.number)
        selected = pick
        guard pick != model.reviewingPullPick else { return }
        model.show(pull: pull, in: section.root)
    }

    /// The row beside the picked one, in the order shown — the first with
    /// none picked.
    private func step(_ offset: Int) -> KeyPress.Result {
        let rows = shown
        guard !rows.isEmpty else { return .ignored }
        let current = rows.firstIndex { PullPick(root: $0.section.root.path, number: $0.pull.number) == selected }
        let next = current.map { min(max($0 + offset, 0), rows.count - 1) } ?? 0
        pick(rows[next].pull, in: rows[next].section)
        return .handled
    }
}

/// A repository's part of the list, over the branches its rows target —
/// only while the workspace holds more than one. Headed by its avatar, as
/// the Branches pane heads each repository.
private struct RepositoryHeader: View {
    let name: String

    var body: some View {
        HStack(spacing: 6) {
            RepoAvatar(name: name, size: 16)
            Text(name)
                .lineLimit(1)
        }
        .font(.system(size: 12, weight: .semibold))
        .padding(.horizontal, 8)
        .padding(.top, 12)
        .padding(.bottom, 2)
    }
}

/// The search over the list and the filter menu beside it. No count of
/// the open pull requests under them: the rows are the count, and a line
/// saying "1 merge request" over the one row said nothing the row did not.
/// That the filters are narrowing the list is the menu's dot to say.
private struct PullListHeader: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        HStack(spacing: 6) {
            MinimalSearchField(prompt: "Search merge requests", text: $model.pullFilter.query)
            PullFilterMenu()
        }
        .sidebarSearchBand()
    }
}

/// The web filter popover as a pull-down: the branches the open pull
/// requests target, over how far back to look, the chosen one in each
/// ticked. The button carries a dot while anything is set, as the web's
/// does: the list is never quietly narrower than it looks.
private struct PullFilterMenu: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Menu {
            Section("Target branch") {
                Toggle("All branches", isOn: baseBinding(nil))
                ForEach(model.pullBaseBranches, id: \.self) { base in
                    Toggle(base.isEmpty ? "No branch" : base, isOn: baseBinding(base))
                }
            }
            Section("Updated") {
                ForEach(PullDateFilter.allCases) { date in
                    Toggle(date.label, isOn: dateBinding(date))
                }
            }
        } label: {
            Image(systemName: "line.3.horizontal.decrease")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
                .frame(width: PaneMetrics.glassHeight, height: PaneMetrics.glassHeight)
                .overlay(alignment: .topTrailing) {
                    if model.pullFilter.isNarrowed {
                        Circle()
                            .fill(Color.accentColor)
                            .frame(width: 5, height: 5)
                            .padding(4)
                    }
                }
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .glassCircleControl()
        .fixedSize()
        .help("Filter merge requests")
    }

    private func baseBinding(_ base: String?) -> Binding<Bool> {
        Binding(
            get: { model.pullFilter.base == base },
            set: { on in if on { model.pullFilter.base = base } })
    }

    private func dateBinding(_ date: PullDateFilter) -> Binding<Bool> {
        Binding(
            get: { model.pullFilter.date == date },
            set: { on in if on { model.pullFilter.date = date } })
    }
}

/// A pull request's row: its title, over its number, its author and the
/// branch it comes from; at the trailing edge the blocker, if any, and
/// what CI said. The target branch is not among them: nearly every one
/// targets the default branch, and the filter narrows by it. Picked, it wears the tree's wash; under
/// the pointer, the same faint one the tree's rows do.
private struct PullRow: View {
    let pull: PullRequestInfo
    let selected: Bool
    let pick: () -> Void
    @State private var isHovering = false

    var body: some View {
        Button(action: pick) { content }
            .buttonStyle(.plain)
            .onHover { isHovering = $0 }
            .help(pull.title)
    }

    private var content: some View {
        HStack(alignment: .top, spacing: 6) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    if pull.draft {
                        Image(systemName: "pencil.line")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(.secondary)
                            .help("Draft")
                    }
                    Text(pull.title)
                        .font(.system(size: 13))
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
                HStack(spacing: 4) {
                    Text("#\(pull.number)")
                        .font(.system(size: 11, design: .monospaced))
                    if !pull.author.isEmpty {
                        Text(pull.author)
                            .lineLimit(1)
                    }
                    if !pull.headRef.isEmpty {
                        Text("·")
                        Text(pull.headRef)
                            .font(.system(size: 11, design: .monospaced))
                            .lineLimit(1)
                            .truncationMode(.middle)
                    }
                }
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
            }
            Spacer(minLength: 4)
            HStack(spacing: 4) {
                BlockedIcon(pull: pull)
                ChecksIcon(pull: pull)
                if !pull.updatedAt.isEmpty {
                    // The byline's secondary ink, not the tertiary: on the
                    // picked row's wash the tertiary all but vanished.
                    Text(TimeAgo.text(pull.updatedAt))
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }
            }
            .padding(.top, 2)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            selected ? TreeSelection.color : isHovering ? Color.primary.opacity(0.05) : Color.clear,
            in: RoundedRectangle(cornerRadius: 5))
        .contentShape(Rectangle())
    }
}

/// What a row can do without being opened: the overview's own actions,
/// minus the two that are confirmed there.
private struct PullRowMenu: View {
    let pull: PullRequestInfo
    /// The repository the pull request is against, which the checkout lands in.
    let root: RootModel
    @Environment(AppModel.self) private var model

    var body: some View {
        Button("Check out \(pull.localBranch)") { model.checkout(pull: pull, in: root) }
            .disabled(root.branch == pull.localBranch)
        Divider()
        if !pull.url.isEmpty {
            Button("Open on GitHub") { model.open(pull: pull) }
            Button("Copy link") { model.copyLink(of: pull) }
        }
    }
}

private struct PullListPlaceholder<Actions: View>: View {
    let symbol: String
    let title: String
    var detail: String? = nil
    @ViewBuilder var actions: Actions

    init(symbol: String, title: String, detail: String? = nil, @ViewBuilder actions: () -> Actions = { EmptyView() }) {
        self.symbol = symbol
        self.title = title
        self.detail = detail
        self.actions = actions()
    }

    var body: some View {
        VStack {
            Spacer()
            PanePlaceholder(title, symbol: symbol, detail: detail) { actions }
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 12)
    }
}
