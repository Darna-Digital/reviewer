// Task-list editing for the boxes the app is typed into — the SPA's
// `lib/list-editing`, ported. A newline inside a list opens the next item,
// Tab re-nests the item under the one above it, and every structural edit
// renumbers the block around it, so a list stays in order no matter where
// items were inserted or how they were re-nested. Sub-items are numbered
// under their parent (2 → 2.1).
//
// Pure text in, pure text out; offsets are UTF-16 units so a result maps
// straight onto an `NSTextView`'s selected range. Which key counts as the
// newline is the composer's own business — in a chat prompt Return sends and
// ⇧Return opens a line — so it is not decided here.
import Foundation

struct ComposerSelection: Equatable {
    var text: String
    var selectionStart: Int
    var selectionEnd: Int
}

enum ListEditing {
    private static let indent = "  "

    /// An ordered marker needs a trailing dot ("2.") or a dotted path
    /// ("2.1"), so a line opening with a bare year ("2024 was…") stays prose.
    private static var itemPattern: Regex<(Substring, Substring, Substring?, Substring?, Substring)> {
        /^( *)(?:([-*+])|(?:\d+(?:\.\d+)+\.?|\d+\.))[ \t]+(?:(\[[ xX]\])[ \t]+)?(.*)$/
    }

    private struct Item {
        var depth: Int
        var bullet: String?
        var checkbox: String?
        var content: String
        var prefixLength: Int
    }

    /// Newline inside a list: open the next item at the same depth, or close
    /// the list when the current item is still empty. Nil when the caret is
    /// not in a list and the newline should go in as usual.
    static func continueList(_ input: ComposerSelection) -> ComposerSelection? {
        let text = input.text.utf16Replacing(input.selectionStart..<input.selectionEnd, with: "")
        var lines = text.components(separatedBy: "\n")
        let (line, column) = locate(lines, position: input.selectionStart)
        guard let item = parseItem(lines[line]) else { return nil }

        if item.content.isEmpty {
            if item.depth == 0 {
                lines[line] = ""
                return caret(in: lines, line: line, contentOffset: 0)
            }
            var outdented = item
            outdented.depth -= 1
            lines[line] = format(outdented, numbers: [1])
            return caret(in: renumberBlock(lines, anchor: line), line: line, contentOffset: 0)
        }

        let split = item.content.utf16Index(contentOffset(in: lines, line: line, column: column))
        var head = item
        head.content = String(item.content[..<split])
        var tail = item
        tail.content = String(item.content[split...])
        tail.checkbox = item.checkbox == nil ? nil : "[ ]"
        lines[line] = format(head, numbers: [1])
        lines.insert(format(tail, numbers: [1]), at: line + 1)
        return caret(in: renumberBlock(lines, anchor: line + 1), line: line + 1, contentOffset: 0)
    }

    /// Tab / ⇧Tab on list lines. An item can only nest one level under the
    /// item above it. Nil when nothing in the selection can move, leaving
    /// Tab to do what it normally does.
    static func shiftIndent(_ input: ComposerSelection, by levels: Int) -> ComposerSelection? {
        let original = input.text.components(separatedBy: "\n")
        var lines = original
        let start = locate(original, position: input.selectionStart)
        let end = locate(original, position: input.selectionEnd)
        let lastLine = end.line > start.line && end.column == 0 ? end.line - 1 : end.line

        var changed = false
        for i in start.line...lastLine {
            guard let item = parseItem(lines[i]) else { continue }
            let above = i > 0 ? parseItem(lines[i - 1]) : nil
            let maxDepth = above.map { $0.depth + 1 } ?? 0
            let depth = min(max(item.depth + levels, 0), maxDepth)
            guard depth != item.depth else { continue }
            var moved = item
            moved.depth = depth
            lines[i] = format(moved, numbers: [1])
            changed = true
        }
        guard changed else { return nil }

        var next = lines
        for i in start.line...lastLine { next = renumberBlock(next, anchor: i) }

        return ComposerSelection(
            text: next.joined(separator: "\n"),
            selectionStart: position(in: next, line: start.line, contentOffset: contentOffset(in: original, line: start.line, column: start.column)),
            selectionEnd: position(in: next, line: end.line, contentOffset: contentOffset(in: original, line: end.line, column: end.column)))
    }

    private static func parseItem(_ line: String) -> Item? {
        guard let match = line.wholeMatch(of: itemPattern) else { return nil }
        let content = String(match.4)
        return Item(
            depth: match.1.count / indent.count,
            bullet: match.2.map(String.init),
            checkbox: match.3.map(String.init),
            content: content,
            prefixLength: line.utf16.count - content.utf16.count)
    }

    private static func format(_ item: Item, numbers: [Int]) -> String {
        let marker = item.bullet ?? (numbers.count == 1 ? "\(numbers[0])." : numbers.map(String.init).joined(separator: "."))
        let checkbox = item.checkbox.map { "\($0) " } ?? ""
        return String(repeating: indent, count: item.depth) + marker + " " + checkbox + item.content
    }

    /// The run of consecutive list lines around `anchor`.
    private static func blockRange(_ lines: [String], anchor: Int) -> ClosedRange<Int> {
        var from = anchor
        var to = anchor
        while from > 0, parseItem(lines[from - 1]) != nil { from -= 1 }
        while to + 1 < lines.count, parseItem(lines[to + 1]) != nil { to += 1 }
        return from...to
    }

    private static func renumberBlock(_ lines: [String], anchor: Int) -> [String] {
        var next = lines
        var counters: [Int] = []
        for i in blockRange(next, anchor: anchor) {
            guard let item = parseItem(next[i]) else { continue }
            if item.bullet != nil {
                counters = Array(counters.prefix(item.depth + 1))
                next[i] = format(item, numbers: [])
                continue
            }
            counters = Array(counters.prefix(item.depth + 1))
            while counters.count < item.depth { counters.append(1) }
            if counters.count == item.depth { counters.append(0) }
            counters[item.depth] += 1
            next[i] = format(item, numbers: counters)
        }
        return next
    }

    private static func locate(_ lines: [String], position: Int) -> (line: Int, column: Int) {
        var remaining = position
        for (i, line) in lines.enumerated() {
            let length = line.utf16.count
            if remaining <= length { return (i, remaining) }
            remaining -= length + 1
        }
        return (lines.count - 1, lines[lines.count - 1].utf16.count)
    }

    /// Absolute offset of `contentOffset` units into a line's content.
    private static func position(in lines: [String], line: Int, contentOffset: Int) -> Int {
        let start = lines[..<line].reduce(0) { $0 + $1.utf16.count + 1 }
        let raw = lines[line]
        let prefix = parseItem(raw)?.prefixLength ?? 0
        return start + min(prefix + contentOffset, raw.utf16.count)
    }

    private static func contentOffset(in lines: [String], line: Int, column: Int) -> Int {
        let prefix = parseItem(lines[line])?.prefixLength ?? 0
        return max(0, column - prefix)
    }

    private static func caret(in lines: [String], line: Int, contentOffset: Int) -> ComposerSelection {
        let at = position(in: lines, line: line, contentOffset: contentOffset)
        return ComposerSelection(text: lines.joined(separator: "\n"), selectionStart: at, selectionEnd: at)
    }
}

private extension String {
    func utf16Index(_ offset: Int) -> String.Index {
        String.Index(utf16Offset: min(offset, utf16.count), in: self)
    }

    func utf16Replacing(_ range: Range<Int>, with replacement: String) -> String {
        replacingCharacters(in: utf16Index(range.lowerBound)..<utf16Index(range.upperBound), with: replacement)
    }
}
