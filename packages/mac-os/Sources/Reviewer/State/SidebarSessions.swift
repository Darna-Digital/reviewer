// The sessions list the code island reports while the page is on the
// sessions surface — see `ShellSessions` in the SPA's `lib/shell` — for the
// sidebar to draw natively in the web list's place: every project's
// sessions, newest first, under the filters the surface keeps, and above
// them the runs handed to reviewer cloud. The list, its pages and the marks
// on its rows are the page's; what goes back is each thing the native list
// was asked to do — see `SessionAction`.
import Foundation

struct ShellSessions: Decodable, Equatable, Sendable {
    let sessions: [ShellSession]
    let cloudRuns: [ShellSession]
    let activeId: String?
    let loading: Bool
    let hasMore: Bool

    var isEmpty: Bool { sessions.isEmpty && cloudRuns.isEmpty }

    static func decode(_ body: Any?) -> ShellSessions? { Wire.decode(body) }
}

struct ShellSession: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let title: String
    /// Where the session runs — its project, or a cloud run's repository.
    let origin: String
    let updatedAt: String
    let mark: SessionMark?
}

/// The state a row wears, as the web row reads it off the session: the orb
/// while an agent works, a red dot where a turn ended badly, and the accent
/// dot for a session that has moved since it was last opened.
enum SessionMark: String, Decodable, Sendable {
    case running, error, unread

    var label: String {
        switch self {
        case .running: return "turn running"
        case .error: return "turn error"
        case .unread: return "unread"
        }
    }
}

/// The list's actions, in the shape the island's `ShellSessionAction` takes.
enum SessionAction {
    case select(String)
    case openInTab(String)
    case delete(String)
    case loadMore

    var payload: [String: Any] {
        switch self {
        case .select(let id): return ["kind": "select", "id": id]
        case .openInTab(let id): return ["kind": "openInTab", "id": id]
        case .delete(let id): return ["kind": "delete", "id": id]
        case .loadMore: return ["kind": "loadMore"]
        }
    }
}
