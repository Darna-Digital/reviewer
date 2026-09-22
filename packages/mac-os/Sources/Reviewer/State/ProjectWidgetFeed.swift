// The project feed the widget reads (see `ProjectFeed`), written from the
// catalog as the opener holds it and the project the server has open.
// Written whenever either changes and only when something did — the
// catalog is re-read on every project open, and the widget redraws on
// each write — then WidgetKit is asked to run the widget's timeline
// again, which is how a click on the widget shows the project it just
// opened as the open one.
import Foundation
import ReviewerShared
import WidgetKit

@MainActor
enum ProjectWidgetFeed {
    private static var lastPublished: (current: String?, projects: [ProjectFeed.Project])?

    static func publish(rows: [RepoRow], favorites: [String], current: String?) {
        let projects = rows.map { row in
            ProjectFeed.Project(
                name: row.name,
                path: row.path,
                branch: row.entry.branch,
                lastOpened: row.lastOpened,
                favorite: favorites.contains(row.path))
        }
        guard lastPublished?.current != current || lastPublished?.projects != projects else { return }
        do {
            try ProjectFeed(current: current, projects: projects).write()
        } catch {
            NSLog("Reviewer: the widget feed could not be written: \(error.localizedDescription)")
            return
        }
        lastPublished = (current, projects)
        WidgetCenter.shared.reloadAllTimelines()
    }
}
