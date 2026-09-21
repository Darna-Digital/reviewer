// The bottom pane's Services: the project's dev commands — a frontend, an
// API, a watcher — as the server keeps them, each with its process and its
// output. The server runs them (so they outlive this window, and the web
// app sees the same ones); this lists, starts, stops and watches.
import Foundation
import Observation

@MainActor
@Observable
final class DevServices {
    private(set) var commands: [DevCommandView] = []
    /// Up until the first answer from the server. Later reloads — every
    /// return to the surface asks again — keep what is shown while they
    /// wait, so the table does not give way to the placeholder and back.
    private(set) var isLoading = true
    var selectedId: String?
    var lastError: String?

    @ObservationIgnored private let client: ReviewerClient
    @ObservationIgnored private var streams: [String: PtyStream] = [:]

    init(client: ReviewerClient) {
        self.client = client
    }

    var selected: DevCommandView? {
        commands.first { $0.id == selectedId }
    }

    func load() async {
        defer { isLoading = false }
        do {
            commands = try await client.devCommands()
            lastError = nil
            if selectedId == nil || !commands.contains(where: { $0.id == selectedId }) {
                selectedId = commands.first?.id
            }
            for command in commands where command.status == .running {
                stream(for: command.id)
            }
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// Cleared on a project switch: the commands, and the sockets, belong to
    /// the project that was open.
    func reset() {
        for stream in streams.values { stream.detach() }
        streams = [:]
        commands = []
        selectedId = nil
        isLoading = true
    }

    /// The output view for a command, attached to its process the first time
    /// it is asked for. Kept once made, so the backlog is not replayed and
    /// scroll position survives moving between commands.
    @discardableResult
    func stream(for id: String) -> PtyStream {
        if let existing = streams[id] { return existing }
        let stream = PtyStream { [client] cols, rows in client.devProcessURL(command: id, cols: cols, rows: rows) }
        streams[id] = stream
        stream.attach()
        return stream
    }

    func start(id: String) async {
        await act {
            let started = try await client.startDevCommand(id: id)
            replace(started)
            // A fresh process is a fresh socket: the old one closed with the
            // old process, and its backlog is that run's.
            streams[id]?.detach()
            streams[id] = nil
            stream(for: id)
        }
    }

    func stop(id: String) async {
        await act { try await client.stopDevCommand(id: id) }
    }

    func startAll() async {
        await act {
            try await client.startAllDevCommands()
            for stream in streams.values { stream.detach() }
            streams = [:]
        }
    }

    func stopAll() async {
        await act { try await client.stopAllDevCommands() }
    }

    func create(name: String, command: String, cwd: String) async {
        await act { try await client.createDevCommand(NewDevCommand(name: name, command: command, cwd: cwd)) }
    }

    func remove(id: String) async {
        await act {
            try await client.removeDevCommand(id: id)
            streams[id]?.detach()
            streams[id] = nil
        }
    }

    private func replace(_ command: DevCommandView) {
        if let index = commands.firstIndex(where: { $0.id == command.id }) {
            commands[index] = command
        }
    }

    /// Every action re-reads the list afterwards: status is the server's to
    /// say, and a process can have exited before the call came back.
    private func act(_ body: () async throws -> Void) async {
        do {
            try await body()
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
        await load()
    }
}
