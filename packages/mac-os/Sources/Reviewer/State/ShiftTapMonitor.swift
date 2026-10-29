// Shift, tapped twice — the web app's way into the file search — heard at
// the application level rather than by a view: the keys belong to the page
// island the rest of the time, and the gesture has to work wherever focus
// is. A local event monitor sees every key before the window does and
// hands it on untouched; only the pattern is watched for.
//
// The rules are the web app's own (`shortcuts.functions` there): a tap
// only counts when Shift goes down alone — Shift in a chord such as ⌘⇧F
// breaks the pair, so a shortcut never opens the palette behind itself —
// and any key pressed between two taps breaks it too, so capitalising two
// words in a row does not read as the gesture.
import AppKit

@MainActor
final class ShiftTapMonitor {
    /// How long a first tap waits for its partner: long enough to be
    /// comfortable, short enough that two unrelated Shifts do not pair.
    private static let doubleTapWindow: TimeInterval = 0.4
    private static let shiftKeyCodes: Set<UInt16> = [56, 60]

    private let onDoubleTap: @MainActor () -> Void
    private var lastTapAt: TimeInterval?
    private var monitor: Any?

    init(onDoubleTap: @escaping @MainActor () -> Void) {
        self.onDoubleTap = onDoubleTap
        monitor = NSEvent.addLocalMonitorForEvents(matching: [.flagsChanged, .keyDown]) { [weak self] event in
            MainActor.assumeIsolated { self?.heard(event) }
            return event
        }
    }

    private func heard(_ event: NSEvent) {
        guard event.type == .flagsChanged else {
            lastTapAt = nil
            return
        }
        // Caps Lock is a state, not a press: it is on or off through the
        // whole gesture and says nothing about it.
        let modifiers = event.modifierFlags.intersection(.deviceIndependentFlagsMask).subtracting(.capsLock)
        // Shift coming back up arrives as a change to no modifiers at all;
        // the tap it ends is still waiting for its partner.
        if modifiers.isEmpty { return }
        guard modifiers == .shift, Self.shiftKeyCodes.contains(event.keyCode) else {
            lastTapAt = nil
            return
        }
        if let last = lastTapAt, event.timestamp - last <= Self.doubleTapWindow {
            lastTapAt = nil
            onDoubleTap()
        } else {
            lastTapAt = event.timestamp
        }
    }
}
