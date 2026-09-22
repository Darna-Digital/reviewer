// The Projects widget: the repositories the machine holds, a click away
// from being the open project. Small, it is the last project on its own —
// one click opens it again. Medium and large, a grid of tiles, each a
// repository with its branch, the open one marked; which repositories fill
// the grid is the widget's list — the recents, newest first, or the
// favourites starred in the opener. The timeline is a single entry that
// never expires on its own: the app rewrites the feed and asks for a
// redraw whenever the catalog or the open project changes, and a widget
// added before the app has ever run shows how to fill it.
import ReviewerShared
import SwiftUI
import WidgetKit

struct RecentProjectsWidget: Widget {
    var body: some WidgetConfiguration { ProjectsWidget.configuration(for: .recents) }
}

struct FavoriteProjectsWidget: Widget {
    var body: some WidgetConfiguration { ProjectsWidget.configuration(for: .favorites) }
}

/// The one configuration both widgets are, over their list — a `Widget`
/// has to be made from nothing, so each list gets a type of its own.
@MainActor
enum ProjectsWidget {
    static func configuration(for list: ProjectList) -> some WidgetConfiguration {
        StaticConfiguration(kind: list.kind, provider: ProjectsProvider(list: list)) { entry in
            ProjectsWidgetView(entry: entry)
                .containerBackground(for: .widget) { WidgetBackdrop() }
        }
        .configurationDisplayName(list.displayName)
        .description(list.description)
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

/// Which repositories a widget lists.
enum ProjectList: String {
    case recents
    case favorites

    /// The kind WidgetKit knows the widget by; kept stable, since a widget
    /// placed on the desktop is remembered by it.
    var kind: String { "com.byconvo.reviewer.macos.widget.projects.\(rawValue)" }

    var title: String {
        switch self {
        case .recents: return "Recents"
        case .favorites: return "Favorites"
        }
    }

    var displayName: String {
        switch self {
        case .recents: return "Recent projects"
        case .favorites: return "Favorite projects"
        }
    }

    var description: String {
        switch self {
        case .recents: return "The repositories you opened last, one click from opening again."
        case .favorites: return "The repositories starred in Reviewer, one click from opening."
        }
    }

    func projects(in feed: ProjectFeed) -> [ProjectFeed.Project] {
        switch self {
        case .recents: return feed.recents
        case .favorites: return feed.favorites
        }
    }
}

struct ProjectsEntry: TimelineEntry {
    let date: Date
    /// The feed as the app last wrote it; nil where the app has never run.
    let feed: ProjectFeed?
    let list: ProjectList

    var projects: [ProjectFeed.Project] {
        feed.map(list.projects(in:)) ?? []
    }

    /// The small widget's one project: the list's first, which for the
    /// recents is the one worked on last.
    var hero: ProjectFeed.Project? {
        projects.first
    }
}

struct ProjectsProvider: TimelineProvider {
    let list: ProjectList

    func placeholder(in context: Context) -> ProjectsEntry {
        ProjectsEntry(date: .now, feed: .sample, list: list)
    }

    func getSnapshot(in context: Context, completion: @escaping @Sendable (ProjectsEntry) -> Void) {
        let feed = context.isPreview ? (ProjectFeed.read() ?? .sample) : ProjectFeed.read()
        completion(ProjectsEntry(date: .now, feed: feed, list: list))
    }

    func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<ProjectsEntry>) -> Void) {
        completion(Timeline(entries: [ProjectsEntry(date: .now, feed: ProjectFeed.read(), list: list)], policy: .never))
    }
}
