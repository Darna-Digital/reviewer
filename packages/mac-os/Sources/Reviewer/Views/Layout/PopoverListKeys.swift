// The keys every popover list answers: ↑/↓ walk the rows, wrapping at the
// ends, Home and End jump, Return picks the lit row, Escape puts the
// popover away — and whatever else a popover adds, → into a submenu, ←
// back out of it.
//
// The keys are heard ahead of the window, not through SwiftUI's focus. A
// popover's window becomes key only once something in it takes the
// keyboard, which SwiftUI does a turn of the run loop after the popover
// comes up, and not at all when the focus is asked for from outside the
// popover; until then the keys go to whatever had them in the window
// below — the composer's prompt, the page's web view — and an arrow that
// moved the list one time did nothing the next. So while a popover is on
// screen, the topmost one (a submenu over its list) hears the keys first,
// wherever the keyboard is.
import AppKit
import SwiftUI

enum PopoverKey {
    case up, down, left, right, home, end, enter, escape, delete

    init?(_ event: NSEvent) {
        let modifiers = event.modifierFlags.intersection([.command, .option, .control, .shift])
        guard event.type == .keyDown, modifiers.isEmpty else { return nil }
        switch event.keyCode {
        case 126: self = .up
        case 125: self = .down
        case 123: self = .left
        case 124: self = .right
        case 115: self = .home
        case 119: self = .end
        case 36, 76: self = .enter
        case 53: self = .escape
        case 51, 117: self = .delete
        default: return nil
        }
    }
}

/// A key as a popover hears it, with the search field it may have been
/// typed into — so ←/→ can leave the caret alone while it has somewhere
/// to go.
struct PopoverKeyPress {
    let key: PopoverKey
    let editor: NSTextView?

    var fieldIsEmpty: Bool { editor?.string.isEmpty ?? true }

    /// Whether ← would only knock the caret against the start of the field.
    var caretAtStart: Bool {
        guard let editor else { return true }
        let selection = editor.selectedRange()
        return selection.length == 0 && selection.location == 0
    }

    /// Whether → would only knock the caret against the end of the field.
    var caretAtEnd: Bool {
        guard let editor else { return true }
        let selection = editor.selectedRange()
        return selection.length == 0 && selection.location == (editor.string as NSString).length
    }
}

extension View {
    /// Hear the keys while this popover is the topmost one on screen. The
    /// handler answers whether it took the key; one it leaves goes on to
    /// the window as it would have.
    func popoverKeys(_ handle: @escaping (PopoverKeyPress) -> Bool) -> some View {
        background(PopoverKeyListener(handle: handle))
    }

    /// Walk `active` through `count` rows from the keyboard. Nothing lit
    /// (`nil`) is a list the keys have not touched yet: ↓ lights the first
    /// row, ↑ the last, and Return does nothing. `also` is asked first, for
    /// the keys a popover answers beyond these.
    func popoverListKeys(
        active: Binding<Int?>, count: Int, pick: @escaping (Int) -> Void,
        also: @escaping (PopoverKeyPress) -> Bool = { _ in false }
    ) -> some View {
        modifier(PopoverListKeys(active: active, count: count, pick: pick, also: also))
    }
}

/// Where a step of `offset` from `active` lands among `count` rows,
/// wrapping at the ends; from nothing lit, ↓ is the first row and ↑ the
/// last.
func walkedRow(from active: Int?, by offset: Int, in count: Int) -> Int? {
    guard count > 0 else { return nil }
    guard let active, (0..<count).contains(active) else { return offset < 0 ? count - 1 : 0 }
    return (active + offset % count + count) % count
}

private struct PopoverListKeys: ViewModifier {
    @Binding var active: Int?
    let count: Int
    let pick: (Int) -> Void
    let also: (PopoverKeyPress) -> Bool
    @Environment(\.dismiss) private var dismiss

    func body(content: Content) -> some View {
        content
            .popoverKeys(handle)
            .onChange(of: count) { _, count in
                if let current = active, current >= count { active = count == 0 ? nil : count - 1 }
            }
    }

    private func handle(_ press: PopoverKeyPress) -> Bool {
        if also(press) { return true }
        switch press.key {
        case .up: active = walkedRow(from: active, by: -1, in: count)
        case .down: active = walkedRow(from: active, by: 1, in: count)
        case .home: if count > 0 { active = 0 }
        case .end: if count > 0 { active = count - 1 }
        case .enter:
            guard let active, (0..<count).contains(active) else { return false }
            pick(active)
        case .escape: dismiss()
        case .left, .right, .delete: return false
        }
        return true
    }
}

/// A view with no size that stands in the popover's window for as long as
/// the popover is up, holding the latest handler the popover drew.
private struct PopoverKeyListener: NSViewRepresentable {
    let handle: (PopoverKeyPress) -> Bool

    func makeNSView(context: Context) -> PopoverKeyListenerView {
        PopoverKeyListenerView()
    }

    func updateNSView(_ view: PopoverKeyListenerView, context: Context) {
        view.handle = handle
    }
}

final class PopoverKeyListenerView: NSView {
    var handle: (PopoverKeyPress) -> Bool = { _ in false }

    override func hitTest(_ point: NSPoint) -> NSView? { nil }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if window == nil { PopoverKeyRouter.shared.remove(self) } else { PopoverKeyRouter.shared.push(self) }
    }

    /// The search field being typed in, if the keyboard is in this
    /// popover's window at all.
    var editor: NSTextView? { window?.firstResponder as? NSTextView }
}

/// The popovers on screen, newest last, and the one monitor that hands the
/// keys to the newest — installed while any is up, taken out after.
@MainActor
private final class PopoverKeyRouter {
    static let shared = PopoverKeyRouter()

    private var listeners: [PopoverKeyListenerView] = []
    private var monitor: Any?

    func push(_ listener: PopoverKeyListenerView) {
        listeners.removeAll { $0 === listener }
        listeners.append(listener)
        guard monitor == nil else { return }
        monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            guard let key = PopoverKey(event) else { return event }
            return MainActor.assumeIsolated { PopoverKeyRouter.shared.route(key) } ? nil : event
        }
    }

    func remove(_ listener: PopoverKeyListenerView) {
        listeners.removeAll { $0 === listener }
        guard listeners.isEmpty, let monitor else { return }
        NSEvent.removeMonitor(monitor)
        self.monitor = nil
    }

    /// Whether the topmost popover took the key.
    private func route(_ key: PopoverKey) -> Bool {
        // A popover put away whose view outlives it, in a window ordered
        // out, must not go on taking the keys.
        guard let top = listeners.last(where: { $0.window?.isVisible == true }) else { return false }
        let editor = top.editor
        // A key mid-composition — an accent, a kana — is the input
        // method's, not the list's.
        if editor?.hasMarkedText() == true { return false }
        return top.handle(PopoverKeyPress(key: key, editor: editor))
    }
}
