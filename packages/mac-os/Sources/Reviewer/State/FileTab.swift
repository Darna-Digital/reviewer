// The open-file strip the code island reports — see `ShellTabStrip` in the
// SPA's `lib/shell`. The tabs are the page's own state, kept in its store
// with its preview slot and its pinning; what arrives here is a picture of
// the strip to draw natively under the window tabs, and what goes back is
// each thing the native strip was asked to do to it. The file's type icon is
// the shell's own (`FileIcon`), so only the path crosses.
import Foundation

struct FileTabStrip: Decodable, Hashable, Sendable {
    var tabs: [FileTab]
    var active: String?

    /// From the message body as WebKit hands it over. Anything but a
    /// dictionary — the `null` a page with no strip sends arrives as
    /// `NSNull` — is no strip: `JSONSerialization` raises an Objective-C
    /// exception on a non-container rather than throwing, and one of those
    /// inside a task on the main actor leaves the concurrency runtime's
    /// executor tracking stale, which WebKit's next isolation check then
    /// crashes on.
    static func decode(_ body: Any?) -> FileTabStrip? {
        guard let object = body as? [String: Any],
            let data = try? JSONSerialization.data(withJSONObject: object)
        else { return nil }
        return try? JSONDecoder().decode(FileTabStrip.self, from: data)
    }
}

struct FileTab: Decodable, Identifiable, Hashable, Sendable {
    let path: String
    let name: String
    let pinned: Bool
    let preview: Bool
    let dirty: Bool

    var id: String { path }
}

/// The strip's actions, in the shape the island's `ShellTabAction` takes.
enum FileTabAction {
    case select(String)
    case keep(String)
    case close(String)
    case togglePin(String)
    case closeOthers(String)
    case closeAll
    case move(String, toIndex: Int)

    var payload: [String: Any] {
        switch self {
        case .select(let path): return ["kind": "select", "path": path]
        case .keep(let path): return ["kind": "keep", "path": path]
        case .close(let path): return ["kind": "close", "path": path]
        case .togglePin(let path): return ["kind": "togglePin", "path": path]
        case .closeOthers(let path): return ["kind": "closeOthers", "path": path]
        case .closeAll: return ["kind": "closeAll"]
        case .move(let path, let toIndex): return ["kind": "move", "path": path, "toIndex": toIndex]
        }
    }
}
