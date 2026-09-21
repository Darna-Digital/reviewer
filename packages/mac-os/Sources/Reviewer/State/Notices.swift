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
    /// The headline: what was done, or what failed — never the command's
    /// own words, which go under it.
    var title: String
    /// Prose under the title, muted — GitHub's "Pull Request successfully
    /// merged", a server's refusal.
    var detail: String?
    /// A command's own words — git's account of a push, the reason it
    /// refused one — tidied of progress chatter (see `GitOutput`), behind
    /// the card's Details rather than on it: the title and detail say what
    /// happened, this is the evidence.
    var output: String?
}

/// How what an action answers is shown: as prose under the headline, or as
/// the command's own words.
enum NoticeReport {
    case prose
    case command
}

/// An error that is a command's own words — git's stderr — shown as output
/// rather than read as a sentence.
protocol CommandOutputError: Error {
    var commandOutput: String? { get }
}

/// Git's output as the notice shows it: the progress lines a push prints
/// while it works dropped, since they are news only while it is working,
/// blank lines and empty `remote:` lines dropped with them, and tabs made
/// spaces, since the card's text has no tab stops.
enum GitOutput {
    private static let progressPrefixes = [
        "Enumerating objects", "Counting objects", "Compressing objects", "Writing objects",
        "Delta compression", "Total ", "Receiving objects", "Resolving deltas", "Unpacking objects",
        "remote: Resolving deltas", "remote: Counting objects", "remote: Compressing objects",
        "remote: Enumerating objects", "remote: Total ",
    ]

    static func tidy(_ raw: String) -> String? {
        let lines = raw
            .replacingOccurrences(of: "\t", with: "    ")
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespaces).isEmpty ? "" : String($0) }
            .filter { line in
                !line.isEmpty
                    && line != "remote:"
                    && !progressPrefixes.contains { line.hasPrefix($0) }
            }
        return lines.isEmpty ? nil : lines.joined(separator: "\n")
    }

}

@MainActor
@Observable
final class Notices {
    /// Oldest first: the stack draws them bottom-up, the newest nearest the
    /// window's edge, the way the web toaster stacks.
    private(set) var items: [Notice] = []
    @ObservationIgnored private var clocks: [Notice.ID: Task<Void, Never>] = [:]
    @ObservationIgnored private var held = false
    @ObservationIgnored private var pinned: Set<Notice.ID> = []

    /// The web toaster's 6s: about as long as "Saved" needs and short
    /// enough for a six-line push rejection to have been worth reading.
    static let readTime: Duration = .seconds(6)
    /// How many stand at once; beyond it the oldest settled one goes, so a
    /// run of errors cannot wall the page off.
    static let capacity = 5

    @discardableResult
    func post(_ kind: NoticeKind, _ title: String, detail: String? = nil, output: String? = nil) -> Notice.ID {
        let notice = Notice(id: UUID(), kind: kind, title: title, detail: detail, output: output)
        items.append(notice)
        trim()
        wind(notice)
        return notice.id
    }

    /// The notice, changed in place — the attempt become its outcome. A
    /// notice already put away is not brought back: the action outlived the
    /// reader's interest, and its outcome reads fine as a fresh one.
    func settle(_ id: Notice.ID, _ kind: NoticeKind, _ title: String, detail: String? = nil, output: String? = nil) {
        guard let index = items.firstIndex(where: { $0.id == id }) else {
            post(kind, title, detail: detail, output: output)
            return
        }
        items[index].kind = kind
        items[index].title = title
        items[index].detail = detail
        items[index].output = output
        wind(items[index])
    }

    /// The notice become the failure it came to: `title` as the headline,
    /// and the error under it — read into a sentence when it is a command's
    /// own words (see `GitReport`), else as the sentence it is.
    func settle(_ id: Notice.ID, failed title: String, with error: Error) {
        if let output = (error as? CommandOutputError)?.commandOutput.flatMap(GitOutput.tidy) {
            let summary = GitReport.read(output)
            settle(id, .error, summary.headline ?? title, detail: summary.detail, output: output)
        } else {
            settle(id, .error, title, detail: error.localizedDescription)
        }
    }

    func dismiss(_ id: Notice.ID) {
        clocks.removeValue(forKey: id)?.cancel()
        pinned.remove(id)
        items.removeAll { $0.id == id }
    }

    /// The pointer is over the stack, or has left it: every settled notice
    /// keeps while it is read, and gets a whole reading again once it is not.
    func hold(_ holding: Bool) {
        guard holding != held else { return }
        held = holding
        for notice in items { wind(notice) }
    }

    /// One notice kept up on its own — its details are open — and given a
    /// whole reading again once they close.
    func pin(_ id: Notice.ID, _ pinning: Bool) {
        if pinning { pinned.insert(id) } else { pinned.remove(id) }
        if let notice = items.first(where: { $0.id == id }) { wind(notice) }
    }

    /// An action seen through: `pending` while it runs, then `done` over
    /// whatever it answered — prose or, for a git command, its own output
    /// (`report`) — or `failed` over the error it threw. A merge or rebase
    /// that stopped on conflicts is a failure too, whatever its exit code:
    /// the tree wants tending before anything else. Answers whether it
    /// went through, for a caller with somewhere to go after.
    @discardableResult
    func run(_ pending: String, done: String, failed: String, report: NoticeReport = .prose, _ body: () async throws -> String?) async -> Bool {
        let id = post(.loading, pending)
        do {
            let answer = try await body()?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            switch report {
            case .prose:
                settle(id, .success, done, detail: answer.isEmpty ? nil : answer)
            case .command:
                guard let output = GitOutput.tidy(answer) else {
                    settle(id, .success, done)
                    return true
                }
                let summary = GitReport.read(output)
                let kind: NoticeKind = summary.conflicted ? .error : .success
                settle(id, kind, summary.headline ?? (summary.conflicted ? failed : done), detail: summary.detail, output: output)
            }
            return true
        } catch {
            settle(id, failed: failed, with: error)
            return false
        }
    }

    /// The clock on a settled notice, started over — and stopped, while the
    /// stack is held or the notice is still loading.
    private func wind(_ notice: Notice) {
        clocks.removeValue(forKey: notice.id)?.cancel()
        guard notice.kind != .loading, !held, !pinned.contains(notice.id) else { return }
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
