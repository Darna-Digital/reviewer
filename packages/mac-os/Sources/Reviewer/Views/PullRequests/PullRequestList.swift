// The merge requests as a native source list, standing in the sidebar
// while the page is on that surface — where the tree stands on the others
// — drawn from what the shell reads itself (see `PullRequests`): every open
// pull request under the branch it targets, each row its title over who
// wrote it and where it comes from, with what CI said and whether anything
// is in the way at the trailing edge, the web list's own facts in the
// sidebar's two lines. The web list's search and its branch-and-time filter
// stand at the head, as the sessions list has them.
//
// Picking a row sends the page to that pull request's diff, and the
// overview and its files stand up beside the sidebar (see
// `PullRequestColumn`); the row stays picked while the page is on it, so
// the list is the way between pull requests, as Mail's is between
// messages. The context menu is the overview's own — check out, open on
// GitHub, copy the link.
import SwiftUI

struct PullRequestList: View {
    @Environment(AppModel.self) private var model
    /// The row highlighted: the page's, until a click moves it ahead of the
    /// page's answer — a list that waited for the round trip would flash the
    /// old row back under the pointer first.
    @State private var selected: Int?

    private var pulls: PullRequests { model.pullRequests }

    var body: some View {
        VStack(spacing: 0) {
            PullListHeader()
            if !pulls.hasGitHub {
                PullListPlaceholder(
                    symbol: "point.3.connected.trianglepath.dotted", title: "No GitHub remote",
                    detail: "This project is not on GitHub, so there are no merge requests to read here.")
            } else if let error = pulls.error {
                PullListPlaceholder(symbol: "exclamationmark.triangle", title: "Could not load merge requests", detail: error)
            } else if pulls.loading {
                Spacer()
                ProgressView().controlSize(.small)
                Spacer()
            } else if pulls.pulls.isEmpty {
                PullListPlaceholder(
                    symbol: "arrow.triangle.pull", title: "No open merge requests",
                    detail: "When a branch is pushed and opened for review, it shows up here with its files and comments.")
            } else if pulls.groups.isEmpty {
                PullListPlaceholder(symbol: "line.3.horizontal.decrease", title: "Nothing matches") {
                    Button("Clear Filters") { pulls.clearFilters() }
                }
            } else {
                rows
            }
        }
        .onChange(of: model.reviewingPull?.number, initial: true) { _, reviewing in selected = reviewing }
    }

    private var rows: some View {
        List(selection: $selected) {
            ForEach(pulls.groups) { group in
                Section {
                    ForEach(group.pulls) { pull in
                        PullRow(pull: pull)
                            .tag(pull.number)
                            .contextMenu { PullRowMenu(pull: pull) }
                    }
                } header: {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.triangle.branch")
                            .font(.system(size: 9, weight: .medium))
                        Text(group.base.isEmpty ? "No branch" : group.base)
                            .lineLimit(1)
                        if group.pulls.count > 1 {
                            Spacer(minLength: 4)
                            Text("\(group.pulls.count)")
                                .monospacedDigit()
                        }
                    }
                }
            }
        }
        .listStyle(.sidebar)
        .scrollContentBackground(.hidden)
        .onChange(of: selected) { _, picked in
            guard let picked, picked != model.reviewingPull?.number else { return }
            model.show(pull: pulls.pull(numbered: picked))
        }
    }
}

/// The search over the list and the filter menu beside it, then how many
/// pull requests are open — of the ones the filters keep, while any are set.
private struct PullListHeader: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var pulls = model.pullRequests
        let shown = pulls.groups.reduce(0) { $0 + $1.pulls.count }
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                PaneFilterField(prompt: "Search merge requests", text: $pulls.query)
                PullFilterMenu()
            }
            if pulls.hasGitHub && !pulls.loading && pulls.error == nil {
                Text(count(shown, of: pulls.pulls.count, narrowed: pulls.isFiltered))
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .padding(.leading, 4)
            }
        }
        .padding(.horizontal, 10)
        .padding(.top, 8)
        .padding(.bottom, 6)
    }

    private func count(_ shown: Int, of total: Int, narrowed: Bool) -> String {
        let noun = total == 1 ? "merge request" : "merge requests"
        return narrowed ? "\(shown) of \(total) \(noun)" : "\(total) \(noun)"
    }
}

/// The web filter popover as a pull-down: the branches the open pull
/// requests target, over how far back to look, the chosen one in each
/// ticked. The button carries a dot while anything is set, as the web's
/// does: the list is never quietly narrower than it looks.
private struct PullFilterMenu: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let pulls = model.pullRequests
        Menu {
            Section("Target branch") {
                Toggle("All branches", isOn: baseBinding(nil))
                ForEach(pulls.baseBranches, id: \.self) { base in
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
                .frame(width: 24, height: 24)
                .overlay(alignment: .topTrailing) {
                    if pulls.isNarrowed {
                        Circle()
                            .fill(Color.accentColor)
                            .frame(width: 5, height: 5)
                            .padding(3)
                    }
                }
        }
        .menuStyle(.borderlessButton)
        .menuIndicator(.hidden)
        .fixedSize()
        .help("Filter merge requests")
    }

    private func baseBinding(_ base: String?) -> Binding<Bool> {
        Binding(
            get: { model.pullRequests.baseFilter == base },
            set: { on in if on { model.pullRequests.baseFilter = base } })
    }

    private func dateBinding(_ date: PullDateFilter) -> Binding<Bool> {
        Binding(
            get: { model.pullRequests.dateFilter == date },
            set: { on in if on { model.pullRequests.dateFilter = date } })
    }
}

/// A pull request's row: its title, over its number, its author and the
/// branch it comes from; at the trailing edge the blocker, if any, and
/// what CI said. The target branch is not among them — the heading the
/// row sits under has said it. No gesture of its own: on macOS a gesture
/// on a row's content takes the mouse-down before the list does.
private struct PullRow: View {
    let pull: PullRequestInfo

    var body: some View {
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
                    Text(TimeAgo.text(pull.updatedAt))
                        .font(.system(size: 11))
                        .foregroundStyle(.tertiary)
                        .monospacedDigit()
                }
            }
            .padding(.top, 2)
        }
        .padding(.vertical, 3)
        .contentShape(Rectangle())
        .help(pull.title)
    }
}

/// What a row can do without being opened: the overview's own actions,
/// minus the two that are confirmed there.
private struct PullRowMenu: View {
    let pull: PullRequestInfo
    @Environment(AppModel.self) private var model

    var body: some View {
        Button("Check Out \(pull.localBranch)") { model.checkout(pull: pull) }
            .disabled(model.currentBranch == pull.localBranch)
        Divider()
        if !pull.url.isEmpty {
            Button("Open on GitHub") { model.open(pull: pull) }
            Button("Copy Link") { model.copyLink(of: pull) }
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
