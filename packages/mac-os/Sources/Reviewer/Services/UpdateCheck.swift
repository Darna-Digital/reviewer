// In-place updates, through Sparkle. Each GitHub release carries an
// `appcast.xml` beside its disk image (see release.yml), and Info.plist's
// SUFeedURL points at the latest release's copy, so the feed always names
// the newest build. When it is newer than this one, Sparkle's window offers
// "Install Update": it downloads the disk image, checks its EdDSA signature
// against SUPublicEDKey, swaps the bundle in place and relaunches.
//
// Sparkle schedules its own checks (SUScheduledCheckInterval in Info.plist)
// and keeps "Skip This Version" and "Remind Me Later" itself; "Check for
// Updates…" in the app menu asks on demand.
import AppKit
import Sparkle

@MainActor
final class UpdateCheck: NSObject, SPUUpdaterDelegate {
    static let shared = UpdateCheck()

    /// Points the check at another feed — a `file://` one is how the window
    /// is tried without shipping a release:
    /// `defaults write com.byconvo.reviewer.macos update.feedURL file:///tmp/appcast.xml`
    private static let feedOverrideKey = "update.feedURL"

    private lazy var controller = SPUStandardUpdaterController(
        startingUpdater: false,
        updaterDelegate: self,
        userDriverDelegate: nil
    )

    /// A bare `swift run` binary has no bundle, so no version or feed to
    /// check against, and Sparkle would only complain that it is misconfigured.
    private var isBundled: Bool {
        Bundle.main.bundleURL.pathExtension == "app"
    }

    func start() {
        guard isBundled else { return }
        controller.startUpdater()
    }

    func checkByHand() {
        guard isBundled else { return }
        controller.checkForUpdates(nil)
    }

    func feedURLString(for updater: SPUUpdater) -> String? {
        UserDefaults.standard.string(forKey: Self.feedOverrideKey)
    }
}
