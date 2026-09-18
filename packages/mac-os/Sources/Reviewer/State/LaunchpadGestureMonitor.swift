// The trackpad's way into the launchpad, heard at the application level
// like the Shift taps (`ShiftTapMonitor`): the toolbar is the system's
// view, not one of ours, and nothing on it scrolls, so what two fingers do
// over it is the launchpad's to answer.
//
// Two fingers drawn down the bar pull the panel out under them, frame for
// frame — the same pull the seam on its edge answers to the pointer, so a
// scroll that starts on the bar is a drag of the edge the panel comes out
// of — and let go of, it settles or goes back in by the same rules.
//
// Only the events the launchpad claims are swallowed. A scroll that did not
// start on the bar, and the momentum that follows a pull, go on to whatever
// is under the pointer.
import AppKit

enum LaunchpadGesture {
    case pullBegan
    case pulled(CGFloat)
    case pullEnded
}

@MainActor
final class LaunchpadGestureMonitor {
    private let hear: @MainActor (LaunchpadGesture) -> Void
    private var monitor: Any?
    /// How far down two fingers have scrolled since their pull began —
    /// present only while a pull is being tracked.
    private var travel: CGFloat?

    init(hear: @escaping @MainActor (LaunchpadGesture) -> Void) {
        self.hear = hear
        monitor = NSEvent.addLocalMonitorForEvents(matching: .scrollWheel) { [weak self] event in
            let claimed = MainActor.assumeIsolated { self?.scrolled(event) ?? false }
            return claimed ? nil : event
        }
    }

    /// Whether the launchpad took the scroll as its own.
    private func scrolled(_ event: NSEvent) -> Bool {
        if travel == nil {
            guard event.phase == .began, event.hasPreciseScrollingDeltas, isOverBar(event)
            else { return false }
            travel = 0
            hear(.pullBegan)
        }
        switch event.phase {
        case .began, .changed:
            let pulled = (travel ?? 0) + fingersDown(in: event)
            travel = pulled
            hear(.pulled(pulled))
        default:
            travel = nil
            hear(.pullEnded)
        }
        return true
    }

    /// Scroll deltas are given as the scroll they ask for, already turned
    /// round for natural scrolling. The pull wants the fingers' own travel,
    /// down positive: under natural scrolling that is the delta as given
    /// (the content follows the fingers), and otherwise its opposite.
    private func fingersDown(in event: NSEvent) -> CGFloat {
        event.isDirectionInvertedFromDevice ? event.scrollingDeltaY : -event.scrollingDeltaY
    }

    /// Whether the pointer — which is where fingers on a trackpad are — sits
    /// on the toolbar above the content of the key window.
    private func isOverBar(_ event: NSEvent) -> Bool {
        guard let window = event.window ?? NSApp.keyWindow, window.isKeyWindow else { return false }
        let y = window.convertPoint(fromScreen: NSEvent.mouseLocation).y
        return y >= window.contentLayoutRect.maxY
    }
}
