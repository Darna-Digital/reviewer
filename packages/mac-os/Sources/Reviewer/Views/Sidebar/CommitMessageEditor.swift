// The commit message box: a plain `NSTextView` in a scroll view, standing
// in for `TextEditor` because the draft controls float over its bottom
// corner and the pointer over them has to be the arrow. The `NSTextView`
// under a `TextEditor` gives that up only while it is empty — once it has
// text it re-sets the I-beam on every `mouseMoved`, and a tracking area is
// not occluded by what SwiftUI layers above it, so no pointer style or
// pushed cursor from the controls' side holds. Owning the view, the box is
// told when the controls are under the pointer and yields the arrow itself.
import AppKit
import SwiftUI

struct CommitMessageEditor: NSViewRepresentable {
    @Binding var text: String
    @Binding var focused: Bool
    /// The clearance the text scrolls through under the floating controls.
    let bottomClearance: CGFloat
    /// True while the controls are under the pointer, when the box shows
    /// the arrow in place of its I-beam.
    let pointerYieldsToControls: Bool
    let onCommit: () -> Void

    private static let font = NSFont.systemFont(ofSize: 12)

    func makeCoordinator() -> Coordinator { Coordinator(text: $text) }

    func makeNSView(context: Context) -> NSScrollView {
        let textView = CommitMessageTextView(frame: .zero)
        textView.delegate = context.coordinator
        textView.isRichText = false
        textView.allowsUndo = true
        textView.drawsBackground = false
        textView.focusRingType = .none
        textView.font = Self.font
        textView.textColor = .labelColor
        textView.typingAttributes = [.font: Self.font, .foregroundColor: NSColor.labelColor]
        textView.textContainerInset = .zero
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.autoresizingMask = [.width]
        textView.minSize = .zero
        textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
        textView.textContainer?.widthTracksTextView = true
        textView.textContainer?.size = NSSize(width: 0, height: CGFloat.greatestFiniteMagnitude)

        let scrollView = NSScrollView()
        scrollView.drawsBackground = false
        scrollView.borderType = .noBorder
        scrollView.hasVerticalScroller = true
        scrollView.autohidesScrollers = true
        // The clearance is the content's alone, as the web textarea's bottom
        // padding is: the scroller still runs the box's full height.
        scrollView.automaticallyAdjustsContentInsets = false
        scrollView.contentInsets = NSEdgeInsets(top: 0, left: 0, bottom: bottomClearance, right: 0)
        scrollView.scrollerInsets = NSEdgeInsets(top: 0, left: 0, bottom: -bottomClearance, right: 0)
        scrollView.documentView = textView
        return scrollView
    }

    func updateNSView(_ scrollView: NSScrollView, context: Context) {
        guard let textView = scrollView.documentView as? CommitMessageTextView else { return }
        context.coordinator.text = $text
        if textView.string != text {
            textView.string = text
            textView.font = Self.font
        }
        textView.pointerYieldsToControls = pointerYieldsToControls
        textView.onCommit = onCommit
        textView.onFocusChange = { focused = $0 }
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        var text: Binding<String>

        init(text: Binding<String>) { self.text = text }

        func textDidChange(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else { return }
            text.wrappedValue = textView.string
        }
    }
}

final class CommitMessageTextView: NSTextView {
    var pointerYieldsToControls = false
    var onCommit: (() -> Void)?
    var onFocusChange: ((Bool) -> Void)?

    // Both of the text view's cursor paths end in the arrow while the
    // controls are under the pointer: the cursor rect it registers for its
    // bounds, and the per-move update it makes over text.
    override func mouseMoved(with event: NSEvent) {
        super.mouseMoved(with: event)
        if pointerYieldsToControls { NSCursor.arrow.set() }
    }

    override func cursorUpdate(with event: NSEvent) {
        if pointerYieldsToControls {
            NSCursor.arrow.set()
        } else {
            super.cursorUpdate(with: event)
        }
    }

    // ⌘↩ commits from the message box alone. As the Commit button's key
    // equivalent it answered window-wide, so the same chord in a comment
    // field in the web view committed the tree instead of posting the
    // comment; here it fires only while the message has focus.
    override func keyDown(with event: NSEvent) {
        let isReturn = event.keyCode == 36
        let modifiers = event.modifierFlags.intersection([.command, .shift, .option, .control])
        if isReturn, modifiers == .command {
            onCommit?()
            return
        }
        super.keyDown(with: event)
    }

    override func becomeFirstResponder() -> Bool {
        let became = super.becomeFirstResponder()
        if became { onFocusChange?(true) }
        return became
    }

    override func resignFirstResponder() -> Bool {
        let resigned = super.resignFirstResponder()
        if resigned { onFocusChange?(false) }
        return resigned
    }
}
