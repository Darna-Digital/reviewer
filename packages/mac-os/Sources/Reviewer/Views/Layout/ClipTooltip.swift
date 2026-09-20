// A tooltip for a line of text that says the whole of it only when the
// line was cut short — the web app's `TruncatedRow`, whose tooltip speaks
// for text the layout ellipsized and stays quiet otherwise, since a
// tooltip that repeats a name already fully on screen is noise over every
// row. It is `PathTooltip`'s panel, so the name comes up as one small
// line beside the pointer rather than the system's wrapped paragraph.
//
// The host is a view laid under the text, the text's own size: it watches
// the pointer, measures the text in the font the text is set in against
// the width it was given, and hands `PathTooltip` the text while it is
// clipped. It takes no clicks — the row under it keeps them all.
import AppKit
import SwiftUI

private struct ClipTooltip: NSViewRepresentable {
    let text: String
    let font: NSFont

    func makeNSView(context: Context) -> ClipTooltipView {
        ClipTooltipView()
    }

    func updateNSView(_ view: ClipTooltipView, context: Context) {
        view.text = text
        view.font = font
    }
}

private final class ClipTooltipView: NSView {
    var text = ""
    var font = NSFont.systemFont(ofSize: NSFont.systemFontSize)
    private var hoverTracking: NSTrackingArea?

    /// Sub-pixel rounding leaves a snugly fitting line a hair "over".
    private static let slack: CGFloat = 1

    override var isFlipped: Bool { true }

    override func hitTest(_ point: NSPoint) -> NSView? { nil }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let hoverTracking { removeTrackingArea(hoverTracking) }
        let tracking = NSTrackingArea(
            rect: .zero, options: [.mouseMoved, .mouseEnteredAndExited, .activeInActiveApp, .inVisibleRect],
            owner: self, userInfo: nil)
        addTrackingArea(tracking)
        hoverTracking = tracking
    }

    private var isClipped: Bool {
        (text as NSString).size(withAttributes: [.font: font]).width > bounds.width + Self.slack
    }

    override func mouseMoved(with event: NSEvent) {
        super.mouseMoved(with: event)
        PathTooltip.shared.hover(isClipped ? text : nil, at: event.locationInWindow, in: window)
    }

    override func mouseExited(with event: NSEvent) {
        super.mouseExited(with: event)
        PathTooltip.shared.hide()
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if window == nil { PathTooltip.shared.hide() }
    }
}

extension View {
    /// The whole of `text` in a tooltip, but only while this view — the
    /// `Text` setting it, in `font` — is too narrow to show it all.
    func clipTooltip(_ text: String, font: NSFont) -> some View {
        background(ClipTooltip(text: text, font: font))
    }
}
