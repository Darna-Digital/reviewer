// The code view: an AppKit text view wrapped for SwiftUI. `TextEditor` cannot
// show attributed text, so this is the one place the shell drops to AppKit for
// its own UI. Non-wrapping, with a line number ruler, undo, and the smart
// quote/dash substitutions off — the things a source buffer needs that a prose
// field has on.
//
// Highlighting is applied over the text view's ordinary storage: after each
// edit settles, the whole text goes to the buffer's queue and the attributes
// that come back replace the old ones in place, leaving the string, the caret
// and the undo stack alone. A result for text that has since changed is
// dropped; the next pass will cover it.
import AppKit
import SwiftUI

struct CodeEditor: NSViewRepresentable {
    typealias NSViewType = CodeEditorContainer

    @Binding var text: String
    let buffer: CodeBuffer
    @Environment(\.colorScheme) private var colorScheme

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text, buffer: buffer)
    }

    func makeNSView(context: Context) -> CodeEditorContainer {
        let scrollView = NSTextView.scrollableTextView()
        let textView = scrollView.documentView as! NSTextView
        // The stock view comes up on TextKit 2 and drops back to TextKit 1
        // the first time `layoutManager` is read. The ruler reads it while
        // drawing, and a text view rebuilt mid-draw leaves the window showing
        // stale frames — so make the switch here, before anything is on screen.
        _ = textView.layoutManager
        textView.delegate = context.coordinator
        textView.isRichText = false
        textView.allowsUndo = true
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticTextReplacementEnabled = false
        textView.textContainerInset = NSSize(width: 6, height: 8)
        let container = CodeEditorContainer(scrollView: scrollView, gutter: LineNumberGutter(textView: textView))
        context.coordinator.textView = textView
        context.coordinator.scrollView = scrollView
        context.coordinator.gutter = container.gutter
        apply(context.coordinator)
        return container
    }

    func updateNSView(_ container: CodeEditorContainer, context: Context) {
        apply(context.coordinator)
    }

    /// Left to its own devices the scroll view offers its document's size as
    /// its fitting size, and SwiftUI would centre that oversized view on the
    /// slot — spilling over the tab strip above. The editor fills whatever
    /// it is given.
    func sizeThatFits(_ proposal: ProposedViewSize, nsView: CodeEditorContainer, context: Context) -> CGSize? {
        proposal.replacingUnspecifiedDimensions(by: CGSize(width: 400, height: 300))
    }

    private func apply(_ coordinator: Coordinator) {
        guard let textView = coordinator.textView else { return }
        let dark = colorScheme == .dark
        let themeChanged = coordinator.isDark != dark
        coordinator.isDark = dark
        if themeChanged { coordinator.applyPlainAppearance() }
        // Only push text in when it actually differs — the usual case is the
        // coordinator having just pushed the very same text out, and
        // replacing it again would reset the caret and the undo stack.
        if textView.string != text {
            textView.string = text
            coordinator.applyPlainAppearance()
            coordinator.scheduleHighlight(after: .zero)
        } else if themeChanged {
            coordinator.scheduleHighlight(after: .zero)
        }
    }

    @MainActor
    final class Coordinator: NSObject, NSTextViewDelegate {
        var text: Binding<String>
        let buffer: CodeBuffer
        weak var textView: NSTextView?
        weak var scrollView: NSScrollView?
        weak var gutter: LineNumberGutter?
        var isDark: Bool?
        private var pending: Task<Void, Never>?

        init(text: Binding<String>, buffer: CodeBuffer) {
            self.text = text
            self.buffer = buffer
        }

        func textDidChange(_ notification: Notification) {
            guard let textView else { return }
            text.wrappedValue = textView.string
            // Long enough to coalesce a burst of typing, short enough that a
            // pause reads as instant.
            scheduleHighlight(after: .milliseconds(120))
        }

        /// The un-highlighted look: the theme's plain colours on every run and
        /// on the typing attributes, so text typed between passes matches.
        func applyPlainAppearance() {
            guard let textView, let scrollView else { return }
            let dark = isDark ?? false
            let hasGrammar = buffer.language != nil
            let foreground = hasGrammar ? CodeBuffer.foreground(dark: dark) : .textColor
            let background = hasGrammar ? CodeBuffer.background(dark: dark) : .textBackgroundColor
            textView.font = CodeBuffer.font
            textView.textColor = foreground
            textView.insertionPointColor = foreground
            textView.typingAttributes = [.font: CodeBuffer.font, .foregroundColor: foreground]
            textView.backgroundColor = background
            scrollView.backgroundColor = background
            gutter?.needsDisplay = true
        }

        func scheduleHighlight(after delay: Duration) {
            pending?.cancel()
            guard buffer.language != nil else { return }
            pending = Task { [weak self] in
                if delay > .zero {
                    try? await Task.sleep(for: delay)
                }
                guard !Task.isCancelled, let self, let textView = self.textView else { return }
                let source = textView.string
                guard let result = await self.buffer.highlight(source, dark: self.isDark ?? false) else { return }
                guard !Task.isCancelled, textView.string == source else { return }
                self.apply(result, to: textView)
            }
        }

        private func apply(_ result: HighlightedCode, to textView: NSTextView) {
            guard let storage = textView.textStorage, result.text.length == storage.length else { return }
            let selection = textView.selectedRanges
            storage.beginEditing()
            result.text.enumerateAttributes(in: NSRange(location: 0, length: result.text.length)) { attributes, range, _ in
                storage.setAttributes(attributes, range: range)
            }
            storage.endEditing()
            textView.selectedRanges = selection
            textView.backgroundColor = result.background
            scrollView?.backgroundColor = result.background
            gutter?.needsDisplay = true
        }
    }
}

/// The gutter and the scroll view side by side. An `NSRulerView` would be the
/// AppKit way to put line numbers on a scroll view, but hosted under SwiftUI
/// on macOS 26 a ruler stalls the window's render commit (`waitForCommitId`
/// never returns) the moment it draws — so the gutter is an ordinary sibling
/// view instead, told about scrolling by the clip view.
final class CodeEditorContainer: NSView {
    let scrollView: NSScrollView
    let gutter: LineNumberGutter

    init(scrollView: NSScrollView, gutter: LineNumberGutter) {
        self.scrollView = scrollView
        self.gutter = gutter
        super.init(frame: .zero)
        addSubview(gutter)
        addSubview(scrollView)
    }

    required init?(coder: NSCoder) {
        fatalError("not used")
    }

    override var isFlipped: Bool { true }

    override func layout() {
        super.layout()
        let width = gutter.thickness
        gutter.frame = NSRect(x: 0, y: 0, width: width, height: bounds.height)
        scrollView.frame = NSRect(x: width, y: 0, width: max(0, bounds.width - width), height: bounds.height)
    }
}

/// Line numbers beside the text. The buffer never wraps and is set in one
/// monospaced face, so every line is the same height and line *n*'s position
/// is arithmetic — the gutter never asks the layout manager for geometry.
final class LineNumberGutter: NSView {
    private weak var textView: NSTextView?
    private var lineCount = 1
    private(set) var thickness: CGFloat = 40

    init(textView: NSTextView) {
        self.textView = textView
        super.init(frame: .zero)
        NotificationCenter.default.addObserver(
            self, selector: #selector(textChanged), name: NSText.didChangeNotification, object: textView)
        if let storage = textView.textStorage {
            NotificationCenter.default.addObserver(
                self, selector: #selector(textChanged), name: NSTextStorage.didProcessEditingNotification, object: storage)
        }
        if let clipView = textView.enclosingScrollView?.contentView {
            clipView.postsBoundsChangedNotifications = true
            NotificationCenter.default.addObserver(
                self, selector: #selector(scrolled), name: NSView.boundsDidChangeNotification, object: clipView)
        }
    }

    required init?(coder: NSCoder) {
        fatalError("not used")
    }

    override var isFlipped: Bool { true }

    @objc private func scrolled() {
        needsDisplay = true
    }

    @objc private func textChanged() {
        let count = (textView?.string ?? "").reduce(into: 1) { total, character in
            if character == "\n" { total += 1 }
        }
        if count != lineCount {
            lineCount = count
            let digits = max(3, String(count).count)
            let wanted = CGFloat(digits) * 8 + 16
            if wanted != thickness {
                thickness = wanted
                superview?.needsLayout = true
            }
        }
        needsDisplay = true
    }

    private var lineHeight: CGFloat {
        let font = textView?.font ?? CodeBuffer.font
        return ceil(font.ascender - font.descender + font.leading)
    }

    override func draw(_ dirtyRect: NSRect) {
        guard let textView else { return }
        textView.backgroundColor.setFill()
        dirtyRect.fill()

        let attributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.monospacedDigitSystemFont(ofSize: 11, weight: .regular),
            .foregroundColor: textView.textColor?.withAlphaComponent(0.45) ?? NSColor.secondaryLabelColor,
        ]
        let visible = textView.visibleRect
        let top = textView.textContainerInset.height
        let height = lineHeight
        let first = max(0, Int((visible.minY - top) / height))
        let last = min(lineCount - 1, Int((visible.maxY - top) / height))
        guard first <= last else { return }
        for line in first...last {
            let y = top + CGFloat(line) * height - visible.minY
            let label = NSAttributedString(string: String(line + 1), attributes: attributes)
            let size = label.size()
            label.draw(at: NSPoint(x: thickness - size.width - 8, y: y + (height - size.height) / 2))
        }
    }
}
