// The window's notices — the web app's toasts, native: what a git action
// came to, a save, a request the server refused — stacked at the foot of
// the detail column (see `NoticeStack`) rather than raised inside the page
// island, whose web view would clip them and whose edge the pane stands
// over. An action worth waiting on is one notice for its whole run: it goes
// up as the attempt — "Pushing…", wearing the orb every wait in the app
// wears — and settles in place into what came of it, so a push that is
// slow to answer is seen being tried rather than wondered about. A settled
// notice stays up long enough to read and then goes; the clock holds while
// the pointer is over the stack, as the web toaster's does, and a loading
// notice has no clock at all — it goes when its action does.
import Foundation
import Observation

enum NoticeKind: Equatable, Sendable {
    case loading
    case success
    case error
    case info
}

struct Notice: Identifiable, Equatable, Sendable {
    let id: UUID
    var kind: NoticeKind
    var title: String
    /// The line under the title — a push's output under "Pushed" — muted.
    var detail: String?
}

@MainActor
@Observable
final class Notices {
    /// Oldest first: the stack draws them bottom-up, the newest nearest the
    /// window's edge, the way the web toaster stacks.
    private(set) var items: [Notice] = []
    @ObservationIgnored private var clocks: [Notice.ID: Task<Void, Never>] = [:]
    @ObservationIgnored private var held = false

    /// The web toaster's 6s: about as long as "Saved" needs and short
    /// enough for a six-line push rejection to have been worth reading.
    static let readTime: Duration = .seconds(6)
    /// How many stand at once; beyond it the oldest settled one goes, so a
    /// run of errors cannot wall the page off.
    static let capacity = 5

    @discardableResult
    func post(_ kind: NoticeKind, _ title: String, detail: String? = nil) -> Notice.ID {
        let notice = Notice(id: UUID(), kind: kind, title: title, detail: detail)
        items.append(notice)
        trim()
        wind(notice)
        return notice.id
    }

    /// The notice, changed in place — the attempt become its outcome. A
    /// notice already put away is not brought back: the action outlived the
    /// reader's interest, and its outcome reads fine as a fresh one.
    func settle(_ id: Notice.ID, _ kind: NoticeKind, _ title: String, detail: String? = nil) {
        guard let index = items.firstIndex(where: { $0.id == id }) else {
            post(kind, title, detail: detail)
            return
        }
        items[index].kind = kind
        items[index].title = title
        items[index].detail = detail
        wind(items[index])
    }

    func dismiss(_ id: Notice.ID) {
        clocks.removeValue(forKey: id)?.cancel()
        items.removeAll { $0.id == id }
    }

    /// The pointer is over the stack, or has left it: every settled notice
    /// keeps while it is read, and gets a whole reading again once it is not.
    func hold(_ holding: Bool) {
        guard holding != held else { return }
        held = holding
        for notice in items { wind(notice) }
    }

    /// An action seen through: `pending` while it runs, then what it
    /// answered — its own output when it has any, else `done` — or the
    /// error it threw. Answers whether it went through, for a caller with
    /// somewhere to go after.
    @discardableResult
    func run(_ pending: String, done: String, _ body: () async throws -> String?) async -> Bool {
        let id = post(.loading, pending)
        do {
            let output = try await body()?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            settle(id, .success, output.isEmpty ? done : output)
            return true
        } catch {
            settle(id, .error, error.localizedDescription)
            return false
        }
    }

    /// The clock on a settled notice, started over — and stopped, while the
    /// stack is held or the notice is still loading.
    private func wind(_ notice: Notice) {
        clocks.removeValue(forKey: notice.id)?.cancel()
        guard notice.kind != .loading, !held else { return }
        clocks[notice.id] = Task { [weak self] in
            try? await Task.sleep(for: Self.readTime)
            guard !Task.isCancelled else { return }
            self?.dismiss(notice.id)
        }
    }

    private func trim() {
        while items.count > Self.capacity, let oldest = items.first(where: { $0.kind != .loading }) {
            dismiss(oldest.id)
        }
    }
}
