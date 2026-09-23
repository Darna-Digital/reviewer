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
// A drag cannot be kept off the page the same way: AppKit does not ask the
// hit test where a drag goes. It walks the window's views front to back for
// one registered for the dragged types, and WebKit answers that walk for
// its own view itself — with a view under the pointer that takes nothing,
// registered types or not, which ends the walk there. SwiftUI does not keep
// the window's subviews in the order it draws them, and the island's view
// often lands in front of the native page drawn over it, so whether a
// photo let go over a conversation arrived came down to the order SwiftUI
// happened to insert the two in — and every layout change reshuffled it.
// So a covered view is fronted by a view of our own (`CoveredDropProxy`),
// the one sibling in its holder, which is in front of it however SwiftUI
// orders the rest and hands the drag on to the target it was aimed at.
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
            coverDropProxy.isHidden = !isCovered
        }
    }

    /// Laid over the view by whatever holds it (see `IslandView`), and shown
    /// while the view is covered.
    let coverDropProxy: NSView = {
        let proxy = CoveredDropProxy()
        proxy.isHidden = true
        return proxy
    }()

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


/// Takes every drag over a covered island and hands it to the frontmost
/// other drop target under the pointer — the native page's, drawn over the
/// island but behind it in the window's order. Never the mouse's: clicks,
/// the wheel and the cursor go to the page drawn over it as if the proxy
/// were not there.
private final class CoveredDropProxy: NSView {
    private var target: NSDraggingDestination?

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        autoresizingMask = [.width, .height]
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        ZZDropProbe.log.notice("\(String(describing: type(of: self)), privacy: .public) moved window=\(self.window != nil)")
        guard window != nil else { return }
        registerForDraggedTypes([.fileURL, .png, .tiff])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("CoveredDropProxy is made in code") }

    override func hitTest(_ point: NSPoint) -> NSView? { nil }

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        target = targetBeneath(sender)
        let op = target?.draggingEntered?(sender) ?? []
        ZZDropProbe.log.notice("PROXY entered target=\(String(describing: self.target.map { type(of: $0) }), privacy: .public) op=\(op.rawValue) carried=\(sender.draggingPasteboard.types?.count ?? -1)")
        return op
    }

    override func draggingUpdated(_ sender: NSDraggingInfo) -> NSDragOperation {
        let next = targetBeneath(sender)
        guard next === target else {
            target?.draggingExited?(sender)
            target = next
            return next?.draggingEntered?(sender) ?? []
        }
        return next?.draggingUpdated?(sender) ?? []
    }

    override func draggingExited(_ sender: NSDraggingInfo?) {
        target?.draggingExited?(sender)
        target = nil
    }

    override func prepareForDragOperation(_ sender: NSDraggingInfo) -> Bool {
        guard let target else { return false }
        return target.prepareForDragOperation?(sender) ?? true
    }

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        ZZDropProbe.log.notice("PROXY perform target=\(String(describing: self.target.map { type(of: $0) }), privacy: .public)")
        return target?.performDragOperation?(sender) ?? false
    }

    override func concludeDragOperation(_ sender: NSDraggingInfo?) {
        target?.concludeDragOperation?(sender)
    }

    override func draggingEnded(_ sender: NSDraggingInfo) {
        target?.draggingEnded?(sender)
        target = nil
    }

    /// The frontmost view under the drag, outside the island's holder,
    /// registered for any type the drag carries. The window is walked
    /// depth-first in subview order, so the last match is the one in front.
    private func targetBeneath(_ sender: NSDraggingInfo) -> NSDraggingDestination? {
        guard let root = window?.contentView?.superview else { return nil }
        let island = superview ?? self
        let carried = Set(sender.draggingPasteboard.types ?? [])
        let point = sender.draggingLocation
        var frontmost: NSView?
        func visit(_ view: NSView) {
            guard view !== island, !view.isHidden else { return }
            if !carried.isDisjoint(with: view.registeredDraggedTypes), view.bounds.contains(view.convert(point, from: nil)) {
                frontmost = view
            }
            view.subviews.forEach(visit)
        }
        visit(root)
        return frontmost
    }
}
