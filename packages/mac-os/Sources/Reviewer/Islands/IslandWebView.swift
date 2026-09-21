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
//
// A drag is kept off the page the same way, but ahead of time rather than
// per event: AppKit hands a drag to the frontmost view registered for its
// types, and the chat page the shell draws over this view is SwiftUI, with
// no view of its own for AppKit to find — so the page would take every
// image let go over the conversation, into a document showing nothing. The
// host says when a native page stands over the island (see `acceptsDrops`),
// and the types WebKit registered are put away until it steps back.
import AppKit
import WebKit

final class IslandWebView: WKWebView {
    private var pointerIsCovered = false
    private lazy var pageDropTypes = registeredDraggedTypes

    var acceptsDrops = true {
        didSet {
            guard acceptsDrops != oldValue else { return }
            if acceptsDrops {
                registerForDraggedTypes(pageDropTypes)
            } else {
                unregisterDraggedTypes()
            }
            DropDiagnostics.note("island.acceptsDrops=\(acceptsDrops) registered=\(registeredDraggedTypes.count)")
        }
    }

    /// No WebKit menu over the code: a right-click is the page's to answer
    /// — the symbol menu over an identifier, nothing elsewhere — and the
    /// stock "Look Up", "Search with Google" and friends only stand in its
    /// way. Emptied rather than refused, since AppKit shows no menu with
    /// nothing in it — and told to stay empty, since AppKit would otherwise
    /// add "Services" of its own once the menu is on screen.
    override func willOpenMenu(_ menu: NSMenu, with event: NSEvent) {
        menu.allowsContextMenuPlugIns = false
        menu.removeAllItems()
    }

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        DropDiagnostics.note("island.entered", sender.draggingPasteboard)
        return super.draggingEntered(sender)
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
