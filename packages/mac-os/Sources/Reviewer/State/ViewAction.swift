// What the shell asks of the page's own view preferences — the one the
// palette's Toggle Diff Style reaches for, kept by the page since the diff
// is its to lay out — see `ShellViewAction` in the SPA's `lib/shell`.
import Foundation

enum ViewAction {
    case toggleDiffStyle

    var payload: [String: Any] {
        switch self {
        case .toggleDiffStyle: return ["kind": "toggleDiffStyle"]
        }
    }
}
