// What the strip along the top of the window holds — the same tabs the web
// app's window bar holds: Code and Sessions pinned, then one per agent
// session lifted into a tab of its own. Files are not window tabs; they are
// the code surface's own strip, inside the island.
//
// Every tab is a place in the SPA, and remembers the last place it was — the
// diff you were reading on Code, the conversation open on Sessions — so
// coming back lands where you left, the way the window bar's `trackLocation`
// does in the browser.
import Foundation

enum WindowTabKind: Hashable, Sendable {
    case code
    case sessions
    case session(id: String)
    /// A session being composed — its tab exists before the server has an id
    /// for it, and becomes `.session` the moment the composer lands on one.
    case newSession(token: String)
}

struct WindowTab: Identifiable, Hashable, Sendable {
    let kind: WindowTabKind
    var href: String

    var id: String {
        switch kind {
        case .code: return "code"
        case .sessions: return "sessions"
        case .session(let id): return "session:\(id)"
        case .newSession(let token): return "new:\(token)"
        }
    }

    var isPinned: Bool {
        switch kind {
        case .code, .sessions: return true
        case .session, .newSession: return false
        }
    }

    /// The web app's icons for the same tabs — Tabler's code, send and
    /// message — in their SF Symbols shapes.
    var symbol: String {
        switch kind {
        case .code: return "chevron.left.forwardslash.chevron.right"
        case .sessions: return "paperplane"
        case .session, .newSession: return "message"
        }
    }

    static let code = WindowTab(kind: .code, href: Href.review)
    static let sessions = WindowTab(kind: .sessions, href: Href.sessions)

    static func newSession() -> WindowTab {
        WindowTab(kind: .newSession(token: UUID().uuidString), href: Href.composer)
    }

    static func session(id: String) -> WindowTab {
        WindowTab(kind: .session(id: id), href: Href.session(id: id))
    }
}

/// The SPA's addresses the shell steers by — the same ones its own window
/// bar uses, so an island asked for one behaves exactly as the page would.
enum Href {
    static let review = "/modes/code/review"
    static let browsePath = "/modes/code/browse"
    static let sessions = "/modes/agent-session"
    static let composer = "/modes/agent-session?new=true"

    /// The browse page with a file open over it. The path is the same
    /// repo-relative one the tree lists, which is what the page's `file`
    /// search param names.
    static func browse(file: String) -> String {
        var components = URLComponents()
        components.path = browsePath
        components.queryItems = [URLQueryItem(name: "file", value: file)]
        return components.string ?? browsePath
    }

    static func session(id: String) -> String { "\(sessions)/\(id)" }

    /// The session a conversation address names, if it is one.
    static func sessionId(in href: String) -> String? {
        guard let components = URLComponents(string: href) else { return nil }
        let prefix = sessions + "/"
        guard components.path.hasPrefix(prefix) else { return nil }
        let rest = components.path.dropFirst(prefix.count)
        guard !rest.isEmpty, !rest.contains("/") else { return nil }
        return String(rest)
    }
}
