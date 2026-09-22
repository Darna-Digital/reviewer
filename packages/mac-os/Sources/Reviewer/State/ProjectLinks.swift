// The `reviewer://open` links Launch Services hands the app — from the
// widget, or anything else that opens the scheme (see `ProjectLink`). The
// app delegate receives them, and this passes each on to the model as a
// path to open, or a bare launch. A link can arrive ahead of the model —
// the app brought up by a click on the widget gets its URL as it launches
// — so links wait here until there is a handler, and the model itself
// holds one back while the server is still coming up (see
// `AppModel.open(link:)`).
import Foundation
import ReviewerShared

@MainActor
final class ProjectLinks {
    static let shared = ProjectLinks()

    /// Handed the path an open link names, or nil for a bare launch.
    var handler: ((String?) -> Void)? {
        didSet { deliverPending() }
    }
    private var pending: [String?] = []

    func receive(_ urls: [URL]) {
        for url in urls where ProjectLink.isOpen(url) {
            pending.append(ProjectLink.path(in: url))
        }
        deliverPending()
    }

    private func deliverPending() {
        guard let handler else { return }
        let links = pending
        pending = []
        links.forEach(handler)
    }
}
