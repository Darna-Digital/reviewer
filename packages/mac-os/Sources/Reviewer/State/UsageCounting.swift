// How the app is counted (see reviewer.sh/privacy): the first update check
// of each local day carries a few flags — the day, whether it is the first
// counted day of the week, the month or ever, the month the app was first
// counted in, and the macOS major version — which reviewer.sh writes as one
// row and every later check that day does not carry. They are worked out
// here, from a record of the periods the app was last counted in; there is
// no id, so two days from this Mac cannot be tied together.
//
// The record lives in the app's defaults, which dragging the app to the
// Trash and installing it again leaves alone. Turning counting off in
// Settings sends no flags at all; the update check goes on as before.
//
// `UpdateCheck` asks for the flags as Sparkle builds the feed URL, commits
// them once the feed has loaded, and lets them go when a check fails, so
// the next one counts the day instead.
import Foundation
import Observation

@MainActor
@Observable
final class UsageCounting {
    static let shared = UsageCounting()

    /// Settings → Privacy → Share anonymous usage counts.
    var isOn: Bool {
        didSet { defaults.set(isOn, forKey: Keys.isOn) }
    }

    @ObservationIgnored private let defaults = UserDefaults.standard
    /// The flags of the check under way, until it loads or fails.
    @ObservationIgnored private var pending: Periods?

    private enum Keys {
        static let isOn = "usage.isOn"
        static let day = "usage.day"
        static let week = "usage.week"
        static let month = "usage.month"
        static let since = "usage.since"
        /// Set once, on the first launch of a build that counts: whether
        /// an older build had run here already, so its first day is not new.
        static let upgraded = "usage.upgraded"
        /// Sparkle's own, written by every build since 0.0.5.
        static let sparkleLastCheck = "SULastCheckTime"
    }

    private struct Periods {
        let day: String
        let week: String
        let month: String
    }

    private init() {
        isOn = defaults.object(forKey: Keys.isOn) as? Bool ?? true
        if defaults.object(forKey: Keys.upgraded) == nil {
            let olderBuildRan = defaults.string(forKey: Keys.since) == nil
                && defaults.object(forKey: Keys.sparkleLastCheck) != nil
            defaults.set(olderBuildRan, forKey: Keys.upgraded)
        }
    }

    var isTodayCounted: Bool {
        defaults.string(forKey: Keys.day) == Self.periods(Date()).day
    }

    /// The query items for the check about to go out: the day's flags when
    /// it is the day's first, and nothing otherwise.
    func feedParameters() -> [[String: String]] {
        guard isOn, Self.isReleaseBuild, pending == nil else { return [] }
        let now = Self.periods(Date())
        guard defaults.string(forKey: Keys.day) != now.day else { return [] }
        let since = defaults.string(forKey: Keys.since)
        let isNew = since == nil && !defaults.bool(forKey: Keys.upgraded)
        pending = now
        let items: [(String, String)] = [
            ("d", "1"),
            ("day", now.day),
            ("w", defaults.string(forKey: Keys.week) == now.week ? "0" : "1"),
            ("m", defaults.string(forKey: Keys.month) == now.month ? "0" : "1"),
            ("new", isNew ? "1" : "0"),
            ("since", since ?? now.month),
            ("os", String(ProcessInfo.processInfo.operatingSystemVersion.majorVersion)),
        ]
        return items.map { ["key": $0.0, "value": $0.1, "displayKey": $0.0, "displayValue": $0.1] }
    }

    /// The feed loaded, so the check reached reviewer.sh: keep the day.
    func commit() {
        guard let counted = pending else { return }
        pending = nil
        defaults.set(counted.day, forKey: Keys.day)
        defaults.set(counted.week, forKey: Keys.week)
        defaults.set(counted.month, forKey: Keys.month)
        if defaults.string(forKey: Keys.since) == nil {
            defaults.set(counted.month, forKey: Keys.since)
        }
    }

    /// The check ended without loading the feed: the next one tries again.
    func release() {
        pending = nil
    }

    /// Not a debug bundle, which `bundle.sh` marks by turning Sparkle's
    /// scheduled checks off; it still checks when asked, uncounted.
    private static let isReleaseBuild =
        Bundle.main.object(forInfoDictionaryKey: "SUEnableAutomaticChecks") as? Bool ?? true

    /// The local day, ISO week and month of `date`.
    private static func periods(_ date: Date) -> Periods {
        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = .current
        let parts = calendar.dateComponents([.year, .month, .day, .yearForWeekOfYear, .weekOfYear], from: date)
        let month = String(format: "%04d-%02d", parts.year ?? 0, parts.month ?? 0)
        return Periods(
            day: month + String(format: "-%02d", parts.day ?? 0),
            week: String(format: "%04d-W%02d", parts.yearForWeekOfYear ?? 0, parts.weekOfYear ?? 0),
            month: month
        )
    }
}
