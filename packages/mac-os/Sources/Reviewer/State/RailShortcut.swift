// The rail's chords. The code surfaces take ⌘ and their place down the
// rail — ⌘1 Browse, ⌘2 Review, ⌘3 Merge requests — the way Xcode's
// navigators take ⌘1 onwards; the bottom pane's surfaces after them take
// ⌥⌘ and theirs, ⌥⌘4–7, in the order the rail draws them. The session tabs
// are ⇧⌘1–9 (see `TabSlotChords`), and the letters the web app claims are
// taken. The one chord is read three ways: as the menu item's key
// equivalent, as the tooltip's hint, and as the palette's.
import SwiftUI

struct RailShortcut {
    let slot: Int
    let modifiers: EventModifiers

    var key: KeyEquivalent { KeyEquivalent(Character(String(slot))) }

    var hint: String { "\(modifiers.contains(.option) ? "⌥" : "")⌘\(slot)" }
}

extension CodeSurface {
    var railShortcut: RailShortcut {
        RailShortcut(slot: Self.allCases.firstIndex(of: self)! + 1, modifiers: .command)
    }

    /// The tooltip: the surface's name, and the chord that reaches it.
    var railHelp: String { "\(title) (\(railShortcut.hint))" }
}

extension BottomPaneTab {
    var railShortcut: RailShortcut {
        RailShortcut(
            slot: CodeSurface.allCases.count + Self.allCases.firstIndex(of: self)! + 1,
            modifiers: [.option, .command])
    }

    var railHelp: String { "\(title) (\(railShortcut.hint))" }
}

extension View {
    func keyboardShortcut(_ shortcut: RailShortcut) -> some View {
        keyboardShortcut(shortcut.key, modifiers: shortcut.modifiers)
    }
}
