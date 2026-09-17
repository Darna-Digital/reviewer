// The drawer the code island still keeps under its page: find usages, the
// one surface of the web app's dock that stays the page's, since it is
// opened from a symbol in the page's own code and previews the page's own
// files. Branches, history, the terminal and the run surfaces are the
// bottom pane's, native (see `BottomPaneTab`). The two share the foot of
// the window one at a time: the island says when its drawer is up, and the
// pane puts it away when it takes the foot back. See `AppModel.take(dock:)`
// and the SPA's `ShellDockAction`.
import Foundation

/// The shell's one ask of the drawer, in the shape the island's
/// `ShellDockAction` takes: put away, the native pane taking the foot.
enum DockAction {
    case close

    var payload: [String: Any] {
        switch self {
        case .close: return ["kind": "close"]
        }
    }
}

/// The drawer as the island last reported it: down, or up on find usages.
enum DockState: Equatable, Sendable {
    case down
    case up

    var isUp: Bool { self == .up }

    /// From the island's `shown`: a tab id, or null for a drawer that is down.
    static func decode(_ shown: Any?) -> DockState {
        shown is String ? .up : .down
    }
}
