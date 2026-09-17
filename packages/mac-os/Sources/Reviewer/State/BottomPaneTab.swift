// The surfaces the bottom pane holds. Two are native — a shell in the
// project, and the project's dev services — and the rest are the web app's
// dock surfaces, shown by the dock island at the address each one has in
// the SPA (`shell-route`'s `DOCK_PAGES`).
import Foundation

enum BottomPaneTab: String, CaseIterable, Identifiable, Sendable {
    case terminal
    case services
    case branches
    case history
    case find
    case threads

    var id: String { rawValue }

    var title: String {
        switch self {
        case .terminal: return "Terminal"
        case .services: return "Services"
        case .branches: return "Branches"
        case .history: return "History"
        case .find: return "Find"
        case .threads: return "Threads"
        }
    }

    var symbol: String {
        switch self {
        case .terminal: return "terminal"
        case .services: return "play.circle"
        case .branches: return "arrow.triangle.branch"
        case .history: return "clock.arrow.circlepath"
        case .find: return "magnifyingglass"
        case .threads: return "rectangle.stack"
        }
    }

    /// The surface an address of the dock island's names, if it is one.
    static func forDockHref(_ href: String) -> BottomPaneTab? {
        guard let path = URLComponents(string: href)?.path else { return nil }
        return allCases.first { $0.dockHref == path }
    }

    /// The dock island's address for a web surface; nil for the native ones.
    var dockHref: String? {
        switch self {
        case .terminal, .services: return nil
        case .branches: return "/modes/code/branches"
        case .history: return "/modes/code/history"
        case .find: return "/modes/code/find"
        case .threads: return "/modes/code/threads"
        }
    }
}
