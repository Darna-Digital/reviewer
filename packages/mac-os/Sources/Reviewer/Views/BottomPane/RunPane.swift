// The Run surface, laid out as the opener is: the project's dev commands
// as the system's own table down the left — name under its dot, the
// command it runs, the folder it runs in (the root, or a package of a
// monorepo), whether it is up — sortable on any column, its rows plain
// rather than striped, under a toolbar with add and remove grouped at its
// leading edge, start all and stop all beside them, and a search at its
// trailing edge. With nothing to list the table gives way to a
// placeholder, header and all. A click picks a command, a double-click or Return
// starts or stops it, Delete removes it, and the row's menu holds the
// same, with a restart while it runs. The selected one's output stands on
// the right under a bar of the toolbar's height naming it and its state,
// with stop and restart while it runs. Starting, stopping and restarting
// are the server's doing — a restart is a start, which replaces the live
// process; the output is its process's socket drawn by SwiftTerm, so a
// command that asks a question can be answered here too.
import AppKit
import SwiftUI

struct RunPane: View {
    @Environment(AppModel.self) private var model
    @State private var adding = false

    var body: some View {
        TableSplit {
            CommandTable(adding: $adding)
        } detail: {
            CommandDetail()
        }
        .task { await model.services.load() }
        .sheet(isPresented: $adding) {
            NewCommandSheet(repository: model.workspace?.project ?? "") { name, command, cwd in
                Task { await model.services.create(name: name, command: command, cwd: cwd) }
            }
        }
    }
}

private struct CommandTable: View {
    @Binding var adding: Bool
    @Environment(AppModel.self) private var model
    @State private var query = ""
    @State private var sortOrder = [KeyPathComparator(\DevCommandView.name)]

    private var services: DevServices { model.services }
    private var anyRunning: Bool { services.commands.contains(where: \.isRunning) }

    private var rows: [DevCommandView] {
        let needle = query.trimmingCharacters(in: .whitespaces)
        let matched = needle.isEmpty
            ? services.commands
            : services.commands.filter {
                $0.name.localizedCaseInsensitiveContains(needle)
                    || $0.command.localizedCaseInsensitiveContains(needle)
                    || $0.cwd.localizedCaseInsensitiveContains(needle)
            }
        return matched.sorted(using: sortOrder)
    }

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            if rows.isEmpty && !services.isLoading {
                placeholder
            } else {
                table
            }
        }
    }

    private var toolbar: some View {
        PaneToolbar {
            ControlGroup {
                Button { adding = true } label: { Label("Add command", systemImage: "plus") }
                    .help("Add a command")
                Button(action: removeSelected) { Label("Remove command", systemImage: "minus") }
                    .help("Remove the selected command")
                    .disabled(services.selected == nil)
            }
            ControlGroup {
                Button { Task { await services.startAll() } } label: { Label("Start all", systemImage: "play.fill") }
                    .help("Start all")
                    .disabled(services.commands.isEmpty)
                Button { Task { await services.stopAll() } } label: { Label("Stop all", systemImage: "stop.fill") }
                    .help("Stop all")
                    .disabled(!anyRunning)
            }
            Spacer(minLength: 8)
            PaneSearchField(prompt: "Search", text: $query)
                .frame(width: PaneMetrics.toolbarSearchWidth)
        }
    }

    private var table: some View {
        Table(rows, selection: selection, sortOrder: $sortOrder) {
            TableColumn("Name", value: \.name) { command in
                HStack(spacing: 8) {
                    ProcessDot(status: command.status, exitCode: command.exitCode)
                    Text(command.name)
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
            }
            .width(min: 120, ideal: 170)
            TableColumn("Command", value: \.command) { command in
                Text(command.command)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .help(command.command)
            }
            .width(min: 120, ideal: 200)
            TableColumn("Folder", value: \.cwd) { command in
                Text(command.folderLabel)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .help(command.cwd.isEmpty ? "Runs at the repository root" : "Runs in \(command.cwd)")
            }
            .width(min: 80, ideal: 140)
            TableColumn("Status", value: \.statusLabel) { command in
                Text(command.statusLabel)
                    .foregroundStyle(command.exitedBadly ? .red : .secondary)
                    .lineLimit(1)
            }
            .width(min: 80, ideal: 100)
        }
        .tableStyle(.inset(alternatesRowBackgrounds: false))
        .scrollContentBackground(.hidden)
        .contextMenu(forSelectionType: String.self) { ids in
            if let command = ids.first.flatMap(command(for:)) { menu(for: command) }
        } primaryAction: { ids in
            if let command = ids.first.flatMap(command(for:)) { toggle(command) }
        }
        .onKeyPress(.return) {
            guard let command = services.selected else { return .ignored }
            toggle(command)
            return .handled
        }
        .onDeleteCommand(perform: removeSelected)
    }

    @ViewBuilder
    private var placeholder: some View {
        if query.isEmpty {
            PanePlaceholder("No commands", symbol: "play.circle",
                            detail: "Add a dev server or a watcher to run in this project.") {
                Button("Add command…") { adding = true }
            }
        } else {
            PanePlaceholder("No commands match “\(query)”", symbol: "magnifyingglass")
        }
    }

    @ViewBuilder
    private func menu(for command: DevCommandView) -> some View {
        if command.isRunning {
            Button("Restart") { Task { await services.start(id: command.id) } }
            Button("Stop") { Task { await services.stop(id: command.id) } }
        } else {
            Button(command.status == .exited ? "Restart" : "Start") {
                Task { await services.start(id: command.id) }
            }
        }
        Divider()
        Button("Copy command") { copy(command.command) }
        if !command.cwd.isEmpty {
            Button("Show folder in Finder") { reveal(command.cwd) }
        }
        Divider()
        Button("Remove", role: .destructive) {
            Task { await services.remove(id: command.id) }
        }
    }

    private func command(for id: String) -> DevCommandView? {
        services.commands.first { $0.id == id }
    }

    private func toggle(_ command: DevCommandView) {
        Task {
            if command.isRunning {
                await services.stop(id: command.id)
            } else {
                await services.start(id: command.id)
            }
        }
    }

    private func removeSelected() {
        guard let id = services.selectedId else { return }
        Task { await services.remove(id: id) }
    }

    private func copy(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }

    private func reveal(_ cwd: String) {
        guard let project = model.workspace?.project else { return }
        let url = URL(fileURLWithPath: project).appendingPathComponent(cwd)
        NSWorkspace.shared.activateFileViewerSelecting([url])
    }

    private var selection: Binding<String?> {
        Binding(get: { services.selectedId }, set: { services.selectedId = $0 })
    }
}

private struct CommandDetail: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if let command = model.services.selected {
            VStack(spacing: 0) {
                bar(for: command)
                if command.status == .stopped {
                    PanePlaceholder(command.statusLabel, symbol: "pause.circle",
                                    detail: "Start it to see its output here.") {
                        Button("Start") { Task { await model.services.start(id: command.id) } }
                    }
                } else {
                    let stream = model.services.stream(for: command.id)
                    TerminalWell {
                        TerminalHost(view: stream.view)
                            .id(ObjectIdentifier(stream))
                    }
                }
            }
        } else {
            PanePlaceholder("No command selected", symbol: "play.circle",
                            detail: "Pick a command on the left to see its output.")
        }
    }

    private func bar(for command: DevCommandView) -> some View {
        PaneToolbar {
            ProcessDot(status: command.status, exitCode: command.exitCode)
            Text(command.name)
                .fontWeight(.medium)
                .lineLimit(1)
            Text(command.command)
                .font(.system(size: 12, design: .monospaced))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .truncationMode(.middle)
            if !command.cwd.isEmpty {
                Label(command.cwd, systemImage: "folder")
                    .labelStyle(.titleAndIcon)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .help("Runs in \(command.cwd)")
            }
            Spacer(minLength: 8)
            Text(command.statusLabel)
                .font(.system(size: 12))
                .foregroundStyle(command.exitedBadly ? .red : .secondary)
            if command.isRunning {
                Button { Task { await model.services.start(id: command.id) } } label: {
                    Label("Restart", systemImage: "arrow.clockwise")
                }
                .help("Restart")
                Button { Task { await model.services.stop(id: command.id) } } label: {
                    Label("Stop", systemImage: "stop.fill")
                }
                .help("Stop")
            } else {
                Button { Task { await model.services.start(id: command.id) } } label: {
                    Label(command.status == .exited ? "Restart" : "Start",
                          systemImage: command.status == .exited ? "arrow.clockwise" : "play.fill")
                }
                .help(command.status == .exited ? "Restart" : "Start")
            }
        }
    }
}

/// The form for a command: its name, the command line, and the folder it
/// runs from — the root unless another is typed, or chosen in the folder
/// panel opened on the repository. A folder chosen outside the repository
/// is refused, since the command belongs to it.
private struct NewCommandSheet: View {
    let repository: String
    let create: (String, String, String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var command = ""
    @State private var folder = ""
    @State private var folderProblem: String?

    private var canAdd: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
            && !command.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 2) {
                Text("New command")
                    .font(.headline)
                Text("A process the server runs in this project and keeps running while you work.")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 6)
            Form {
                TextField("Name", text: $name, prompt: Text("Frontend"))
                TextField("Command", text: $command, prompt: Text("pnpm dev"))
                    .font(.system(.body, design: .monospaced))
                LabeledContent("Folder") {
                    HStack(spacing: 6) {
                        TextField("Folder", text: $folder, prompt: Text("Repository root"))
                            .labelsHidden()
                            .font(.system(.body, design: .monospaced))
                            .onChange(of: folder) { folderProblem = nil }
                        Button("Choose…", action: chooseFolder)
                    }
                }
                if let folderProblem {
                    Text(folderProblem)
                        .font(.system(size: 11))
                        .foregroundStyle(.red)
                }
            }
            .formStyle(.grouped)
            .scrollContentBackground(.hidden)
            .scrollDisabled(true)
            HStack {
                Spacer()
                Button("Cancel") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button("Add") {
                    create(name.trimmingCharacters(in: .whitespaces),
                           command.trimmingCharacters(in: .whitespaces),
                           folder.trimmingCharacters(in: .whitespaces))
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(!canAdd)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 18)
        }
        .frame(width: 440)
    }

    private func chooseFolder() {
        let root = URL(fileURLWithPath: repository).standardizedFileURL
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.prompt = "Choose"
        panel.message = "Choose the folder in this repository the command runs in."
        panel.directoryURL = folder.isEmpty ? root : root.appendingPathComponent(folder)
        guard panel.runModal() == .OK, let chosen = panel.url?.standardizedFileURL else { return }
        let rootParts = root.pathComponents
        let chosenParts = chosen.pathComponents
        guard chosenParts.starts(with: rootParts) else {
            folderProblem = "Choose a folder inside \(root.lastPathComponent)."
            return
        }
        folder = chosenParts.dropFirst(rootParts.count).joined(separator: "/")
        folderProblem = nil
    }
}
