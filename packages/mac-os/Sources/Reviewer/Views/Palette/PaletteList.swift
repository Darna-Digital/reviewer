// The palette's list as a native table: an `NSTableView` with its rows
// reused as they scroll, so a grep's five hundred hits cost what the
// visible dozen do, drawn the way the web dialog draws them — a heading
// over each run of rows that share one (a file's path over its hits, with
// the file's own icon), then the rows: a command with its glyph and its
// chord, a file wearing the tree's icon with its folder dimmed ahead of
// its name, a hit with its line number ahead of the line and the match
// picked out of it, a branch with its counts. The row the keyboard is on
// wears the quiet fill and the return glyph; the pointer moves it too, so
// the mouse and the keyboard never disagree about the row. The keys stay
// the panel's — the table never takes the focus from the box.
import AppKit
import SwiftUI

struct PaletteList: NSViewRepresentable {
    let rows: [PaletteRow]
    let query: String
    let options: GrepOptions
    let mode: PaletteMode
    @Binding var active: Int
    let run: (Int) -> Void

    static let rowHeight: CGFloat = 28
    static let headingHeight: CGFloat = 26
    /// The air around the list, the web viewport's own `p-1.5`.
    static let inset: CGFloat = 8

    func makeCoordinator() -> PaletteListCoordinator {
        PaletteListCoordinator()
    }

    func makeNSView(context: Context) -> NSScrollView {
        let table = PaletteTableView()
        let column = NSTableColumn(identifier: .init("row"))
        column.resizingMask = .autoresizingMask
        table.addTableColumn(column)
        table.headerView = nil
        table.style = .plain
        table.rowSizeStyle = .custom
        table.intercellSpacing = .zero
        table.columnAutoresizingStyle = .firstColumnOnlyAutoresizingStyle
        table.allowsMultipleSelection = false
        table.allowsEmptySelection = true
        table.usesAutomaticRowHeights = false
        table.backgroundColor = .clear
        table.dataSource = context.coordinator
        table.delegate = context.coordinator
        table.target = context.coordinator
        table.action = #selector(PaletteListCoordinator.clicked)
        table.hovered = { [coordinator = context.coordinator] line in coordinator.hovered(line) }
        table.appearanceChanged = { [coordinator = context.coordinator] in coordinator.redrawVisibleRows() }
        context.coordinator.table = table

        let scroll = NSScrollView()
        scroll.documentView = table
        scroll.hasVerticalScroller = true
        scroll.hasHorizontalScroller = false
        scroll.autohidesScrollers = true
        scroll.drawsBackground = false
        scroll.borderType = .noBorder
        scroll.automaticallyAdjustsContentInsets = false
        scroll.contentInsets = NSEdgeInsets(top: Self.inset, left: 0, bottom: Self.inset, right: 0)
        return scroll
    }

    func updateNSView(_ scroll: NSScrollView, context: Context) {
        context.coordinator.sync(
            rows: rows, query: query, options: options, mode: mode, active: $active, run: run)
    }
}

/// One line of the table: a heading, or the row at that index of the list.
enum PaletteLine: Equatable {
    case heading(String)
    case row(Int)

    /// The rows under a heading each time the group changes, as the web
    /// list derives its headings from the rows rather than tracking them.
    static func lines(of rows: [PaletteRow]) -> [PaletteLine] {
        var lines: [PaletteLine] = []
        var group: String?
        for (index, row) in rows.enumerated() {
            if row.group != group {
                lines.append(.heading(row.group))
                group = row.group
            }
            lines.append(.row(index))
        }
        return lines
    }
}

@MainActor
final class PaletteListCoordinator: NSObject, NSTableViewDataSource, NSTableViewDelegate {
    weak var table: PaletteTableView?

    private var rows: [PaletteRow] = []
    private var lines: [PaletteLine] = []
    private var query = ""
    private var options = GrepOptions()
    private var mode: PaletteMode = .commands
    private var active: Binding<Int> = .constant(0)
    private var run: (Int) -> Void = { _ in }

    /// The list again from SwiftUI. New rows — or a new query over the same
    /// ones, which moves the highlight in every hit — reload the table;
    /// the keyboard moving between rows repaints only the two it touched.
    func sync(rows: [PaletteRow], query: String, options: GrepOptions, mode: PaletteMode,
              active: Binding<Int>, run: @escaping (Int) -> Void) {
        self.active = active
        self.run = run
        let contentChanged = rows.map(\.id) != self.rows.map(\.id) || query != self.query
            || options != self.options || mode != self.mode
        let previous = self.rows.isEmpty ? nil : self.activeIndex
        self.rows = rows
        self.query = query
        self.options = options
        self.mode = mode
        guard let table else { return }
        if contentChanged {
            lines = PaletteLine.lines(of: rows)
            table.reloadData()
        } else if let previous, previous != active.wrappedValue {
            paint(row: previous, active: false)
            paint(row: active.wrappedValue, active: true)
        }
        activeIndex = active.wrappedValue
        if let line = line(ofRow: active.wrappedValue) { table.scrollRowToVisible(line) }
    }

    /// The row last painted as active, so the next sync knows what to
    /// repaint besides the new one.
    private var activeIndex = 0

    /// The fill is the row view's and the return glyph the cell's; a reload
    /// of the line remakes only the cell, so the row view is told directly.
    private func paint(row index: Int, active: Bool) {
        guard let table, let line = line(ofRow: index) else { return }
        (table.rowView(atRow: line, makeIfNecessary: false) as? PaletteRowView)?.isActive = active
        table.reloadData(forRowIndexes: [line], columnIndexes: [0])
    }

    private func line(ofRow index: Int) -> Int? {
        lines.firstIndex(of: .row(index))
    }

    private func row(atLine line: Int) -> Int? {
        guard lines.indices.contains(line), case .row(let index) = lines[line] else { return nil }
        return index
    }

    @objc func clicked() {
        guard let table, let index = row(atLine: table.clickedRow) else { return }
        run(index)
    }

    func hovered(_ line: Int) {
        guard let index = row(atLine: line), index != active.wrappedValue else { return }
        active.wrappedValue = index
    }

    func redrawVisibleRows() {
        guard let table else { return }
        let visible = table.rows(in: table.visibleRect)
        guard visible.length > 0 else { return }
        table.reloadData(forRowIndexes: IndexSet(integersIn: visible.location..<(visible.location + visible.length)), columnIndexes: [0])
    }

    // MARK: NSTableViewDataSource

    func numberOfRows(in tableView: NSTableView) -> Int {
        lines.count
    }

    // MARK: NSTableViewDelegate

    func tableView(_ tableView: NSTableView, heightOfRow row: Int) -> CGFloat {
        switch lines[row] {
        case .heading: return PaletteList.headingHeight
        case .row: return PaletteList.rowHeight
        }
    }

    func tableView(_ tableView: NSTableView, shouldSelectRow row: Int) -> Bool {
        false
    }

    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        let dark = tableView.isDark
        switch lines[row] {
        case .heading(let group):
            let cell = tableView.makeView(withIdentifier: PaletteHeadingCell.identifier, owner: nil) as? PaletteHeadingCell
                ?? PaletteHeadingCell()
            cell.show(group, asPath: mode == .text, dark: dark)
            return cell
        case .row(let index):
            let cell = tableView.makeView(withIdentifier: PaletteRowCell.identifier, owner: nil) as? PaletteRowCell
                ?? PaletteRowCell()
            cell.show(rows[index], query: query, options: options, isActive: index == active.wrappedValue, dark: dark)
            return cell
        }
    }

    func tableView(_ tableView: NSTableView, rowViewForRow line: Int) -> NSTableRowView? {
        let view = tableView.makeView(withIdentifier: PaletteRowView.identifier, owner: nil) as? PaletteRowView
            ?? PaletteRowView()
        view.isActive = row(atLine: line) == active.wrappedValue
        return view
    }
}

/// The table: it never takes the focus — the keys are the box's — and it
/// tells the coordinator which line the pointer is over.
final class PaletteTableView: NSTableView {
    var hovered: ((Int) -> Void)?
    var appearanceChanged: (() -> Void)?
    private var hoverTracking: NSTrackingArea?

    override var acceptsFirstResponder: Bool { false }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let hoverTracking { removeTrackingArea(hoverTracking) }
        let tracking = NSTrackingArea(
            rect: .zero, options: [.mouseMoved, .activeInActiveApp, .inVisibleRect], owner: self, userInfo: nil)
        addTrackingArea(tracking)
        hoverTracking = tracking
    }

    override func mouseMoved(with event: NSEvent) {
        super.mouseMoved(with: event)
        let line = row(at: convert(event.locationInWindow, from: nil))
        if line >= 0 { hovered?(line) }
    }

    override func viewDidChangeEffectiveAppearance() {
        super.viewDidChangeEffectiveAppearance()
        appearanceChanged?()
    }
}

extension NSView {
    var isDark: Bool { effectiveAppearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua }
}

/// The active row's quiet fill, drawn by the row itself since the table's
/// selection is never used: the keyboard's row is the panel's state.
private final class PaletteRowView: NSTableRowView {
    static let identifier = NSUserInterfaceItemIdentifier("PaletteRow")

    var isActive = false {
        didSet { if isActive != oldValue { needsDisplay = true } }
    }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        identifier = Self.identifier
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func drawBackground(in dirtyRect: NSRect) {
        guard isActive else { return }
        IslandPalette.text.withAlphaComponent(0.1).setFill()
        NSBezierPath(roundedRect: bounds.insetBy(dx: PaletteList.inset, dy: 0), xRadius: 10, yRadius: 10).fill()
    }
}

/// A heading: the group's name, or in the text search the file the hits
/// under it belong to, wearing the file's icon and set in the code's face.
private final class PaletteHeadingCell: NSTableCellView {
    static let identifier = NSUserInterfaceItemIdentifier("PaletteHeading")

    private static let iconSize: CGFloat = 14
    private let iconView = NSImageView()
    private let label = NSTextField(labelWithString: "")

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        identifier = Self.identifier
        iconView.imageScaling = .scaleProportionallyUpOrDown
        label.textColor = IslandPalette.textSecondary
        label.lineBreakMode = .byTruncatingMiddle
        label.maximumNumberOfLines = 1
        label.cell?.truncatesLastVisibleLine = true
        addSubview(iconView)
        addSubview(label)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func show(_ group: String, asPath: Bool, dark: Bool) {
        label.stringValue = group
        label.font = .systemFont(ofSize: 11, weight: .medium)
        iconView.image = asPath ? FileIcon.image(for: group, dark: dark) ?? PaletteGlyph.document : nil
        iconView.isHidden = !asPath
        needsLayout = true
    }

    override func layout() {
        super.layout()
        let height = bounds.height
        var x = PaletteList.inset + 8
        if !iconView.isHidden {
            let size = Self.iconSize
            iconView.frame = NSRect(x: x, y: (height - size) / 2 + 2, width: size, height: size)
            x += size + 6
        }
        let labelHeight = ceil(label.font!.ascender - label.font!.descender) + 2
        label.frame = NSRect(
            x: x, y: (height - labelHeight) / 2 + 2, width: max(0, bounds.width - x - PaletteList.inset - 8),
            height: labelHeight)
    }
}

/// One row, laid out by hand — a reused cell has nothing to solve: the
/// icon or the line number, the label, the hint, and the return glyph
/// while the row is the active one.
private final class PaletteRowCell: NSTableCellView {
    static let identifier = NSUserInterfaceItemIdentifier("PaletteRowCell")

    private static let iconSize: CGFloat = 16
    private static let leadWidth: CGFloat = 40
    private static let textFont = NSFont.systemFont(ofSize: 13)

    private let iconView = NSImageView()
    private let leadField = NSTextField(labelWithString: "")
    private let label = NSTextField(labelWithString: "")
    private let hintField = NSTextField(labelWithString: "")
    private let returnView = NSImageView()

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        identifier = Self.identifier
        iconView.imageScaling = .scaleProportionallyUpOrDown
        leadField.font = .monospacedDigitSystemFont(ofSize: 11, weight: .regular)
        leadField.textColor = IslandPalette.textSecondary
        leadField.alignment = .right
        label.maximumNumberOfLines = 1
        label.cell?.truncatesLastVisibleLine = true
        hintField.font = .systemFont(ofSize: 11)
        hintField.textColor = IslandPalette.textSecondary
        hintField.alignment = .right
        returnView.image = PaletteGlyph.symbol("return", size: 10)
        returnView.contentTintColor = .secondaryLabelColor
        for view in [iconView, leadField, label, hintField, returnView] { addSubview(view) }
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func show(_ row: PaletteRow, query: String, options: GrepOptions, isActive: Bool, dark: Bool) {
        leadField.isHidden = true
        iconView.isHidden = false
        iconView.contentTintColor = .secondaryLabelColor
        switch row.content {
        case .command(let text, let symbol):
            iconView.image = PaletteGlyph.symbol(symbol, size: 13)
            label.attributedStringValue = NSAttributedString(
                string: text, attributes: [.font: Self.textFont, .foregroundColor: IslandPalette.text])
            label.lineBreakMode = .byTruncatingTail
        case .file(let path):
            iconView.image = FileIcon.image(for: path, dark: dark) ?? PaletteGlyph.document
            iconView.contentTintColor = nil
            label.attributedStringValue = Self.fileLabel(path)
            label.lineBreakMode = .byTruncatingMiddle
        case .match(_, let line, let text):
            iconView.isHidden = true
            leadField.isHidden = false
            leadField.stringValue = String(line)
            label.attributedStringValue = Self.matchLabel(text, query: query, options: options)
            label.lineBreakMode = .byTruncatingTail
        case .branch(let name):
            iconView.image = PaletteGlyph.symbol("arrow.triangle.branch", size: 13)
            label.attributedStringValue = NSAttributedString(
                string: name, attributes: [.font: Self.textFont, .foregroundColor: IslandPalette.text])
            label.lineBreakMode = .byTruncatingTail
        }
        hintField.stringValue = row.hint ?? ""
        hintField.isHidden = row.hint == nil
        returnView.isHidden = !isActive
        needsLayout = true
    }

    /// A file row: its directory dimmed ahead of its name.
    private static func fileLabel(_ path: String) -> NSAttributedString {
        let slash = path.lastIndex(of: "/").map { path.index(after: $0) } ?? path.startIndex
        let text = NSMutableAttributedString(
            string: String(path[..<slash]), attributes: [.font: textFont, .foregroundColor: NSColor.secondaryLabelColor])
        text.append(NSAttributedString(
            string: String(path[slash...]), attributes: [.font: textFont, .foregroundColor: IslandPalette.text]))
        return text
    }

    /// A hit: the line with its leading whitespace dropped, and the match
    /// picked out of it.
    private static func matchLabel(_ line: String, query: String, options: GrepOptions) -> NSAttributedString {
        let text = String(line.drop(while: \.isWhitespace))
        let attributed = NSMutableAttributedString(
            string: text, attributes: [.font: textFont, .foregroundColor: IslandPalette.text])
        if let range = CommandPalette.matchRange(in: text, query: query, options: options) {
            attributed.addAttribute(
                .backgroundColor, value: NSColor.controlAccentColor.withAlphaComponent(0.3),
                range: NSRange(range, in: text))
        }
        return attributed
    }

    override func layout() {
        super.layout()
        let height = bounds.height
        var x = PaletteList.inset + 8
        if !leadField.isHidden {
            let leadHeight = ceil(leadField.font!.ascender - leadField.font!.descender) + 2
            leadField.frame = NSRect(x: x, y: (height - leadHeight) / 2, width: Self.leadWidth, height: leadHeight)
            x += Self.leadWidth + 10
        } else {
            let size = Self.iconSize
            iconView.frame = NSRect(x: x, y: (height - size) / 2, width: size, height: size)
            x += size + 10
        }
        var trailing = bounds.width - PaletteList.inset - 8
        if !returnView.isHidden {
            returnView.frame = NSRect(x: trailing - 12, y: (height - 12) / 2, width: 12, height: 12)
            trailing -= 12 + 8
        }
        if !hintField.isHidden {
            let width = min(ceil(hintField.fittingSize.width), 160)
            let hintHeight = ceil(hintField.font!.ascender - hintField.font!.descender) + 2
            hintField.frame = NSRect(x: trailing - width, y: (height - hintHeight) / 2, width: width, height: hintHeight)
            trailing -= width + 8
        }
        let labelHeight = ceil(Self.textFont.ascender - Self.textFont.descender) + 4
        label.frame = NSRect(x: x, y: (height - labelHeight) / 2, width: max(0, trailing - x), height: labelHeight)
    }
}

/// The system glyphs the rows wear, made once each.
@MainActor
private enum PaletteGlyph {
    private static var cache: [String: NSImage] = [:]

    static let document = symbol("doc", size: 13)

    static func symbol(_ name: String, size: CGFloat) -> NSImage? {
        let key = "\(name)@\(size)"
        if let cached = cache[key] { return cached }
        let configuration = NSImage.SymbolConfiguration(pointSize: size, weight: .medium)
        guard let image = NSImage(systemSymbolName: name, accessibilityDescription: nil)?
            .withSymbolConfiguration(configuration)
        else { return nil }
        cache[key] = image
        return image
    }
}
