// The branch picker at the head of the sidebar: a pull-down button naming
// the branch you are on, whose menu is the web app's switcher done in
// NSMenu — Recent, Local by folder, Remote by remote, each branch a submenu
// of everything you can do to it — plus a search, since a menu of sixty
// branches is a menu you read, and a field is how you find one.
import SwiftUI

struct BranchPicker: View {
    @Environment(AppModel.self) private var model
    @State private var searching = false

    var body: some View {
        Menu {
            Button("Search Branches…") { searching = true }
                .keyboardShortcut("b", modifiers: [.command, .shift])
            Divider()
            if !model.recentBranches.isEmpty {
                Section("Recent") {
                    ForEach(model.recentBranches) { branch in
                        BranchMenu(branch: BranchRef(branch), badge: badge(branch))
                    }
                }
            }
            Section("Local · \(model.branches.count)") {
                ForEach(folders(of: model.branches.map(BranchRef.init)), id: \.name) { folder in
                    if let name = folder.name {
                        Menu(name) {
                            ForEach(folder.items, id: \.ref) { branch in
                                BranchMenu(branch: branch, badge: badge(branch))
                            }
                        }
                    } else {
                        ForEach(folder.items, id: \.ref) { branch in
                            BranchMenu(branch: branch, badge: badge(branch))
                        }
                    }
                }
            }
            Section("Remote · \(model.remoteBranches.count)") {
                ForEach(folders(of: model.remoteBranches.map(BranchRef.init)), id: \.name) { folder in
                    Menu(folder.name ?? "remote") {
                        ForEach(folder.items, id: \.ref) { branch in
                            BranchMenu(branch: branch, badge: nil)
                        }
                    }
                }
            }
            Divider()
            Button("New Branch…") { model.branchPrompt = .create(startPoint: nil) }
            Button("Update") { model.fetch() }
            Button("Push…") { model.push() }
        } label: {
            Label(model.currentBranch ?? "No branch", systemImage: "arrow.triangle.branch")
                .lineLimit(1)
                .truncationMode(.middle)
        }
        .menuStyle(.button)
        .controlSize(.regular)
        .disabled(!model.hasProject)
        .help("Branches")
        .popover(isPresented: $searching, arrowEdge: .bottom) {
            BranchSearch(dismiss: { searching = false })
        }
        .branchPrompts()
    }

    private func badge(_ branch: BranchInfo) -> String? {
        var parts: [String] = []
        if branch.ahead > 0 { parts.append("↑\(branch.ahead)") }
        if branch.behind > 0 { parts.append("↓\(branch.behind)") }
        return parts.isEmpty ? nil : parts.joined(separator: " ")
    }

    private func badge(_ branch: BranchRef) -> String? {
        model.branches.first { $0.name == branch.ref }.flatMap(badge)
    }

    private struct Folder {
        let name: String?
        let items: [BranchRef]
    }

    /// `feature/x` and `feature/y` under one `feature` submenu, the way the
    /// switcher folds them, in the order the server listed them.
    private func folders(of branches: [BranchRef]) -> [Folder] {
        var order: [String?] = []
        var grouped: [String?: [BranchRef]] = [:]
        for branch in branches {
            let folder = branch.display.contains("/") ? String(branch.display.prefix { $0 != "/" }) : nil
            if grouped[folder] == nil { order.append(folder) }
            grouped[folder, default: []].append(branch)
        }
        return order.map { Folder(name: $0, items: grouped[$0] ?? []) }
    }
}

/// One branch's submenu — the same actions the web app's switcher gives it,
/// in the same order, worded against the branch you are on.
struct BranchMenu: View {
    let branch: BranchRef
    let badge: String?
    @Environment(AppModel.self) private var model

    var body: some View {
        Menu {
            BranchActions(branch: branch)
        } label: {
            if let badge {
                Text("\(branch.display)   \(badge)")
            } else {
                Text(branch.display)
            }
            if branch.isCurrent {
                Image(systemName: "star.fill")
            }
        }
    }
}

struct BranchActions: View {
    let branch: BranchRef
    @Environment(AppModel.self) private var model

    private var head: String { model.currentBranch ?? "HEAD" }

    var body: some View {
        if !branch.isCurrent {
            Button("Checkout") { model.checkout(branch.ref) }
        }
        Button("New Branch from ‘\(branch.display)’…") { model.branchPrompt = .create(startPoint: branch.ref) }
        if !branch.isCurrent {
            Button("Checkout and Update") { model.checkoutAndUpdate(branch.ref) }
            Divider()
            Button("Compare with ‘\(head)’") { model.compare(base: branch.ref, head: head) }
            Button("Review ‘\(head)’ against ‘\(branch.display)’") { model.review(head, against: branch.ref) }
            Button("Merge ‘\(branch.display)’ into ‘\(head)’") { model.merge(branch.ref) }
            Button("Rebase ‘\(head)’ onto ‘\(branch.display)’") { model.rebase(onto: branch.ref) }
        }
        Divider()
        Button("Update") { model.fetch() }
        Button("Push…") { model.push() }
        if !branch.isRemote {
            Divider()
            Button("Rename…") { model.branchPrompt = .rename(from: branch.ref) }
            if !branch.isCurrent {
                Button("Delete", role: .destructive) { model.branchPrompt = .delete(name: branch.ref) }
            }
        }
    }
}

/// The search: a field over every branch, local and remote, each row
/// carrying the same submenu the menu gives it; Return checks out the first
/// match.
private struct BranchSearch: View {
    let dismiss: () -> Void
    @Environment(AppModel.self) private var model
    @State private var query = ""
    @FocusState private var fieldFocused: Bool

    private var matches: [BranchRef] {
        let needle = query.trimmingCharacters(in: .whitespaces)
        let all = model.branches.map(BranchRef.init) + model.remoteBranches.map(BranchRef.init)
        guard !needle.isEmpty else { return all }
        return all.filter { $0.display.localizedCaseInsensitiveContains(needle) }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("Search branches", text: $query)
                    .textFieldStyle(.plain)
                    .focused($fieldFocused)
                    .onSubmit {
                        guard let first = matches.first, !first.isCurrent else { return }
                        dismiss()
                        model.checkout(first.ref)
                    }
            }
            .padding(10)
            Divider()
            List {
                ForEach(matches, id: \.ref) { branch in
                    HStack(spacing: 8) {
                        Image(systemName: branch.isCurrent ? "star.fill" : branch.isRemote ? "cloud" : "arrow.triangle.branch")
                            .foregroundStyle(branch.isCurrent ? Color.orange : Color.secondary)
                            .frame(width: 14)
                        Text(branch.display)
                            .lineLimit(1)
                            .truncationMode(.middle)
                        Spacer(minLength: 4)
                        if let local = model.branches.first(where: { $0.name == branch.ref }) {
                            if local.ahead > 0 { Text("↑\(local.ahead)").foregroundStyle(.green) }
                            if local.behind > 0 { Text("↓\(local.behind)").foregroundStyle(.blue) }
                        }
                        Menu {
                            BranchActions(branch: branch)
                        } label: {
                            Image(systemName: "ellipsis.circle")
                        }
                        .menuStyle(.borderlessButton)
                        .menuIndicator(.hidden)
                        .fixedSize()
                    }
                    .font(.system(size: 12))
                    .contentShape(Rectangle())
                    .onTapGesture(count: 2) {
                        guard !branch.isCurrent else { return }
                        dismiss()
                        model.checkout(branch.ref)
                    }
                }
            }
            .listStyle(.plain)
        }
        .frame(width: 360, height: 420)
        .onAppear { fieldFocused = true }
    }
}

/// The picker's prompts, as alerts on whatever view wears them: a name for
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
