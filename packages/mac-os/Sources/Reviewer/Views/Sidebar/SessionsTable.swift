// The sessions list's rows as a native table: an `NSTableView` whose rows
// are reused as they scroll, so a list of hundreds of sessions costs what
// the dozen on screen do. The `LazyVStack` it replaces gave every row its
// own hover tracking, tooltip, context menu and observation of the model,
// and every working agent a SwiftUI orb ticking on the main thread — a list
// that grew long, or busy, stuttered under the scroll. Here the table
// watches the pointer once for all of its rows, the system draws the
// tooltips and runs the selection — ⌘- and ⇧-clicks, the arrows — and the
// orb is Core Animation's (see `OrbView`).
//
// The table is driven, not diffed by SwiftUI: each list the page reports is
// laid against the one on screen, the rows that came or went are put in or
// taken out in place, and the rows that stayed are repainted where they
// stand — a mark coming on, a title settling — so the scroll position and
// the sweep survive the page's every report.
//
// What the rows do is the web list's, as before: a plain pick sends the
// page to the session, a sweep stays the list's own until the menu or the
// delete key acts on it, the ✕ under the pointer deletes its row, a row the
// pointer rests on has its conversation read ahead, and the foot of the
// list coming into view asks the page for its next page.
import AppKit
import SwiftUI

struct SessionsTable: NSViewRepresentable {
    let model: AppModel
    let list: ShellSessions
    /// A sweep of more than one row is asked about before it goes.
    let confirmDelete: ([String]) -> Void

    func makeCoordinator() -> SessionsCoordinator {
        SessionsCoordinator(model: model)
    }

    func makeNSView(context: Context) -> NSScrollView {
        let table = SessionsTableView()
        let column = NSTableColumn(identifier: .init("session"))
        column.resizingMask = .autoresizingMask
        table.addTableColumn(column)
        table.headerView = nil
        table.style = .plain
        table.rowSizeStyle = .custom
        table.rowHeight = SessionCellView.rowHeight
        table.intercellSpacing = NSSize(width: 0, height: 1)
        table.columnAutoresizingStyle = .firstColumnOnlyAutoresizingStyle
        table.allowsMultipleSelection = true
        table.allowsEmptySelection = true
        table.usesAutomaticRowHeights = false
        table.backgroundColor = .clear
        table.gridStyleMask = []
        table.focusRingType = .none
        table.dataSource = context.coordinator
        table.delegate = context.coordinator
        let coordinator = context.coordinator
        table.menuForRow = { coordinator.menu(forRow: $0) }
        table.hoveredRow = { coordinator.hover($0) }
        table.deleteSelection = { coordinator.deleteSelection() }
        coordinator.table = table

        let scroll = NSScrollView()
        scroll.documentView = table
        coordinator.watchScrolling(of: scroll.contentView)
        scroll.hasVerticalScroller = false
        scroll.hasHorizontalScroller = false
        scroll.drawsBackground = false
        scroll.borderType = .noBorder
        scroll.automaticallyAdjustsContentInsets = false
        scroll.contentInsets = NSEdgeInsets(top: 0, left: 0, bottom: 8, right: 0)
        return scroll
    }

    func updateNSView(_ scroll: NSScrollView, context: Context) {
        context.coordinator.confirmDelete = confirmDelete
        context.coordinator.sync(list)
    }
}

@MainActor
final class SessionsCoordinator: NSObject, NSTableViewDataSource, NSTableViewDelegate {
    let model: AppModel
    var confirmDelete: ([String]) -> Void = { _ in }
    weak var table: SessionsTableView?

    private var sessions: [ShellSession] = []
    private var hasMore = false
    private var activeId: String?
    /// The page's row as the table last followed it: a report that names
    /// the same one leaves the sweep alone.
    private var followedActive: String??
    /// Set while the table's selection is being moved for the page, so the
    /// move is not taken for a pick and sent back.
    private var following = false
    /// The last next-page request: the length of the list it was made at,
    /// and when. The page may let a request drop — one made while it was
    /// refetching what it had, say — so the same list asks again once
    /// `askAgainAfter` has gone by with the footer still in view.
    private var askedForMore: (count: Int, at: ContinuousClock.Instant)?
    private var askAgain: Task<Void, Never>?
    private var scrolling: NSObjectProtocol?
    private var hoveredId: String?
    private var prefetch: Task<Void, Never>?

    /// More rows than this coming or going at once is another list — a
    /// search, a filter — rather than the same one moving, and is reloaded
    /// whole instead of row by row.
    private static let reloadThreshold = 40
    /// How long the pointer rests before the row's conversation is read
    /// ahead: past a pointer crossing the row, well short of the click.
    private static let restBeforePrefetch: Duration = .milliseconds(50)
    private static let footerKey = "\u{0}more"
    private static let askAgainAfter: Duration = .seconds(1.5)

    init(model: AppModel) {
        self.model = model
    }

    // MARK: driven from the page

    func sync(_ list: ShellSessions) {
        guard let table else { return }
        let before = keys
        let sweep = selectedIds
        sessions = list.sessions
        hasMore = list.hasMore
        activeId = list.activeId
        let after = keys
        if before != after {
            askedForMore = nil
            apply(after.difference(from: before), from: before, to: after, in: table)
        }
        repaintVisibleRows()
        if followedActive != .some(list.activeId) {
            followedActive = list.activeId
            select(list.activeId.map { [$0] } ?? [])
        } else {
            let kept = sweep.filter { id in sessions.contains { $0.id == id } }
            select(kept.isEmpty ? (list.activeId.map { [$0] } ?? []) : Set(kept))
        }
        table.refreshHover()
        // After the table has laid out what was just put into it, so the
        // footer's place is where it now stands.
        DispatchQueue.main.async { [weak self] in self?.askForMoreIfFooterShows() }
    }

    /// The rows by identity, the footer included, in the table's order.
    private var keys: [String] {
        sessions.map(\.id) + (hasMore ? [Self.footerKey] : [])
    }

    private func apply(
        _ difference: CollectionDifference<String>, from before: [String], to after: [String], in table: NSTableView
    ) {
        guard table.numberOfRows > 0, difference.count <= Self.reloadThreshold else {
            table.reloadData()
            // A list headed by another session is another list, and starts
            // at its top; a page appended under the same one keeps its place.
            if before.first != after.first { table.scroll(.zero) }
            return
        }
        let animation: NSTableView.AnimationOptions =
            NSWorkspace.shared.accessibilityDisplayShouldReduceMotion ? [] : .effectFade
        table.beginUpdates()
        // Removals come highest first and insertions lowest first, so each
        // offset is still right when its turn comes.
        for change in difference {
            switch change {
            case .remove(let offset, _, _): table.removeRows(at: [offset], withAnimation: animation)
            case .insert(let offset, _, _): table.insertRows(at: [offset], withAnimation: animation)
            }
        }
        table.endUpdates()
    }

    /// The rows that stayed put through a report have been made already;
    /// what is in them may have moved — a mark, a title.
    private func repaintVisibleRows() {
        table?.enumerateAvailableRowViews { rowView, row in
            guard row < self.sessions.count,
                let cell = rowView.view(atColumn: 0) as? SessionCellView
            else { return }
            self.configure(cell, rowView, for: self.sessions[row])
        }
    }

    private func configure(_ cell: SessionCellView, _ rowView: NSTableRowView?, for session: ShellSession) {
        let hovering = session.id == hoveredId
        cell.show(session, hovering: hovering)
        cell.onDelete = { [weak self] in self?.model.act(onSessions: .delete([session.id])) }
        (rowView as? SessionRowView)?.isHovered = hovering
    }

    private var selectedIds: [String] {
        guard let table else { return [] }
        return table.selectedRowIndexes.compactMap { $0 < sessions.count ? sessions[$0].id : nil }
    }

    private func select(_ ids: Set<String>) {
        guard let table else { return }
        let rows = IndexSet(sessions.indices.filter { ids.contains(sessions[$0].id) })
        guard rows != table.selectedRowIndexes else { return }
        following = true
        table.selectRowIndexes(rows, byExtendingSelection: false)
        following = false
    }

    // MARK: NSTableViewDataSource

    func numberOfRows(in tableView: NSTableView) -> Int {
        sessions.count + (hasMore ? 1 : 0)
    }

    // MARK: NSTableViewDelegate

    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        guard row < sessions.count else {
            return tableView.makeView(withIdentifier: SessionsFooterView.identifier, owner: nil)
                ?? SessionsFooterView()
        }
        let cell =
            tableView.makeView(withIdentifier: SessionCellView.identifier, owner: nil) as? SessionCellView
            ?? SessionCellView()
        configure(cell, nil, for: sessions[row])
        return cell
    }

    func tableView(_ tableView: NSTableView, rowViewForRow row: Int) -> NSTableRowView? {
        let rowView =
            tableView.makeView(withIdentifier: SessionRowView.identifier, owner: nil) as? SessionRowView
            ?? SessionRowView()
        rowView.isHovered = row < sessions.count && sessions[row].id == hoveredId
        return rowView
    }

    func tableView(_ tableView: NSTableView, shouldSelectRow row: Int) -> Bool {
        row < sessions.count
    }

    /// A pick is a selection of one row made without ⌘ or ⇧ — a click or
    /// an arrow — and sends the page to it. A sweep grown or shrunk with
    /// either key is the list's own, and moves nothing, even when it comes
    /// down to one row.
    func tableViewSelectionDidChange(_ notification: Notification) {
        guard !following, let table, table.selectedRowIndexes.count == 1,
            let row = table.selectedRowIndexes.first, row < sessions.count
        else { return }
        let flags = NSApp.currentEvent?.modifierFlags ?? []
        guard flags.isDisjoint(with: [.command, .shift]) else { return }
        let id = sessions[row].id
        guard id != activeId else { return }
        model.act(onSessions: .select(id))
    }

    /// Watched rather than learned from the footer's cell being made: the
    /// table makes cells ahead of the scroll and keeps them across inserts,
    /// so a footer already made never says it came into view.
    func watchScrolling(of clip: NSClipView) {
        clip.postsBoundsChangedNotifications = true
        scrolling = NotificationCenter.default.addObserver(
            forName: NSView.boundsDidChangeNotification, object: clip, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.askForMoreIfFooterShows() }
        }
    }

    /// The foot of the list is on screen, so the next page is wanted.
    private func askForMoreIfFooterShows() {
        guard let table, hasMore else { return }
        let footer = sessions.count
        let visible = table.rows(in: table.visibleRect)
        guard footer >= visible.lowerBound, footer < visible.upperBound else { return }
        let now = ContinuousClock.now
        if let asked = askedForMore, asked.count == sessions.count, now - asked.at < Self.askAgainAfter { return }
        askedForMore = (sessions.count, now)
        model.act(onSessions: .loadMore)
        askAgain?.cancel()
        askAgain = Task { @MainActor [weak self] in
            try? await Task.sleep(for: Self.askAgainAfter)
            guard !Task.isCancelled else { return }
            self?.askForMoreIfFooterShows()
        }
    }

    // MARK: the pointer

    func hover(_ row: Int) {
        let id = row >= 0 && row < sessions.count ? sessions[row].id : nil
        guard id != hoveredId else { return }
        setHovered(hoveredId, false)
        hoveredId = id
        setHovered(id, true)
        prefetch?.cancel()
        prefetch = id.map { id in
            Task { @MainActor [weak self] in
                try? await Task.sleep(for: Self.restBeforePrefetch)
                guard !Task.isCancelled else { return }
                self?.model.chats.prefetch(id)
            }
        }
    }

    private func setHovered(_ id: String?, _ hovering: Bool) {
        guard let id, let table, let row = sessions.firstIndex(where: { $0.id == id }) else { return }
        (table.rowView(atRow: row, makeIfNecessary: false) as? SessionRowView)?.isHovered = hovering
        (table.view(atColumn: 0, row: row, makeIfNecessary: false) as? SessionCellView)?
            .setHovering(hovering, animated: true)
    }

    // MARK: acting on rows

    /// The menu acts on the sweep when the row is in it, and on the row
    /// alone when it is not — a right-click off the sweep is about that row.
    func menu(forRow row: Int) -> NSMenu? {
        guard row >= 0, row < sessions.count else { return nil }
        let id = sessions[row].id
        let sweep = selectedIds
        let targets = sweep.contains(id) ? sweep : [id]
        return NSHostingMenu(
            rootView: SessionRowMenu(
                targets: targets,
                openInTab: { [model] in model.act(onSessions: .openInTab(id)) },
                delete: { [weak self] in self?.delete(targets) }))
    }

    func deleteSelection() {
        delete(selectedIds)
    }

    /// One row goes without asking; a sweep asks first.
    private func delete(_ ids: [String]) {
        if ids.count > 1 {
            confirmDelete(ids)
        } else if let id = ids.first {
            model.act(onSessions: .delete([id]))
        }
    }
}

private struct SessionRowMenu: View {
    let targets: [String]
    let openInTab: () -> Void
    let delete: () -> Void

    var body: some View {
        if targets.count == 1 {
            Button("Open in a tab", action: openInTab)
            Divider()
        }
        Button(targets.count == 1 ? "Delete session" : "Delete \(targets.count) sessions", role: .destructive, action: delete)
    }
}

/// The table with the web list's pointer and keys: it watches the pointer
/// over its rows once for all of them — telling the coordinator each row
/// the pointer moves onto, and again when a scroll carries another row
/// under a pointer standing still — asks the coordinator for a row's menu
/// without picking the row, and hands the delete key to it.
final class SessionsTableView: NSTableView {
    var menuForRow: ((Int) -> NSMenu?)?
    var hoveredRow: ((Int) -> Void)?
    var deleteSelection: (() -> Void)?
    private var hoverTracking: NSTrackingArea?

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let hoverTracking { removeTrackingArea(hoverTracking) }
        let tracking = NSTrackingArea(
            rect: .zero, options: [.mouseMoved, .mouseEnteredAndExited, .activeInActiveApp, .inVisibleRect],
            owner: self, userInfo: nil)
        addTrackingArea(tracking)
        hoverTracking = tracking
    }

    override func mouseMoved(with event: NSEvent) {
        super.mouseMoved(with: event)
        hoveredRow?(row(at: convert(event.locationInWindow, from: nil)))
    }

    override func mouseEntered(with event: NSEvent) {
        super.mouseEntered(with: event)
        hoveredRow?(row(at: convert(event.locationInWindow, from: nil)))
    }

    override func mouseExited(with event: NSEvent) {
        super.mouseExited(with: event)
        hoveredRow?(-1)
    }

    override func scrollWheel(with event: NSEvent) {
        super.scrollWheel(with: event)
        refreshHover()
    }

    /// The row under a pointer that has not moved — the rows having moved
    /// under it instead, by a scroll or a report.
    func refreshHover() {
        guard let window else { return }
        let point = convert(window.mouseLocationOutsideOfEventStream, from: nil)
        let inside = visibleRect.contains(point)
        hoveredRow?(inside ? row(at: point) : -1)
    }

    override func menu(for event: NSEvent) -> NSMenu? {
        menuForRow?(row(at: convert(event.locationInWindow, from: nil)))
    }

    override func keyDown(with event: NSEvent) {
        if event.specialKey == .delete || event.specialKey == .deleteForward {
            deleteSelection?()
            return
        }
        super.keyDown(with: event)
    }

    @objc func delete(_ sender: Any?) {
        deleteSelection?()
    }
}

/// The row's wash: the tree's quiet fill when picked (see `TreeSelection`),
/// the faint one the tree's rows wear under the pointer, never emphasized —
/// so the title keeps its colour — and inset from the sidebar's edges with
/// the rounded corners the list's rows have always had.
private final class SessionRowView: NSTableRowView {
    static let identifier = NSUserInterfaceItemIdentifier("SessionRow")

    private static let hoverFill = NSColor(name: nil) { appearance in
        appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
            ? NSColor.white.withAlphaComponent(0.05)
            : NSColor.black.withAlphaComponent(0.05)
    }

    var isHovered = false {
        didSet { if isHovered != oldValue { needsDisplay = true } }
    }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        identifier = Self.identifier
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override var isEmphasized: Bool {
        get { false }
        set {}
    }

    override var interiorBackgroundStyle: NSView.BackgroundStyle { .normal }

    private var wash: NSBezierPath {
        let height = SessionCellView.rowHeight
        let rect = NSRect(
            x: SessionCellView.listInset, y: (bounds.height - height) / 2,
            width: bounds.width - SessionCellView.listInset * 2, height: height)
        return NSBezierPath(roundedRect: rect, xRadius: 7, yRadius: 7)
    }

    override func drawBackground(in dirtyRect: NSRect) {
        guard isHovered, !isSelected else { return }
        Self.hoverFill.setFill()
        wash.fill()
    }

    override func drawSelection(in dirtyRect: NSRect) {
        guard isSelected else { return }
        TreeSelection.fill.setFill()
        wash.fill()
    }
}

/// One session: the title, and a column at the trailing edge that the mark
/// and the ✕ share — the web row's, which is why a title with nothing
/// beside it runs the whole width and is cut only once that column opens
/// under the pointer. A row already wearing a mark has the column open, so
/// the pointer swaps the mark for the ✕ rather than moving the title.
/// Laid out by hand, as the tree's cells are: a reused cell has nothing to
/// solve.
private final class SessionCellView: NSTableCellView {
    static let identifier = NSUserInterfaceItemIdentifier("SessionCell")
    static let rowHeight: CGFloat = 32
    /// The list's margin from the sidebar's edges, which the wash keeps.
    static let listInset: CGFloat = 10

    /// The row's own padding inside the wash.
    private static let padding: CGFloat = 8
    private static let column: CGFloat = 20
    private static let gap: CGFloat = 6
    private static let accessoryHeight: CGFloat = 18
    /// The ✕'s lit square, as wide as the column; taller than the column's
    /// 18, which it overhangs evenly rather than being squeezed to fit.
    private static let plate: CGFloat = 20
    /// The web row's 160ms: long enough to read as the column opening,
    /// short enough that the title is never chasing the pointer.
    private static let opening: TimeInterval = 0.16

    private let titleField = NSTextField(labelWithString: "")
    private let accessory = NSView()
    private let deleteButton = PlateButton()
    // At 14pt the orb's lattice is only 7.5pt across, and its faint resting
    // dots disappear into the sidebar's material; the toolbar's scale reads
    // and still fits the 20×18 column.
    private let orb = OrbView(size: 18, label: SessionMark.running.label)
    private let dot = NSView()

    private var mark: SessionMark?
    private var hovering = false
    var onDelete: (() -> Void)?

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        identifier = Self.identifier

        titleField.font = .systemFont(ofSize: 14)
        titleField.textColor = IslandPalette.text
        titleField.lineBreakMode = .byTruncatingTail
        titleField.maximumNumberOfLines = 1
        titleField.cell?.truncatesLastVisibleLine = true

        deleteButton.image = NSImage(systemSymbolName: "xmark", accessibilityDescription: "Delete session")?
            .withSymbolConfiguration(.init(pointSize: 11, weight: .medium))
        deleteButton.refusesFirstResponder = true
        deleteButton.toolTip = "Delete session"
        deleteButton.target = self
        deleteButton.action = #selector(deleteClicked)

        dot.wantsLayer = true
        dot.layer?.cornerRadius = 3.5

        accessory.wantsLayer = true
        for view in [deleteButton, orb, dot] { accessory.addSubview(view) }
        for view in [titleField, accessory] { addSubview(view) }
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func show(_ session: ShellSession, hovering: Bool) {
        if titleField.stringValue != session.title {
            titleField.stringValue = session.title
            toolTip = session.title
        }
        dot.setAccessibilityLabel(session.mark?.label)
        // Every report repaints the rows on screen; one that moved nothing
        // in this row leaves it be, so a column opening under the pointer
        // is not snapped to its end by a mark changing on another row.
        guard session.mark != mark || hovering != self.hovering else { return }
        mark = session.mark
        setHovering(hovering, animated: false)
    }

    /// The pointer onto the row or off it: the ✕ takes the mark's place at
    /// once, and the column opens for it — or shuts behind it — over the
    /// web's 160ms.
    func setHovering(_ hovering: Bool, animated: Bool) {
        self.hovering = hovering
        deleteButton.isHidden = !hovering
        orb.isHidden = hovering || mark != .running
        dot.isHidden = hovering || mark == nil || mark == .running
        if let mark, mark != .running {
            dot.layer?.backgroundColor = (mark == .error ? NSColor.systemRed : NSColor.controlAccentColor).cgColor
        }
        guard animated, window != nil, !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion else {
            needsLayout = true
            return
        }
        NSAnimationContext.runAnimationGroup { context in
            context.duration = Self.opening
            context.timingFunction = CAMediaTimingFunction(name: .easeOut)
            place(animated: true)
        }
    }

    @objc private func deleteClicked() {
        onDelete?()
    }

    override func layout() {
        super.layout()
        place(animated: false)
    }

    /// The column laid out at its own size and faded in with the width that
    /// opens, rather than clipped to it: the ✕'s lit corners round a little
    /// wider than the glyph's box, and a clip that tight cuts them square.
    private func place(animated: Bool) {
        let open = mark != nil || hovering
        let inset = Self.listInset + Self.padding
        let height = bounds.height
        let trailing = bounds.width - inset
        let titleHeight = ceil(titleField.font!.ascender - titleField.font!.descender) + 2
        let titleWidth = max(0, trailing - inset - (open ? Self.column + Self.gap : 0))
        let titleFrame = NSRect(x: inset, y: (height - titleHeight) / 2, width: titleWidth, height: titleHeight)
        let alpha: CGFloat = open ? 1 : 0
        if animated {
            titleField.animator().frame = titleFrame
            accessory.animator().alphaValue = alpha
        } else {
            titleField.frame = titleFrame
            accessory.alphaValue = alpha
        }
        accessory.frame = NSRect(
            x: trailing - Self.column, y: (height - Self.accessoryHeight) / 2,
            width: Self.column, height: Self.accessoryHeight)
        deleteButton.frame = NSRect(
            x: (Self.column - Self.plate) / 2, y: (Self.accessoryHeight - Self.plate) / 2,
            width: Self.plate, height: Self.plate)
        orb.frame = NSRect(x: (Self.column - 18) / 2, y: 0, width: 18, height: 18)
        dot.frame = NSRect(x: (Self.column - 7) / 2, y: (Self.accessoryHeight - 7) / 2, width: 7, height: 7)
    }
}

/// The ✕: the glyph alone, with a square lit behind it while the pointer
/// is on it and darker while pressed — the bar buttons' look, drawn here
/// because the system's accessory bezel sizes itself to its own height and
/// stood a tall sliver behind the glyph at this size.
private final class PlateButton: NSButton {
    private static let hoverFill = NSColor.labelColor.withAlphaComponent(0.1)
    private static let pressFill = NSColor.labelColor.withAlphaComponent(0.18)

    private var hovering = false {
        didSet { if hovering != oldValue { paint() } }
    }
    private var tracking: NSTrackingArea?

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        isBordered = false
        imagePosition = .imageOnly
        imageScaling = .scaleNone
        contentTintColor = .secondaryLabelColor
        wantsLayer = true
        layer?.cornerRadius = 5
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let tracking { removeTrackingArea(tracking) }
        let area = NSTrackingArea(
            rect: .zero, options: [.mouseEnteredAndExited, .activeInActiveApp, .inVisibleRect],
            owner: self, userInfo: nil)
        addTrackingArea(area)
        tracking = area
    }

    override func mouseEntered(with event: NSEvent) { hovering = true }

    override func mouseExited(with event: NSEvent) { hovering = false }

    override var isHidden: Bool {
        didSet { if isHidden { hovering = false } }
    }

    override func highlight(_ flag: Bool) {
        super.highlight(flag)
        paint()
    }

    override func viewDidChangeEffectiveAppearance() {
        super.viewDidChangeEffectiveAppearance()
        paint()
    }

    private func paint() {
        let fill = isHighlighted ? Self.pressFill : hovering ? Self.hoverFill : nil
        effectiveAppearance.performAsCurrentDrawingAppearance {
            layer?.backgroundColor = fill?.cgColor
        }
    }
}

/// The foot of a list with more to come, while the next page is fetched.
private final class SessionsFooterView: NSTableCellView {
    static let identifier = NSUserInterfaceItemIdentifier("SessionsFooter")

    private let label = NSTextField(labelWithString: "Loading more…")

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        identifier = Self.identifier
        label.font = .systemFont(ofSize: 11)
        label.textColor = .secondaryLabelColor
        label.alignment = .center
        addSubview(label)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layout() {
        super.layout()
        let height = ceil(label.fittingSize.height)
        label.frame = NSRect(x: 0, y: (bounds.height - height) / 2, width: bounds.width, height: height)
    }
}
