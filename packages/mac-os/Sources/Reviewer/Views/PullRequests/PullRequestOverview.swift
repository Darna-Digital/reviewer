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
                        // The head ruled off from the body, as Mail rules a
                        // message's head off from what it says.
                        VStack(alignment: .leading, spacing: 18) {
                            identity
                            ThemedDivider()
                            description
                        }
                        .frame(maxWidth: Self.readingWidth, alignment: .leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        PullRequestInspector(pull: pull)
                            .frame(width: Self.inspectorWidth)
                    }
                } else {
                    VStack(alignment: .leading, spacing: 18) {
                        identity
                        PullRequestInspector(pull: pull)
                            .frame(maxWidth: Self.inspectorWidth)
                        ThemedDivider()
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

    /// The header: the title, and under it two quiet lines — who opened it
    /// and when, then which branch goes where. Everything under the title is
    /// plain text in the secondary ink at one size, the author's name alone
    /// stepped up to the primary, so the eye has the title and one name to
    /// land on. A first version dressed each fact — a badge for the state, a
    /// chip and a symbol per branch, an icon per date, a diffstat bar — and
    /// the header read as a row of controls rather than as a heading; what it
    /// dropped is said elsewhere already: an open pull request is the only
    /// kind the list holds, and the bar over the files carries their count
    /// and the lines changed.
    ///
    /// Set as Mail sets a message's head: the person's picture at the height
    /// of the two lines beside it, their name over what they are proposing,
    /// so the meta reads as one block hung off the picture rather than as two
    /// loose lines. The title is a semibold step tightened as the system
    /// tightens its display sizes, the number in the same run a shade down
    /// rather than spaced off on its own.
    private var identity: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                (Text(pull.title)
                    .foregroundStyle(.primary)
                    + Text(" #\(pull.number)")
                    .foregroundStyle(.secondary)
                    .fontWeight(.regular))
                    .font(.system(size: 21, weight: .semibold))
                    .tracking(-0.3)
                    .lineSpacing(2)
                    .textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
                if pull.draft {
                    DraftBadge()
                }
            }
            HStack(alignment: .center, spacing: 10) {
                if !pull.author.isEmpty {
                    GitHubAvatar(login: pull.author, size: 32)
                }
                VStack(alignment: .leading, spacing: 3) {
                    byline
                    branches
                }
            }
        }
    }

    /// The author's name, then when it was opened and last touched — the
    /// exact dates on hover.
    private var byline: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            if !pull.author.isEmpty {
                Text(pull.author)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.primary)
            }
            Text(dates)
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .help(exactDates)
        }
        .lineLimit(1)
    }

    /// The branch pair as one line in the code face, head to base, the
    /// arrow pointing the way the merge goes. Selectable, to be copied.
    @ViewBuilder
    private var branches: some View {
        if !pull.headRef.isEmpty {
            HStack(spacing: 5) {
                Text(pull.headRef)
                    .truncationMode(.middle)
                Image(systemName: "arrow.right")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(.tertiary)
                Text(pull.baseRef)
                    .layoutPriority(1)
            }
            .font(.system(size: 11.5, design: .monospaced))
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .textSelection(.enabled)
            .help(pull.fromFork ? "\(pull.headRef), from a fork, into \(pull.baseRef)" : "\(pull.headRef) into \(pull.baseRef)")
        }
    }

    private var dates: String {
        var parts: [String] = []
        if let opened = Wire.date(pull.createdAt) {
            parts.append("opened \(opened.formatted(.relative(presentation: .named)))")
        }
        if let updated = Wire.date(pull.updatedAt), pull.updatedAt != pull.createdAt {
            parts.append("updated \(updated.formatted(.relative(presentation: .named)))")
        }
        return parts.joined(separator: " · ")
    }

    private var exactDates: String {
        [("Opened", pull.createdAt), ("Updated", pull.updatedAt)]
            .compactMap { label, iso in
                Wire.date(iso).map { "\(label) \($0.formatted(date: .complete, time: .shortened))" }
            }
            .joined(separator: "\n")
    }

    @ViewBuilder
    private var description: some View {
        if hasDescription {
            CollapsedDescription {
                MarkdownText(text: pull.body, size: 13)
            }
            // A pull request of its own opens folded again.
            .id(pull.number)
        } else {
            Text("No description provided.")
                .font(.system(size: 13))
                .italic()
                .foregroundStyle(.tertiary)
        }
    }
}

/// A draft, said beside the title as GitHub says it: the one state worth a
/// mark, since a draft is not yet asking for review.
private struct DraftBadge: View {
    var body: some View {
        Text("Draft")
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 7)
            .padding(.vertical, 2)
            .background(.quaternaryWash(0.8), in: Capsule())
            .fixedSize()
    }
}

/// A description long enough to push the files and the diff a screen or
/// more down the page, folded to its opening: cut at a height, faded out
/// over its last lines so the cut reads as "there is more" rather than as
/// the end, with the chevron under it to unfold it — and to fold it again.
/// The page is for the diff, and most descriptions are read in their first
/// paragraph. One short enough to show whole is left whole, with no
/// chevron to promise more than there is.
private struct CollapsedDescription<Content: View>: View {
    @ViewBuilder let content: Content
    @State private var expanded = false
    @State private var fullHeight: CGFloat = 0

    /// How much shows folded: a paragraph or two, a table's head.
    private static var foldedHeight: CGFloat { 220 }
    /// The run over which the folded text fades out.
    private static var fade: CGFloat { 72 }
    /// Folding a description only a few lines longer than the fold would
    /// hide less than the chevron costs.
    private static var slack: CGFloat { 60 }

    private var folds: Bool { fullHeight > Self.foldedHeight + Self.slack }
    private var folded: Bool { folds && !expanded }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            content
                .fixedSize(horizontal: false, vertical: true)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { fullHeight = $0 }
                .frame(maxHeight: folded ? Self.foldedHeight : nil, alignment: .top)
                .clipped()
                .mask {
                    VStack(spacing: 0) {
                        Rectangle()
                        LinearGradient(colors: [.black, .clear], startPoint: .top, endPoint: .bottom)
                            .frame(height: folded ? Self.fade : 0)
                    }
                }
                // Folded, the chevron stands in the fade itself, the text
                // running out behind it — on a row of its own under the
                // fade, the gradient stopped short of it and the cut showed
                // as a hard edge after all.
                .overlay(alignment: .bottom) {
                    if folded { toggle }
                }
            if folds && !folded {
                toggle
            }
        }
    }

    private var toggle: some View {
        Button {
            withAnimation(.snappy(duration: 0.3)) { expanded.toggle() }
        } label: {
            Label(expanded ? "Show less" : "Show more", systemImage: "chevron.down")
                .labelStyle(ChevronAfterTitle(turned: expanded))
                .font(.system(size: 12, weight: .medium))
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .foregroundStyle(.secondary)
        .background(.quaternaryWash(0.5), in: Capsule())
        // On the sheet's own colour first, so the last of the faded text
        // does not show through the wash where the pill stands over it.
        .background(Color(nsColor: IslandPalette.island), in: Capsule())
        .frame(maxWidth: .infinity)
        .help(expanded ? "Fold the description" : "Show the whole description")
    }
}

/// The words, then the chevron, turned up while the text is unfolded —
/// the order a "Show more" reads in, the chevron pointing where the text
/// will go.
private struct ChevronAfterTitle: LabelStyle {
    let turned: Bool

    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 4) {
            configuration.title
            configuration.icon
                .font(.system(size: 9, weight: .semibold))
                .rotationEffect(.degrees(turned ? 180 : 0))
        }
    }
}
