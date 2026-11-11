// The workspace's branches a step at a time — the popover the sidebar's
// title and the agent chat's workspace chip both open. With several
// repositories it opens on them, each with the branch it is on; a pick
// moves on to that one's branches, with the way back above them, and a
// branch picked is checked out in the repository it is listed under. With
// one it opens straight on that one's branches. A move between the steps
// swaps the list's rows for the step's at once, the way back standing over
// a repository's branches.
import SwiftUI

struct WorkspaceBranchPopover<Footer: View>: View {
    let dismiss: () -> Void
    /// The row menu of a repository's branches, where the picker offers
    /// one for that repository.
    var actions: ((RootModel) -> ((BranchRef) -> [BranchAction])?)? = nil
    /// The popover's foot, given the repository whose branches are up, or
    /// nil over the repositories.
    @ViewBuilder let footer: (RootModel?) -> Footer

    @Environment(AppModel.self) private var model
    /// The repository whose branches the popover has moved on to.
    @State private var drilled: String?

    private var single: RootModel? { model.roots.count == 1 ? model.roots.first : nil }
    private var shownRoot: RootModel? { single ?? model.root(at: drilled) }

    var body: some View {
        VStack(spacing: 0) {
            if single == nil, let shownRoot {
                RepositoryBackRow(root: shownRoot) { drilled = nil }
            }
            BranchPopover(
                sections: sections, placeholder: placeholder, pick: pick, dismiss: dismiss,
                actions: rowActions, rowActions: repositoryMenu, drillsIn: { $0.branch == nil }
            ) {
                footer(shownRoot)
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

    /// The step's rows: the workspace's repositories, each with the branch
    /// it is on — or the one picked's branches.
    private var sections: [BranchChoiceSection] {
        if let root = shownRoot { return Self.branchSections(of: root) }
        return [BranchChoiceSection(
            id: "repositories", title: nil,
            rows: model.roots.map { root in
                BranchChoice(
                    id: root.path, branch: nil, title: root.name, symbol: "folder", tint: nil,
                    badge: nil, checked: false,
                    detail: root.branch ?? "Detached HEAD", detailSymbol: "arrow.triangle.branch",
                    monograms: [root.name])
            })]
    }

    private var placeholder: String {
        guard let root = shownRoot else { return "Search repositories" }
        return single == nil ? "Search \(root.name)’s branches" : "Search branches"
    }

    /// A repository's row menu — switch to it, replace it, remove it — on
    /// the step that lists them.
    private var repositoryMenu: ((BranchChoice) -> [BranchAction])? {
        guard shownRoot == nil else { return nil }
        return { choice in model.root(at: choice.id).map(model.repositoryActions(for:)) ?? [] }
    }

    private var rowActions: ((BranchRef) -> [BranchAction])? {
        guard let actions, let root = shownRoot else { return nil }
        return actions(root)
    }

    /// A repository moves on to its branches; a branch is checked out in
    /// the repository it is listed under.
    private func pick(_ choice: BranchChoice) {
        guard let root = shownRoot else {
            drilled = choice.id
            return
        }
        guard let branch = choice.branch, !branch.isCurrent else { return }
        if model.roots.count > 1 {
            model.checkout(branch.ref, in: root)
        } else {
            model.checkout(branch.ref)
        }
    }

    private static func branchSections(of root: RootModel) -> [BranchChoiceSection] {
        let local = root.branches.map { BranchChoice.branch(BranchRef($0), badge: branchDistance($0)) }
        return [
            BranchChoiceSection(id: "recent", title: "Recent", rows: Array(local.prefix(5)), hiddenWhileSearching: true),
            BranchChoiceSection(id: "local", title: "Local", rows: local),
            BranchChoiceSection(id: "remote", title: "Remote", rows: root.remoteBranches.map { .branch(BranchRef($0)) }),
        ]
    }
}

/// The way back to a workspace's repositories, over the branches of one —
/// in every picker that steps from a repository into its branches.
struct RepositoryBackRow: View {
    let root: RootModel
    let back: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Button { back() } label: {
                HStack(spacing: 8) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.secondary)
                    RepoAvatar(name: root.name, size: 16)
                    Text(root.name)
                        .font(.system(size: 12, weight: .semibold))
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 12)
                .frame(height: 34)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help("Back to the repositories")
            ThemedDivider()
        }
    }
}
