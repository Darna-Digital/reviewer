// The Services surface: the project's dev commands down the left, the
// selected one's output on the right. Starting and stopping is the server's
// doing; the output is its process's socket drawn by SwiftTerm, so a service
// that asks a question can be answered here too.
import SwiftUI

struct ServicesPane: View {
    @Environment(AppModel.self) private var model
    @State private var adding = false

    var body: some View {
        HSplitView {
            commandList
                .frame(minWidth: 220, idealWidth: 260, maxWidth: 400)
            output
                .frame(minWidth: 200, maxWidth: .infinity, maxHeight: .infinity)
        }
        .task { await model.services.load() }
        .sheet(isPresented: $adding) {
            NewServiceSheet(repos: model.workspace?.repos ?? []) { name, command, repoPath in
                Task { await model.services.create(name: name, command: command, repoPath: repoPath) }
            }
        }
    }

    private var commandList: some View {
        VStack(spacing: 0) {
            List(selection: selection) {
                ForEach(model.services.commands) { command in
                    ServiceRow(command: command)
                        .tag(command.id)
                        .contextMenu {
                            Button("Remove", role: .destructive) {
                                Task { await model.services.remove(id: command.id) }
                            }
                        }
                }
            }
            .listStyle(.inset)
            .overlay {
                if model.services.commands.isEmpty && !model.services.isLoading {
                    ContentUnavailableView {
                        Label("No services", systemImage: "play.circle")
                    } description: {
                        Text("Add a command to run in this project — a dev server, a watcher.")
                    }
                }
            }
            Divider()
            HStack(spacing: 4) {
                Button { adding = true } label: { Image(systemName: "plus") }
                    .help("Add a service")
                Spacer()
                Button("Start All") { Task { await model.services.startAll() } }
                    .disabled(model.services.commands.isEmpty)
                Button("Stop All") { Task { await model.services.stopAll() } }
                    .disabled(!model.services.commands.contains { $0.status == .running })
            }
            .controlSize(.small)
            .buttonStyle(.borderless)
            .padding(6)
        }
    }

    @ViewBuilder
    private var output: some View {
        if let command = model.services.selected {
            VStack(spacing: 0) {
                HStack(spacing: 8) {
                    Text(command.command)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Spacer()
                    if command.status == .running {
                        Button("Stop") { Task { await model.services.stop(id: command.id) } }
                    } else {
                        Button(command.status == .exited ? "Restart" : "Start") {
                            Task { await model.services.start(id: command.id) }
                        }
                    }
                }
                .controlSize(.small)
                .padding(.horizontal, 8)
                .frame(height: 26)
                Divider()
                if command.status == .stopped {
                    ContentUnavailableView("Not running", systemImage: "pause.circle")
                } else {
                    TerminalHost(view: model.services.stream(for: command.id).view)
                        .padding(.top, 4)
                }
            }
        } else {
            ContentUnavailableView("Pick a service", systemImage: "play.circle")
        }
    }

    private var selection: Binding<String?> {
        Binding(get: { model.services.selectedId }, set: { model.services.selectedId = $0 })
    }
}

private struct ServiceRow: View {
    let command: DevCommandView

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(tint)
                .frame(width: 7, height: 7)
            VStack(alignment: .leading, spacing: 1) {
                Text(command.name)
                    .lineLimit(1)
                Text(command.repo)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            if command.status == .exited, let code = command.exitCode, code != 0 {
                Text("exit \(code)")
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        }
    }

    private var tint: Color {
        switch command.status {
        case .running: return .green
        case .exited: return (command.exitCode ?? 0) == 0 ? .secondary : .red
        case .stopped: return .secondary.opacity(0.4)
        }
    }
}

private struct NewServiceSheet: View {
    let repos: [RepoEntry]
    let create: (String, String, String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var command = ""
    @State private var repoPath = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("New Service")
                .font(.headline)
            Form {
                TextField("Name", text: $name, prompt: Text("Frontend"))
                TextField("Command", text: $command, prompt: Text("pnpm dev"))
                    .font(.system(.body, design: .monospaced))
                Picker("Repository", selection: $repoPath) {
                    ForEach(repos, id: \.path) { repo in
                        Text(repo.name).tag(repo.path)
                    }
                }
            }
            HStack {
                Spacer()
                Button("Cancel") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button("Add") {
                    create(name, command, repoPath)
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(name.isEmpty || command.isEmpty || repoPath.isEmpty)
            }
        }
        .padding(20)
        .frame(width: 420)
        .onAppear { repoPath = repos.first?.path ?? "" }
    }
}
