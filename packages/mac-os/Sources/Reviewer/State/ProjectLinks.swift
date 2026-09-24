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

    /// Handed what each open link asks for: a project to open, with or
    /// without its dev commands, or nothing for a bare launch.
    var handler: ((ProjectLink.Request) -> Void)? {
        didSet { deliverPending() }
    }
    private var pending: [ProjectLink.Request] = []

    func receive(_ urls: [URL]) {
        pending.append(contentsOf: urls.compactMap(ProjectLink.request(in:)))
        deliverPending()
    }

    private func deliverPending() {
        guard let handler else { return }
        let links = pending
        pending = []
        links.forEach(handler)
    }
}
