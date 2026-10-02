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

    /// The header, on the system's type scale rather than sizes picked one
    /// by one: the title at the Title size, the one thing on the page set
    /// that large; under it a single sentence saying who wants what merged
    /// where, at the body size, its author in their GitHub picture and the
    /// two branches as the tokens the system draws for a value you can
    /// select and copy; and under that the facts it is dated and sized by,
    /// each behind its symbol in the secondary ink, as Finder's Get Info
    /// and Xcode's inspectors set a fact. The state leads the sentence as
    /// a tinted capsule — the one coloured thing in the header besides the
    /// diffstat, since it is the one thing about the pull request that can
    /// change under you.
    private var identity: some View {
        VStack(alignment: .leading, spacing: 12) {
            (Text(pull.title)
                .foregroundStyle(.primary)
                + Text("  #\(pull.number)")
                .foregroundStyle(.tertiary)
                .fontWeight(.regular))
                .font(.system(size: 22, weight: .bold))
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
            byline
            facts
        }
    }

    /// The state, then the sentence: who wants which branch merged into
    /// which. Wraps as a sentence would when the page is narrow.
    private var byline: some View {
        HStack(spacing: 8) {
            PullStateBadge(pull: pull)
            if !pull.author.isEmpty {
                HStack(spacing: 6) {
                    GitHubAvatar(login: pull.author, size: 20)
                    Text(pull.author)
                        .fontWeight(.semibold)
                        .lineLimit(1)
                }
                .help(pull.author)
            }
            Text(pull.author.isEmpty ? "Merging" : "wants to merge")
                .foregroundStyle(.secondary)
            if !pull.headRef.isEmpty {
                BranchToken(name: pull.headRef, fork: pull.fromFork)
                Text("into")
                    .foregroundStyle(.secondary)
            }
            BranchToken(name: pull.baseRef, fork: false)
        }
        .font(.system(size: 13))
        .lineLimit(1)
    }

    private var facts: some View {
        HStack(spacing: 16) {
            if let opened = Wire.date(pull.createdAt) {
                Fact(symbol: "clock", text: "Opened \(opened.formatted(.relative(presentation: .named)))")
                    .help(opened.formatted(date: .complete, time: .shortened))
            }
            if let updated = Wire.date(pull.updatedAt) {
                Fact(symbol: "arrow.triangle.2.circlepath", text: "Updated \(updated.formatted(.relative(presentation: .named)))")
                    .help(updated.formatted(date: .complete, time: .shortened))
            }
            if pull.changedFiles > 0 {
                HStack(spacing: 6) {
                    Fact(symbol: "doc.on.doc", text: "\(pull.changedFiles) \(pull.changedFiles == 1 ? "file" : "files") changed")
                    LineCounts(pull: pull)
                        .font(.system(size: 12, weight: .medium))
                    DiffStatBar(additions: pull.additions, deletions: pull.deletions)
                }
            }
        }
        .lineLimit(1)
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

/// The pull request's state as GitHub badges it — open, or a draft — in
/// the capsule the system tints a status in: the hue washed behind it, the
/// hue itself on the type.
private struct PullStateBadge: View {
    let pull: PullRequestInfo

    var body: some View {
        let hue = pull.draft ? Color.secondary : Color.green
        Label(pull.draft ? "Draft" : "Open", systemImage: pull.draft ? "pencil.circle" : "arrow.triangle.pull")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(hue)
            .padding(.horizontal, 9)
            .padding(.vertical, 3)
            .background(hue.opacity(0.16), in: Capsule())
    }
}

/// A branch, as a token: its symbol and its name in the code face, washed
/// in a capsule, selectable, cut in the middle where the name runs long —
/// the start says whose it is and the end what it is for.
private struct BranchToken: View {
    let name: String
    let fork: Bool

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: fork ? "tuningfork" : "arrow.triangle.branch")
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.secondary)
            Text(name)
                .font(.system(size: 12, design: .monospaced))
                .truncationMode(.middle)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(.quaternaryWash(0.6), in: Capsule())
        .textSelection(.enabled)
        .help(fork ? "\(name), from a fork" : name)
        .layoutPriority(name.count > 24 ? 0 : 1)
    }
}

/// One fact under the byline: its symbol and its words, in the secondary
/// ink at the caption size.
private struct Fact: View {
    let symbol: String
    let text: String

    var body: some View {
        Label {
            Text(text)
        } icon: {
            Image(systemName: symbol)
                .font(.system(size: 11))
        }
        .font(.system(size: 12))
        .foregroundStyle(.secondary)
        .labelStyle(.titleAndIcon)
    }
}

/// GitHub's five-block diffstat: the share of the lines changed that were
/// added, in green, and taken away, in red, the rest left grey when the
/// change is small enough not to fill the bar.
private struct DiffStatBar: View {
    let additions: Int
    let deletions: Int

    private static let blocks = 5

    var body: some View {
        let total = additions + deletions
        let filled = total == 0 ? 0 : min(Self.blocks, max(1, Int((Double(total) / 20).rounded(.up))))
        let green = total == 0 ? 0 : Int((Double(additions) / Double(total) * Double(filled)).rounded())
        HStack(spacing: 2) {
            ForEach(0..<Self.blocks, id: \.self) { index in
                RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                    .fill(color(at: index, green: green, filled: filled))
                    .frame(width: 8, height: 8)
            }
        }
        .accessibilityHidden(true)
    }

    private func color(at index: Int, green: Int, filled: Int) -> AnyShapeStyle {
        if index < green { return AnyShapeStyle(Color.green) }
        if index < filled { return AnyShapeStyle(Color.red) }
        return AnyShapeStyle(.quaternaryWash(1.2))
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
            Label(expanded ? "Show Less" : "Show More", systemImage: "chevron.down")
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
/// the order a "Show More" reads in, the chevron pointing where the text
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
