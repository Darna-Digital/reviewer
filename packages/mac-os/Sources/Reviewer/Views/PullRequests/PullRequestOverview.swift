// Everything about the open pull request that is not its diff — the web
// app's `PullRequestOverview`, drawn natively: who wrote it and who is on
// it, where it is going, what CI made of it, and what its author said it
// was for — plus what a reviewer does to it: checking it out, merging it,
// or closing it unmerged, the two outward-facing ones confirmed first.
//
// It stands in the island over the pull request's files, beside the diff
// (see `PullRequestColumn`), and reads down a spine: identity — title,
// byline, branches and the figures the pull request is sized by — then
// the actions, then the checks, who is on it, and what its author wrote.
// The pull request is the shell's own reading of the list (see
// `PullRequests`), so nothing here waits on the island; a number the list
// has not answered for yet stands as its number alone until it does.
import SwiftUI

struct PullRequestOverview: View {
    let pull: PullRequestInfo
    @Environment(AppModel.self) private var model
    @State private var confirmingMerge: MergeMethod?
    @State private var confirmingClose = false

    private var pulls: PullRequests { model.pullRequests }

    var body: some View {
        if pulls.isGone(pull.number) {
            PanePlaceholder(
                "#\(pull.number) is no longer open", symbol: "arrow.triangle.pull",
                detail: "It has been merged or closed since the list was read."
            ) {
                Button("Back to list") { model.leavePull() }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    identity
                    actions
                    if pull.blockedReason != nil || pull.checksHeadline != nil {
                        ThemedDivider()
                        checks
                    }
                    if !pull.assignees.isEmpty || !pull.reviewers.isEmpty || !pull.labels.isEmpty {
                        ThemedDivider()
                        details
                    }
                    if !pull.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        ThemedDivider()
                        MarkdownText(text: pull.body)
                            .padding(12)
                            .padding(.bottom, 12)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .mergeConfirmation(pull: pull, method: $confirmingMerge) { model.merge(pull: pull, method: $0) }
            .closeConfirmation(pull: pull, shown: $confirmingClose) { model.close(pull: pull) }
        }
    }

    /// The title is the one step above the rest of the column, and every
    /// fact under it is the caption size, so the eye lands on the title and
    /// the rest reads as one band rather than four lines competing for the
    /// same weight.
    private var identity: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 6) {
                PullStateIcon(pull: pull)
                    .padding(.top, 1)
                Text(pull.title)
                    .font(.system(size: 13, weight: .medium))
                    .textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
            }
            HStack(spacing: 5) {
                Text("#\(pull.number)")
                    .font(.system(size: 11, design: .monospaced))
                if !pull.author.isEmpty {
                    Text("·")
                    RepoAvatar(name: pull.author, size: 14)
                    Text(pull.author)
                        .lineLimit(1)
                }
                if !pull.updatedAt.isEmpty {
                    Text("·")
                    Text("updated \(TimeAgo.text(pull.updatedAt))")
                }
            }
            .font(.system(size: 11))
            .foregroundStyle(.secondary)
            if !pull.headRef.isEmpty {
                // The branch pair as one rail rather than a loose line: it is
                // a single fact — this goes there — so it gets a single
                // object, filled only as wide as the two names.
                HStack(spacing: 5) {
                    Text(pull.headRef)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Image(systemName: "arrow.right")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(.secondary)
                    Text(pull.baseRef)
                        .lineLimit(1)
                    if pull.fromFork {
                        Image(systemName: "arrow.triangle.branch")
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                            .help("Opened from a fork")
                    }
                }
                .font(.system(size: 11, design: .monospaced))
                .padding(.horizontal, 7)
                .padding(.vertical, 4)
                .background(.quaternaryWash(0.5), in: RoundedRectangle(cornerRadius: 6))
                .textSelection(.enabled)
            }
            if pull.changedFiles > 0 || !pull.createdAt.isEmpty {
                HStack(spacing: 10) {
                    if pull.changedFiles > 0 {
                        HStack(spacing: 4) {
                            Text("\(pull.changedFiles) \(pull.changedFiles == 1 ? "file" : "files")")
                            Text("+\(pull.additions)").foregroundStyle(.green)
                            Text("−\(pull.deletions)").foregroundStyle(.red)
                        }
                        .monospacedDigit()
                    }
                    if !pull.createdAt.isEmpty {
                        Text("opened \(TimeAgo.text(pull.createdAt)) ago")
                    }
                }
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
            }
        }
        .padding(12)
    }

    /// One filled control per view is the house rule, so Merge is the only
    /// prominent one and Check out recedes beside it; closing keeps the
    /// quiet icon face the GitHub link has and reddens only under the
    /// pointer, being the one thing here that takes the pull request away
    /// rather than doing something with it.
    private var actions: some View {
        let work = pulls.work
        let merging = work == .merging(pull.number)
        let closing = work == .closing(pull.number)
        let checkingOut = work == .checkingOut(pull.number)
        let onBranch = model.currentBranch == pull.localBranch
        return HStack(spacing: 6) {
            Menu {
                ForEach(MergeMethod.allCases) { method in
                    Button {
                        confirmingMerge = method
                    } label: {
                        Text(method.label)
                        Text(method.detail)
                    }
                }
            } label: {
                Label(merging ? "Merging…" : "Merge", systemImage: "arrow.triangle.merge")
                    .frame(maxWidth: .infinity)
            } primaryAction: {
                confirmingMerge = .merge
            }
            .menuStyle(.button)
            .buttonStyle(.borderedProminent)
            .disabled(pull.mergeBlockedReason != nil || merging || pull.headRef.isEmpty)
            .help(pull.mergeBlockedReason ?? "Merge #\(pull.number) into \(pull.baseRef) on GitHub")
            Button {
                model.checkout(pull: pull)
            } label: {
                Label(
                    onBranch ? "Checked out" : checkingOut ? "Checking out…" : "Check out",
                    systemImage: onBranch ? "checkmark" : "arrow.triangle.branch"
                )
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .disabled(onBranch || checkingOut || pull.headRef.isEmpty)
            .help(checkoutHelp(onBranch: onBranch))
            CloseButton(number: pull.number, closing: closing, disabled: closing || merging || pull.headRef.isEmpty) {
                confirmingClose = true
            }
            if !pull.url.isEmpty {
                Button {
                    model.open(pull: pull)
                } label: {
                    Image(systemName: "arrow.up.right.square")
                        .frame(width: 16, height: 16)
                }
                .buttonStyle(.borderless)
                .help("Open on GitHub")
            }
        }
        .controlSize(.small)
        .padding(.horizontal, 12)
        .padding(.bottom, 12)
    }

    private func checkoutHelp(onBranch: Bool) -> String {
        if onBranch { return "The working copy is already on \(pull.localBranch)." }
        if pull.fromFork {
            return "Fetch #\(pull.number) from the fork it was opened from and check it out as \(pull.localBranch)."
        }
        return "Fetch \(pull.headRef) from origin and check it out. An existing local branch is fast-forwarded, never reset."
    }

    /// The verdict is the row; the runs behind it are what you open when
    /// the verdict is not enough. Green folds itself away — a red or
    /// still-running one opens, because that is the one you came to read.
    private var checks: some View {
        let counts = pull.checkCounts
        return VStack(alignment: .leading, spacing: 8) {
            if let blocked = pull.blockedReason {
                HStack(alignment: .top, spacing: 6) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(.orange)
                        .padding(.top, 1)
                    Text(blocked)
                        .font(.system(size: 11))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.orange.opacity(0.1), in: RoundedRectangle(cornerRadius: 6))
                .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Color.orange.opacity(0.3), lineWidth: 1))
            }
            if let headline = pull.checksHeadline {
                ChecksDisclosure(pull: pull, headline: headline, openAtFirst: counts.failed > 0 || counts.pending > 0)
            }
        }
        .padding(12)
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: 6) {
            Legend("Details")
            if !pull.assignees.isEmpty {
                DetailRow(label: "Assignees") { People(people: pull.assignees) }
            }
            if !pull.reviewers.isEmpty {
                DetailRow(label: "Reviewers") { People(people: pull.reviewers) }
            }
            if !pull.labels.isEmpty {
                DetailRow(label: "Labels") {
                    HStack(spacing: 4) {
                        ForEach(pull.labels, id: \.name) { LabelBadge(label: $0) }
                    }
                }
            }
        }
        .padding(12)
    }
}

/// The legend a section reads under — the column's spine.
private struct Legend: View {
    let text: String

    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(.system(size: 10, weight: .medium))
            .textCase(.uppercase)
            .foregroundStyle(.secondary)
    }
}

/// One row of a section: a name on the left, its figure on the right — the
/// one shape both sections are made of, so the column has a left edge and
/// a right one.
private struct DetailRow<Value: View>: View {
    let label: String
    @ViewBuilder let value: Value

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
            Spacer(minLength: 8)
            value
                .font(.system(size: 11))
        }
        .frame(minHeight: 18)
    }
}

private struct People: View {
    let people: [String]

    var body: some View {
        HStack(spacing: 4) {
            ForEach(people.prefix(3), id: \.self) { RepoAvatar(name: $0, size: 14) }
            Text(people.joined(separator: ", "))
                .lineLimit(1)
                .truncationMode(.tail)
        }
    }
}

/// The checks: the headline over the runs, each with its dot, its name
/// linking to its page on GitHub, and its verdict; capped, the rest
/// counted, with the failures and the still-running first — the ones
/// worth the room are the ones with something to say.
private struct ChecksDisclosure: View {
    let pull: PullRequestInfo
    let headline: String
    let openAtFirst: Bool
    @State private var open = false
    @Environment(AppModel.self) private var model

    private static let shown = 6

    var body: some View {
        let counts = pull.checkCounts
        let rank: [CheckState: Int] = [.failure: 0, .pending: 1, .neutral: 2, .success: 3]
        let ordered = pull.checks.sorted { (rank[$0.state] ?? 4) < (rank[$1.state] ?? 4) }
        DisclosureGroup(isExpanded: $open) {
            VStack(alignment: .leading, spacing: 2) {
                ForEach(ordered.prefix(Self.shown), id: \.name) { check in
                    HStack(spacing: 4) {
                        CheckDot(state: check.state)
                        if let url = URL(string: check.url), !check.url.isEmpty {
                            Link(check.name, destination: url)
                                .lineLimit(1)
                        } else {
                            Text(check.name)
                                .lineLimit(1)
                        }
                        Spacer(minLength: 8)
                        Text(check.state.word)
                            .foregroundStyle(.secondary)
                    }
                    .font(.system(size: 11))
                    .frame(minHeight: 18)
                }
                if counts.total > Self.shown, let url = URL(string: "\(pull.url)/checks") {
                    HStack(spacing: 4) {
                        Spacer().frame(width: 14)
                        Link("\(counts.total - Self.shown) more on GitHub", destination: url)
                            .font(.system(size: 11))
                    }
                    .frame(minHeight: 18)
                }
            }
            .padding(.top, 4)
        } label: {
            HStack(spacing: 6) {
                ChecksIcon(pull: pull, size: 12)
                Text(headline)
                    .font(.system(size: 11, weight: .medium))
                    .lineLimit(1)
                Spacer(minLength: 8)
                if let tally = pull.checksTally {
                    Text(tally)
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }
            }
        }
        .onAppear { open = openAtFirst }
        .onChange(of: pull.number) { _, _ in open = openAtFirst }
    }
}

/// Closing, as a quiet icon that reddens under the pointer.
private struct CloseButton: View {
    let number: Int
    let closing: Bool
    let disabled: Bool
    let action: () -> Void
    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            Image(systemName: "xmark.circle")
                .frame(width: 16, height: 16)
                .foregroundStyle(isHovering && !disabled ? Color.red : Color.secondary)
        }
        .buttonStyle(.borderless)
        .disabled(disabled)
        .onHover { isHovering = $0 }
        .help(closing ? "Closing…" : "Close #\(number) without merging")
    }
}

extension View {
    /// Merging is outward-facing and not ours to undo, so it is confirmed —
    /// and the confirmation is where the reasons to think twice that are not
    /// reasons to refuse (a red check, a mergeability GitHub has not worked
    /// out) finally get said.
    fileprivate func mergeConfirmation(
        pull: PullRequestInfo, method: Binding<MergeMethod?>, merge: @escaping (MergeMethod) -> Void
    ) -> some View {
        alert(
            "Merge #\(pull.number) into \(pull.baseRef)?",
            isPresented: Binding(get: { method.wrappedValue != nil }, set: { if !$0 { method.wrappedValue = nil } }),
            presenting: method.wrappedValue
        ) { chosen in
            Button("Merge") { merge(chosen) }
            Button("Cancel", role: .cancel) {}
        } message: { chosen in
            Text(
                "This merges \(pull.headRef) on GitHub as a \(chosen.label.lowercased())."
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
            Button("Close pull request", role: .destructive) { close() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("\(pull.headRef) keeps its commits and stays where it is. Reopening #\(pull.number) is done on GitHub.")
        }
    }
}
