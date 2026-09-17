// The trackpad's ways into the launchpad, heard at the application level
// like the Shift taps (`ShiftTapMonitor`): the toolbar is the system's
// view, not one of ours, and nothing on it scrolls, so what the fingers do
// over it is the launchpad's to answer.
//
// Two fingers drawn down the bar pull the panel out under them, frame for
// frame — the same pull the seam on its edge answers to the pointer, so a
// scroll that starts on the bar is a drag of the edge the panel comes out
// of — and let go of, it settles or goes back in by the same rules. Three
// fingers swiped down the bar fling it open; swiped up, over the bar or the
// panel itself, put it away. The swipe arrives already as one event, with
// its direction in `deltaY`: -1 down, 1 up.
//
// Only the events the launchpad claims are swallowed. A scroll that did not
// start on the bar, and the momentum that follows a pull, go on to whatever
// is under the pointer.
import AppKit

enum LaunchpadGesture {
    case swipeDown
    case swipeUp
    case pullBegan
    case pulled(CGFloat)
    case pullEnded
}

@MainActor
final class LaunchpadGestureMonitor {
    private enum Place {
        case bar
        case panel
    }

    private let launchpad: Launchpad
    private let hear: @MainActor (LaunchpadGesture) -> Void
    private var monitor: Any?
    /// How far down the fingers have come since the pull began — present
    /// only while a pull is being tracked.
    private var travel: CGFloat?

    init(launchpad: Launchpad, hear: @escaping @MainActor (LaunchpadGesture) -> Void) {
        self.launchpad = launchpad
        self.hear = hear
        monitor = NSEvent.addLocalMonitorForEvents(matching: [.scrollWheel, .swipe]) { [weak self] event in
            let claimed = MainActor.assumeIsolated { self?.heard(event) ?? false }
            return claimed ? nil : event
        }
    }

    /// Whether the launchpad took the event as its own.
    private func heard(_ event: NSEvent) -> Bool {
        switch event.type {
        case .swipe: return swiped(event)
        case .scrollWheel: return scrolled(event)
        default: return false
        }
    }

    private func swiped(_ event: NSEvent) -> Bool {
        guard event.deltaY != 0, let place = place(of: event) else { return false }
        let down = event.deltaY < 0
        switch (place, down) {
        case (.bar, true): hear(.swipeDown)
        case (.bar, false), (.panel, false): hear(.swipeUp)
        case (.panel, true): return false
        }
        return true
    }

    private func scrolled(_ event: NSEvent) -> Bool {
        if travel == nil {
            guard event.phase == .began, event.hasPreciseScrollingDeltas, place(of: event) == .bar else { return false }
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

    /// Where the fingers are: on the toolbar above the content, on the
    /// panel while it is out, or somewhere that is not the launchpad's.
    private func place(of event: NSEvent) -> Place? {
        guard let window = event.window, window.isKeyWindow else { return nil }
        let y = event.locationInWindow.y
        let barFloor = window.contentLayoutRect.maxY
        if y >= barFloor { return .bar }
        if launchpad.isShown, y >= barFloor - launchpad.height { return .panel }
        return nil
    }
}
