// The two things a reviewer reads off a pull request before opening it —
// did CI pass, and is anything in the way of merging it — as glyphs, the
// web app's `pull-request-status` in SF Symbols. They live together, and
// apart from both places that draw them — the sidebar's rows and the
// overview's checks — because the pair has to read the same in both: a
// tick meaning "passing" in one column and "mergeable" in the other is
// how a status light stops being trusted. With them, the compact "time
// ago" the rows and the overview date themselves in, the web app's own.
import SwiftUI

extension CheckState {
    var symbol: String {
        switch self {
        case .success: return "checkmark.circle.fill"
        case .failure: return "xmark.circle.fill"
        case .pending: return "circle.dotted"
        case .neutral: return "circle.dashed"
        }
    }

    var tint: Color {
        switch self {
        case .success: return .green
        case .failure: return .red
        case .pending: return .orange
        case .neutral: return .secondary
        }
    }

    var word: String {
        switch self {
        case .success: return "passed"
        case .failure: return "failed"
        case .pending: return "running"
        case .neutral: return "skipped"
        }
    }
}

/// CI on the head commit. Nothing when the repo runs no checks. Spun
/// while still running: that is the one of the four that will change on
/// its own, and a still icon reads as a settled verdict.
struct ChecksIcon: View {
    let pull: PullRequestInfo
    var size: CGFloat = 12

    var body: some View {
        if let state = pull.checksState, let summary = pull.checksSummary {
            Image(systemName: state.symbol)
                .font(.system(size: size, weight: .medium))
                .foregroundStyle(state.tint)
                .symbolEffect(.rotate, options: .repeat(.continuous), isActive: state == .pending)
                .help(summary)
                .accessibilityLabel(summary)
        }
    }
}

/// The blocker. Absent — not greyed out — when nothing is blocking: an
/// icon that is always there is an icon nobody looks at, and this one has
/// to be noticed.
struct BlockedIcon: View {
    let pull: PullRequestInfo
    var size: CGFloat = 12

    var body: some View {
        if let reason = pull.blockedReason {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: size, weight: .medium))
                .foregroundStyle(.orange)
                .help(reason)
                .accessibilityLabel(reason)
        }
    }
}

/// A check's verdict as a dot, boxed to the width of the icon the summary
/// above it wears, so a list of checks hangs on the edge the headline
/// starts on.
struct CheckDot: View {
    let state: CheckState

    var body: some View {
        Circle()
            .fill(state.tint)
            .frame(width: 6, height: 6)
            .frame(width: 14)
    }
}

/// The pull request's own state — open, or a draft — in the glyph the
/// rail names the surface with.
struct PullStateIcon: View {
    let pull: PullRequestInfo
    var size: CGFloat = 13

    var body: some View {
        Image(systemName: "arrow.triangle.pull")
            .font(.system(size: size, weight: .medium))
            .foregroundStyle(pull.draft ? AnyShapeStyle(.secondary) : AnyShapeStyle(Color.green))
            .help(pull.draft ? "Draft" : "Open")
            .accessibilityLabel(pull.draft ? "Draft" : "Open")
    }
}

/// Compact "time ago" — "just now", "3h", "2d" — the web app's
/// `timeAgo`, falling back to a date once the gap grows past a few weeks.
enum TimeAgo {
    static func text(_ iso: String, now: Date = Date()) -> String {
        guard let then = Wire.date(iso) else { return "" }
        let gap = now.timeIntervalSince(then)
        let minute = 60.0, hour = 60 * minute, day = 24 * hour, week = 7 * day
        if gap < minute { return "just now" }
        if gap < hour { return "\(Int(gap / minute))m" }
        if gap < day { return "\(Int(gap / hour))h" }
        if gap < week { return "\(Int(gap / day))d" }
        if gap < 4 * week { return "\(Int(gap / week))w" }
        return then.formatted(date: .abbreviated, time: .omitted)
    }
}

/// A GitHub label as a badge in its own colour — six bare hex digits, a
/// label with none falling back to the plain badge.
struct LabelBadge: View {
    let label: PullRequestLabel

    var body: some View {
        let hue = Self.hue(label.color)
        Text(label.name)
            .font(.system(size: 10, weight: .medium))
            .lineLimit(1)
            .foregroundStyle(hue ?? Color.primary)
            .padding(.horizontal, 5)
            .frame(height: 16)
            .background((hue ?? Color.primary).opacity(0.12), in: Capsule())
            .overlay(Capsule().strokeBorder((hue ?? Color.primary).opacity(0.3), lineWidth: 1))
    }

    private static func hue(_ color: String) -> Color? {
        guard color.count == 6, color.allSatisfy(\.isHexDigit) else { return nil }
        return Color(hex: "#\(color)")
    }
}
