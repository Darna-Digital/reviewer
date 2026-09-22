// The window tabs — Code and Sessions pinned, then one per agent session
// — are the page island's own strip, the same one the web app's
// window bar draws: the store and the switching live in the document, so a
// tab is a route change in a page that has already primed it rather than a
// trip over the bridge. What the shell holds is a picture of the strip,
// reported whenever it changes, which the toolbar draws natively (see
// `TabStripItems`) and the menu bar names: the sessions ⌘1–9 reach, the
// modes ⌘G crosses between, and
// whether the tab in front can be closed. See `ShellWindowTabStrip` in the
// SPA's `lib/shell`.
import Foundation

struct WindowTabStrip: Decodable, Hashable, Sendable {
    var tabs: [WindowTab]
    var activeId: String

    static let empty = WindowTabStrip(tabs: [], activeId: "")

    var active: WindowTab? { tabs.first { $0.id == activeId } }

    /// Whether a pinned tab's toggle is lit: while it is in front, and for
    /// Sessions while a session's own tab is — the same way of working with
    /// one conversation lifted out of the list, the list still down the
    /// sidebar beside it, so the mode's toggle stays on rather than leaving
    /// the pair dark.
    func lights(_ tab: WindowTab) -> Bool {
        guard let active else { return false }
        return active.id == tab.id || (tab.kind == .sessions && active.kind == .session)
    }

    /// The sessions in strip order, which is what ⌘1–9 count: the pinned
    /// tabs are ways of working rather than tabs among them, and ⌘G's.
    var sessions: [WindowTab] { tabs.filter { !$0.pinned } }

    /// The ways of working the strip leads with — Code, Sessions — which
    /// ⌘G crosses between, so it has somewhere to go only with two of them.
    var canSwitchMode: Bool { tabs.filter(\.pinned).count > 1 }

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
    /// Its agent is mid-turn, so the tab wears the orb.
    let working: Bool
    /// Its thread has moved since it was last read, so the tab wears the dot.
    let waiting: Bool

    /// The marks are read as absent rather than required: the shell can be
    /// run against a build of the SPA older than itself (see `SpaSource`),
    /// and a missing key would throw away the whole strip — tabs and all —
    /// over two dots.
    init(from decoder: any Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(String.self, forKey: .id)
        title = try values.decode(String.self, forKey: .title)
        kind = try values.decode(WindowTabKind.self, forKey: .kind)
        pinned = try values.decode(Bool.self, forKey: .pinned)
        working = try values.decodeIfPresent(Bool.self, forKey: .working) ?? false
        waiting = try values.decodeIfPresent(Bool.self, forKey: .waiting) ?? false
    }

    private enum CodingKeys: String, CodingKey {
        case id, title, kind, pinned, working, waiting
    }
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
    /// A tab dragged along the strip and let go on the leading or trailing
    /// half of another: the toolbar knows the geometry, the strip knows the
    /// slots, so what crosses is the tab it was dropped on and which side.
    case move(id: String, toId: String, after: Bool)
    case newSession
    case closeActive
    case step(Int)
    case mode

    var payload: [String: Any] {
        switch self {
        case .select(let id): return ["kind": "select", "id": id]
        case .close(let id): return ["kind": "close", "id": id]
        case .move(let id, let toId, let after):
            return ["kind": "move", "id": id, "toId": toId, "after": after]
        case .newSession: return ["kind": "newSession"]
        case .closeActive: return ["kind": "closeActive"]
        case .step(let offset): return ["kind": "step", "offset": offset]
        case .mode: return ["kind": "mode"]
        }
    }
}

/// The SPA's addresses the shell steers by — the same ones its own window
/// bar uses, so an island asked for one behaves exactly as the page would.
enum Href {
    static let review = "/modes/code/review"
    static let reviews = "/modes/code/reviews"
    static let browsePath = "/modes/code/browse"
    private static let pullPath = "/modes/code/review/pull/"

    /// One pull request's diff, read in the diff view — the web app's
    /// `reviewHref` for a pull source.
    static func pull(_ number: Int) -> String {
        "\(pullPath)\(number)"
    }

    /// The pull request an address reads, by its number, or nil for any
    /// other page.
    static func pullNumber(of href: String) -> Int? {
        let path = URLComponents(string: href)?.path ?? ""
        guard path.hasPrefix(pullPath) else { return nil }
        let rest = path.dropFirst(pullPath.count)
        let digits = rest.prefix { $0 != "/" }
        guard !digits.isEmpty, digits.allSatisfy(\.isNumber) else { return nil }
        return Int(digits)
    }

    /// One commit's diff, read on the browse page — scrolled to `path`'s
    /// own diff, when one is named. A commit picked out of one file's
    /// history is `history`'s side of it alone, the way that log reads.
    static func commit(_ sha: String, path: String? = nil, history: String? = nil) -> String {
        var components = URLComponents()
        components.path = "\(browsePath)/commit/\(sha)"
        var items: [URLQueryItem] = []
        if let path { items.append(URLQueryItem(name: "path", value: path)) }
        if let history { items.append(URLQueryItem(name: "history", value: history)) }
        if !items.isEmpty { components.queryItems = items }
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
        case .review: return "plusminus"
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

    /// Whether `href`, on this surface, shows files, so one can be opened on
    /// it in place: the browse page and the diff always do; the merge
    /// requests only once one of them is open, its diff being the page —
    /// with none picked the page is a list, and a file found while it is
    /// up opens on the diff instead.
    static func opensFiles(_ href: String) -> Bool {
        switch forHref(href) {
        case .browse, .review: return true
        case .reviews: return Href.pullNumber(of: href) != nil
        case nil: return false
        }
    }

    /// The surface an address is on, by its path: the browse page and every
    /// commit or range read on it; the merge requests — the list, and every
    /// pull request read out of it, which is the diff's own path with the
    /// pull request named on the end; or the diff of your own changes.
    static func forHref(_ href: String) -> CodeSurface? {
        let path = URLComponents(string: href)?.path ?? ""
        if path.hasPrefix(Href.browsePath) { return .browse }
        if path.hasPrefix(Href.reviews) || Href.pullNumber(of: href) != nil { return .reviews }
        if path.hasPrefix(Href.review) { return .review }
        return nil
    }
}
