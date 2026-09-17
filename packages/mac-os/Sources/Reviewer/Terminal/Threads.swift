// The bottom pane's Terminal: the project's terminal sessions as the server
// keeps them — the same threads the web app's Terminal sessions surface
// lists, so a shell opened here is there too, and survives this window.
// Each is a shell in the project folder; the server keeps it running between
// attachments and replays the screen on the way back.
import Foundation
import Observation

@MainActor
@Observable
final class Threads {
    private(set) var threads: [ThreadSummary] = []
    private(set) var isLoading = false
    var selectedId: String?
    var lastError: String?

    @ObservationIgnored private let client: ReviewerClient
    @ObservationIgnored private var streams: [String: PtyStream] = [:]

    init(client: ReviewerClient) {
        self.client = client
    }

    var selected: ThreadSummary? {
        threads.first { $0.id == selectedId }
    }

    /// Plain shells only: agent sessions are run from Sessions, not from
    /// here, the way the web app's surface has it.
    private var shells: [ThreadSummary] {
        threads.filter { $0.agent == "terminal" }
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            threads = try await client.threads()
            lastError = nil
            if selectedId == nil || !threads.contains(where: { $0.id == selectedId }) {
                selectedId = shells.first?.id
            }
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// Cleared on a project switch: the threads, and the sockets, belong to
    /// the project that was open.
    func reset() {
        for stream in streams.values { stream.detach() }
        streams = [:]
        threads = []
        selectedId = nil
    }

    /// The terminal of a thread, attached the first time it is asked for and
    /// kept: every thread visited stays attached while hidden, so its shell
    /// is exactly where it was on the way back.
    @discardableResult
    func stream(for id: String) -> PtyStream {
        if let existing = streams[id] { return existing }
        let stream = PtyStream { [client] cols, rows in
            client.threadPtyURL(id: id, cols: cols, rows: rows, theme: NativePalette.appearanceName())
        }
        streams[id] = stream
        stream.attach()
        return stream
    }

    func open(branch: String?) async {
        do {
            let thread = try await client.createThread(NewThread(title: nil, agent: "terminal", branch: branch))
            threads.insert(thread, at: 0)
            selectedId = thread.id
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
    }

    func rename(id: String, to title: String) async {
        do {
            try await client.renameThread(id: id, title: title)
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
        await load()
    }

    func close(id: String) async {
        streams[id]?.detach()
        streams[id] = nil
        do {
            try await client.removeThread(id: id)
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
        await load()
    }
}
