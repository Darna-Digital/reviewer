// The trailing column of a pull request's overview: what is done with it,
// and what stands in its way — an inspector, laid out the way the system
// lays its own out since Liquid Glass. The actions first, as glass: Merge
// the one prominent control on the page, asking in its confirmation which
// of GitHub's three ways to merge by — a split button was the first try,
// but a menu takes no glass, and stood plain beside a tinted Check Out as
// if that were the page's action; Check Out beside it in clear glass; and
// everything less often reached for — the link out, copying, closing —
// behind the ellipsis, as Finder and Xcode keep their own secondary
// commands, rather than as a row of loose icons. Then the facts as System Settings groups them: a
// title-case header over a rounded box of full-width rows, each a name on
// the leading edge and its value on the trailing one, parted by inset
// rules. Status says whether the pull request can go in — what blocks it,
// what CI made of it, the runs behind that verdict a click away — and
// Details who is on it. Every row stands whether or not it has anything
// to say, a "None" in the tertiary ink where it does not, so the column
// keeps one shape from pull request to pull request.
//
// Merging and closing are outward-facing and not ours to undo, so both
// are confirmed first.
import AppKit
import SwiftUI

struct PullRequestInspector: View {
    let pull: PullRequestInfo
    @Environment(AppModel.self) private var model
    @State private var confirmingMerge = false
    @State private var confirmingClose = false

    private var pulls: PullRequests { model.pullRequests }

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            actions
            InspectorSection("Status") { status }
            InspectorSection("Details") { details }
        }
        .mergeConfirmation(pull: pull, shown: $confirmingMerge) { model.merge(pull: pull, method: $0) }
        .closeConfirmation(pull: pull, shown: $confirmingClose) { model.close(pull: pull) }
    }

    // MARK: actions

    private var actions: some View {
        let work = pulls.work
        let merging = work == .merging(pull.number)
        let checkingOut = work == .checkingOut(pull.number)
        let onBranch = model.currentBranch == pull.localBranch
        return HStack(spacing: 8) {
            Button {
                confirmingMerge = true
            } label: {
                Label(merging ? "Merging…" : "Merge", systemImage: "arrow.triangle.merge")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.glassProminent)
            .disabled(pull.mergeBlockedReason != nil || merging || pull.headRef.isEmpty)
            .help(pull.mergeBlockedReason ?? "Merge #\(pull.number) into \(pull.baseRef) on GitHub")

            Button {
                model.checkout(pull: pull)
            } label: {
                Label(
                    onBranch ? "Checked Out" : checkingOut ? "Checking Out…" : "Check Out",
                    systemImage: onBranch ? "checkmark" : "arrow.down.to.line"
                )
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.glass)
            // Clear glass: the column's theme tint would fill it, and two
            // filled controls side by side leave no action the page's own.
            .tint(nil)
            .disabled(onBranch || checkingOut || pull.headRef.isEmpty)
            .help(checkoutHelp(onBranch: onBranch))

            MoreMenu(pull: pull) { confirmingClose = true }
        }
        .labelStyle(.titleAndIcon)
        .lineLimit(1)
        .controlSize(.large)
    }

    private func checkoutHelp(onBranch: Bool) -> String {
        if onBranch { return "The working copy is already on \(pull.localBranch)." }
        if pull.fromFork {
            return "Fetch #\(pull.number) from the fork it was opened from and check it out as \(pull.localBranch)."
        }
        return "Fetch \(pull.headRef) from origin and check it out. An existing local branch is fast-forwarded, never reset."
    }

    // MARK: status

    /// What blocks the merge, then what CI made of the head commit. A pull
    /// request with neither says so plainly rather than leaving the box out.
    @ViewBuilder
    private var status: some View {
        if let blocked = pull.blockedReason {
            InspectorRow {
                Label {
                    Text(blocked)
                        .fixedSize(horizontal: false, vertical: true)
                } icon: {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)
                }
            }
        }
        if let headline = pull.checksHeadline {
            if pull.blockedReason != nil { InspectorSeparator() }
            ChecksRows(pull: pull, headline: headline)
        }
        if pull.blockedReason == nil && pull.checksHeadline == nil {
            InspectorRow {
                Label {
                    Text("No checks reported")
                        .foregroundStyle(.secondary)
                } icon: {
                    Image(systemName: "checkmark.circle")
                        .foregroundStyle(.tertiary)
                }
            }
        }
    }

    // MARK: details

    @ViewBuilder
    private var details: some View {
        InspectorRow(label: "Reviewers") { People(people: pull.reviewers) }
        InspectorSeparator()
        InspectorRow(label: "Assignees") { People(people: pull.assignees) }
        InspectorSeparator()
        InspectorRow(label: "Labels") {
            if pull.labels.isEmpty {
                None()
            } else {
                HStack(spacing: 4) {
                    ForEach(pull.labels, id: \.name) { LabelBadge(label: $0) }
                }
            }
        }
    }
}

// MARK: - The more menu

/// The commands reached for less often than merging or checking out, behind
/// the ellipsis the system gives a toolbar's or an inspector's overflow:
/// the way out to GitHub, the two things worth copying, and closing — set
/// apart at the foot, since it is the one that takes the pull request away.
private struct MoreMenu: View {
    let pull: PullRequestInfo
    /// A large glass button's height.
    private static let size: CGFloat = 27
    let close: () -> Void
    @Environment(AppModel.self) private var model

    var body: some View {
        let work = model.pullRequests.work
        let busy = work == .closing(pull.number) || work == .merging(pull.number)
        Menu {
            Button {
                model.open(pull: pull)
            } label: {
                Label("Open on GitHub", systemImage: "safari")
            }
            .disabled(pull.url.isEmpty)
            Button {
                model.copyLink(of: pull)
            } label: {
                Label("Copy Link", systemImage: "link")
            }
            .disabled(pull.url.isEmpty)
            Button {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(pull.headRef, forType: .string)
            } label: {
                Label("Copy Branch Name", systemImage: "doc.on.doc")
            }
            .disabled(pull.headRef.isEmpty)
            Divider()
            Button(role: .destructive, action: close) {
                Label("Close Pull Request…", systemImage: "xmark.circle")
            }
            .disabled(busy || pull.headRef.isEmpty)
        } label: {
            Image(systemName: "ellipsis")
                .font(.system(size: 14, weight: .semibold))
                .frame(width: Self.size, height: Self.size)
                .contentShape(Circle())
        }
        // A menu takes no glass style of its own, and drew as a small grey
        // disc beside the glass buttons; so it is drawn plain, and the glass
        // is laid around it here, at the buttons' height.
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .glassEffect(.regular.interactive(), in: Circle())
        .fixedSize()
        .help("More")
    }
}

// MARK: - Checks

/// The verdict as a row, opened onto the runs behind it: the failures and
/// the still-running first, since they are the ones with something to say,
/// capped, the rest counted with the way to them on GitHub. Green folds
/// itself away — a red or still-running verdict opens, because that is the
/// one you came to read.
private struct ChecksRows: View {
    let pull: PullRequestInfo
    let headline: String
    @State private var open = false

    private static let shown = 6

    var body: some View {
        let counts = pull.checkCounts
        let openAtFirst = counts.failed > 0 || counts.pending > 0
        VStack(spacing: 0) {
            Button {
                withAnimation(.snappy(duration: 0.22)) { open.toggle() }
            } label: {
                InspectorRow {
                    HStack(spacing: 8) {
                        ChecksIcon(pull: pull, size: 13)
                            .frame(width: 16)
                        Text(headline)
                        Spacer(minLength: 8)
                        if let tally = pull.checksTally {
                            Text(tally)
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                        }
                        Image(systemName: "chevron.right")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.tertiary)
                            .rotationEffect(.degrees(open ? 90 : 0))
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(open ? "Hide checks" : "Show checks")

            // Faded in as the box grows to hold them, rather than slid down
            // from the verdict: the row has no sheet of its own, and the
            // runs sliding in showed through it.
            if open {
                runs
                    .transition(.opacity)
            }
        }
        .clipped()
        .onAppear { open = openAtFirst }
        .onChange(of: pull.number) { _, _ in open = openAtFirst }
    }

    private var runs: some View {
        let rank: [CheckState: Int] = [.failure: 0, .pending: 1, .neutral: 2, .success: 3]
        let ordered = pull.checks.sorted { (rank[$0.state] ?? 4) < (rank[$1.state] ?? 4) }
        let total = pull.checkCounts.total
        return VStack(spacing: 0) {
            ForEach(ordered.prefix(Self.shown), id: \.name) { check in
                InspectorSeparator(leading: 36)
                CheckRun(check: check)
            }
            if total > Self.shown, let url = URL(string: "\(pull.url)/checks") {
                InspectorSeparator(leading: 36)
                Link(destination: url) {
                    Text("\(total - Self.shown) more on GitHub")
                        .font(.system(size: 12))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.leading, 36)
                        .padding(.trailing, InspectorMetrics.inset)
                        .frame(minHeight: 28)
                }
            }
        }
    }
}

/// One run: its verdict's dot under the summary's icon, its name — opening
/// its page on GitHub — and the verdict in words at the trailing edge.
private struct CheckRun: View {
    let check: PullRequestCheck

    var body: some View {
        HStack(spacing: 8) {
            CheckDot(state: check.state)
                .frame(width: 16)
            if let url = URL(string: check.url), !check.url.isEmpty {
                Link(check.name, destination: url)
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            } else {
                Text(check.name)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            Spacer(minLength: 8)
            Text(check.state.word.capitalized)
                .foregroundStyle(check.state == .failure ? AnyShapeStyle(Color.red) : AnyShapeStyle(.secondary))
        }
        .font(.system(size: 12))
        .padding(.leading, InspectorMetrics.inset)
        .padding(.trailing, InspectorMetrics.inset)
        .frame(minHeight: 28)
    }
}

// MARK: - The grouped box

enum InspectorMetrics {
    /// The run of box between its edge and a row's content.
    static let inset: CGFloat = 12
    /// The box's corner: the larger, concentric one the system turns its
    /// grouped sections at since Liquid Glass.
    static let corner: CGFloat = 12
    /// A row's least height — the system's grouped-form row.
    static let rowHeight: CGFloat = 34
}

/// A section: its title-case header over a rounded box of rows — the
/// grouped form's section, as System Settings draws it, washed rather than
/// ringed so it sits in the island's sheet instead of on it.
private struct InspectorSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    init(_ title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .padding(.leading, 4)
                .accessibilityAddTraits(.isHeader)
            VStack(spacing: 0) {
                content
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.quaternaryWash(0.45), in: RoundedRectangle(cornerRadius: InspectorMetrics.corner, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: InspectorMetrics.corner, style: .continuous)
                    .strokeBorder(.quaternaryWash(0.6), lineWidth: 0.5)
            }
        }
    }
}

/// A row of a box: a name at the leading edge and its value at the trailing
/// one, or a single piece of content across it.
private struct InspectorRow<Value: View>: View {
    var label: String?
    @ViewBuilder let value: Value

    init(label: String? = nil, @ViewBuilder value: () -> Value) {
        self.label = label
        self.value = value()
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            if let label {
                Text(label)
                Spacer(minLength: 8)
                value
                    .foregroundStyle(.secondary)
            } else {
                value
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .font(.system(size: 13))
        .padding(.horizontal, InspectorMetrics.inset)
        .padding(.vertical, 8)
        .frame(minHeight: InspectorMetrics.rowHeight)
    }
}

/// The rule between two rows, inset from the leading edge as the system
/// insets its own — further under a run, to stand under its name.
private struct InspectorSeparator: View {
    var leading: CGFloat = InspectorMetrics.inset

    var body: some View {
        ThemedDivider()
            .padding(.leading, leading)
    }
}

private struct None: View {
    var body: some View {
        Text("None")
            .foregroundStyle(.tertiary)
    }
}

private struct People: View {
    let people: [String]

    var body: some View {
        if people.isEmpty {
            None()
        } else {
            HStack(spacing: 5) {
                HStack(spacing: -4) {
                    ForEach(people.prefix(3), id: \.self) { RepoAvatar(name: $0, size: 18) }
                }
                Text(people.joined(separator: ", "))
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
        }
    }
}

// MARK: - Confirmations

extension View {
    /// The confirmation is where the way of merging is picked — GitHub's
    /// three, the merge commit first as GitHub has it, stacked as the
    /// system stacks an alert's choices — and where the reasons to think
    /// twice that are not reasons to refuse — a red check, a mergeability
    /// GitHub has not worked out — finally get said.
    fileprivate func mergeConfirmation(
        pull: PullRequestInfo, shown: Binding<Bool>, merge: @escaping (MergeMethod) -> Void
    ) -> some View {
        alert("Merge #\(pull.number) into \(pull.baseRef)?", isPresented: shown) {
            ForEach(MergeMethod.allCases) { method in
                Button(method.title) { merge(method) }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(
                "GitHub lands \(pull.headRef) on \(pull.baseRef) the way you pick."
                    + (pull.mergeCaution.map { " \($0)" } ?? ""))
        }
    }

    /// Closing is undone by reopening it on GitHub rather than by anything
    /// here, and the branch it was opened from is untouched either way —
    /// the pair of facts that decide whether to go through with it.
    fileprivate func closeConfirmation(pull: PullRequestInfo, shown: Binding<Bool>, close: @escaping () -> Void)
        -> some View
    {
        alert("Close #\(pull.number) without merging?", isPresented: shown) {
            Button("Close Pull Request", role: .destructive) { close() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("\(pull.headRef) keeps its commits and stays where it is. Reopening #\(pull.number) is done on GitHub.")
        }
    }
}

extension MergeMethod {
    /// The method as an alert's button names it, in the title case the
    /// system's buttons wear.
    fileprivate var title: String {
        switch self {
        case .merge: return "Create Merge Commit"
        case .squash: return "Squash and Merge"
        case .rebase: return "Rebase and Merge"
        }
    }
}
