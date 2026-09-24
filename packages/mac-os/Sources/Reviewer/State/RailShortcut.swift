// The rail's chords. Each rail button answers ⌥⌘ and its place down the
// rail counted from the top — Xcode's chord for its inspectors, which
// stand in a column the same way — so the code surfaces are ⌥⌘1–3 and
// the bottom pane's surfaces ⌥⌘4–7, in the order the rail draws them.
// ⌘1–9 are the sessions' (see `ReviewerCommands`), and the letters the
// web app claims are taken. The one chord is read three ways: as the menu
// item's key equivalent, as the tooltip's hint, and as the palette's.
import SwiftUI

struct RailShortcut {
    let slot: Int

    static let modifiers: EventModifiers = [.option, .command]

    var key: KeyEquivalent { KeyEquivalent(Character(String(slot))) }

    var hint: String { "⌥⌘\(slot)" }
}

extension CodeSurface {
    var railShortcut: RailShortcut {
        RailShortcut(slot: Self.allCases.firstIndex(of: self)! + 1)
    }

    /// The tooltip: the surface's name, and the chord that reaches it.
    var railHelp: String { "\(title) (\(railShortcut.hint))" }
}

extension BottomPaneTab {
    var railShortcut: RailShortcut {
        RailShortcut(slot: CodeSurface.allCases.count + Self.allCases.firstIndex(of: self)! + 1)
    }

    var railHelp: String { "\(title) (\(railShortcut.hint))" }
}

extension View {
    func keyboardShortcut(_ shortcut: RailShortcut) -> some View {
        keyboardShortcut(shortcut.key, modifiers: RailShortcut.modifiers)
    }
}
