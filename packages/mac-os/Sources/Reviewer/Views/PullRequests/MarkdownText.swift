// Markdown — a pull request's description, an agent's reply — drawn as a
// column of blocks: headings, paragraphs, lists, fenced code, quotes and
// rules, each block's own inline marks (emphasis, code, links) read by
// Foundation's markdown parser, which knows the inline grammar and stops
// at the block one. The block split is a small line reader of our own:
// what descriptions and replies are made of, and no more — a table or a
// nested list comes through as the lines it is written in rather than
// nothing.
//
// Everything about how it reads comes from one body size through
// `MarkdownMetrics`, in the proportions the system reads long-form text
// at: a paragraph set near 1.4 line height, measured against the height
// SF already gives a line rather than the nominal size — the font sets
// its own lines about 1.2 tall, so leading counted from the size lands
// far looser than intended; a gap between blocks wider than that leading
// so a paragraph ends visibly rather than only wrapping again; headings
// stepping through the system's own title sizes rather than past them,
// since at 20pt SF changes to its Display cut and stops belonging to the
// text around it; and inline code a point down from the body, since SF
// Mono sets heavier and wider than SF at the same nominal size and
// otherwise shouts over the sentence it sits in.
import AppKit
import SwiftUI

/// The measures one body size sets.
struct MarkdownMetrics {
    let size: CGFloat

    /// The line height prose reads best at, as a multiple of the size:
    /// what the system's own reading surfaces sit near, and a step looser
    /// than the 1.2 a control's label gets.
    private static let proseLineHeight: CGFloat = 1.4
    /// Code a touch tighter, since a monospaced face already spaces its
    /// characters apart and reads by the line rather than the sentence.
    private static let codeLineHeight: CGFloat = 1.35

    private var codeSize: CGFloat { size - 1 }

    /// The air added between lines of a paragraph, over what SF already
    /// gives a line, to reach `proseLineHeight`.
    var leading: CGFloat { Self.spacing(toReach: Self.proseLineHeight, for: .systemFont(ofSize: size)) }
    /// The same for a code block, over SF Mono's own line.
    var codeLeading: CGFloat {
        Self.spacing(toReach: Self.codeLineHeight, for: .monospacedSystemFont(ofSize: codeSize, weight: .regular))
    }
    /// The air between blocks — most of a line, and always more than
    /// `leading`, which is what tells a paragraph from a wrap.
    var blockGap: CGFloat { (size * 0.7).rounded() }
    /// Between items of one list: less than a block's gap, more than a wrap's.
    var itemGap: CGFloat { (size * 0.3).rounded() }
    /// The extra air a heading takes above it, so it belongs to what follows.
    var headingGap: CGFloat { (size * 0.6).rounded() }
    /// The hanging indent a list's marker sits in.
    var markerColumn: CGFloat { (size * 0.95).rounded() }
    var codeFont: Font { .system(size: codeSize, design: .monospaced) }

    /// Headings on the system's own steps over the body — title2, title3,
    /// headline — told apart by weight as much as size, as the system does.
    func heading(_ level: Int) -> Font {
        .system(size: size + (level == 1 ? 3 : level == 2 ? 1 : 0), weight: .semibold)
    }

    /// What `lineSpacing` has to add to `font`'s own line to set it at
    /// `multiple` of its point size; nothing where the font is already
    /// there.
    private static func spacing(toReach multiple: CGFloat, for font: NSFont) -> CGFloat {
        let natural = (font.ascender - font.descender + font.leading).rounded(.up)
        return max(0, (font.pointSize * multiple).rounded() - natural)
    }
}

enum MarkdownBlock: Identifiable {
    case heading(level: Int, text: AttributedString)
    case paragraph(AttributedString)
    case list(items: [AttributedString], ordered: Bool)
    /// A fence and what it said it held: the language, for the grammar it
    /// is coloured with, and whether the closing fence has been written —
    /// a reply still streaming ends in one that has not.
    case code(String, lang: String, closed: Bool)
    case quote(AttributedString)
    case rule

    var id: String {
        switch self {
        case .heading(let level, let text): return "h\(level):\(text.characters.prefix(40))"
        case .paragraph(let text): return "p:\(text.characters.prefix(40))"
        case .list(let items, _): return "l:\(items.first.map { String($0.characters.prefix(40)) } ?? "")\(items.count)"
        case .code(let text, let lang, _): return "c:\(lang):\(text.prefix(40))"
        case .quote(let text): return "q:\(text.characters.prefix(40))"
        case .rule: return "rule"
        }
    }

    /// `text` split into blocks, in order, with inline code set in `code`.
    static func parse(_ text: String, code: Font) -> [MarkdownBlock] {
        var blocks: [MarkdownBlock] = []
        var paragraph: [String] = []
        var quote: [String] = []
        var items: [String] = []
        var ordered = false
        var fence: [String]?
        var fenceLang = ""

        func inlined(_ text: String) -> AttributedString { inline(text, code: code) }
        func flushParagraph() {
            if !paragraph.isEmpty { blocks.append(.paragraph(inlined(paragraph.joined(separator: " ")))) }
            paragraph = []
        }
        func flushQuote() {
            if !quote.isEmpty { blocks.append(.quote(inlined(quote.joined(separator: " ")))) }
            quote = []
        }
        func flushList() {
            if !items.isEmpty { blocks.append(.list(items: items.map(inlined), ordered: ordered)) }
            items = []
        }
        func flushAll() {
            flushParagraph()
            flushQuote()
            flushList()
        }

        for rawLine in text.replacingOccurrences(of: "\r\n", with: "\n").split(separator: "\n", omittingEmptySubsequences: false) {
            let line = String(rawLine)
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            if var open = fence {
                if trimmed.hasPrefix("```") {
                    blocks.append(.code(open.joined(separator: "\n"), lang: fenceLang, closed: true))
                    fence = nil
                } else {
                    open.append(line)
                    fence = open
                }
                continue
            }
            if trimmed.hasPrefix("```") {
                flushAll()
                fence = []
                // The info string is the fence's own line after the ticks;
                // only its first word names the language.
                fenceLang = String(trimmed.dropFirst(3))
                    .trimmingCharacters(in: .whitespaces)
                    .split(separator: " ").first.map(String.init) ?? ""
                continue
            }
            if trimmed.isEmpty {
                flushAll()
                continue
            }
            if let heading = trimmed.wholeMatch(of: /(#{1,6})\s+(.*?)\s*#*\s*/) {
                flushAll()
                blocks.append(.heading(level: heading.1.count, text: inlined(String(heading.2))))
                continue
            }
            if trimmed.wholeMatch(of: /(-{3,}|\*{3,}|_{3,})/) != nil {
                flushAll()
                blocks.append(.rule)
                continue
            }
            if let item = trimmed.wholeMatch(of: /[-*+]\s+(.*)/) {
                flushParagraph()
                flushQuote()
                if !items.isEmpty && ordered { flushList() }
                ordered = false
                items.append(String(item.1))
                continue
            }
            if let item = trimmed.wholeMatch(of: /\d+[.)]\s+(.*)/) {
                flushParagraph()
                flushQuote()
                if !items.isEmpty && !ordered { flushList() }
                ordered = true
                items.append(String(item.1))
                continue
            }
            if let quoted = trimmed.wholeMatch(of: />\s?(.*)/) {
                flushParagraph()
                flushList()
                quote.append(String(quoted.1))
                continue
            }
            // An indented line under a list item continues it; anything else
            // continues the paragraph.
            if !items.isEmpty && line.first?.isWhitespace == true {
                items[items.count - 1] += " " + trimmed
                continue
            }
            flushQuote()
            flushList()
            paragraph.append(trimmed)
        }
        if let open = fence { blocks.append(.code(open.joined(separator: "\n"), lang: fenceLang, closed: false)) }
        flushAll()
        return blocks
    }

    /// The inline marks of one block, read as markdown; the bare text where
    /// the parser refuses it. The parser leaves code spans as an intent
    /// rather than a face, which SwiftUI would resolve at the body's own
    /// size; we set the face ourselves to bring it back down beside the
    /// sentence.
    private static func inline(_ text: String, code: Font) -> AttributedString {
        let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        guard var parsed = try? AttributedString(markdown: text, options: options) else {
            return AttributedString(text)
        }
        let spans = parsed.runs[\.inlinePresentationIntent].compactMap { intent, range in
            intent?.contains(.code) == true ? range : nil
        }
        for span in spans { parsed[span].font = code }
        return parsed
    }
}

struct MarkdownText: View {
    let text: String
    /// The body size everything else is measured from; the headings, the
    /// leading and the code step from it. A pull request's description
    /// reads at the column's caption size, a reply in a conversation at
    /// the page's.
    var size: CGFloat = 12

    var body: some View {
        let metrics = MarkdownMetrics(size: size)
        let blocks = MarkdownBlock.parse(text, code: metrics.codeFont)
        VStack(alignment: .leading, spacing: metrics.blockGap) {
            ForEach(blocks) { block in
                switch block {
                case .heading(let level, let text):
                    Text(text)
                        .font(metrics.heading(level))
                        .padding(.top, metrics.headingGap)
                case .paragraph(let text):
                    paragraph(text, metrics: metrics)
                case .list(let items, let ordered):
                    VStack(alignment: .leading, spacing: metrics.itemGap) {
                        ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                            HStack(alignment: .firstTextBaseline, spacing: 6) {
                                Text(ordered ? "\(index + 1)." : "•")
                                    .font(.system(size: size).monospacedDigit())
                                    .foregroundStyle(.secondary)
                                    .frame(minWidth: metrics.markerColumn, alignment: .trailing)
                                paragraph(item, metrics: metrics)
                            }
                        }
                    }
                case .code(let text, let lang, let closed):
                    CodeBlock(code: text, lang: lang, closed: closed, metrics: metrics)
                case .quote(let text):
                    HStack(alignment: .top, spacing: 8) {
                        RoundedRectangle(cornerRadius: 1)
                            .fill(.quaternaryWash())
                            .frame(width: 2)
                        paragraph(text, metrics: metrics)
                            .foregroundStyle(.secondary)
                    }
                    .fixedSize(horizontal: false, vertical: true)
                case .rule:
                    ThemedDivider()
                }
            }
        }
        .textSelection(.enabled)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// A run of prose: the body face, the long-form leading, and the
    /// insistence on wrapping — a lazily laid out reply would otherwise be
    /// free to cut a paragraph to one line.
    private func paragraph(_ text: AttributedString, metrics: MarkdownMetrics) -> some View {
        Text(text)
            .font(.system(size: metrics.size))
            .lineSpacing(metrics.leading)
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
    }
}
