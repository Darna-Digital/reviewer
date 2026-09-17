// The sessions list the code island reports while the page is on the
// sessions surface — see `ShellSessions` in the SPA's `lib/shell` — for the
// sidebar to draw natively in the web list's place: every project's
// sessions, newest first, under the filters the surface keeps, and above
// them the runs handed to reviewer cloud. The list, its pages, the filters
// it is fetched under and the marks on its rows are the page's; what goes
// back is each thing the native list was asked to do — see `SessionAction`.
import Foundation

struct ShellSessions: Decodable, Equatable, Sendable {
    let sessions: [ShellSession]
    let cloudRuns: [ShellSession]
    let activeId: String?
    let loading: Bool
    let hasMore: Bool
    let filters: ShellSessionFilters

    var isEmpty: Bool { sessions.isEmpty && cloudRuns.isEmpty }

    static func decode(_ body: Any?) -> ShellSessions? { Wire.decode(body) }
}

struct ShellSession: Decodable, Identifiable, Hashable, Sendable {
    enum Kind: String, Decodable, Sendable {
        case session, cloud
    }

    let id: String
    let kind: Kind
    let title: String
    /// Where the session runs — its project, or a cloud run's repository.
    let origin: String
    let updatedAt: String
    let mark: SessionMark?
    let messageCount: Int
    let lastMessage: String?

    var updated: Date? { Wire.date(updatedAt) }
}

/// What the list is narrowed to — the web rail's search and its filter
/// popover's two axes, all of them part of what the page asks the server
/// for — and the projects the filter can name, with how many sessions each
/// holds. `project` is `all` or a project folder's absolute path.
struct ShellSessionFilters: Decodable, Equatable, Sendable {
    let search: String
    let project: String
    let date: SessionDateFilter
    let projects: [ShellProjectTally]

    static let allProjects = "all"

    var isNarrowed: Bool { project != Self.allProjects || date != .all }
}

struct ShellProjectTally: Decodable, Identifiable, Hashable, Sendable {
    let path: String
    let name: String
    let count: Int

    var id: String { path }
}

/// How far back the list looks — `DATE_FILTERS` in the SPA's `date-filter`.
enum SessionDateFilter: String, Decodable, CaseIterable, Identifiable, Sendable {
    case all
    case today
    case week = "7d"
    case month = "30d"

    var id: Self { self }

    var label: String {
        switch self {
        case .all: return "Any time"
        case .today: return "Today"
        case .week: return "Past 7 days"
        case .month: return "Past 30 days"
        }
    }
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
    case search(String)
    case filter(project: String?, date: SessionDateFilter?)

    var payload: [String: Any] {
        switch self {
        case .select(let id): return ["kind": "select", "id": id]
        case .openInTab(let id): return ["kind": "openInTab", "id": id]
        case .delete(let id): return ["kind": "delete", "id": id]
        case .loadMore: return ["kind": "loadMore"]
        case .search(let text): return ["kind": "search", "text": text]
        case .filter(let project, let date):
            var payload: [String: Any] = ["kind": "filter"]
            if let project { payload["project"] = project }
            if let date { payload["date"] = date.rawValue }
            return payload
        }
    }
}
