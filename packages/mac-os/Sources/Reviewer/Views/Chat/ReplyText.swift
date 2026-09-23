// An agent's reply, drawn as one run of selectable text: prose, lists,
// quotes, tables and the code snippets between them all in a single
// `NSTextView`, so a drag that starts in a sentence carries on through the
// snippet under it and ⌘C takes the lot.
//
// `MarkdownText` draws the same markdown as a column of SwiftUI `Text`s,
// and SwiftUI selects within one `Text` and never across two — every
// paragraph was an island of its own, and a snippet in its horizontal
// scroll view another, so copying a reply meant copying it a block at a
// time. Here the blocks are the text system's own instead: each code
// snippet, quote and table is an `NSTextBlock` the paragraphs inside it
// belong to, which is what lets them wear a box, a bar or a grid and still
// be characters in the one string. That needs TextKit 1 — TextKit 2 has no
// text blocks — so the view is made on the older layout manager outright.
//
// The price is that a snippet wraps at the column's edge rather than
// scrolling sideways, which a single text container cannot do for one
// block of it; wrapped, a long line is at least all there to be read and
// selected.
//
// The measures are `MarkdownMetrics`', the same ones `MarkdownText` sets,
// so a reply reads as it did; the colours are the island palette's, which
// resolve at draw time and follow the theme. Snippets are coloured as
// `CodeBlock` colours them — through `CodeHighlights`, plain first and
// coloured once the server answers.
import AppKit
import SwiftUI

struct ReplyText: View {
    let text: String
    var size: CGFloat = ChatLayout.bodySize

    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.openURL) private var openURL
    @State private var highlights: [CodeHighlightRequest: HighlightedCode] = [:]

    var body: some View {
        let metrics = MarkdownMetrics(size: size)
        let blocks = MarkdownBlock.parse(text, code: metrics.codeFont)
        let theme = ChromePalette.shared.themeName(for: colorScheme == .dark ? .dark : .light)
        let snippets = ReplySnippet.all(in: blocks, theme: theme)
        let document = ReplyDocument(metrics: metrics, theme: theme, highlights: highlights).build(blocks)
        SelectableText(document: document, openURL: openURL)
            .task(id: snippets) { await paint(snippets) }
    }

    /// Colours every snippet the reply holds, one at a time, each landing
    /// as it is answered. An open fence — the tail of a reply still being
    /// written — is left to settle first, as `CodeBlock` leaves it.
    private func paint(_ snippets: [ReplySnippet]) async {
        let wanted = Set(snippets.map(\.request))
        if highlights.keys.contains(where: { !wanted.contains($0) }) {
            highlights = highlights.filter { wanted.contains($0.key) }
        }
        for snippet in snippets where highlights[snippet.request] == nil {
            if let held = await CodeHighlights.shared.held(snippet.request) {
                highlights[snippet.request] = held
                continue
            }
            if !snippet.closed {
                try? await Task.sleep(for: CodeBlock.settle)
            }
            guard !Task.isCancelled else { return }
            if let read = await CodeHighlights.shared.highlight(snippet.request), !Task.isCancelled {
                highlights[snippet.request] = read
            }
        }
    }
}

/// One fenced snippet in a reply, as it is asked to be coloured.
private struct ReplySnippet: Hashable {
    let request: CodeHighlightRequest
    let closed: Bool

    static func all(in blocks: [MarkdownBlock], theme: String) -> [ReplySnippet] {
        blocks.compactMap { block in
            guard case .code(let code, let lang, let closed) = block else { return nil }
            return ReplySnippet(request: CodeHighlightRequest(code: code, lang: lang, theme: theme), closed: closed)
        }
    }
}

/// The reply's blocks written out as one attributed string, in the
/// proportions `MarkdownText` lays its column out in: a block's gap after
/// it as paragraph spacing, a list's marker hung in its column, and the
/// boxed blocks as text blocks around their paragraphs.
///
/// TextKit adds a paragraph's line spacing under its last line as well as
/// between its lines, where SwiftUI's `lineSpacing` stops at the last; so
/// the spacing after a paragraph is its gap less the leading already
/// under it, which lands the next block where the column put it.
@MainActor
private struct ReplyDocument {
    let metrics: MarkdownMetrics
    let theme: String
    let highlights: [CodeHighlightRequest: HighlightedCode]

    private static let codeInset = NSSize(width: 10, height: 8)
    private static let cellInset = NSSize(width: 10, height: 6)
    private static let codeCorner: CGFloat = 6
    private static let markerGap: CGFloat = 6
    private static let quoteBar: CGFloat = 2
    private static let quoteGap: CGFloat = 8

    private var bodyFont: NSFont { .systemFont(ofSize: metrics.size) }
    /// A point down from the body, as `MarkdownMetrics.codeFont` sets it.
    private var codeFont: NSFont { .monospacedSystemFont(ofSize: metrics.size - 1, weight: .regular) }

    private func headingFont(_ level: Int) -> NSFont {
        .systemFont(ofSize: metrics.size + (level == 1 ? 3 : level == 2 ? 1 : 0), weight: .semibold)
    }

    func build(_ blocks: [MarkdownBlock]) -> NSAttributedString {
        let document = NSMutableAttributedString()
        for (index, block) in blocks.enumerated() {
            let gapAfter = index == blocks.count - 1 ? 0 : metrics.blockGap
            switch block {
            case .heading(let level, let text):
                let style = paragraphStyle {
                    $0.paragraphSpacingBefore = index == 0 ? 0 : metrics.headingGap
                    $0.paragraphSpacing = gapAfter
                }
                document.append(line(text, font: headingFont(level), color: IslandPalette.text, style: style))
            case .paragraph(let text):
                document.append(line(text, font: bodyFont, color: IslandPalette.text, style: prose(gapAfter: gapAfter)))
            case .list(let items, let ordered):
                for (number, item) in items.enumerated() {
                    let gap = number == items.count - 1 ? gapAfter : metrics.itemGap
                    document.append(listItem(item, marker: ordered ? "\(number + 1)." : "•", gapAfter: gap))
                }
            case .code(let code, let lang, _):
                document.append(snippet(code, lang: lang, gapAfter: gapAfter))
            case .quote(let text):
                document.append(quote(text, gapAfter: gapAfter))
            case .rule:
                document.append(rule(gapAfter: gapAfter))
            case .table(let header, let rows, let alignments):
                document.append(table(header: header, rows: rows, alignments: alignments, gapAfter: gapAfter))
            }
        }
        // The last paragraph's newline would open an empty line under the
        // reply and stand it a line taller than its text.
        if document.string.hasSuffix("\n") {
            document.deleteCharacters(in: NSRange(location: document.length - 1, length: 1))
        }
        return document
    }

    private func prose(gapAfter: CGFloat) -> NSParagraphStyle {
        paragraphStyle {
            $0.lineSpacing = metrics.leading
            $0.paragraphSpacing = max(0, gapAfter - metrics.leading)
        }
    }

    /// A list item with its marker hung to the left of the text, right
    /// against the marker column's edge as `MarkdownText` sets it, so a
    /// wrapped line starts under the item's first word. The marker is a
    /// character of the text like any other, and comes along when the list
    /// is copied.
    private func listItem(_ text: AttributedString, marker: String, gapAfter: CGFloat) -> NSAttributedString {
        let markerFont = NSFont.monospacedDigitSystemFont(ofSize: metrics.size, weight: .regular)
        let markerWidth = (marker as NSString).size(withAttributes: [.font: markerFont]).width
        let indent = metrics.markerColumn + Self.markerGap
        let style = paragraphStyle {
            $0.lineSpacing = metrics.leading
            $0.paragraphSpacing = max(0, gapAfter - metrics.leading)
            $0.firstLineHeadIndent = max(0, metrics.markerColumn - markerWidth)
            $0.headIndent = indent
            $0.tabStops = [NSTextTab(textAlignment: .left, location: indent)]
        }
        let item = NSMutableAttributedString(
            string: marker + "\t",
            attributes: [.font: markerFont, .foregroundColor: IslandPalette.textSecondary, .paragraphStyle: style])
        item.append(line(text, font: bodyFont, color: IslandPalette.text, style: style))
        return item
    }

    /// A fenced snippet: every line of it a paragraph of the one rounded
    /// box, coloured where the server has answered for it and in the
    /// body's ink until then.
    private func snippet(_ code: String, lang: String, gapAfter: CGFloat) -> NSAttributedString {
        let box = WashBlock(fill: wash(0.5), corner: Self.codeCorner)
        box.spanColumn()
        box.setPadding(horizontal: Self.codeInset.width, top: Self.codeInset.height,
                       // Under the last line TextKit has already put the
                       // code's leading, which the box's own inset makes up.
                       bottom: max(0, Self.codeInset.height - metrics.codeLeading))
        box.setWidth(gapAfter, type: .absoluteValueType, for: .margin, edge: .maxY)
        let style = paragraphStyle {
            $0.textBlocks = [box]
            $0.lineSpacing = metrics.codeLeading
        }
        let request = CodeHighlightRequest(code: code, lang: lang, theme: theme)
        let text = highlights[request].map(coloured) ?? NSMutableAttributedString(
            string: code, attributes: [.font: codeFont, .foregroundColor: IslandPalette.text])
        text.append(NSAttributedString(string: "\n", attributes: [.font: codeFont]))
        text.addAttribute(.paragraphStyle, value: style, range: NSRange(location: 0, length: text.length))
        return text
    }

    /// The server's tokens as runs of the code face, the way `CodeBlock`
    /// paints them: a token the theme gives no colour takes the code's
    /// foreground where the theme names one, and the body's ink otherwise.
    private func coloured(_ highlighted: HighlightedCode) -> NSMutableAttributedString {
        let plain = highlighted.foreground.map(NSColor.init(hex:)) ?? IslandPalette.text
        let text = NSMutableAttributedString()
        for (index, tokens) in highlighted.lines.enumerated() {
            if index > 0 { text.append(NSAttributedString(string: "\n", attributes: [.font: codeFont])) }
            for token in tokens {
                var traits: NSFontDescriptor.SymbolicTraits = []
                if token.italic == true { traits.insert(.italic) }
                if token.bold == true { traits.insert(.bold) }
                text.append(NSAttributedString(string: token.text, attributes: [
                    .font: codeFont.adding(traits),
                    .foregroundColor: token.color.map(NSColor.init(hex:)) ?? plain,
                ]))
            }
        }
        return text
    }

    /// A quote set off by a bar down its leading edge and in the muted ink.
    private func quote(_ text: AttributedString, gapAfter: CGFloat) -> NSAttributedString {
        let bar = NSTextBlock()
        bar.spanColumn()
        bar.setWidth(Self.quoteBar, type: .absoluteValueType, for: .border, edge: .minX)
        bar.setBorderColor(wash(1), for: .minX)
        bar.setWidth(Self.quoteGap, type: .absoluteValueType, for: .padding, edge: .minX)
        bar.setWidth(gapAfter, type: .absoluteValueType, for: .margin, edge: .maxY)
        let style = paragraphStyle {
            $0.textBlocks = [bar]
            $0.lineSpacing = metrics.leading
        }
        return line(text, font: bodyFont, color: IslandPalette.textSecondary, style: style)
    }

    /// A rule: an empty line of next to no height, with the hairline under it.
    private func rule(gapAfter: CGFloat) -> NSAttributedString {
        let rule = NSTextBlock()
        rule.spanColumn()
        rule.setWidth(1, type: .absoluteValueType, for: .border, edge: .maxY)
        rule.setBorderColor(IslandPalette.hairline, for: .maxY)
        rule.setWidth(gapAfter, type: .absoluteValueType, for: .margin, edge: .maxY)
        let style = paragraphStyle { $0.textBlocks = [rule] }
        return NSAttributedString(string: "\n", attributes: [.font: NSFont.systemFont(ofSize: 1), .paragraphStyle: style])
    }

    /// A pipe table as the text system's own: a cell block per cell, the
    /// borders collapsed into one hairline grid, the header in semibold.
    private func table(
        header: [AttributedString], rows: [[AttributedString]], alignments: [MarkdownColumnAlignment], gapAfter: CGFloat
    ) -> NSAttributedString {
        let grid = NSTextTable()
        grid.numberOfColumns = header.count
        grid.collapsesBorders = true
        grid.hidesEmptyCells = false
        let headerFont = NSFont.systemFont(ofSize: metrics.size, weight: .semibold)
        let text = NSMutableAttributedString()
        for (row, cells) in ([header] + rows).enumerated() {
            for (column, cell) in cells.enumerated() {
                let block = NSTextTableBlock(table: grid, startingRow: row, rowSpan: 1, startingColumn: column, columnSpan: 1)
                block.setWidth(1, type: .absoluteValueType, for: .border)
                block.setBorderColor(IslandPalette.hairline)
                block.setPadding(horizontal: Self.cellInset.width, top: Self.cellInset.height, bottom: Self.cellInset.height)
                let style = paragraphStyle {
                    $0.textBlocks = [block]
                    $0.alignment = alignments[column].paragraph
                }
                text.append(line(cell, font: row == 0 ? headerFont : bodyFont, color: IslandPalette.text, style: style))
            }
        }
        // A table takes no margin of its own under it, as the other
        // blocks do, so the gap is an empty line of just that height.
        if gapAfter > 0 {
            let spacer = paragraphStyle {
                $0.minimumLineHeight = gapAfter
                $0.maximumLineHeight = gapAfter
            }
            text.append(NSAttributedString(string: "\n", attributes: [.font: NSFont.systemFont(ofSize: 1), .paragraphStyle: spacer]))
        }
        return text
    }

    /// One paragraph of inline markdown — emphasis, strong, code spans,
    /// strikes and links read off the runs the parser marked — closed by
    /// its newline.
    private func line(_ text: AttributedString, font: NSFont, color: NSColor, style: NSParagraphStyle) -> NSAttributedString {
        let result = NSMutableAttributedString()
        for run in text.runs {
            let intent = run.inlinePresentationIntent ?? []
            var traits: NSFontDescriptor.SymbolicTraits = []
            if intent.contains(.stronglyEmphasized) { traits.insert(.bold) }
            if intent.contains(.emphasized) { traits.insert(.italic) }
            var attributes: [NSAttributedString.Key: Any] = [
                .font: (intent.contains(.code) ? codeFont : font).adding(traits),
                .foregroundColor: color,
                .paragraphStyle: style,
            ]
            if intent.contains(.strikethrough) { attributes[.strikethroughStyle] = NSUnderlineStyle.single.rawValue }
            if let link = run.link { attributes[.link] = link }
            result.append(NSAttributedString(string: String(text[run.range].characters), attributes: attributes))
        }
        result.append(NSAttributedString(string: "\n", attributes: [.font: font, .paragraphStyle: style]))
        return result
    }

    private func paragraphStyle(_ configure: (NSMutableParagraphStyle) -> Void) -> NSParagraphStyle {
        let style = NSMutableParagraphStyle()
        configure(style)
        return style
    }

    /// The faint fill `QuaternaryWash` gives SwiftUI, in AppKit's terms:
    /// the ink at a tenth of its strength, times the share.
    private func wash(_ share: CGFloat) -> NSColor {
        IslandPalette.text.withAlphaComponent(0.1 * share)
    }
}

/// A text block that fills its box with rounded corners, where
/// `NSTextBlock`'s own background is a square one.
private final class WashBlock: NSTextBlock {
    private let fill: NSColor
    private let corner: CGFloat

    init(fill: NSColor, corner: CGFloat) {
        self.fill = fill
        self.corner = corner
        super.init()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    // The frame handed in runs out to the block's margins; the box is
    // drawn inside them, where the square background would be.
    override func drawBackground(
        withFrame frameRect: NSRect, in controlView: NSView?, characterRange charRange: NSRange,
        layoutManager: NSLayoutManager
    ) {
        let box = NSRect(
            x: frameRect.minX + width(for: .margin, edge: .minX),
            y: frameRect.minY + width(for: .margin, edge: .minY),
            width: frameRect.width - width(for: .margin, edge: .minX) - width(for: .margin, edge: .maxX),
            height: frameRect.height - width(for: .margin, edge: .minY) - width(for: .margin, edge: .maxY))
        fill.setFill()
        NSBezierPath(roundedRect: box, xRadius: corner, yRadius: corner).fill()
    }
}

private extension NSTextBlock {
    /// Runs the block the full width of the column. A block given no width
    /// of its own is not laid out as a block at all — its padding lands on
    /// the first line only and its background is never drawn.
    func spanColumn() {
        setContentWidth(100, type: .percentageValueType)
    }

    func setPadding(horizontal: CGFloat, top: CGFloat, bottom: CGFloat) {
        setWidth(horizontal, type: .absoluteValueType, for: .padding, edge: .minX)
        setWidth(horizontal, type: .absoluteValueType, for: .padding, edge: .maxX)
        setWidth(top, type: .absoluteValueType, for: .padding, edge: .minY)
        setWidth(bottom, type: .absoluteValueType, for: .padding, edge: .maxY)
    }
}

private extension NSFont {
    func adding(_ traits: NSFontDescriptor.SymbolicTraits) -> NSFont {
        guard !traits.isEmpty else { return self }
        let descriptor = fontDescriptor.withSymbolicTraits(fontDescriptor.symbolicTraits.union(traits))
        return NSFont(descriptor: descriptor, size: pointSize) ?? self
    }
}

private extension MarkdownColumnAlignment {
    var paragraph: NSTextAlignment {
        switch self {
        case .leading: return .natural
        case .center: return .center
        case .trailing: return .right
        }
    }
}

/// A read-only `NSTextView` sized to its text at the width it is offered,
/// standing in the SwiftUI layout as a `Text` would. A link in it goes
/// through the environment's `openURL`, so a file a reply names opens on
/// the browse page as it does from anywhere else in the conversation.
struct SelectableText: NSViewRepresentable {
    let document: NSAttributedString
    let openURL: OpenURLAction

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> NSTextView {
        let textView = SelectableTextView(usingTextLayoutManager: false)
        textView.isEditable = false
        textView.isSelectable = true
        textView.isRichText = true
        textView.drawsBackground = false
        textView.textContainerInset = .zero
        textView.textContainer?.lineFragmentPadding = 0
        textView.textContainer?.widthTracksTextView = true
        textView.isVerticallyResizable = false
        textView.isHorizontallyResizable = false
        textView.linkTextAttributes = [.foregroundColor: IslandPalette.link, .cursor: NSCursor.pointingHand]
        textView.delegate = context.coordinator
        return textView
    }

    func updateNSView(_ textView: NSTextView, context: Context) {
        context.coordinator.openURL = openURL
        guard let storage = textView.textStorage, !storage.isEqual(to: document) else { return }
        // A reply streaming in is rewritten a token at a time; what the
        // reader has selected in it so far stays selected through that.
        let selection = textView.selectedRange()
        storage.setAttributedString(document)
        if NSMaxRange(selection) <= storage.length {
            textView.setSelectedRange(selection)
        }
    }

    func sizeThatFits(_ proposal: ProposedViewSize, nsView textView: NSTextView, context: Context) -> CGSize? {
        guard let width = proposal.width, width.isFinite,
              let container = textView.textContainer, let layout = textView.layoutManager
        else { return nil }
        container.containerSize = NSSize(width: width, height: .greatestFiniteMagnitude)
        layout.ensureLayout(for: container)
        return CGSize(width: width, height: layout.usedRect(for: container).height.rounded(.up))
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        var openURL: OpenURLAction?

        func textView(_ textView: NSTextView, clickedOnLink link: Any, at charIndex: Int) -> Bool {
            guard let url = (link as? URL) ?? (link as? String).flatMap(URL.init(string:)) else { return false }
            openURL?(url)
            return true
        }
    }
}

/// Lets go of its selection once the reader has moved on — clicked into
/// another reply or the composer — so the conversation only ever shows the
/// one selection ⌘C would take, rather than a grey trail of old ones.
private final class SelectableTextView: NSTextView {
    override func resignFirstResponder() -> Bool {
        let resigned = super.resignFirstResponder()
        if resigned { setSelectedRange(NSRange(location: selectedRange().location, length: 0)) }
        return resigned
    }
}
