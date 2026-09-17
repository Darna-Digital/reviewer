// The trackpad's ways into the launchpad, heard at the application level
// like the Shift taps (`ShiftTapMonitor`): the toolbar is the system's
// view, not one of ours, and nothing on it scrolls, so what the fingers do
// over it is the launchpad's to answer.
//
// Two fingers drawn down the bar pull the panel out under them, frame for
// frame — the same pull the seam on its edge answers to the pointer, so a
// scroll that starts on the bar is a drag of the edge the panel comes out
// of — and let go of, it settles or goes back in by the same rules.
//
// Three fingers do the same, read off the touches themselves: the system
// turns a vertical three-finger swipe into no event of its own (its swipe
// events are the horizontal page swipes), but every touch on the trackpad
// reaches the app as a gesture event carrying the fingers on the surface.
// Three of them together, over the bar or the panel, are a pull: their
// travel down the trackpad, scaled up to the screen, is the pull's — and
// let go of, three fingers are a swipe: the panel is flung the rest of the
// way it was going, out onto its rows or back in, rather than left where a
// flick happened to end.
//
// Only the events the launchpad claims are swallowed. A scroll that did not
// start on the bar, the momentum that follows a pull, and every gesture
// event go on to whatever is under the pointer.
import AppKit
import SwiftUI

enum LaunchpadGesture {
    case pullBegan
    case pulled(CGFloat)
    case pullEnded
    case flung(down: Bool)
}

@MainActor
final class LaunchpadGestureMonitor {
    private enum Place {
        case bar
        case panel
    }

    /// Three fingers on the surface, and where they started.
    private struct Fingers {
        let startY: CGFloat
        let surfaceHeight: CGFloat
        var travel: CGFloat = 0
        /// A fourth finger landed, or the fingers came down somewhere that
        /// is not the launchpad's: the rest of this touch is not a pull.
        var spent = false
    }

    /// Screen points per point of travel on the trackpad — the pointer's
    /// own ratio, near enough, so a pull feels like moving the panel with
    /// the fingers rather than winding it.
    private static let fingerGain: CGFloat = 3
    /// Three fingers moved at least this far, and let go: a swipe.
    private static let flickTravel: CGFloat = 24

    private let launchpad: Launchpad
    private let hear: @MainActor (LaunchpadGesture) -> Void
    private var monitor: Any?
    /// How far down two fingers have scrolled since their pull began —
    /// present only while a scroll pull is being tracked.
    private var travel: CGFloat?
    private var fingers: Fingers?

    init(launchpad: Launchpad, hear: @escaping @MainActor (LaunchpadGesture) -> Void) {
        self.launchpad = launchpad
        self.hear = hear
        monitor = NSEvent.addLocalMonitorForEvents(matching: [.scrollWheel, .gesture]) { [weak self] event in
            let claimed = MainActor.assumeIsolated { self?.heard(event) ?? false }
            return claimed ? nil : event
        }
    }

    /// Whether the launchpad took the event as its own.
    private func heard(_ event: NSEvent) -> Bool {
        switch event.type {
        case .scrollWheel: return scrolled(event)
        case .gesture: touched(event); return false
        default: return false
        }
    }

    private func scrolled(_ event: NSEvent) -> Bool {
        if travel == nil {
            guard event.phase == .began, event.hasPreciseScrollingDeltas, fingers == nil,
                place(of: event) == .bar
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

    private func touched(_ event: NSEvent) {
        let touches = event.touches(matching: .touching, in: nil)
        switch touches.count {
        case 3:
            let y = touches.reduce(0) { $0 + $1.normalizedPosition.y } / 3
            if fingers == nil {
                let surface = touches.first?.deviceSize.height ?? 1
                let underPointer = travel == nil && place(of: event) != nil
                fingers = Fingers(startY: y, surfaceHeight: surface, spent: !underPointer)
                if underPointer { hear(.pullBegan) }
            }
            guard var fingers, !fingers.spent else { return }
            fingers.travel = (fingers.startY - y) * fingers.surfaceHeight * Self.fingerGain
            self.fingers = fingers
            hear(.pulled(fingers.travel))
        case ..<3:
            guard let fingers else { return }
            self.fingers = nil
            guard !fingers.spent else { return }
            let flicked = abs(fingers.travel) >= Self.flickTravel
            hear(flicked ? .flung(down: fingers.travel > 0) : .pullEnded)
        default:
            guard let fingers, !fingers.spent else { return }
            self.fingers?.spent = true
            hear(.pullEnded)
        }
    }

    /// Where the fingers are: on the toolbar above the content, on the
    /// panel while it is out, or somewhere that is not the launchpad's.
    /// The pointer's place, since fingers on a trackpad have no other: a
    /// gesture event's own location is the pointer's too.
    private func place(of event: NSEvent) -> Place? {
        guard let window = event.window ?? NSApp.keyWindow, window.isKeyWindow else { return nil }
        let y = window.convertPoint(fromScreen: NSEvent.mouseLocation).y
        let barFloor = window.contentLayoutRect.maxY
        if y >= barFloor { return .bar }
        if launchpad.isShown, y >= barFloor - launchpad.height { return .panel }
        return nil
    }
}

/// The window's content, told it wants the trackpad's touches. Nothing
/// here reads them as touches — the monitor above reads them off the
/// events — but a window with no view that accepts them is a window the
/// system may not bother sending them to. Put on the window's root view,
/// once, from whichever view carries it.
struct TouchAcceptance: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView {
        AcceptingView()
    }

    func updateNSView(_ nsView: NSView, context: Context) {}

    private final class AcceptingView: NSView {
        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            window?.contentView?.allowedTouchTypes.insert(.indirect)
        }
    }
}
