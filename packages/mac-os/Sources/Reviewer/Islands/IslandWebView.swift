// The island's web view, with one thing WebKit's own lacks: it keeps its
// hands off the page while something native stands over it. The assign bar
// the shell floats over the page and the palette it hangs over the window
// are SwiftUI, drawn above the view; a click on them lands on them, since
// the window hit-tests for it — but a hover does not. The view's tracking
// area hands it every move of the mouse inside its frame, whatever is
// drawn on top, and the page lit up its lines under the bar as if the bar
// were not there. So each move is checked against the window's hit test
// first, and while the view is not the thing under the pointer the page is
// told the pointer left instead — once, as an exit to nowhere — so a hover
// in progress is put out rather than frozen under the glass.
import AppKit
import WebKit

final class IslandWebView: WKWebView {
    private var pointerIsCovered = false

    /// No WebKit menu over the code: a right-click is the page's to answer
    /// — the symbol menu over an identifier, nothing elsewhere — and the
    /// stock "Look Up", "Search with Google" and friends only stand in its
    /// way. Emptied rather than refused, since AppKit shows no menu with
    /// nothing in it.
    override func willOpenMenu(_ menu: NSMenu, with event: NSEvent) {
        menu.removeAllItems()
    }

    override func mouseMoved(with event: NSEvent) {
        guard isUnderPointer(event) else {
            leave(after: event)
            return
        }
        pointerIsCovered = false
        super.mouseMoved(with: event)
    }

    override func mouseEntered(with event: NSEvent) {
        guard isUnderPointer(event) else { return }
        super.mouseEntered(with: event)
    }

    override func mouseExited(with event: NSEvent) {
        pointerIsCovered = false
        super.mouseExited(with: event)
    }

    /// Whether the window would hand a click at the pointer to this view —
    /// the one reading of what is in front that SwiftUI's overlays answer.
    private func isUnderPointer(_ event: NSEvent) -> Bool {
        guard let content = window?.contentView, let frame = content.superview else { return true }
        let hit = content.hitTest(frame.convert(event.locationInWindow, from: nil))
        return hit?.isDescendant(of: self) ?? false
    }

    /// The page's hover, put out: the pointer reported leaving the view
    /// from far outside it, where there is nothing left to hover. WebKit
    /// drops a move outside a first responder's rect, but never an exit.
    private func leave(after event: NSEvent) {
        guard !pointerIsCovered else { return }
        pointerIsCovered = true
        guard let window,
            let away = NSEvent.enterExitEvent(
                with: .mouseExited, location: NSPoint(x: -10_000, y: -10_000),
                modifierFlags: event.modifierFlags, timestamp: event.timestamp,
                windowNumber: window.windowNumber, context: nil, eventNumber: 0, trackingNumber: 0, userData: nil)
        else { return }
        super.mouseExited(with: away)
    }
}
