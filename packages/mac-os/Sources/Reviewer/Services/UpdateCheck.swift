// The update check. Reviewer ships as a disk image on the repository's GitHub
// releases with no auto-update (see RELEASING.md): a new version is a new
// download. So the app only asks whether there is one, and when there is,
// puts up a window offering the download (see `UpdateWindowController`), the
// way Sparkle's does — without replacing the app itself.
//
// The question goes to reviewer.sh/latest.json rather than to GitHub: the
// repository is private, so its releases API would not answer an installed
// app. The site builds that file from the root package.json's version and is
// redeployed by release.yml once the disk image is published.
//
// It asks a little after launch, so the window never races the workspace
// coming up, then every few hours while the app stays open, and on demand
// from the app menu's "Check for updates…". The two ways of saying no carry
// over between launches: "Skip this version" keeps quiet until a later one
// ships, "Remind me later" for a day. A check asked for by hand ignores both,
// and says so when there is nothing new or the site could not be reached.
import AppKit
import Foundation

/// What reviewer.sh/latest.json answers: the newest released version and
/// the page its disk image is downloaded from.
struct AvailableUpdate: Decodable, Equatable, Sendable {
    let version: String
    let url: URL
}

/// How the update window was answered.
enum UpdateChoice {
    case download
    case later
    case skip
}

@MainActor
final class UpdateCheck {
    static let shared = UpdateCheck()

    private static let feedURL = URL(string: "https://reviewer.sh/latest.json")!
    private static let launchDelay: Duration = .seconds(10)
    private static let interval: Duration = .seconds(6 * 60 * 60)
    private static let remindAfter: TimeInterval = 24 * 60 * 60

    private enum Keys {
        /// Points the check at another manifest — a `file://` one is how the
        /// window is tried without shipping a release:
        /// `defaults write com.byconvo.reviewer.macos update.feedURL file:///tmp/latest.json`
        static let feedURL = "update.feedURL"
        static let skippedVersion = "update.skippedVersion"
        static let remindAfter = "update.remindAfter"
    }

    private let defaults = UserDefaults.standard
    private let window = UpdateWindowController()
    private var schedule: Task<Void, Never>?

    /// The running build's version, which `bundle.sh` stamps from the root
    /// package.json. A bare `swift run` binary has no bundle and so none,
    /// and is never offered anything.
    private var currentVersion: String? {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
    }

    func start() {
        guard schedule == nil else { return }
        schedule = Task { [weak self] in
            try? await Task.sleep(for: Self.launchDelay)
            while !Task.isCancelled {
                await self?.check(byHand: false)
                try? await Task.sleep(for: Self.interval)
            }
        }
    }

    func checkByHand() {
        Task { await check(byHand: true) }
    }

    private func check(byHand: Bool) async {
        guard let currentVersion else {
            if byHand { presentFailure(detail: "This build carries no version to compare.") }
            return
        }
        let update: AvailableUpdate
        do {
            update = try await fetchLatest()
        } catch {
            if byHand { presentFailure(detail: error.localizedDescription) }
            return
        }
        guard Self.isNewer(update.version, than: currentVersion) else {
            if byHand { presentUpToDate(currentVersion) }
            return
        }
        if !byHand, isDeferred(update) { return }
        window.show(update, current: currentVersion) { [weak self] choice in
            self?.record(choice, for: update)
        }
    }

    private func fetchLatest() async throws -> AvailableUpdate {
        let url = defaults.string(forKey: Keys.feedURL).flatMap(URL.init(string:)) ?? Self.feedURL
        let request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode(AvailableUpdate.self, from: data)
    }

    /// Numeric comparison, segment by segment, so 0.0.10 sorts above 0.0.9.
    static func isNewer(_ candidate: String, than current: String) -> Bool {
        candidate.compare(current, options: .numeric) == .orderedDescending
    }

    private func isDeferred(_ update: AvailableUpdate) -> Bool {
        if defaults.string(forKey: Keys.skippedVersion) == update.version { return true }
        if let until = defaults.object(forKey: Keys.remindAfter) as? Date, until > .now { return true }
        return false
    }

    /// A download counts as a "later" too: until the new copy is dragged into
    /// Applications this build keeps running, and a day is soon enough to
    /// mention it again.
    private func record(_ choice: UpdateChoice, for update: AvailableUpdate) {
        switch choice {
        case .download:
            NSWorkspace.shared.open(update.url)
            defaults.set(Date.now.addingTimeInterval(Self.remindAfter), forKey: Keys.remindAfter)
        case .later:
            defaults.set(Date.now.addingTimeInterval(Self.remindAfter), forKey: Keys.remindAfter)
        case .skip:
            defaults.set(update.version, forKey: Keys.skippedVersion)
        }
    }

    private func presentUpToDate(_ version: String) {
        let alert = NSAlert()
        alert.messageText = "You’re up to date!"
        alert.informativeText = "Reviewer \(version) is the newest version available."
        alert.runModal()
    }

    private func presentFailure(detail: String) {
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = "Couldn’t check for updates"
        alert.informativeText = detail
        alert.runModal()
    }
}
