// The system tooltip for a line of text, but only while the line was cut
// short — the web app's `TruncatedRow`, whose tooltip speaks for text the
// layout ellipsized and stays quiet otherwise, since a tooltip that
// repeats a name already fully on screen is noise over every row.
//
// Whether the line is cut is measured by a view laid under the text, the
// text's own size: the text in the font it is set in, against the width
// the layout gave it. The measure lands in state, and the `.help` says
// the text only while it holds. It takes no clicks.
import AppKit
import SwiftUI

private struct ClipHelp: ViewModifier {
    let text: String
    let font: NSFont
    @State private var clipped = false

    // One view either way — an empty help is no tooltip — since swapping
    // the view for one with the help on lays the text out afresh, at a
    // width that may measure the other way, and the swap is animated.
    func body(content: Content) -> some View {
        content
            .background(ClipMeasure(text: text, font: font, clipped: $clipped))
            .help(clipped ? text : "")
    }
}

private struct ClipMeasure: NSViewRepresentable {
    let text: String
    let font: NSFont
    @Binding var clipped: Bool

    func makeNSView(context: Context) -> ClipMeasureView {
        ClipMeasureView()
    }

    func updateNSView(_ view: ClipMeasureView, context: Context) {
        view.text = text
        view.font = font
        view.onMeasure = { value in
            // Laid out mid-update: the state is set once the update is over.
            Task { @MainActor in
                if clipped != value { clipped = value }
            }
        }
        view.measure()
    }
}

private final class ClipMeasureView: NSView {
    var text = "" { didSet { if text != oldValue { measure() } } }
    var font = NSFont.systemFont(ofSize: NSFont.systemFontSize)
    var onMeasure: ((Bool) -> Void)?

    /// Sub-pixel rounding leaves a snugly fitting line a hair "over".
    private static let slack: CGFloat = 1

    override func hitTest(_ point: NSPoint) -> NSView? { nil }

    /// The width comes from the layout setting the frame, not from a
    /// layout pass of this view's own — it has no subviews to lay out —
    /// so the measure is taken as the frame is set.
    override func setFrameSize(_ newSize: NSSize) {
        super.setFrameSize(newSize)
        measure()
    }

    func measure() {
        guard bounds.width > 0 else { return }
        let wanted = (text as NSString).size(withAttributes: [.font: font]).width
        onMeasure?(wanted > bounds.width + Self.slack)
    }
}

extension View {
    /// The whole of `text` as the system tooltip, but only while this view
    /// — the `Text` setting it, in `font` — is too narrow to show it all.
    func clipHelp(_ text: String, font: NSFont) -> some View {
        modifier(ClipHelp(text: text, font: font))
    }
}
