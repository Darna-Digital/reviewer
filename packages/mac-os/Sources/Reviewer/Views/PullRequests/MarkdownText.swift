// A pull request's description, as the author wrote it: markdown, drawn
// as a column of blocks — headings, paragraphs, lists, fenced code, quotes
// and rules — each block's own inline marks (emphasis, code, links) read by
// Foundation's markdown parser, which knows the inline grammar and stops
// at the block one. The block split is a small line reader of our own:
// what GitHub descriptions are made of, and no more — a table or a nested
// list comes through as the lines it is written in rather than nothing.
import SwiftUI

enum MarkdownBlock: Identifiable {
    case heading(level: Int, text: AttributedString)
    case paragraph(AttributedString)
    case list(items: [AttributedString], ordered: Bool)
    case code(String)
    case quote(AttributedString)
    case rule

    var id: String {
        switch self {
        case .heading(let level, let text): return "h\(level):\(text.characters.prefix(40))"
        case .paragraph(let text): return "p:\(text.characters.prefix(40))"
        case .list(let items, _): return "l:\(items.first.map { String($0.characters.prefix(40)) } ?? "")\(items.count)"
        case .code(let text): return "c:\(text.prefix(40))"
        case .quote(let text): return "q:\(text.characters.prefix(40))"
        case .rule: return "rule"
        }
    }

    /// `text` split into blocks, in order.
    static func parse(_ text: String) -> [MarkdownBlock] {
        var blocks: [MarkdownBlock] = []
        var paragraph: [String] = []
        var quote: [String] = []
        var items: [String] = []
        var ordered = false
        var code: [String]?

        func flushParagraph() {
            if !paragraph.isEmpty { blocks.append(.paragraph(inline(paragraph.joined(separator: " ")))) }
            paragraph = []
        }
        func flushQuote() {
            if !quote.isEmpty { blocks.append(.quote(inline(quote.joined(separator: " ")))) }
            quote = []
        }
        func flushList() {
            if !items.isEmpty { blocks.append(.list(items: items.map(inline), ordered: ordered)) }
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

            if var open = code {
                if trimmed.hasPrefix("```") {
                    blocks.append(.code(open.joined(separator: "\n")))
                    code = nil
                } else {
                    open.append(line)
                    code = open
                }
                continue
            }
            if trimmed.hasPrefix("```") {
                flushAll()
                code = []
                continue
            }
            if trimmed.isEmpty {
                flushAll()
                continue
            }
            if let heading = trimmed.wholeMatch(of: /(#{1,6})\s+(.*?)\s*#*\s*/) {
                flushAll()
                blocks.append(.heading(level: heading.1.count, text: inline(String(heading.2))))
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
        if let open = code { blocks.append(.code(open.joined(separator: "\n"))) }
        flushAll()
        return blocks
    }

    /// The inline marks of one block, read as markdown; the bare text where
    /// the parser refuses it.
    private static func inline(_ text: String) -> AttributedString {
        let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        return (try? AttributedString(markdown: text, options: options)) ?? AttributedString(text)
    }
}

struct MarkdownText: View {
    let text: String

    var body: some View {
        let blocks = MarkdownBlock.parse(text)
        VStack(alignment: .leading, spacing: 8) {
            ForEach(blocks) { block in
                switch block {
                case .heading(let level, let text):
                    Text(text)
                        .font(.system(size: level == 1 ? 15 : level == 2 ? 14 : 13, weight: .semibold))
                        .padding(.top, 4)
                case .paragraph(let text):
                    Text(text)
                        .font(.system(size: 12))
                        .lineSpacing(3)
                case .list(let items, let ordered):
                    VStack(alignment: .leading, spacing: 3) {
                        ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                            HStack(alignment: .firstTextBaseline, spacing: 6) {
                                Text(ordered ? "\(index + 1)." : "•")
                                    .font(.system(size: 12))
                                    .foregroundStyle(.secondary)
                                    .frame(minWidth: 12, alignment: .trailing)
                                Text(item)
                                    .font(.system(size: 12))
                                    .lineSpacing(3)
                            }
                        }
                    }
                case .code(let text):
                    ScrollView(.horizontal, showsIndicators: false) {
                        Text(text)
                            .font(.system(size: 11, design: .monospaced))
                            .lineSpacing(2)
                            .padding(8)
                    }
                    .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 6))
                case .quote(let text):
                    HStack(alignment: .top, spacing: 8) {
                        RoundedRectangle(cornerRadius: 1)
                            .fill(.quaternary)
                            .frame(width: 2)
                        Text(text)
                            .font(.system(size: 12))
                            .foregroundStyle(.secondary)
                            .lineSpacing(3)
                    }
                    .fixedSize(horizontal: false, vertical: true)
                case .rule:
                    Divider()
                }
            }
        }
        .textSelection(.enabled)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
