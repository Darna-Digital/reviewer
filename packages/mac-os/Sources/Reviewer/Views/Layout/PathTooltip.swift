// A tooltip for a path: one line of small type, however long the path is.
// The system's tooltip sets its text in the tooltip font and wraps it at a
// width of its choosing, so a deep path comes up as a paragraph of large
// print; this one draws the path on a single line in 11pt, and only when
// the line would run off the screen does it shorten it in the middle. It
// is a borderless panel dressed in the system's tooltip material, put up
// beside the pointer after the same pause the system takes, and hung under
// the view's window as a child so it keeps to that window's order.
//
// A view hosts it: it tells the tooltip what the pointer is over as the
// pointer moves, and the tooltip takes care of the pause, the switch from
// one text to another without pausing again, and coming down.
import AppKit

@MainActor
final class PathTooltip {
    static let shared = PathTooltip()

    private static let font = NSFont.systemFont(ofSize: 11)
    private static let padding = NSSize(width: 6, height: 3)
    private static let pause: TimeInterval = 0.7
    /// Where the panel's top-left corner goes, from the pointer: below it,
    /// clear of the arrow.
    private static let pointerOffset = NSPoint(x: 0, y: -20)
    private static let screenMargin: CGFloat = 8

    private let panel: NSPanel
    private let label: NSTextField
    private var shownText: String?
    private var pending: DispatchWorkItem?

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
        backdrop.layer?.cornerRadius = 5
        backdrop.layer?.masksToBounds = true

        label = NSTextField(labelWithString: "")
        label.font = Self.font
        label.textColor = IslandPalette.text
        label.usesSingleLineMode = true
        label.maximumNumberOfLines = 1
        label.lineBreakMode = .byTruncatingMiddle
        label.cell?.truncatesLastVisibleLine = true
        backdrop.addSubview(label)
        panel.contentView = backdrop
    }

    /// The pointer is over something with this text, at this point in the
    /// window: the tooltip comes up after the pause, or right away if one
    /// is already up — moving from row to row swaps the text — and moves
    /// with the pointer while the text is the same. `nil` brings it down.
    func hover(_ text: String?, at pointInWindow: NSPoint, in window: NSWindow?) {
        guard let text, let window else {
            hide()
            return
        }
        let point = window.convertPoint(toScreen: pointInWindow)
        if shownText != nil {
            if text != shownText { present(text, at: point, in: window) }
            return
        }
        pending?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.present(text, at: point, in: window) }
        pending = work
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.pause, execute: work)
    }

    func hide() {
        pending?.cancel()
        pending = nil
        guard shownText != nil else { return }
        shownText = nil
        panel.parent?.removeChildWindow(panel)
        panel.orderOut(nil)
    }

    private func present(_ text: String, at point: NSPoint, in window: NSWindow) {
        pending = nil
        shownText = text
        label.stringValue = text
        let screen = (window.screen ?? NSScreen.main)?.visibleFrame ?? .infinite
        let padding = Self.padding
        let widest = screen.width - Self.screenMargin * 2 - padding.width * 2
        let textSize = label.fittingSize
        let width = min(textSize.width, widest)
        let size = NSSize(width: ceil(width + padding.width * 2), height: ceil(textSize.height + padding.height * 2))
        label.frame = NSRect(x: padding.width, y: padding.height, width: width, height: textSize.height)

        var origin = NSPoint(x: point.x + Self.pointerOffset.x, y: point.y + Self.pointerOffset.y - size.height)
        origin.x = min(origin.x, screen.maxX - Self.screenMargin - size.width)
        origin.x = max(origin.x, screen.minX + Self.screenMargin)
        if origin.y < screen.minY + Self.screenMargin { origin.y = point.y + 16 }
        panel.setFrame(NSRect(origin: origin, size: size), display: true)
        if panel.parent !== window {
            panel.parent?.removeChildWindow(panel)
            window.addChildWindow(panel, ordered: .above)
        }
        panel.orderFront(nil)
    }
}
