// What the app tells its widget: the repositories the machine holds, as
// the opener lists them, with which one is open. The widget runs in a
// process of its own, sandboxed, and can reach neither the server nor the
// app's defaults, so the app writes this snapshot into the app group's
// container — the one folder both are let into — whenever the catalog or
// the open project changes, and asks WidgetKit to redraw. The widget only
// ever reads; a machine the app has never run on has no feed, and the
// widget says so.
import Foundation

public struct ProjectFeed: Codable, Equatable, Sendable {
    public struct Project: Codable, Hashable, Identifiable, Sendable {
        public let name: String
        public let path: String
        public let branch: String?
        public let lastOpened: Date?
        public let favorite: Bool

        public var id: String { path }

        public init(name: String, path: String, branch: String?, lastOpened: Date?, favorite: Bool) {
            self.name = name
            self.path = path
            self.branch = branch
            self.lastOpened = lastOpened
            self.favorite = favorite
        }

        /// The folder the repository sits in, the home folder folded to `~`.
        public var location: String {
            let folder = URL(fileURLWithPath: path).deletingLastPathComponent().path
            let home = NSHomeDirectory()
            if folder == home { return "~" }
            guard folder.hasPrefix(home + "/") else { return folder }
            return "~" + folder.dropFirst(home.count)
        }
    }

    /// The open project's path, or nil while nothing is open.
    public var current: String?
    public var projects: [Project]
    public var writtenAt: Date

    public init(current: String?, projects: [Project], writtenAt: Date = .now) {
        self.current = current
        self.projects = projects
        self.writtenAt = writtenAt
    }

    /// Repositories opened here, newest first.
    public var recents: [Project] {
        projects
            .filter { $0.lastOpened != nil }
            .sorted { ($0.lastOpened ?? .distantPast) > ($1.lastOpened ?? .distantPast) }
    }

    /// The starred repositories, in the order they were starred.
    public var favorites: [Project] {
        projects.filter(\.favorite)
    }

    public var currentProject: Project? {
        current.flatMap { path in projects.first { $0.path == path } }
    }

    // MARK: the file

    /// The app group both the app and the widget carry in their
    /// entitlements; the container under ~/Library/Group Containers.
    public static let groupIdentifier = "group.com.byconvo.reviewer"

    /// The widget extension, whose own sandbox container is the other
    /// place the feed is kept (see `writeURLs`).
    public static let widgetIdentifier = "com.byconvo.reviewer.macos.widget"

    private static let fileName = "projects.json"

    private static var groupURL: URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: groupIdentifier)?
            .appending(path: fileName)
    }

    /// Inside the widget's sandbox this is its own container's Application
    /// Support; the extension may always read it, whatever the signature.
    private static var sandboxURL: URL? {
        FileManager.default
            .urls(for: .applicationSupportDirectory, in: .userDomainMask)
            .first?
            .appending(path: fileName)
    }

    /// Where the app writes. The group container is the proper home for a
    /// feed shared between an app and its extension, and where a build
    /// signed with a team identifier reads it from. Ad-hoc signed — which
    /// a local build is — the sandbox grants the extension no group
    /// container and refuses it that file, so the app writes a second copy
    /// straight into the extension's own container, the one place a
    /// sandboxed extension can always read. The container is the system's
    /// to create, on the extension's first run, so this copy only goes
    /// where one already stands.
    private static var writeURLs: [URL] {
        var urls = [groupURL].compactMap { $0 }
        let support = URL(fileURLWithPath: NSHomeDirectory())
            .appending(path: "Library/Containers/\(widgetIdentifier)/Data/Library/Application Support")
        if FileManager.default.fileExists(atPath: support.path) {
            urls.append(support.appending(path: fileName))
        }
        return urls
    }

    /// Where the widget reads, in the order it tries them.
    private static var readURLs: [URL] {
        [groupURL, sandboxURL].compactMap { $0 }
    }

    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.sortedKeys, .prettyPrinted]
        return encoder
    }()

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    public static func read() -> ProjectFeed? {
        for url in readURLs {
            guard let data = try? Data(contentsOf: url) else { continue }
            if let feed = try? decoder.decode(ProjectFeed.self, from: data) { return feed }
        }
        return nil
    }

    /// Written everywhere it is wanted, and a refusal at one place is not
    /// one at the others; only a write that landed nowhere is an error.
    public func write() throws {
        let data = try Self.encoder.encode(self)
        var landed = false
        var failure: (any Error)?
        for url in Self.writeURLs {
            do {
                try data.write(to: url, options: .atomic)
                landed = true
            } catch {
                failure = error
            }
        }
        guard landed else { throw failure ?? CocoaError(.fileNoSuchFile) }
    }

    // MARK: the gallery's sample

    /// What the widget gallery shows before a real feed exists.
    public static let sample: ProjectFeed = {
        let home = NSHomeDirectory()
        func project(_ name: String, _ branch: String, hoursAgo: Double, favorite: Bool = false) -> Project {
            Project(
                name: name,
                path: "\(home)/Projects/\(name)",
                branch: branch,
                lastOpened: Date(timeIntervalSinceNow: -hoursAgo * 3600),
                favorite: favorite)
        }
        return ProjectFeed(
            current: "\(home)/Projects/reviewer",
            projects: [
                project("reviewer", "main", hoursAgo: 0.2, favorite: true),
                project("darna-web", "feat/checkout", hoursAgo: 3, favorite: true),
                project("embedded-server", "main", hoursAgo: 26),
                project("design-system", "tokens-v2", hoursAgo: 50, favorite: true),
                project("mobile-app", "release/4.2", hoursAgo: 72),
                project("infra", "main", hoursAgo: 120),
                project("docs", "main", hoursAgo: 200),
                project("analytics", "spike/otel", hoursAgo: 300),
                project("billing", "main", hoursAgo: 400),
                project("cli", "main", hoursAgo: 500),
            ])
    }()
}
