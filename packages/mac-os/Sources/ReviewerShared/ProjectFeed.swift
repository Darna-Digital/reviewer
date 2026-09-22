// What the app tells its widget: the repositories the machine holds, as
// the opener lists them, with which one is open. The widget runs in a
// process of its own, sandboxed, and can reach neither the server nor the
// app's defaults, so the app writes this snapshot where the extension is
// let in — `~/.reviewer`, beside the server's own state, and the app
// group's container too where the signature carries a team identifier —
// whenever the catalog or the open project changes, and asks WidgetKit to
// redraw. The widget only ever reads; a machine the app has never run on
// has no feed, and the widget says so.
import Foundation
import Security

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
        /// Drawn in the widget, so the home folder is the user's rather
        /// than `NSHomeDirectory()`, which there is the sandbox container.
        public var location: String {
            let folder = URL(fileURLWithPath: path).deletingLastPathComponent().path
            let home = ProjectFeed.homeDirectory.path
            if folder == home { return "~" }
            guard folder.hasPrefix(home + "/") else { return folder }
            return "~" + folder.dropFirst(home.count)
        }
    }

    /// The open project's path, or nil while nothing is open. Nothing is
    /// drawn from it — a widget lists projects to open, and which one this
    /// machine happens to have open is not a mark it needs to carry — but
    /// it is what makes the feed change as the project does, and so what
    /// has the widget redrawn then.
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

    // MARK: the file

    /// The app group both the app and the widget carry in their
    /// entitlements; the container under ~/Library/Group Containers.
    public static let groupIdentifier = "group.com.byconvo.reviewer"

    private static let fileName = "projects.json"

    /// The team identifier in the signature this process runs under, and
    /// nil where there is none — which is every local build, signed with
    /// a self-signed certificate. Read once: a process cannot be re-signed
    /// under its own feet.
    private static let teamIdentifier: String? = {
        var code: SecCode?
        guard SecCodeCopySelf([], &code) == errSecSuccess, let code else { return nil }
        var staticCode: SecStaticCode?
        guard SecCodeCopyStaticCode(code, [], &staticCode) == errSecSuccess, let staticCode else { return nil }
        var information: CFDictionary?
        guard SecCodeCopySigningInformation(staticCode, SecCSFlags(rawValue: kSecCSSigningInformation), &information)
            == errSecSuccess,
            let signing = information as? [String: Any]
        else { return nil }
        return signing[kSecCodeInfoTeamIdentifier as String] as? String
    }()

    /// Asked for only where the group container is any use, because asking
    /// is itself the thing that costs: Group Containers is a data vault,
    /// so the first look inside one goes through the sandbox daemon to
    /// TCC, which raises "would like to access data from other apps" at
    /// the app and refuses the widget outright — a widget may not prompt.
    /// Without a team identifier the container is granted to neither side
    /// anyway, so nothing is lost by leaving it alone.
    private static var groupURL: URL? {
        guard teamIdentifier != nil else { return nil }
        return FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: groupIdentifier)?
            .appending(path: fileName)
    }

    /// The home folder as the password database holds it. Inside the
    /// widget's sandbox `NSHomeDirectory()` answers with the container
    /// instead, and the folder both sides have to agree on is the user's
    /// own.
    private static var homeDirectory: URL {
        guard let entry = getpwuid(getuid()) else { return URL(fileURLWithPath: NSHomeDirectory()) }
        return URL(fileURLWithPath: String(cString: entry.pointee.pw_dir))
    }

    /// `~/.reviewer`, where the server already keeps its state, holds the
    /// feed — the only copy of it on a build with no team identifier. The
    /// widget is let in by the home-relative read-only exception in its
    /// entitlements, and the app writes there with no privilege of any
    /// kind, which is the whole point of the folder: both of the
    /// container folders the feed used to go to are data vaults, and
    /// every look inside one asked the user to allow "access data from
    /// other apps".
    private static var sharedURL: URL {
        homeDirectory.appending(path: ".reviewer").appending(path: fileName)
    }

    /// Where the feed is kept, in the order the widget tries them. The
    /// group container is the proper home for something an app shares
    /// with its extension, and where a build signed with a team
    /// identifier reads it from; signed without one — which a local build
    /// is — there is no group container to be had and `~/.reviewer` is
    /// the whole of it.
    private static var feedURLs: [URL] {
        [groupURL, sharedURL].compactMap { $0 }
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
        for url in feedURLs {
            guard let data = try? Data(contentsOf: url) else { continue }
            if let feed = try? decoder.decode(ProjectFeed.self, from: data) { return feed }
        }
        return nil
    }

    /// Written everywhere it is wanted, and a refusal at one place is not
    /// one at the others; only a write that landed nowhere is an error.
    public func write() throws {
        let data = try Self.encoder.encode(self)
        try? FileManager.default.createDirectory(
            at: Self.sharedURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        var landed = false
        var failure: (any Error)?
        for url in Self.feedURLs {
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
        let home = homeDirectory.path
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
