// The opener's workspaces: the saved ones as the system's own table — name,
// the repositories each holds, when it was last opened — and the sheet that
// makes one or changes it: a name over an ordered list of repositories,
// picked from the machine's (the same index the opener lists) or from the
// folder panel, dragged into the order the tree will stand them in.
//
// A workspace is the environment several repositories make together — a
// web app beside its API beside the docs — opened at once into one window,
// one tree with a header per repository, their dev commands running side by
// side. Kept by the server, so every window's opener lists the same ones.
import AppKit
import SwiftUI

/// The saved workspaces, as the opener's table lists them.
struct WorkspacesTable: View {
    @Environment(AppModel.self) private var model
    let workspaces: [SavedWorkspace]
    @Binding var editing: WorkspaceDraft?
    @State private var selected: SavedWorkspace.ID?
    @State private var deleting: SavedWorkspace?

    var body: some View {
        Table(workspaces, selection: $selected) {
            TableColumn("Name") { workspace in
                HStack(spacing: 8) {
                    WorkspaceGlyph(names: workspace.rootNames)
                    Text(workspace.name)
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
            }
            .width(min: 140, ideal: 200)
            TableColumn("Repositories") { workspace in
                Text(workspace.rootNames.joined(separator: ", "))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .help(workspace.roots.joined(separator: "\n"))
            }
            .width(min: 160, ideal: 280)
            TableColumn("Date last opened") { workspace in
                Text(workspace.openedAt.flatMap(Wire.date).map(OpenerDates.format) ?? "—")
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .width(min: 130, ideal: 190)
        }
        .tableStyle(.inset(alternatesRowBackgrounds: true))
        .contextMenu(forSelectionType: SavedWorkspace.ID.self) { ids in
            if let workspace = ids.first.flatMap(find) {
                Button("Open") { open(workspace) }
                Button("Open and run") { openAndRun(workspace) }
                Divider()
                Button("Edit…") { editing = WorkspaceDraft(editing: workspace) }
                Divider()
                Button("Delete…") { deleting = workspace }
            }
        } primaryAction: { ids in
            if let workspace = ids.first.flatMap(find) { open(workspace) }
        }
        .onKeyPress(.return) {
            guard let workspace = selected.flatMap(find) else { return .ignored }
            open(workspace)
            return .handled
        }
        .alert("Delete workspace?", isPresented: deletingShown, presenting: deleting) { workspace in
            Button("Delete", role: .destructive) {
                Task {
                    do {
                        try await model.catalog.deleteWorkspace(workspace)
                    } catch {
                        model.lastError = error.localizedDescription
                    }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: { workspace in
            Text("\(workspace.name) is forgotten. Its repositories stay where they are.")
        }
    }

    private func find(_ id: SavedWorkspace.ID) -> SavedWorkspace? {
        workspaces.first { $0.id == id }
    }

    private func open(_ workspace: SavedWorkspace) {
        Task { await model.openWorkspace(id: workspace.id) }
    }

    private func openAndRun(_ workspace: SavedWorkspace) {
        Task {
            guard await model.openWorkspace(id: workspace.id) else { return }
            model.runProject()
        }
    }

    private var deletingShown: Binding<Bool> {
        Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } })
    }
}

/// A workspace's glyph: its repositories' monograms, the first two
/// overlapping, so a row says at a glance what it holds.
struct WorkspaceGlyph: View {
    let names: [String]
    var size: CGFloat = 16

    var body: some View {
        ZStack(alignment: .topLeading) {
            ForEach(Array(names.prefix(2).enumerated().reversed()), id: \.offset) { index, name in
                RepoAvatar(name: name, size: size * 0.8)
                    .offset(x: CGFloat(index) * size * 0.35, y: CGFloat(index) * size * 0.2)
            }
        }
        .frame(width: size * 1.15, height: size, alignment: .topLeading)
    }
}

/// A workspace being made or changed, as the sheet holds it.
struct WorkspaceDraft: Identifiable {
    /// The saved workspace changed, or nil for a new one.
    let existing: SavedWorkspace?
    var name: String
    var roots: [String]

    var id: String { existing?.id ?? "new" }

    init(editing workspace: SavedWorkspace) {
        existing = workspace
        name = workspace.name
        roots = workspace.roots
    }

    /// A new workspace, starting from the repositories picked in the opener.
    init(roots: [String]) {
        existing = nil
        name = ""
        self.roots = roots
    }
}

/// The File menu's Save as workspace: a name for the repositories open now.
struct SaveWorkspaceSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""

    private var trimmed: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Save as workspace")
                .font(.headline)
            Text("Keep \(model.roots.map(\.name).joined(separator: ", ")) together, to open them again in one go.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            TextField("Name", text: $name, prompt: Text("Workspace name"))
                .textFieldStyle(.roundedBorder)
                .onSubmit(save)
            HStack {
                Spacer()
                Button("Cancel", role: .cancel) { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button("Save", action: save)
                    .keyboardShortcut(.defaultAction)
                    .disabled(trimmed.isEmpty)
            }
        }
        .padding(20)
        .frame(width: 420)
        .onAppear { name = model.roots.first?.name ?? "" }
    }

    private func save() {
        guard !trimmed.isEmpty else { return }
        let name = trimmed
        dismiss()
        Task { await model.saveWorkspace(named: name) }
    }
}
