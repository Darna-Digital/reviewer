// What your own changes are read against, said out loud and changed from
// there — the web header's compare picker, which stands over the diff in
// the browser; here it stands at the end of the changes' filter row, a
// scope over the list it measures, the way Finder's scope bar stands over
// its results. The sidebar's title names the branch the tree is a tree
// of; this names
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

    /// The filter beside it keeps the row's width; a long base is cut.
    private static let maxWidth: CGFloat = 130

    private var symbol: String {
        guard let against = comparison.against else { return "arrow.left.arrow.right" }
        return against.contains("/") ? "cloud" : "arrow.triangle.branch"
    }

    var body: some View {
        PaneBarPopUp(title: labels.chip, help: nil, maxWidth: Self.maxWidth) {
            Image(systemName: symbol)
                .foregroundStyle(.secondary)
        } action: {
            open.toggle()
        }
        .popover(isPresented: $open, arrowEdge: .bottom) {
            BranchPopover(sections: sections, placeholder: "Search branches", pick: { choice in
                model.readChanges(against: choice.branch?.ref)
            }, dismiss: { open = false })
        }
        .closesOnNavigation($open)
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

/// How a comparison reads — core's `comparisonLabels`, cut down to what
/// the chip has room for: the base alone, since the branch picker beside
/// it already names the head, and the full sentence for the tooltip. With
/// nothing to compare against the chip says "Uncommitted" rather than
/// repeating the branch name the picker next to it just said.
struct ComparisonLabels {
    let chip: String
    let summary: String

    init(against: String?, branch: String?) {
        let here = branch.flatMap { $0.isEmpty ? nil : $0 } ?? "this checkout"
        chip = against.map { "vs \($0)" } ?? "Uncommitted"
        summary = "Comparing ‘\(against ?? here)’ against ‘\(here) with changes’"
    }
}
