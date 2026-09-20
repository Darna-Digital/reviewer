// The branch picker at the head of the sidebar — and on the session bar's
// strip: a flat chip naming the branch you are on, opening the web app's
// switcher as a `BranchPopover` — Recent, Local, Remote, the branch you
// are on starred and the others carrying their distance from upstream, a
// search over all of them, and on every row the same menu of everything
// you can do to it. A row picked checks the branch out; the popover's
// foot holds what needs no branch — a new one, update, push.
import SwiftUI

struct BranchPicker: View {
    @Environment(AppModel.self) private var model
    @Environment(\.controlSize) private var controlSize
    @State private var open = false

    private var name: String { model.currentBranch ?? "No branch" }
    /// The accessory bar's type at the size the chip is cut to — named,
    /// so the tooltip measures the name in the font the chip sets it in.
    private var font: NSFont { .systemFont(ofSize: controlSize == .small ? 11 : 13) }

    var body: some View {
        Button { open.toggle() } label: {
            HStack(spacing: 5) {
                Image(systemName: "arrow.triangle.branch")
                Text(name)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .clipTooltip(name, font: font)
                Image(systemName: "chevron.down")
                    .font(.system(size: 8, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
            .font(Font(font))
        }
        .buttonStyle(.accessoryBar)
        .disabled(!model.hasProject)
        .popover(isPresented: $open, arrowEdge: .bottom) {
            BranchPopover(
                sections: sections, placeholder: "Search branches", pick: checkout, dismiss: { open = false },
                actions: { branch in BranchActions(branch: branch) }
            ) {
                Divider()
                HStack(spacing: 2) {
                    Button("New Branch…") { open = false; model.branchPrompt = .create(startPoint: nil) }
                    Button("Update") { open = false; model.fetch() }
                    Button("Push…") { open = false; model.push() }
                    Spacer(minLength: 0)
                }
                .buttonStyle(.accessoryBar)
                .controlSize(.small)
                .padding(6)
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

    private func checkout(_ choice: BranchChoice) {
        guard let branch = choice.branch, !branch.isCurrent else { return }
        model.checkout(branch.ref)
    }
}

/// The same actions the web app's switcher gives a branch, in the same
/// order, worded against the branch you are on.
struct BranchActions: View {
    let branch: BranchRef
    @Environment(AppModel.self) private var model

    private var head: String { model.currentBranch ?? "HEAD" }

    var body: some View {
        if !branch.isCurrent {
            Button("Checkout") { run { model.checkout(branch.ref) } }
        }
        Button("New Branch from ‘\(branch.display)’…") { run { model.branchPrompt = .create(startPoint: branch.ref) } }
        if !branch.isCurrent {
            Button("Checkout and Update") { run { model.checkoutAndUpdate(branch.ref) } }
            Divider()
            Button("Compare with ‘\(head)’") { run { model.compare(base: branch.ref, head: head) } }
            Button("Review ‘\(head)’ against ‘\(branch.display)’") { run { model.review(head, against: branch.ref) } }
            Button("Merge ‘\(branch.display)’ into ‘\(head)’") { run { model.merge(branch.ref) } }
            Button("Rebase ‘\(head)’ onto ‘\(branch.display)’") { run { model.rebase(onto: branch.ref) } }
        }
        Divider()
        Button("Update") { run { model.fetch() } }
        Button("Push…") { run { model.push() } }
        if !branch.isRemote {
            Divider()
            Button("Rename…") { run { model.branchPrompt = .rename(from: branch.ref) } }
            if !branch.isCurrent {
                Button("Delete", role: .destructive) { run { model.branchPrompt = .delete(name: branch.ref) } }
            }
        }
    }

    private func run(_ action: () -> Void) {
        action()
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
            .alert("Rename Branch", isPresented: isPresented(\.isRename), presenting: model.branchPrompt) { prompt in
                TextField("New name", text: $name)
                Button("Rename") {
                    if case .rename(let from) = prompt { model.renameBranch(from, to: name) }
                }
                .disabled(name.isEmpty)
                Button("Cancel", role: .cancel) {}
            } message: { _ in }
            .alert("Delete Branch", isPresented: isPresented(\.isDelete), presenting: model.branchPrompt) { prompt in
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
        if case .create(let start?)? = model.branchPrompt { return "New Branch from ‘\(start)’" }
        return "New Branch"
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
