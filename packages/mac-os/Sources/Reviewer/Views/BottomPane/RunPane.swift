// The Run surface, laid out as the web app's Services are: the project's
// dev commands as a source list down the left — a dot for whether each
// is up, run and stop on the row under the pointer, add and remove in the
// footer with the marks that run and stop them all — and the selected
// one's output on the right, under a bar naming it and its state.
// Starting and stopping is the server's doing; the output is its process's
// socket drawn by SwiftTerm, so a command that asks a question can be
// answered here too.
import SwiftUI

struct RunPane: View {
    @Environment(AppModel.self) private var model
    @State private var adding = false

    var body: some View {
        HSplitView {
            CommandList(adding: $adding)
                .frame(minWidth: PaneMetrics.listMinWidth, idealWidth: PaneMetrics.listIdealWidth,
                       maxWidth: PaneMetrics.listMaxWidth)
            CommandDetail()
                .frame(minWidth: 240, maxWidth: .infinity, maxHeight: .infinity)
        }
        .task { await model.services.load() }
        .sheet(isPresented: $adding) {
            NewCommandSheet { name, command in
                Task { await model.services.create(name: name, command: command) }
            }
        }
    }
}

private struct CommandList: View {
    @Binding var adding: Bool
    @Environment(AppModel.self) private var model

    private var services: DevServices { model.services }
    private var anyRunning: Bool { services.commands.contains(where: \.isRunning) }

    var body: some View {
        VStack(spacing: 0) {
            List(selection: selection) {
                ForEach(services.commands) { command in
                    CommandRow(command: command)
                        .tag(command.id)
                        .listRowInsets(EdgeInsets(top: 2, leading: PaneMetrics.barInset, bottom: 2, trailing: PaneMetrics.barInset))
                        .contextMenu { menu(for: command) }
                }
            }
            .listStyle(.inset)
            .scrollContentBackground(.hidden)
            .overlay {
                if services.commands.isEmpty && !services.isLoading {
                    PanePlaceholder("No commands", symbol: "play.circle",
                                    detail: "Add a dev server or a watcher to run in this project.") {
                        Button("Add Command…") { adding = true }
                    }
                }
            }
            PaneFooter {
                PaneBarButton(symbol: "plus", help: "Add a command") { adding = true }
                PaneBarButton(symbol: "minus", help: "Remove the selected command") {
                    guard let id = services.selectedId else { return }
                    Task { await services.remove(id: id) }
                }
                .disabled(services.selected == nil)
                Spacer(minLength: 0)
                PaneBarButton(symbol: "play.fill", help: "Start all") {
                    Task { await services.startAll() }
                }
                .disabled(services.commands.isEmpty)
                PaneBarButton(symbol: "stop.fill", help: "Stop all") {
                    Task { await services.stopAll() }
                }
                .disabled(!anyRunning)
            }
        }
    }

    @ViewBuilder
    private func menu(for command: DevCommandView) -> some View {
        if command.isRunning {
            Button("Stop") { Task { await services.stop(id: command.id) } }
        } else {
            Button(command.status == .exited ? "Restart" : "Start") {
                Task { await services.start(id: command.id) }
            }
        }
        Divider()
        Button("Remove", role: .destructive) {
            Task { await services.remove(id: command.id) }
        }
    }

    private var selection: Binding<String?> {
        Binding(get: { services.selectedId }, set: { services.selectedId = $0 })
    }
}

/// A command's row: its state as a dot, its name over the repository it
/// runs in, and while the pointer is over it, the mark that runs or stops
/// it — otherwise the exit code, when there is one worth reading.
private struct CommandRow: View {
    let command: DevCommandView
    @Environment(AppModel.self) private var model
    @State private var isHovering = false

    var body: some View {
        HStack(spacing: 8) {
            ProcessDot(status: command.status, exitCode: command.exitCode)
            VStack(alignment: .leading, spacing: 1) {
                Text(command.name)
                    .font(.system(size: 13))
                    .lineLimit(1)
                Text(command.command)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            trailing
        }
        .frame(height: 30)
        .contentShape(Rectangle())
        .onHover { isHovering = $0 }
    }

    @ViewBuilder
    private var trailing: some View {
        if isHovering {
            if command.isRunning {
                PaneBarButton(symbol: "stop.fill", help: "Stop") {
                    Task { await model.services.stop(id: command.id) }
                }
            } else {
                PaneBarButton(symbol: "play.fill", help: command.status == .exited ? "Restart" : "Start") {
                    Task { await model.services.start(id: command.id) }
                }
            }
        } else if command.status == .exited, let code = command.exitCode, code != 0 {
            Text("exit \(code)")
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(.red)
        }
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
        PaneBar {
            ProcessDot(status: command.status, exitCode: command.exitCode)
            Text(command.name)
                .font(.system(size: 12, weight: .medium))
                .lineLimit(1)
            Text(command.command)
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .truncationMode(.middle)
            Spacer(minLength: 8)
            Text(command.statusLabel)
                .font(.system(size: 11))
                .foregroundStyle(command.status == .exited && (command.exitCode ?? 0) != 0 ? .red : .secondary)
            if command.isRunning {
                PaneBarButton(symbol: "stop.fill", help: "Stop") {
                    Task { await model.services.stop(id: command.id) }
                }
            } else {
                PaneBarButton(symbol: command.status == .exited ? "arrow.clockwise" : "play.fill",
                              help: command.status == .exited ? "Restart" : "Start") {
                    Task { await model.services.start(id: command.id) }
                }
            }
        }
    }
}

private struct NewCommandSheet: View {
    let create: (String, String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var command = ""

    private var canAdd: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
            && !command.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 2) {
                Text("New Command")
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
                           command.trimmingCharacters(in: .whitespaces))
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
}
