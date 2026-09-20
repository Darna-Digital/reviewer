// What your own changes are read against, said out loud and changed from
// there — the web header's compare picker, which stands over the diff in
// the browser; here it stands beside the branch picker at the head of the
// sidebar, since that is where the shell keeps the commit view's controls.
// The branch picker names the branch the tree is a tree of; this names
// what its changes are measured from: the branch as it is committed,
// or the merge base with another branch, so "how does this branch differ
// from main" can be asked before there is a pull request to ask it for you.
// The list is the web one's, as a `BranchPopover`: uncommitted only at
// its head, then the local branches, then the remotes, the branch the
// work is aimed at marked and the comparison that is on ticked.
import SwiftUI

struct ComparePicker: View {
    let comparison: ShellComparison
    @Environment(AppModel.self) private var model
    @State private var open = false

    private var candidates: ComparisonCandidates {
        ComparisonCandidates(
            local: model.branches.filter { !$0.isCurrent }.map(BranchRef.init),
            remote: model.remoteBranches.map(BranchRef.init),
            aim: comparison.aim)
    }

    private var labels: ComparisonLabels {
        ComparisonLabels(against: comparison.against, branch: model.currentBranch)
    }

    private var symbol: String {
        guard let against = comparison.against else { return "arrow.left.arrow.right" }
        return against.contains("/") ? "cloud" : "arrow.triangle.branch"
    }

    var body: some View {
        Button { open.toggle() } label: {
            HStack(spacing: 5) {
                Image(systemName: symbol)
                    .foregroundStyle(.secondary)
                Text(labels.base)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .layoutPriority(1)
                Image(systemName: "arrow.left.arrow.right")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(.secondary)
                Text(labels.headShort)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Image(systemName: "chevron.down")
                    .font(.system(size: 8, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
        }
        .buttonStyle(.accessoryBar)
        .help(labels.summary)
        .popover(isPresented: $open, arrowEdge: .bottom) {
            BranchPopover(sections: sections, placeholder: "Search branches", pick: { choice in
                model.readChanges(against: choice.branch?.ref)
            }, dismiss: { open = false })
        }
    }

    private var sections: [BranchChoiceSection] {
        let candidates = candidates
        return [
            BranchChoiceSection(
                id: "uncommitted", title: nil,
                rows: [.answer(id: "uncommitted", title: "Uncommitted changes", symbol: "pencil", checked: comparison.against == nil)],
                hiddenWhileSearching: true),
            BranchChoiceSection(id: "local", title: "Compare against a branch", rows: candidates.local.map(row)),
            BranchChoiceSection(id: "remote", title: "Compare against a remote", rows: candidates.remote.map(row)),
        ]
    }

    private func row(_ candidate: BranchRef) -> BranchChoice {
        .branch(candidate, badge: candidate.ref == comparison.aim ? "lands here" : nil, checked: candidate.ref == comparison.against)
    }
}

/// The branches worth offering, split by where they live, the way core's
/// `comparisonCandidates` splits them: the checked-out branch is left out of
/// the local list — diffed with itself it says nothing "uncommitted only"
/// does not — while its remote counterpart stays in, since `origin/feature`
/// against `feature` is the question "what have I not pushed yet".
struct ComparisonCandidates {
    let local: [BranchRef]
    let remote: [BranchRef]
    let aim: String?
}

/// How a comparison reads — core's `comparisonLabels`: the two sides, the
/// head without repeating a name the base has just said, and the sentence
/// they make for a tooltip.
struct ComparisonLabels {
    let base: String
    let head: String
    let headShort: String
    let summary: String

    init(against: String?, branch: String?) {
        let here = branch.flatMap { $0.isEmpty ? nil : $0 } ?? "this checkout"
        base = against ?? here
        head = "\(here) with changes"
        headShort = against == nil ? "with changes" : head
        summary = "Comparing ‘\(base)’ against ‘\(head)’"
    }
}
