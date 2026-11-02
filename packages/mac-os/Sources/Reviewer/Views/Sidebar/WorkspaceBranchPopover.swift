// The workspace's branches a step at a time — the popover the sidebar's
// title and the agent chat's workspace chip both open. With several
// repositories it opens on them, each with the branch it is on; a pick
// moves on to that one's branches, with the way back above them, and a
// branch picked is checked out in the repository it is listed under. With
// one it opens straight on that one's branches. A move between the steps
// is one list whose rows are the step's, so it is the popover easing to
// the new rows' height and the way back fading in above them, nothing
// sliding sideways.
import SwiftUI

struct WorkspaceBranchPopover<Footer: View>: View {
    let dismiss: () -> Void
    /// Whether the repository the page is on is ticked among the others —
    /// the sidebar's title, which names it; the chat's chip names none.
    var ticksFocused = false
    /// The row menu of a repository's branches, where the picker offers
    /// one for that repository.
    var actions: ((RootModel) -> ((BranchRef) -> [BranchAction])?)? = nil
    /// The popover's foot, given the repository whose branches are up, or
    /// nil over the repositories.
    @ViewBuilder let footer: (RootModel?) -> Footer

    @Environment(AppModel.self) private var model
    /// The repository whose branches the popover has moved on to.
    @State private var drilled: String? {
        didSet { if let drilled { left = drilled } }
    }
    /// The last one moved on to, which the way back keeps naming while it
    /// eases shut.
    @State private var left: String?

    /// The way back's row and the rule under it.
    private static var backHeight: CGFloat { 35 }

    private var single: RootModel? { model.roots.count == 1 ? model.roots.first : nil }
    private var leftRoot: RootModel? { model.root(at: left) }
    private var shownRoot: RootModel? { single ?? model.root(at: drilled) }

    var body: some View {
        VStack(spacing: 0) {
            // The way back eases open on the curve the list grows on, rather
            // than standing up whole above it: a row appearing at once while
            // the list eased made the popover jump and then glide.
            if single == nil {
                back(from: shownRoot ?? leftRoot)
                    .frame(height: shownRoot == nil ? 0 : Self.backHeight, alignment: .top)
                    .clipped()
                    .opacity(shownRoot == nil ? 0 : 1)
                    .allowsHitTesting(shownRoot != nil)
            }
            BranchPopover(
                sections: sections, placeholder: placeholder, pick: pick, dismiss: dismiss,
                actions: rowActions, rowActions: repositoryMenu, drillsIn: { $0.branch == nil }, easesHeight: true
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
                    badge: nil, checked: ticksFocused && root === model.focusedRoot,
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
            return step { drilled = choice.id }
        }
        guard let branch = choice.branch, !branch.isCurrent else { return }
        if model.roots.count > 1 {
            model.checkout(branch.ref, in: root)
        } else {
            model.checkout(branch.ref)
        }
    }

    /// The way back to the repositories, over the branches of one.
    private func back(from root: RootModel?) -> some View {
        VStack(spacing: 0) {
            Button { step { drilled = nil } } label: {
                HStack(spacing: 8) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.secondary)
                    if let root {
                        RepoAvatar(name: root.name, size: 16)
                        Text(root.name)
                            .font(.system(size: 12, weight: .semibold))
                    }
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

    /// A move between the steps: the rows and the back row crossfading,
    /// the popover easing to the new rows' height — on the curve the
    /// list's own height moves on, so the two arrive together.
    private func step(_ move: () -> Void) {
        withAnimation(BranchPopover<EmptyView>.resize, move)
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
