// Everything about the open pull request that is not its diff — the web
// app's `PullRequestOverview`, drawn natively: who wrote it and who is on
// it, where it is going, what CI made of it, and what its author said it
// was for — plus what a reviewer does to it: checking it out, merging it,
// or closing it unmerged, the two outward-facing ones confirmed first.
//
// It heads the pull request's page, across the whole width over the files
// and the diff, and is scrolled away to read them (see `PullRequestPage`).
// Laid out the way GitHub lays a pull request's conversation out, and the
// way a Mac inspector stands beside its document: on the left what the
// pull request *is* — title, byline, branches, size, and what its author
// wrote — and down a column on the right what is *done* with it and what
// stands in its way — the actions, the checks, who is on it (see
// `PullRequestInspector`). A page too narrow for
// two columns stacks them, the column's boxes between the identity and the
// description. The pull request is the shell's own reading of the list
// (see `PullRequests`), so nothing here waits on the island; a number the
// list has not answered for yet stands as its number alone until it does.
import SwiftUI

struct PullRequestOverview: View {
    let pull: PullRequestInfo
    /// The width of the page the overview heads, for it to choose between
    /// its two columns and its stack.
    let width: CGFloat
    @Environment(AppModel.self) private var model

    private static let inspectorWidth: CGFloat = 300
    /// Below this the inspector would squeeze the description to a strip.
    private static let twoColumnWidth: CGFloat = 760
    /// A description reads at a measure, not the page's width.
    private static let readingWidth: CGFloat = 780

    private var pulls: PullRequests { model.pullRequests }
    private var hasDescription: Bool { !pull.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    var body: some View {
        if pulls.isGone(pull.number) {
            PanePlaceholder(
                "#\(pull.number) is no longer open", symbol: "arrow.triangle.pull",
                detail: "It has been merged or closed since the list was read."
            ) {
                Button("Back to list") { model.leavePull() }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 240)
        } else {
            Group {
                if width >= Self.twoColumnWidth {
                    HStack(alignment: .top, spacing: 28) {
                        VStack(alignment: .leading, spacing: 20) {
                            identity
                            description
                        }
                        .frame(maxWidth: Self.readingWidth, alignment: .leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        PullRequestInspector(pull: pull)
                            .frame(width: Self.inspectorWidth)
                    }
                } else {
                    VStack(alignment: .leading, spacing: 20) {
                        identity
                        PullRequestInspector(pull: pull)
                            .frame(maxWidth: Self.inspectorWidth)
                        description
                    }
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 22)
            .padding(.bottom, 26)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// The title is the page's headline, a step above everything else on
    /// it, and every fact under it is the caption size, so the eye lands on
    /// the title and the rest reads as one band rather than four lines
    /// competing for the same weight.
    private var identity: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                PullStateIcon(pull: pull, size: 16)
                Text(pull.title)
                    .font(.system(size: 20, weight: .semibold))
                    .textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
                Text("#\(pull.number)")
                    .font(.system(size: 20, weight: .regular))
                    .foregroundStyle(.tertiary)
            }
            HStack(spacing: 6) {
                if pull.draft {
                    Text("Draft")
                        .font(.system(size: 10, weight: .semibold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(.quaternaryWash(0.8), in: Capsule())
                }
                if !pull.author.isEmpty {
                    RepoAvatar(name: pull.author, size: 16)
                    Text(pull.author)
                        .fontWeight(.medium)
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Text("wants to merge into")
                } else {
                    Text("Into")
                }
                branches
                if !pull.createdAt.isEmpty {
                    Text("· opened \(TimeAgo.text(pull.createdAt)) ago")
                }
                if !pull.updatedAt.isEmpty {
                    Text("· updated \(TimeAgo.text(pull.updatedAt))")
                }
            }
            .font(.system(size: 12))
            .foregroundStyle(.secondary)
            .lineLimit(1)
            if pull.changedFiles > 0 {
                HStack(spacing: 6) {
                    Text("\(pull.changedFiles) \(pull.changedFiles == 1 ? "file" : "files") changed")
                    LineCounts(pull: pull)
                }
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .monospacedDigit()
            }
        }
    }

    /// The branch pair as one rail rather than a loose line: it is a single
    /// fact — this goes there — so it gets a single object, filled only as
    /// wide as the two names.
    @ViewBuilder
    private var branches: some View {
        if !pull.headRef.isEmpty {
            HStack(spacing: 5) {
                Text(pull.baseRef)
                    .lineLimit(1)
                Image(systemName: "arrow.left")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(.secondary)
                Text(pull.headRef)
                    .lineLimit(1)
                    .truncationMode(.middle)
                if pull.fromFork {
                    Image(systemName: "arrow.triangle.branch")
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                        .help("Opened from a fork")
                }
            }
            .font(.system(size: 11, design: .monospaced))
            .foregroundStyle(.primary)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(.quaternaryWash(0.5), in: RoundedRectangle(cornerRadius: 6))
            .textSelection(.enabled)
            .layoutPriority(1)
        } else {
            Text(pull.baseRef)
                .font(.system(size: 11, design: .monospaced))
        }
    }

    @ViewBuilder
    private var description: some View {
        if hasDescription {
            MarkdownText(text: pull.body, size: 13)
        } else {
            Text("No description provided.")
                .font(.system(size: 13))
                .italic()
                .foregroundStyle(.tertiary)
        }
    }
}
