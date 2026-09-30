// The tooltip a list row gives a name it had to cut — the web app's
// `TruncatedRow`, as the Electron build had it: it comes up the moment the
// row is pointed at, with no pause, sits flush against the row's trailing
// edge like a submenu opening off it, centred on the row, and says the
// whole name, wrapped over as many lines as it takes. The system's `.help`
// could say the name too, but a second late, under the pointer, over the
// rows beside it, and gone the moment the pointer moves — too slow and
// too far away to read one branch name after another down a list.
//
// It stays on the trailing side wherever the row is on screen: left to
// flip, a list near the screen's right edge would speak from its left and
// the same list in the middle from its right. Its width is capped to the
// room on that side, so it wraps into the space it has, and only when
// even that is too little does it shift back over the row.
//
// A row speaks only for text the layout cut (see `measuringClip`), and
// only while it is the row being read — pointed at, or lit by the keys.
// It is a borderless panel in the system's tooltip material, hung under
// the row's window as a child so it keeps to that window's order, the
// popover's included; it follows the row as the list scrolls, comes down
// once the row scrolls out of sight, and steps aside while a menu — the
// row's own, at its ellipsis or on a right click — is up.
import AppKit
import SwiftUI

@MainActor
final class RowTooltip {
    static let shared = RowTooltip()

    private static let font = NSFont.systemFont(ofSize: 12)
    private static let padding = NSSize(width: 8, height: 5)
    /// The web tooltip's `max-w-[40rem]`.
    private static let widest: CGFloat = 640
    /// Narrower than this and a branch name is a column of letters, so the
    /// tooltip shifts back over the row rather than squeezing further.
    private static let narrowest: CGFloat = 160
    private static let screenMargin: CGFloat = 8

    private let panel: NSPanel
    private let label: NSTextField
    private weak var owner: NSView?
    private var shown: (text: String, beside: NSRect)?
    private var menuOpen = false

    private init() {
        panel = NSPanel(
            contentRect: .zero, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: true)
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.ignoresMouseEvents = true
        panel.hidesOnDeactivate = true
        panel.isReleasedWhenClosed = false
        panel.animationBehavior = .none

        let backdrop = NSVisualEffectView()
        backdrop.material = .toolTip
        backdrop.blendingMode = .behindWindow
        backdrop.state = .active
        backdrop.wantsLayer = true
        backdrop.layer?.cornerRadius = 6
        backdrop.layer?.masksToBounds = true

        label = NSTextField(wrappingLabelWithString: "")
        label.font = Self.font
        label.textColor = IslandPalette.text
        label.lineBreakMode = .byWordWrapping
        backdrop.addSubview(label)
        panel.contentView = backdrop

        let center = NotificationCenter.default
        center.addObserver(forName: NSMenu.didBeginTrackingNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated {
                self?.menuOpen = true
                self?.takeDown()
            }
        }
        center.addObserver(forName: NSMenu.didEndTrackingNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.menuOpen = false }
        }
    }

    /// `row` — a rect on screen — has `text` to say: the tooltip comes up
    /// beside it at once, or moves to it from whichever row had it.
    fileprivate func show(_ text: String, beside row: NSRect, in window: NSWindow, for anchor: NSView) {
        guard !menuOpen else { return }
        owner = anchor
        if let shown, shown.text == text, shown.beside == row, panel.isVisible { return }
        shown = (text, row)
        present(text, beside: row, in: window)
    }

    /// Brought down by the row that put it up; a row it has since moved
    /// on from has no say, so the order rows change hands in is moot.
    fileprivate func hide(for anchor: NSView) {
        guard owner === anchor else { return }
        takeDown()
    }

    private func takeDown() {
        owner = nil
        shown = nil
        panel.parent?.removeChildWindow(panel)
        panel.orderOut(nil)
    }

    private func present(_ text: String, beside row: NSRect, in window: NSWindow) {
        label.stringValue = text
        let screen = (window.screen ?? NSScreen.main)?.visibleFrame ?? .infinite
        let padding = Self.padding
        let room = screen.maxX - Self.screenMargin - row.maxX
        let width = min(Self.widest, max(room, Self.narrowest))
        let textSize = label.cell?.cellSize(
            forBounds: NSRect(x: 0, y: 0, width: width - padding.width * 2, height: .greatestFiniteMagnitude))
            ?? label.fittingSize
        let size = NSSize(
            width: ceil(textSize.width + padding.width * 2), height: ceil(textSize.height + padding.height * 2))
        label.frame = NSRect(x: padding.width, y: padding.height, width: ceil(textSize.width), height: ceil(textSize.height))

        var origin = NSPoint(x: row.maxX, y: row.midY - size.height / 2)
        origin.x = min(origin.x, screen.maxX - Self.screenMargin - size.width)
        origin.y = min(max(origin.y, screen.minY + Self.screenMargin), screen.maxY - Self.screenMargin - size.height)
        panel.setFrame(NSRect(origin: origin, size: size), display: true)
        if panel.parent !== window {
            panel.parent?.removeChildWindow(panel)
            window.addChildWindow(panel, ordered: .above)
        }
        panel.orderFront(nil)
    }
}

/// Laid under a row, the size of the row, to say where the tooltip goes
/// and when: `text` while the row has something cut to say, `active`
/// while it is the row being read.
private struct RowTooltipAnchor: NSViewRepresentable {
    let text: String?
    let active: Bool

    func makeNSView(context: Context) -> RowTooltipAnchorView {
        RowTooltipAnchorView()
    }

    func updateNSView(_ view: RowTooltipAnchorView, context: Context) {
        view.text = text
        view.active = active
        view.sync()
    }

    static func dismantleNSView(_ view: RowTooltipAnchorView, coordinator: ()) {
        view.retract()
    }
}

private final class RowTooltipAnchorView: NSView {
    var text: String?
    var active = false
    private var scrollObserver: NSObjectProtocol?

    /// Less of the row than this on screen and it is scrolled out of
    /// sight: a tooltip pointing at a sliver of a row points at nothing.
    private static let visibleShare: CGFloat = 0.5

    override func hitTest(_ point: NSPoint) -> NSView? { nil }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        stopFollowingScroll()
        sync()
    }

    override func setFrameSize(_ newSize: NSSize) {
        super.setFrameSize(newSize)
        sync()
    }

    func sync() {
        guard active, let text, let window, window.isVisible else {
            stopFollowingScroll()
            retract()
            return
        }
        followScroll()
        guard visibleRect.height >= bounds.height * Self.visibleShare else {
            retract()
            return
        }
        let row = window.convertToScreen(convert(bounds, to: nil))
        RowTooltip.shared.show(text, beside: row, in: window, for: self)
    }

    func retract() {
        RowTooltip.shared.hide(for: self)
    }

    /// A row moves under the tooltip as its list scrolls — by the wheel, or
    /// by the keys walking past the fold — without its frame changing, so
    /// the list's scrolling is what moves the tooltip with it. Only the row
    /// being read watches: a watch on every row would have the whole list
    /// answering every tick of a scroll. The watch is dropped as the row
    /// leaves its window, which SwiftUI does before letting it go.
    private func followScroll() {
        guard scrollObserver == nil, let clip = enclosingScrollView?.contentView else { return }
        clip.postsBoundsChangedNotifications = true
        scrollObserver = NotificationCenter.default.addObserver(
            forName: NSView.boundsDidChangeNotification, object: clip, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.sync() }
        }
    }

    private func stopFollowingScroll() {
        if let scrollObserver { NotificationCenter.default.removeObserver(scrollObserver) }
        scrollObserver = nil
    }
}

extension View {
    /// This row's cut `text` said whole in a `RowTooltip` at its trailing
    /// edge while `active` — nil `text` for a row with nothing cut.
    func rowTooltip(_ text: String?, active: Bool) -> some View {
        background(RowTooltipAnchor(text: text, active: active))
    }
}
