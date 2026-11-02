// The Run surface, laid out as the opener is: the workspace's dev commands
// — every repository's, the environment they make together — as the
// system's own table down the left — name under its dot, the repository
// it belongs to while there are several, the command it runs, whether it
// is up, the folder it runs in (the root, or a package of a monorepo) —
// sortable on any column, its rows plain rather than striped, under a bar
// (see `RunBar`) with add and remove, start all and stop all, and the
// filter at its trailing edge. A command is a shell command line the server runs in the
// project. With nothing to list the table gives way to a placeholder,
// header and all. A click picks a command, a double-click or Return starts
// or stops it, Delete removes it, and the row's menu holds the same, with
// a restart while it runs. The selected one's output stands on the right
// under a slim bar naming it and its state, with stop and restart while it
// runs. Starting, stopping and restarting are the server's doing — a
// restart is a start, which replaces the live process; the output is its
// process's socket drawn by SwiftTerm, so a command that asks a question
// can be answered here too.
import AppKit
import SwiftUI

struct RunPane: View {
    @Environment(AppModel.self) private var model
    @Environment(BottomPaneQueries.self) private var queries

    var body: some View {
        @Bindable var queries = queries
        TableSplit {
            CommandTable()
        } detail: {
            CommandDetail()
        }
        .task {
            await withTaskGroup(of: Void.self) { group in
                for root in model.roots {
                    group.addTask { await root.services.load() }
                }
            }
        }
        .sheet(isPresented: $queries.addingCommand) {
            NewCommandSheet(repository: model.runRoot.path) { command in
                Task { await model.runRoot.services.create(command) }
            }
        }
    }
}

/// One dev command as the Run pane's table lists it, with the repository
/// it runs in — the workspace's commands are one list.
private struct RunRow: Identifiable {
    let root: RootModel
    let command: DevCommandView

    var id: String { command.id }
    var name: String { command.name }
    var commandLine: String { command.command }
    var statusLabel: String { command.statusLabel }
    var cwd: String { command.cwd }
    var repository: String { root.name }
}

/// The bar over the table: add and remove, start all and stop all —
/// across every repository's commands — and the filter.
private struct RunBar: View {
    @Environment(AppModel.self) private var model
    @Environment(BottomPaneQueries.self) private var queries

    private var multiRoot: Bool { model.roots.count > 1 }
    private var commands: [DevCommandView] { model.roots.flatMap(\.services.commands) }

    var body: some View {
        @Bindable var queries = queries
        PaneBar {
            PaneGlassGroup {
                PaneBarButton(symbol: "plus", help: multiRoot ? "Add a command to \(model.runRoot.name)" : "Add a command") {
                    queries.addingCommand = true
                }
                PaneBarButton(symbol: "minus", help: "Remove the selected command", action: removeSelected)
                    .disabled(model.runRoot.services.selected == nil)
                PaneGlassDivider()
                PaneBarButton(symbol: "play.fill", help: multiRoot ? "Start every repository's commands" : "Start all") {
                    model.runProject()
                }
                .disabled(commands.isEmpty)
                PaneBarButton(symbol: "stop.fill", help: multiRoot ? "Stop every repository's commands" : "Stop all",
                              action: stopAll)
                    .disabled(!commands.contains(where: \.isRunning))
            }
            Spacer(minLength: 0)
            PaneFilterField(text: $queries.commands)
        }
    }

    private func removeSelected() {
        let services = model.runRoot.services
        guard let id = services.selectedId else { return }
        Task { await services.remove(id: id) }
    }

    private func stopAll() {
        Task {
            await withTaskGroup(of: Void.self) { group in
                for root in model.roots {
                    group.addTask { await root.services.stopAll() }
                }
            }
        }
    }
}

private struct CommandTable: View {
    @Environment(AppModel.self) private var model
    @Environment(BottomPaneQueries.self) private var queries
    @State private var sortOrder = [KeyPathComparator(\RunRow.name)]

    /// The commands of the repository picked — what the actions on one
    /// command are sent to.
    private var services: DevServices { model.runRoot.services }
    private var allRows: [RunRow] {
        model.roots.flatMap { root in root.services.commands.map { RunRow(root: root, command: $0) } }
    }
    private var isLoading: Bool { model.roots.contains { $0.services.isLoading } }
    private var multiRoot: Bool { model.roots.count > 1 }

    private var query: String { queries.commands }

    private var rows: [RunRow] {
        let needle = query.trimmingCharacters(in: .whitespaces)
        let matched = needle.isEmpty
            ? allRows
            : allRows.filter {
                $0.name.localizedCaseInsensitiveContains(needle)
                    || $0.commandLine.localizedCaseInsensitiveContains(needle)
                    || $0.cwd.localizedCaseInsensitiveContains(needle)
                    || $0.repository.localizedCaseInsensitiveContains(needle)
            }
        return matched.sorted(using: sortOrder)
    }

    var body: some View {
        VStack(spacing: 0) {
            RunBar()
            if rows.isEmpty && !isLoading {
                placeholder
            } else {
                table
            }
        }
    }

    private var table: some View {
        Table(rows, selection: selection, sortOrder: $sortOrder) {
            TableColumn("Name", value: \.name) { row in
                let command = row.command
                HStack(spacing: 8) {
                    ProcessDot(status: command.status, exitCode: command.exitCode)
                    Text(command.name)
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
            }
            .width(min: 120, ideal: 170)
            if multiRoot {
                TableColumn("Repository", value: \.repository) { row in
                    HStack(spacing: 6) {
                        RepoAvatar(name: row.repository, size: 14)
                        Text(row.repository)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .truncationMode(.tail)
                    }
                    .help(row.root.path)
                }
                .width(min: 80, ideal: 120)
            }
            TableColumn("Command", value: \.commandLine) { row in
                let command = row.command
                CommandText(command: command, size: 12)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .help(command.command)
            }
            .width(min: 120, ideal: 200)
            TableColumn("Status", value: \.statusLabel) { row in
                let command = row.command
                Text(command.statusLabel)
                    .foregroundStyle(command.exitedBadly ? .red : .secondary)
                    .lineLimit(1)
            }
            .width(min: 80, ideal: 100)
            TableColumn("Folder", value: \.cwd) { row in
                let command = row.command
                Text(command.folderLabel)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .help(command.folderHelp)
            }
            .width(min: 80, ideal: 140)
        }
        .tableStyle(.inset(alternatesRowBackgrounds: false))
        .scrollContentBackground(.hidden)
        .selectionInk()
        .themedRows()
        .contextMenu(forSelectionType: String.self) { ids in
            if let row = ids.first.flatMap(row(for:)) { menu(for: row) }
        } primaryAction: { ids in
            if let row = ids.first.flatMap(row(for:)) { toggle(row) }
        }
        .onKeyPress(.return) {
            guard let id = services.selectedId, let row = row(for: id) else { return .ignored }
            toggle(row)
            return .handled
        }
        .onDeleteCommand(perform: removeSelected)
    }

    @ViewBuilder
    private var placeholder: some View {
        if query.isEmpty {
            PanePlaceholder("No commands", symbol: "play.circle",
                            detail: multiRoot
                                ? "Add a dev server or a watcher to run in \(model.runRoot.name)."
                                : "Add a dev server or a watcher to run in this project.") {
                Button("Add command…") { queries.addingCommand = true }
            }
        } else {
            PanePlaceholder("No commands match “\(query)”", symbol: "magnifyingglass")
        }
    }

    @ViewBuilder
    private func menu(for row: RunRow) -> some View {
        let command = row.command
        let services = row.root.services
        if command.isRunning {
            Button("Restart") { Task { await services.start(id: command.id) } }
            Button("Stop") { Task { await services.stop(id: command.id) } }
        } else {
            Button(command.status == .exited ? "Restart" : "Start") {
                Task { await services.start(id: command.id) }
            }
        }
        ThemedDivider()
        Button("Copy command") { copy(command.command) }
        if !command.cwd.isEmpty {
            Button("Show folder in Finder") { reveal(command.cwd, in: row.root) }
        }
        ThemedDivider()
        Button("Remove", role: .destructive) {
            Task { await services.remove(id: command.id) }
        }
    }

    private func row(for id: String) -> RunRow? {
        allRows.first { $0.id == id }
    }

    private func toggle(_ row: RunRow) {
        Task {
            if row.command.isRunning {
                await row.root.services.stop(id: row.id)
            } else {
                await row.root.services.start(id: row.id)
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

    private func reveal(_ cwd: String, in root: RootModel) {
        let url = URL(fileURLWithPath: root.path).appendingPathComponent(cwd)
        NSWorkspace.shared.activateFileViewerSelecting([url])
    }

    /// The picked command, across every repository's: picking one makes
    /// its repository the pane's, whose output then stands beside it.
    private var selection: Binding<String?> {
        Binding(
            get: { services.selectedId },
            set: { id in
                guard let id, let row = row(for: id) else {
                    services.selectedId = nil
                    return
                }
                model.runRootPath = row.root.path
                row.root.services.selectedId = id
            })
    }
}

private struct CommandDetail: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if let command = model.runRoot.services.selected {
            VStack(spacing: 0) {
                bar(for: command)
                if command.status == .stopped {
                    PanePlaceholder(command.statusLabel, symbol: "pause.circle",
                                    detail: "Start it to see its output here.") {
                        Button("Start") { Task { await model.runRoot.services.start(id: command.id) } }
                    }
                } else {
                    let stream = model.runRoot.services.stream(for: command.id)
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
        PaneBar {
            ProcessDot(status: command.status, exitCode: command.exitCode)
            Text(command.name)
                .font(.system(size: 12, weight: .medium))
                .lineLimit(1)
            CommandText(command: command, size: 11)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .truncationMode(.middle)
            if !command.cwd.isEmpty {
                Label(command.cwd, systemImage: "folder")
                    .labelStyle(.titleAndIcon)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .help("Runs in \(command.cwd)")
            }
            Spacer(minLength: 8)
            Text(command.statusLabel)
                .font(.system(size: 11))
                .foregroundStyle(command.exitedBadly ? .red : .secondary)
            let services = model.runRoot.services
            PaneGlassGroup {
                if command.isRunning {
                    PaneBarButton(symbol: "arrow.clockwise", help: "Restart") {
                        Task { await services.start(id: command.id) }
                    }
                    PaneBarButton(symbol: "stop.fill", help: "Stop") {
                        Task { await services.stop(id: command.id) }
                    }
                } else {
                    PaneBarButton(symbol: command.status == .exited ? "arrow.clockwise" : "play.fill",
                                  help: command.status == .exited ? "Restart" : "Start") {
                        Task { await services.start(id: command.id) }
                    }
                }
            }
        }
    }
}

/// A command as a row or the detail bar names it: the command line, in
/// monospace, as it was typed.
private struct CommandText: View {
    let command: DevCommandView
    let size: CGFloat

    var body: some View {
        Text(command.command)
            .font(.system(size: size, design: .monospaced))
    }
}

/// The form for a command: its name, the command line, and the folder it
/// runs from — the root unless another is typed, or chosen in the folder
/// panel opened on the repository; a folder chosen outside the repository
/// is refused, since the command belongs to it.
private struct NewCommandSheet: View {
    let repository: String
    let create: (NewDevCommand) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var command = ""
    @State private var folder = ""
    @State private var folderProblem: String?

    private var canAdd: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
            && !command.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private let explanation =
        "A process the server runs in this project and keeps running while you work." 

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 2) {
                Text("New command")
                    .font(.headline)
                Text(explanation)
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
                    create(newCommand)
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(!canAdd)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 18)
        }
        .frame(width: 440)
        .systemInk()
    }

    private var newCommand: NewDevCommand {
        NewDevCommand(name: name.trimmingCharacters(in: .whitespaces),
                      command: command.trimmingCharacters(in: .whitespaces),
                      cwd: folder.trimmingCharacters(in: .whitespaces))
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
