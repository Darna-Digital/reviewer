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
// Anything of the window's own standing over the page takes the mouse off
// it altogether while it is up (see `isCovered`): the palette is glass, and
// SwiftUI hands the window no view for the parts of it that are only drawn,
// so a wheel turned over them would otherwise find the page behind and
// scroll it. Hit-testing to nothing keeps the click, the wheel and the
// cursor off the page, and a stylesheet hung on the document keeps the
// hover off it too — the one thing no dropped event can reach, since the
// page works out what lies under the pointer from where the pointer is.
//
// A drag is kept off the page by the same one thing, and only by it. Taking
// away the types WebKit registered is not enough and is worse than nothing:
// AppKit finds a drag's destination by hit-testing the window, and a view
// that is under the pointer but takes none of the dragged types ends the
// search where it stands — the drag is refused rather than handed on to the
// drop zone drawn above it, which is SwiftUI and has no view of its own
// this far down. An unregistered web view under a native page therefore
// turned "the page eats every photo let go over the conversation" into
// "nothing anywhere takes one". A covered page is out of the hit test, so
// there is nothing under the pointer but the page drawn over it.
import AppKit
import WebKit

final class IslandWebView: WKWebView {
    private var pointerIsCovered = false

    /// Whether something of the window's own stands over the page — the
    /// palette, or a native page in the island's place. While one does the
    /// view answers the window's hit test with nothing, so every mouse
    /// event and every drag at the pointer goes to what is drawn over it,
    /// and the page is told to be untouchable besides.
    var isCovered = false {
        didSet {
            guard isCovered != oldValue else { return }
            window?.invalidateCursorRects(for: self)
            evaluateJavaScript(Self.coverScript(covered: isCovered)) { _, _ in }
            if isCovered {
                pageDropTypes = registeredDraggedTypes
                unregisterDraggedTypes()
            } else {
                registerForDraggedTypes(pageDropTypes)
            }
            DropDiagnostics.note("island.covered=\(isCovered) kept=\(pageDropTypes.count)")
        }
    }

    /// The page's own drag types while something stands over it, so they
    /// can be given back when it steps away. Read before the unregister and
    /// never after: read after, what comes back is the empty list the
    /// unregister left, and the page never takes a drop again.
    private var pageDropTypes: [NSPasteboard.PasteboardType] = []

    override func hitTest(_ point: NSPoint) -> NSView? {
        isCovered ? nil : super.hitTest(point)
    }

    /// Dropping the page's events is not enough to put its hover out: what
    /// lies under the pointer is worked out from where the pointer is, not
    /// from the events the page was sent, so opening a file while the pane
    /// is up lights the line under the glass as the document lays out,
    /// with no event in it to drop. A page nothing can hit has nothing to
    /// light, so the cover is a stylesheet rather than an event to catch —
    /// hung on the document, outside the app's own root, and taken off
    /// again when the pane goes away.
    private static let coverStyleID = "reviewer-native-cover"

    private static func coverScript(covered: Bool) -> String {
        """
        (() => {
          const cover = document.getElementById('\(coverStyleID)');
          if (!\(covered)) { cover?.remove(); return; }
          if (cover) return;
          const style = document.createElement('style');
          style.id = '\(coverStyleID)';
          style.textContent = '* { pointer-events: none !important; }';
          document.documentElement.appendChild(style);
        })();
        """
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
        DropDiagnostics.note("island.entered covered=\(isCovered)", sender.draggingPasteboard)
        DropDiagnostics.destinations(in: window, at: sender.draggingLocation)
        guard !isCovered else { return [] }
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
