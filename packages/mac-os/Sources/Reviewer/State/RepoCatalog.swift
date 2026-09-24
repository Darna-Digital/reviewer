// The repositories the machine holds, as the server's index lists them —
// what the opener shows. Read when the opener comes up and followed while
// the server's walk is still filling the index in, so the list grows as
// the walk reaches folders rather than waiting on the whole of it; a
// rescan starts the walk over. Each entry is kept with what the table sorts
// and shows — where it stands under the home folder, when it was last
// opened — worked out once here rather than per row per sort. The
// favourites are the app's own — repositories starred here, kept by path
// in the defaults — since the index knows only what the walk found.
import Foundation
import Observation

/// One repository as the opener's table lists it.
struct RepoRow: Identifiable, Hashable, Sendable {
    let entry: RepoEntry
    /// The folder the repository sits in, the home folder folded to `~`.
    let location: String
    let lastOpened: Date?

    var id: String { entry.path }
    var name: String { entry.name }
    var path: String { entry.path }
    /// A repository never opened sorts after every one that was.
    var lastOpenedOrder: Date { lastOpened ?? .distantPast }

    @MainActor
    init(entry: RepoEntry, home: String) {
        self.entry = entry
        location = Self.location(of: entry.path, home: home)
        lastOpened = entry.lastOpened.flatMap(CommitDates.parse)
    }

    static func location(of path: String, home: String) -> String {
        fold(URL(fileURLWithPath: path).deletingLastPathComponent().path, home: home)
    }

    /// A folder with the home folder folded to `~`, as Finder's title bar has it.
    static func fold(_ folder: String, home: String) -> String {
        if folder == home { return "~" }
        guard folder.hasPrefix(home + "/") else { return folder }
        return "~" + folder.dropFirst(home.count)
    }
}

/// A folder the walk found repositories in — the opener's sidebar lists
/// them as Finder lists favourites, each narrowing the table to its own.
struct RepoLocation: Identifiable, Hashable, Sendable {
    let path: String
    let display: String
    let count: Int

    var id: String { path }
    var name: String { URL(fileURLWithPath: path).lastPathComponent }
}

@MainActor
@Observable
final class RepoCatalog {
    private(set) var rows: [RepoRow] = []
    private(set) var isScanning = false
    private(set) var scannedAt: Date?
    private(set) var loadError: String?
    private(set) var hasLoaded = false
    /// The starred repositories' paths, in the order they were starred.
    private(set) var favorites: [String] {
        didSet { defaults.set(favorites, forKey: Keys.favorites) }
    }

    @ObservationIgnored private let client: ReviewerClient
    @ObservationIgnored private let defaults = UserDefaults.standard
    @ObservationIgnored private var home = NSHomeDirectory()
    @ObservationIgnored private var followTask: Task<Void, Never>?
    /// Called as the rows or the favourites change — what the widget's
    /// feed is written from (see `ProjectWidgetFeed`).
    @ObservationIgnored var onChanged: (() -> Void)?

    /// How often the index is re-read while the walk is still filling it in.
    private static let followInterval: Duration = .seconds(1)

    private enum Keys {
        static let favorites = "repos.favorites"
    }

    init(client: ReviewerClient) {
        self.client = client
        favorites = UserDefaults.standard.stringArray(forKey: Keys.favorites) ?? []
    }

    var recents: [RepoRow] {
        rows.filter { $0.lastOpened != nil }.sorted { $0.lastOpenedOrder > $1.lastOpenedOrder }
    }

    /// The starred repositories the index still lists; one that has gone
    /// stays starred in the defaults, back the moment a walk finds it again.
    var favoriteRows: [RepoRow] {
        rows.filter { favorites.contains($0.path) }
    }

    func isFavorite(_ path: String) -> Bool {
        favorites.contains(path)
    }

    func toggleFavorite(_ path: String) {
        if let at = favorites.firstIndex(of: path) {
            favorites.remove(at: at)
        } else {
            favorites.append(path)
        }
        onChanged?()
    }

    /// The folders holding more than one repository, most first — a folder
    /// of one is its repository's row, not a place to look in.
    var locations: [RepoLocation] {
        var counts: [String: Int] = [:]
        for row in rows {
            let parent = URL(fileURLWithPath: row.path).deletingLastPathComponent().path
            counts[parent, default: 0] += 1
        }
        return counts
            .filter { $0.value > 1 }
            .map { RepoLocation(path: $0.key, display: RepoRow.fold($0.key, home: home), count: $0.value) }
            .sorted { $0.count != $1.count ? $0.count > $1.count : $0.display < $1.display }
    }

    func rows(under location: String) -> [RepoRow] {
        rows.filter { URL(fileURLWithPath: $0.path).deletingLastPathComponent().path == location }
    }

    /// Read the index as it stands, and keep reading while a walk is on.
    func load() {
        followTask?.cancel()
        followTask = Task {
            await take { try await client.repos() }
            await follow()
        }
    }

    func rescan() {
        followTask?.cancel()
        followTask = Task {
            await take { try await client.rescanRepos() }
            await follow()
        }
    }

    private func follow() async {
        while isScanning, !Task.isCancelled {
            try? await Task.sleep(for: Self.followInterval)
            guard !Task.isCancelled else { return }
            await take { try await client.repos() }
        }
    }

    private func take(_ read: () async throws -> RepoIndex) async {
        do {
            async let workspace = client.workspace()
            let index = try await read()
            if let info = try? await workspace { home = info.home }
            rows = index.repos.map { RepoRow(entry: $0, home: home) }
            isScanning = index.scanning
            scannedAt = index.scannedAt.flatMap(CommitDates.parse)
            loadError = nil
        } catch {
            loadError = error.localizedDescription
            isScanning = false
        }
        hasLoaded = true
        onChanged?()
    }
}
