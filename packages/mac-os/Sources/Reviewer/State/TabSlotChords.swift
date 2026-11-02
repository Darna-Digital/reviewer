import AppKit

/// ⇧⌘1–9: the session tab in that place along the strip, the pinned tabs
/// not counted (see `WindowTabStrip.sessions`).
///
/// Heard by key rather than through the menu. A menu item matches the
/// character a key types, and with ⇧ held the digit row types !@# on one
/// layout and the digits themselves on another — Lithuanian's row types
/// letters bare and digits shifted — so a menu's ⇧⌘1 answered on some
/// keyboards and not on others. The key under the finger is the same on
/// all of them. ⇧⌘3–5 are the system's screenshots unless those are turned
/// off in Keyboard settings; macOS takes them before any app hears them.
@MainActor
final class TabSlotChords {
    /// The key codes of the digit row, 1 to 9.
    private static let digitRow: [UInt16] = [18, 19, 20, 21, 23, 22, 26, 28, 25]

    private var monitor: Any?

    init(onSlot: @escaping @MainActor (Int) -> Void) {
        monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            let modifiers = event.modifierFlags.intersection(.deviceIndependentFlagsMask).subtracting(.capsLock)
            guard modifiers == [.command, .shift], let index = Self.digitRow.firstIndex(of: event.keyCode)
            else { return event }
            MainActor.assumeIsolated { onSlot(index + 1) }
            return nil
        }
    }

    /// The chord for a slot, as the tab and the menu show it.
    static func hint(forSlot slot: Int) -> String? {
        slot <= digitRow.count ? "⇧⌘\(slot)" : nil
    }
}
