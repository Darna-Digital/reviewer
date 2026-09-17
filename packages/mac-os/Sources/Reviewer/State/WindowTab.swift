// What the strip along the top of the window holds — the same tabs the web
// app's window bar holds: Code, Git and Sessions pinned, then one per agent
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
    case git
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
        case .git: return "git"
        case .sessions: return "sessions"
        case .session(let id): return "session:\(id)"
        case .newSession(let token): return "new:\(token)"
        }
    }

    var isPinned: Bool {
        switch kind {
        case .code, .git, .sessions: return true
        case .session, .newSession: return false
        }
    }

    /// The web app's icons for the same tabs — Tabler's code, send and
    /// message — in their SF Symbols shapes.
    var symbol: String {
        switch kind {
        case .code: return "chevron.left.forwardslash.chevron.right"
        case .git: return "arrow.triangle.branch"
        case .sessions: return "paperplane"
        case .session, .newSession: return "message"
        }
    }

    static let code = WindowTab(kind: .code, href: Href.review)
    static let git = WindowTab(kind: .git, href: Href.git)
    static let sessions = WindowTab(kind: .sessions, href: Href.sessions)

    /// The pinned tab an address belongs to — the way the web app's strip
    /// hands the window to the tab that owns where it went.
    static func owner(of href: String) -> WindowTabKind {
        let path = URLComponents(string: href)?.path ?? ""
        if path.hasPrefix(Href.sessions) { return .sessions }
        if path.hasPrefix(Href.git) { return .git }
        return .code
    }

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
    static let git = "/modes/git"
    static let sessions = "/modes/agent-session"
    static let composer = "/modes/agent-session?new=true"

    static func session(id: String) -> String { "\(sessions)/\(id)" }

    /// `href` showing `path` — at `line`, when there is one — the way the
    /// web app's search opens a result: the page's own address with the
    /// file named in its query, whatever else the query already held.
    static func file(_ path: String, line: Int?, on href: String) -> String {
        guard var components = URLComponents(string: href) else { return href }
        var items = (components.queryItems ?? []).filter { $0.name != "file" && $0.name != "line" }
        items.append(URLQueryItem(name: "file", value: path))
        if let line { items.append(URLQueryItem(name: "line", value: String(line))) }
        components.queryItems = items
        return components.string ?? href
    }

    /// A code surface — the diff, the browse page, the merge requests — as
    /// opposed to the sessions and the settings.
    static func isCodePage(_ href: String) -> Bool {
        (URLComponents(string: href)?.path ?? "").hasPrefix("/modes/code")
    }

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

/// The code surfaces the sidebar's rail moves between — the web app's mode
/// rail, in the same order and to the same addresses.
enum CodeSurface: CaseIterable, Identifiable {
    case browse
    case review

    var id: Self { self }

    var title: String {
        switch self {
        case .browse: return "Browse the project"
        case .review: return "Review"
        }
    }

    /// The word the rail shows beside the symbol once the surface is on.
    var label: String {
        switch self {
        case .browse: return "Browse"
        case .review: return "Review"
        }
    }

    var symbol: String {
        switch self {
        case .browse: return "folder"
        case .review: return "plus.forwardslash.minus"
        }
    }

    var href: String {
        switch self {
        case .browse: return Href.browsePath
        case .review: return Href.review
        }
    }

    /// The surface an address is on, by its path: the browse page and every
    /// commit or range read on it, or the diff and every pull request read
    /// in it.
    static func forHref(_ href: String) -> CodeSurface? {
        let path = URLComponents(string: href)?.path ?? ""
        if path.hasPrefix(Href.browsePath) { return .browse }
        if path.hasPrefix(Href.review) { return .review }
        return nil
    }
}
