// What the tab strip holds. A tab is either a file buffer or an agent session;
// both are keyed by a stable string id so the sidebar's selection, the strip
// and keyboard navigation can all agree on "the current tab" without holding
// a reference to the buffer or the session behind it.
import Foundation

enum EditorTabKind: Hashable, Sendable {
    case file(path: String)
    case chat(id: String)
}

struct EditorTab: Identifiable, Hashable, Sendable {
    let kind: EditorTabKind

    var id: String {
        switch kind {
        case .file(let path): return "file:\(path)"
        case .chat(let id): return "chat:\(id)"
        }
    }

    static func fileId(_ path: String) -> String { "file:\(path)" }
    static func chatId(_ id: String) -> String { "chat:\(id)" }
}
