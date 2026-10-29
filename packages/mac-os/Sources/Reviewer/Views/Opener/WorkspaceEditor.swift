// The sheet that makes a workspace or changes one, laid out as System
// Settings lays a pane out: a grouped form, its name in a row of its own,
// and its repositories as a section that is the list of what is chosen —
// in the order the tree will stand them, dragged into place, each taken
// out on hover — with Add Repository… as the section's last row, the way
// Login Items adds an app: a searchable popover of the machine's
// repositories (the same one every picker in the app opens), recent ones
// first, and the folder panel at its foot for one the index never found.
// One default action, on the right beside Cancel: Create, which opens the
// workspace it makes, or Save for one that already is.
import SwiftUI

struct WorkspaceEditor: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State var draft: WorkspaceDraft
    @State private var adding = false
    @State private var saving = false
    @State private var failure: String?
    @FocusState private var nameFocused: Bool

    private var catalog: RepoCatalog { model.catalog }
    private var isNew: Bool { draft.existing == nil }
    private var name: String { draft.name.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var canSave: Bool { !name.isEmpty && !draft.roots.isEmpty && !saving }

    var body: some View {
        VStack(spacing: 0) {
            Text(isNew ? "New Workspace" : "Edit Workspace")
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20)
                .padding(.top, 18)
            Form {
                Section {
                    TextField("Name", text: $draft.name, prompt: Text("Workspace name"))
                        .focused($nameFocused)
                }
                Section {
                    ForEach(draft.roots, id: \.self) { path in
                        ChosenRepository(path: path) {
                            withAnimation(.snappy) { draft.roots.removeAll { $0 == path } }
                        }
                    }
                    .onMove { draft.roots.move(fromOffsets: $0, toOffset: $1) }
                    Button { adding = true } label: {
                        Label("Add Repository…", systemImage: "plus")
                    }
                    .buttonStyle(.borderless)
                    .popover(isPresented: $adding, arrowEdge: .bottom) { addPopover }
                } header: {
                    Text("Repositories")
                } footer: {
                    Text(draft.roots.count > 1
                         ? "They open together, listed in this order. Drag to reorder."
                         : "They open together in one window.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .formStyle(.grouped)
            .scrollBounceBehavior(.basedOnSize)
            actions
        }
        .frame(width: 520, height: 460)
        .onAppear { if isNew { nameFocused = true } }
    }

    private var actions: some View {
        HStack(spacing: 8) {
            if let failure {
                Text(failure)
                    .font(.callout)
                    .foregroundStyle(.red)
                    .lineLimit(2)
            }
            Spacer(minLength: 0)
            Button("Cancel", role: .cancel) { dismiss() }
                .keyboardShortcut(.cancelAction)
            Button(isNew ? "Create" : "Save", action: save)
                .keyboardShortcut(.defaultAction)
                .buttonStyle(.borderedProminent)
                .disabled(!canSave)
        }
        .controlSize(.large)
        .padding(.horizontal, 20)
        .padding(.bottom, 20)
        .padding(.top, 4)
    }

    // MARK: adding

    /// The machine's repositories to add from: the recent ones first, then
    /// every other the index holds, those already chosen ticked — a pick
    /// adds one, or takes a ticked one back out.
    private var addPopover: some View {
        BranchPopover(
            sections: [
                BranchChoiceSection(id: "recent", title: "Recent", rows: catalog.recents.map(choice)),
                BranchChoiceSection(
                    id: "all", title: "All Repositories",
                    rows: catalog.rows.filter { $0.lastOpened == nil }.sorted { $0.name < $1.name }.map(choice)),
            ],
            placeholder: "Search repositories", pick: toggle, dismiss: { adding = false }, actions: nil
        ) {
            ThemedDivider()
            HStack(spacing: 2) {
                Button("Choose Folder…") {
                    adding = false
                    chooseFolder()
                }
                Spacer(minLength: 0)
            }
            .popoverFooterBar()
        }
    }

    private func choice(_ row: RepoRow) -> BranchChoice {
        BranchChoice(
            id: row.path, branch: nil, title: row.name, symbol: "folder", tint: nil, badge: nil,
            checked: draft.roots.contains(row.path), tooltip: RepoRow.fold(row.path, home: NSHomeDirectory()),
            monograms: [row.name])
    }

    private func toggle(_ choice: BranchChoice) {
        withAnimation(.snappy) {
            if draft.roots.contains(choice.id) {
                draft.roots.removeAll { $0 == choice.id }
            } else {
                draft.roots.append(choice.id)
            }
        }
        suggestName()
    }

    private func chooseFolder() {
        guard let path = model.askForProjectFolder(), !draft.roots.contains(path) else { return }
        withAnimation(.snappy) { draft.roots.append(path) }
        suggestName()
    }

    /// A workspace of one repository is named after it until it is named
    /// otherwise — the name is still there to change.
    private func suggestName() {
        guard isNew, name.isEmpty, draft.roots.count == 1, let only = draft.roots.first else { return }
        draft.name = URL(fileURLWithPath: only).lastPathComponent
    }

    // MARK: saving

    private func save() {
        saving = true
        failure = nil
        Task {
            defer { saving = false }
            do {
                if let existing = draft.existing {
                    try await catalog.updateWorkspace(existing, name: name, roots: draft.roots)
                    // A workspace open in the window follows its saved self.
                    if model.workspace?.workspace?.id == existing.id { await model.refresh() }
                    dismiss()
                } else if await model.createWorkspace(name: name, roots: draft.roots, open: true) {
                    dismiss()
                } else {
                    failure = model.lastError
                    model.lastError = nil
                }
            } catch {
                failure = error.localizedDescription
            }
        }
    }
}

/// One chosen repository, as the form lists it: its avatar and its name —
/// where it lives is the tooltip's to say — and, under the pointer, the way
/// to take it out.
private struct ChosenRepository: View {
    let path: String
    let remove: () -> Void
    @State private var hovered = false

    private var name: String { URL(fileURLWithPath: path).lastPathComponent }

    var body: some View {
        HStack(spacing: 10) {
            RepoAvatar(name: name, size: 20)
            Text(name)
                .lineLimit(1)
            Spacer(minLength: 8)
            Button(action: remove) {
                Image(systemName: "minus.circle.fill")
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .opacity(hovered ? 1 : 0)
            .help("Remove from the workspace")
        }
        .padding(.vertical, 2)
        .contentShape(Rectangle())
        .onHover { hovered = $0 }
        .help(RepoRow.fold(path, home: NSHomeDirectory()))
        .contextMenu {
            Button("Remove from Workspace", action: remove)
        }
    }
}
