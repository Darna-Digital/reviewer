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
//
// The feed is reviewer.sh's, which redirects to the release's copy, and the
// day's first check carries the usage flags (see `UsageCounting`). Sparkle
// checks every six hours, so a short session after a recent check would go
// uncounted: on launch and whenever the app comes forward, a day not yet
// counted gets a check of its own — only while automatic checks are on.
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
        _ = UsageCounting.shared // reads the record before Sparkle's first check touches its own
        controller.startUpdater()
        checkIfDayUncounted()
        NotificationCenter.default.addObserver(
            forName: NSApplication.didBecomeActiveNotification, object: nil, queue: .main
        ) { _ in
            MainActor.assumeIsolated { UpdateCheck.shared.checkIfDayUncounted() }
        }
    }

    /// A background check for a day not counted yet, unless Sparkle is
    /// checking already, the person turned automatic checks off, or the
    /// feed has been pointed elsewhere.
    private func checkIfDayUncounted() {
        let updater = controller.updater
        guard UsageCounting.shared.isOn,
              !UsageCounting.shared.isTodayCounted,
              updater.automaticallyChecksForUpdates,
              !updater.sessionInProgress,
              feedOverride == nil
        else { return }
        updater.checkForUpdatesInBackground()
    }

    func checkByHand() {
        guard isBundled else { return }
        controller.checkForUpdates(nil)
    }

    private var feedOverride: String? {
        UserDefaults.standard.string(forKey: Self.feedOverrideKey)
    }

    func feedURLString(for updater: SPUUpdater) -> String? {
        feedOverride
    }

    /// The usage flags, appended to the feed URL's query by Sparkle; none
    /// when the feed has been pointed elsewhere.
    func feedParameters(for updater: SPUUpdater, sendingSystemProfile sendingProfile: Bool) -> [[String: String]] {
        feedOverride == nil ? UsageCounting.shared.feedParameters() : []
    }

    func updater(_ updater: SPUUpdater, didFinishLoading appcast: SUAppcast) {
        UsageCounting.shared.commit()
    }

    /// Every check ends here, loaded or not; one that never loaded the
    /// feed leaves the day for the next.
    func updater(_ updater: SPUUpdater, didFinishUpdateCycleFor updateCheck: SPUUpdateCheck, error: (any Error)?) {
        UsageCounting.shared.release()
    }
}
