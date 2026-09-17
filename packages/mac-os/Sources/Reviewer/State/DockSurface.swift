// The git dock's surfaces the rail reaches for — Branches and History, the
// two the web rail has at its foot. The dock is not the bottom pane's: it is
// the code island's own drawer under the page, as the web app has it, so
// branches, history and find usages stay the page's to draw and the rail
// presses the web rail's button over the bridge, lighting up from what the
// island reports back. See `AppModel.toggle(dock:)` and the SPA's
// `ShellDockAction`.
import Foundation

enum DockSurface: String, CaseIterable, Identifiable, Sendable {
    case branches
    case history

    var id: String { rawValue }

    var title: String {
        switch self {
        case .branches: return "Branches"
        case .history: return "History"
        }
    }

    var symbol: String {
        switch self {
        case .branches: return "arrow.triangle.branch"
        case .history: return "clock.arrow.circlepath"
        }
    }
}

/// The shell's asks of the dock, in the shape the island's `ShellDockAction`
/// takes: a rail button pressed, and the dock put away when the native pane
/// takes the foot of the window.
enum DockAction {
    case pick(DockSurface)
    case close

    var payload: [String: Any] {
        switch self {
        case .pick(let surface): return ["kind": "pick", "tab": surface.rawValue]
        case .close: return ["kind": "close"]
        }
    }
}

/// The dock as the island last reported it: down, or up on a surface — one
/// of the rail's, or one it has no button for, find usages.
enum DockState: Equatable, Sendable {
    case down
    case up(DockSurface?)

    var isUp: Bool { self != .down }

    var surface: DockSurface? {
        if case .up(let surface) = self { return surface }
        return nil
    }

    /// From the island's `shown`: a tab id, or null for a dock that is down.
    static func decode(_ shown: Any?) -> DockState {
        guard let tab = shown as? String else { return .down }
        return .up(DockSurface(rawValue: tab))
    }
}
