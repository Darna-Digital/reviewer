// The window tabs — Code and Sessions pinned, then one per agent session
// — are the page island's own strip, the same one the web app's
// window bar draws: the store and the switching live in the document, so a
// tab is a route change in a page that has already primed it rather than a
// trip over the bridge. What the shell holds is a picture of the strip,
// reported whenever it changes, which the toolbar draws natively (see
// `TabStripItems`), the launchpad lays out as cards, and the menu bar
// names: the sessions ⌘1–9 reach, and whether the tab in front can be
// closed. See `ShellWindowTabStrip` in the SPA's `lib/shell`.
import Foundation

struct WindowTabStrip: Decodable, Hashable, Sendable {
    var tabs: [WindowTab]
    var activeId: String

    static let empty = WindowTabStrip(tabs: [], activeId: "")

    var active: WindowTab? { tabs.first { $0.id == activeId } }

    /// The sessions in strip order, which is what ⌘1–9 count.
    var sessions: [WindowTab] { tabs.filter { !$0.pinned } }

    /// From the message body as WebKit hands it over. Anything but a
    /// dictionary is no strip: `JSONSerialization` raises an Objective-C
    /// exception on a non-container rather than throwing, and one of those
    /// inside a task on the main actor leaves the concurrency runtime's
    /// executor tracking stale, which WebKit's next isolation check then
    /// crashes on.
    static func decode(_ body: Any?) -> WindowTabStrip? {
        guard let object = body as? [String: Any],
            let data = try? JSONSerialization.data(withJSONObject: object)
        else { return nil }
        return try? JSONDecoder().decode(WindowTabStrip.self, from: data)
    }
}

struct WindowTab: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let title: String
    let kind: WindowTabKind
    let pinned: Bool
}

/// What a tab is, as the web strip sorts them — its `WindowTabKind` — with
/// the web app's icons for each, Tabler's code, git branch, send and
/// message, in their SF Symbols shapes.
enum WindowTabKind: String, Decodable, Sendable {
    case project
    case sessions
    case session

    var symbol: String {
        switch self {
        case .project: return "chevron.left.forwardslash.chevron.right"
        case .sessions: return "paperplane"
        case .session: return "message"
        }
    }
}

/// The shell's asks of the strip, in the shape the island's
/// `ShellWindowTabAction` takes: a tab pressed on the toolbar, and the web
/// app's own chords, claimed by menu items so they answer while a native
/// view has the keyboard.
enum WindowTabAction {
    case select(id: String)
    case close(id: String)
    case newSession
    case closeActive
    case step(Int)
    case session(slot: Int)

    var payload: [String: Any] {
        switch self {
        case .select(let id): return ["kind": "select", "id": id]
        case .close(let id): return ["kind": "close", "id": id]
        case .newSession: return ["kind": "newSession"]
        case .closeActive: return ["kind": "closeActive"]
        case .step(let offset): return ["kind": "step", "offset": offset]
        case .session(let slot): return ["kind": "session", "slot": slot]
        }
    }
}

/// The SPA's addresses the shell steers by — the same ones its own window
/// bar uses, so an island asked for one behaves exactly as the page would.
enum Href {
    static let review = "/modes/code/review"
    static let reviews = "/modes/code/reviews"
    static let browsePath = "/modes/code/browse"

    /// One commit's diff, read on the browse page — on `path`'s own diff,
    /// when one is named.
    static func commit(_ sha: String, path: String?) -> String {
        var components = URLComponents()
        components.path = "\(browsePath)/commit/\(sha)"
        if let path { components.queryItems = [URLQueryItem(name: "path", value: path)] }
        return components.string ?? "\(browsePath)/commit/\(sha)"
    }

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
}

/// The code surfaces the sidebar's rail moves between — the web app's mode
/// rail, in the same order and to the same addresses.
enum CodeSurface: CaseIterable, Identifiable {
    case browse
    case review
    case reviews

    var id: Self { self }

    var title: String {
        switch self {
        case .browse: return "Browse the project"
        case .review: return "Review"
        case .reviews: return "Merge requests"
        }
    }

    /// The word the rail shows beside the symbol once the surface is on.
    var label: String {
        switch self {
        case .browse: return "Browse"
        case .review: return "Review"
        case .reviews: return "Merge requests"
        }
    }

    var symbol: String {
        switch self {
        case .browse: return "folder"
        case .review: return "plus.forwardslash.minus"
        case .reviews: return "arrow.triangle.pull"
        }
    }

    var href: String {
        switch self {
        case .browse: return Href.browsePath
        case .review: return Href.review
        case .reviews: return Href.reviews
        }
    }

    /// Whether the surface shows files, so one can be opened on it in place:
    /// the merge requests are a list, and a file found while it is up opens
    /// on the diff instead.
    var opensFiles: Bool {
        switch self {
        case .browse, .review: return true
        case .reviews: return false
        }
    }

    /// The surface an address is on, by its path: the browse page and every
    /// commit or range read on it, the diff and every pull request read in
    /// it, or the merge requests — read first, its path being the diff's
    /// with a letter on the end.
    static func forHref(_ href: String) -> CodeSurface? {
        let path = URLComponents(string: href)?.path ?? ""
        if path.hasPrefix(Href.browsePath) { return .browse }
        if path.hasPrefix(Href.reviews) { return .reviews }
        if path.hasPrefix(Href.review) { return .review }
        return nil
    }
}
