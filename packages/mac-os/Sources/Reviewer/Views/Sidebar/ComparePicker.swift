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
// work is aimed at marked and the comparison that is on ticked. A
// comparison is one repository's, so across a workspace the list opens on
// its repositories, the way the branch switcher does: a pick moves on to
// that one's branches, and a branch picked there turns the review to that
// repository, read against it.
import SwiftUI

struct ComparePicker: View {
    let comparison: ShellComparison
    @Environment(AppModel.self) private var model
    @State private var open = false

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
            ComparePopover(comparison: comparison, dismiss: { open = false })
        }
        .closesOnNavigation($open)
    }
}

/// The picker's list, a popover of its own so the repository it stepped
/// into is forgotten each time it is put away.
private struct ComparePopover: View {
    let comparison: ShellComparison
    let dismiss: () -> Void
    @Environment(AppModel.self) private var model
    /// The repository the popover has moved on to, across a workspace.
    @State private var drilled: String?

    private static let uncommittedID = "uncommitted"

    private var single: RootModel? { model.roots.count > 1 ? nil : model.focused }
    private var shownRoot: RootModel? { single ?? model.root(at: drilled) }

    var body: some View {
        VStack(spacing: 0) {
            if single == nil, let shownRoot {
                RepositoryBackRow(root: shownRoot) { drilled = nil }
            }
            BranchPopover(
                sections: sections, placeholder: placeholder, pick: pick, dismiss: dismiss, actions: nil,
                drillsIn: { shownRoot == nil && $0.id != Self.uncommittedID }
            ) {
                EmptyView()
            }
        }
        .task {
            await withTaskGroup(of: Void.self) { group in
                for root in model.roots {
                    group.addTask { await root.loadBranches() }
                }
            }
        }
    }

    /// "Uncommitted only" stands over the repositories rather than inside
    /// one: across a workspace it is every repository's changes at once.
    private var uncommitted: BranchChoiceSection {
        BranchChoiceSection(
            id: Self.uncommittedID, title: nil,
            rows: [.answer(id: Self.uncommittedID, title: "Uncommitted changes", symbol: "pencil", checked: comparison.against == nil)],
            hiddenWhileSearching: true)
    }

    private var sections: [BranchChoiceSection] {
        guard let root = shownRoot else {
            return [uncommitted, BranchChoiceSection(id: "repositories", title: "Compare a repository", rows: model.roots.map(repositoryRow))]
        }
        let candidates = ComparisonCandidates(of: root, aim: isPage(root) ? comparison.aim : nil)
        let checked = isPage(root) ? comparison.against : nil
        let row = { (candidate: BranchRef) -> BranchChoice in
            .branch(candidate, badge: candidate.ref == candidates.aim ? "lands here" : nil, checked: candidate.ref == checked)
        }
        return (single == nil ? [] : [uncommitted]) + [
            BranchChoiceSection(id: "local", title: "Compare against a branch", rows: candidates.local.map(row)),
            BranchChoiceSection(id: "remote", title: "Compare against a remote", rows: candidates.remote.map(row)),
        ]
    }

    private var placeholder: String {
        guard let root = shownRoot else { return "Search repositories" }
        return single == nil ? "Search \(root.name)’s branches" : "Search branches"
    }

    /// Whether `root` is the repository the page reads — the one the
    /// comparison it reported is of.
    private func isPage(_ root: RootModel) -> Bool {
        root === model.focusedRoot
    }

    /// A repository, with what it is read against when it is the page's
    /// and the branch it is on otherwise.
    private func repositoryRow(_ root: RootModel) -> BranchChoice {
        let against = isPage(root) ? comparison.against : nil
        return BranchChoice(
            id: root.path, branch: nil, title: root.name, symbol: "folder", tint: nil,
            badge: nil, checked: against != nil,
            detail: against.map { "vs \($0)" } ?? root.branch ?? "Detached HEAD",
            detailSymbol: "arrow.triangle.branch", monograms: [root.name])
    }

    /// A repository moves on to its branches; a branch is what the review
    /// is read against, in the repository it is listed under.
    private func pick(_ choice: BranchChoice) {
        guard let root = shownRoot else {
            if choice.id == Self.uncommittedID {
                model.readChanges(against: nil)
            } else {
                drilled = choice.id
            }
            return
        }
        model.readChanges(against: choice.branch?.ref, in: single == nil ? root : nil)
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

extension ComparisonCandidates {
    @MainActor init(of root: RootModel, aim: String?) {
        self.init(
            local: root.branches.filter { !$0.isCurrent }.map(BranchRef.init),
            remote: root.remoteBranches.map(BranchRef.init),
            aim: aim)
    }
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
