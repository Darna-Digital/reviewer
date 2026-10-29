// The branch picker at the head of the sidebar — and on the session bar's
// strip: a flat chip naming the branch you are on, opening the web app's
// switcher as a `BranchPopover` — Recent, Local, Remote, the branch you
// are on starred and the others carrying their distance from upstream, a
// search over all of them, and on every row the same menu of everything
// you can do to it. A row picked checks the branch out; the popover's
// foot holds what needs no branch — a new one, update, push.
import SwiftUI

struct BranchPicker: View {
    /// How the picker stands: a chip naming the branch, as on the session
    /// bar's strip; or the sidebar's title — the repository over its
    /// branch, the way Xcode's toolbar names a project over the branch it
    /// is on — whose popover opens on the workspace's repositories and
    /// steps into one's branches (see `WorkspaceBranchPopover`), so one
    /// control says and switches both.
    enum Look {
        case chip
        case title
    }

    var look: Look = .chip
    @Environment(AppModel.self) private var model
    @Environment(\.controlSize) private var controlSize
    /// Sidebar pages kept up behind the one in front carry pickers of their
    /// own; only the one in front answers ⇧⌘B.
    @Environment(\.sidebarPageInFront) private var inFront
    @State private var open = false

    private var name: String { model.currentBranch ?? "No branch" }
    /// The accessory bar's type at the size the chip is cut to — named,
    /// so the tooltip measures the name in the font the chip sets it in.
    private var font: NSFont { .systemFont(ofSize: controlSize == .small ? 11 : 13) }

    var body: some View {
        label
            .disabled(!model.hasProject)
            .popover(isPresented: $open, arrowEdge: .bottom) { popover }
            .closesOnNavigation($open)
            .onChange(of: model.branchPickerRequests) {
                if inFront { open.toggle() }
            }
    }

    /// The title's popover is the workspace's, a step at a time, as the
    /// agent chat's chip opens it; the chip's is the branches of the
    /// repository the page is on.
    @ViewBuilder
    private var popover: some View {
        if look == .title {
            WorkspaceBranchPopover(dismiss: { open = false }, ticksFocused: true,
                                   actions: { actionsOffered(in: $0) }) { root in
                ThemedDivider()
                HStack(spacing: 2) {
                    if let root, root === model.focusedRoot {
                        branchFooterButtons
                    }
                    Spacer(minLength: 0)
                    Button("Add repository…") { open = false; model.chooseRootToAdd() }
                }
                .popoverFooterBar()
            }
        } else {
            BranchPopover(
                sections: sections, placeholder: "Search branches",
                pick: pick, dismiss: { open = false }, actions: model.branchActions(for:)
            ) {
                ThemedDivider()
                HStack(spacing: 2) {
                    branchFooterButtons
                    Spacer(minLength: 0)
                }
                .popoverFooterBar()
            }
        }
    }

    /// What can be done to a branch, and to the repository, act on the
    /// repository the page is on, so they are offered only over its
    /// branches.
    private func actionsOffered(in root: RootModel) -> ((BranchRef) -> [BranchAction])? {
        guard root === model.focusedRoot else { return nil }
        return { [model] branch in model.branchActions(for: branch) }
    }

    @ViewBuilder
    private var branchFooterButtons: some View {
        Button("New branch…") { open = false; model.branchPrompt = .create(startPoint: nil) }
        Button("Update") { open = false; model.fetch() }
        Button("Push…") { open = false; model.push() }
    }

    @ViewBuilder
    private var label: some View {
        switch look {
        case .chip:
            Button { open.toggle() } label: {
                HStack(spacing: 5) {
                    Image(systemName: "arrow.triangle.branch")
                    Text(name)
                        .lineLimit(1)
                        .truncationMode(.middle)
                        .clipHelp(name, font: font)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 8, weight: .semibold))
                        .foregroundStyle(.secondary)
                }
                .font(Font(font))
            }
            .buttonStyle(.accessoryBar)
        case .title:
            if model.roots.count > 1 {
                Button { open.toggle() } label: {
                    WorkspaceTitle(name: model.workspace?.displayName ?? "Workspace", repositories: model.roots.map(\.name))
                }
                .buttonStyle(.accessoryBar)
                .help(model.roots.map { "\($0.name) — \($0.branch ?? "Detached HEAD")" }.joined(separator: "\n"))
            } else {
                Button { open.toggle() } label: { SourceControlTitle(repository: model.focusedRoot?.name, branch: name) }
                    .buttonStyle(.accessoryBar)
                    .help(model.focusedRoot.map { "\($0.name) — \(name)" } ?? name)
            }
        }
    }

    private var sections: [BranchChoiceSection] {
        let local = model.branches.map { BranchChoice.branch(BranchRef($0), badge: branchDistance($0)) }
        return [
            BranchChoiceSection(id: "recent", title: "Recent", rows: Array(local.prefix(model.recentBranches.count)),
                                hiddenWhileSearching: true),
            BranchChoiceSection(id: "local", title: "Local", rows: local),
            BranchChoiceSection(id: "remote", title: "Remote", rows: model.remoteBranches.map { .branch(BranchRef($0)) }),
        ]
    }

    private func pick(_ choice: BranchChoice) {
        guard let branch = choice.branch, !branch.isCurrent else { return }
        model.checkout(branch.ref)
    }
}

/// The sidebar's title: the repository's avatar and name over the branch
/// it is on, cut at the end rather than the middle — a branch name's
/// meaning is at its front, the ticket and the kind of change, the way
/// Xcode keeps it.
private struct SourceControlTitle: View {
    let repository: String?
    let branch: String

    var body: some View {
        HStack(spacing: 8) {
            if let repository {
                RepoAvatar(name: repository, size: 22)
            }
            VStack(alignment: .leading, spacing: 0) {
                if let repository {
                    Text(repository)
                        .font(.system(size: 13, weight: .semibold))
                        .lineLimit(1)
                }
                HStack(spacing: 3) {
                    Image(systemName: "arrow.triangle.branch")
                        .font(.system(size: 9, weight: .medium))
                    Text(branch)
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
            }
            Spacer(minLength: 4)
            Image(systemName: "chevron.up.chevron.down")
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }
}

/// The sidebar's title over a workspace of several repositories: the
/// workspace's glyph and name over the repositories it holds, as the agent
/// chat's chip names it — the popover under it is where one of them, and
/// its branch, is picked.
private struct WorkspaceTitle: View {
    let name: String
    let repositories: [String]

    var body: some View {
        HStack(spacing: 8) {
            WorkspaceGlyph(names: repositories, size: 22)
            VStack(alignment: .leading, spacing: 0) {
                Text(name)
                    .font(.system(size: 13, weight: .semibold))
                    .lineLimit(1)
                Text(repositories.joined(separator: ", "))
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            Spacer(minLength: 4)
            Image(systemName: "chevron.up.chevron.down")
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }
}

/// One thing that can be done to a branch, as the switcher's row menu
/// lists it — or the rule between two runs of them.
struct BranchAction: Identifiable {
    enum Kind {
        case item(title: String, destructive: Bool, run: () -> Void)
        case divider
    }

    let id: Int
    let kind: Kind

    var isItem: Bool { if case .item = kind { true } else { false } }
}

extension AppModel {
    /// What a workspace's repository offers on its row's menu: the page
    /// turned to it, and — while the workspace holds others — another
    /// repository put in its place, or it taken out.
    func repositoryActions(for root: RootModel) -> [BranchAction] {
        var actions: [BranchAction] = []
        func item(_ title: String, destructive: Bool = false, _ run: @escaping () -> Void) {
            actions.append(BranchAction(id: actions.count, kind: .item(title: title, destructive: destructive, run: run)))
        }
        if root !== focusedRoot {
            item("Switch to ‘\(root.name)’") { self.focus(root: root) }
        }
        guard roots.count > 1 else { return actions }
        item("Replace…") { self.chooseReplacement(for: root) }
        if !actions.isEmpty { actions.append(BranchAction(id: actions.count, kind: .divider)) }
        item("Remove", destructive: true) { Task { await self.removeRoot(root) } }
        return actions
    }

    /// The same actions the web app's switcher gives a branch, in the same
    /// order, worded against the branch you are on.
    func branchActions(for branch: BranchRef) -> [BranchAction] {
        let head = currentBranch ?? "HEAD"
        var actions: [BranchAction] = []
        func item(_ title: String, destructive: Bool = false, _ run: @escaping () -> Void) {
            actions.append(BranchAction(id: actions.count, kind: .item(title: title, destructive: destructive, run: run)))
        }
        func divider() { actions.append(BranchAction(id: actions.count, kind: .divider)) }

        if !branch.isCurrent {
            item("Checkout") { self.checkout(branch.ref) }
        }
        item("New branch from ‘\(branch.display)’…") { self.branchPrompt = .create(startPoint: branch.ref) }
        if !branch.isCurrent {
            item("Checkout and update") { self.checkoutAndUpdate(branch.ref) }
            divider()
            item("Compare with ‘\(head)’") { self.compare(base: branch.ref, head: head) }
            item("Review ‘\(head)’ against ‘\(branch.display)’") { self.review(head, against: branch.ref) }
            item("Merge ‘\(branch.display)’ into ‘\(head)’") { self.merge(branch.ref) }
            item("Rebase ‘\(head)’ onto ‘\(branch.display)’") { self.rebase(onto: branch.ref) }
        }
        divider()
        item("Update") { self.fetch() }
        item("Push…") { self.push() }
        if !branch.isRemote {
            divider()
            item("Rename…") { self.branchPrompt = .rename(from: branch.ref) }
            if !branch.isCurrent {
                item("Delete", destructive: true) { self.branchPrompt = .delete(name: branch.ref) }
            }
        }
        return actions
    }
}

/// The picker's prompts, as alerts on whatever view wears them — the
/// sidebar, so the picker's own row isn't the thing presenting: a name for
/// a branch, a new name, a yes to a deletion.
private struct BranchPromptModifier: ViewModifier {
    @Environment(AppModel.self) private var model
    @State private var name = ""

    func body(content: Content) -> some View {
        @Bindable var model = model
        content
            .alert(createTitle, isPresented: isPresented(\.isCreate), presenting: model.branchPrompt) { prompt in
                TextField("Branch name", text: $name)
                Button("Create") {
                    if case .create(let start) = prompt { model.createBranch(named: name, from: start) }
                }
                .disabled(name.isEmpty)
                Button("Cancel", role: .cancel) {}
            } message: { _ in }
            .alert("Rename branch", isPresented: isPresented(\.isRename), presenting: model.branchPrompt) { prompt in
                TextField("New name", text: $name)
                Button("Rename") {
                    if case .rename(let from) = prompt { model.renameBranch(from, to: name) }
                }
                .disabled(name.isEmpty)
                Button("Cancel", role: .cancel) {}
            } message: { _ in }
            .alert("Delete branch", isPresented: isPresented(\.isDelete), presenting: model.branchPrompt) { prompt in
                Button("Delete", role: .destructive) {
                    if case .delete(let target) = prompt { model.deleteBranch(target) }
                }
                Button("Cancel", role: .cancel) {}
            } message: { prompt in
                if case .delete(let target) = prompt { Text("Delete ‘\(target)’? This cannot be undone.") }
            }
            .onChange(of: model.branchPrompt) { _, prompt in
                if case .rename(let from)? = prompt { name = from } else { name = "" }
            }
    }

    private var createTitle: String {
        if case .create(let start?)? = model.branchPrompt { return "New branch from ‘\(start)’" }
        return "New branch"
    }

    private func isPresented(_ kind: KeyPath<BranchPrompt, Bool>) -> Binding<Bool> {
        Binding(
            get: { model.branchPrompt.map { $0[keyPath: kind] } ?? false },
            set: { if !$0 { model.branchPrompt = nil } })
    }
}

extension BranchPrompt {
    var isCreate: Bool { if case .create = self { true } else { false } }
    var isRename: Bool { if case .rename = self { true } else { false } }
    var isDelete: Bool { if case .delete = self { true } else { false } }
}

extension View {
    func branchPrompts() -> some View { modifier(BranchPromptModifier()) }
}
