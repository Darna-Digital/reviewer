// The tree as a native outline: an `NSOutlineView` in source-list style —
// the system's own disclosure triangles, selection, vibrancy, arrow keys and
// tooltips, its rows reused as they scroll — laid out the way the web app's
// tree lays a row out: the file's type icon, the name, and at the trailing
// edge the git status letter, or a dot on a folder with a changed file
// somewhere under it. A changed file's name and icon take the status hue,
// as in the web tree. Left and Right fold and unfold the selected folder, a
// double click does too, and the context menu is the web tree's, with a
// native prompt where the web tree edits inline.
//
// The outline is driven, not diffed: it reloads when `SidebarTree` says the
// tree is another one, redraws the rows on screen when the statuses moved,
// and follows the page's selection — and reports each fold and each pick
// back. Selecting a file is the one thing it does to the page.
//
// One outline serves every mode — the sidebar keeps it up across browse and
// the diff rather than making another — and a tree remade for another mode
// or project crossfades: the rows as they were stay over the outline as a
// picture while the new ones come up under them, since a reload is instant
// and one tree's rows cannot be moved to another's.
import AppKit
import SwiftUI

struct FileTreeOutline: View {
    @Environment(AppModel.self) private var model
    @State private var prompt: TreePrompt?

    var body: some View {
        let tree = model.sidebar
        OutlineRepresentable(
            model: model,
            treeVersion: tree.treeVersion,
            remadeVersion: tree.remadeVersion,
            statusVersion: tree.statusVersion,
            selected: tree.selected,
            prompt: $prompt
        )
        .treePrompts($prompt)
    }
}

private struct OutlineRepresentable: NSViewRepresentable {
    let model: AppModel
    let treeVersion: Int
    let remadeVersion: Int
    let statusVersion: Int
    let selected: String?
    @Binding var prompt: TreePrompt?

    func makeCoordinator() -> OutlineCoordinator {
        OutlineCoordinator(model: model, prompt: $prompt)
    }

    func makeNSView(context: Context) -> CrossfadingHost {
        let outline = FileTreeOutlineView()
        let column = NSTableColumn(identifier: .init("path"))
        column.resizingMask = .autoresizingMask
        outline.addTableColumn(column)
        outline.outlineTableColumn = column
        outline.headerView = nil
        outline.style = .sourceList
        outline.rowSizeStyle = .custom
        outline.rowHeight = FileTreeCellView.rowHeight
        outline.intercellSpacing = .zero
        outline.indentationPerLevel = 16
        outline.indentationMarkerFollowsCell = true
        outline.autoresizesOutlineColumn = true
        outline.columnAutoresizingStyle = .firstColumnOnlyAutoresizingStyle
        outline.allowsMultipleSelection = false
        outline.allowsEmptySelection = true
        outline.usesAutomaticRowHeights = false
        outline.autosaveExpandedItems = false
        outline.floatsGroupRows = false
        outline.backgroundColor = .clear
        outline.dataSource = context.coordinator
        outline.delegate = context.coordinator
        outline.target = context.coordinator
        outline.doubleAction = #selector(OutlineCoordinator.doubleClicked)
        outline.menuForNode = { [coordinator = context.coordinator] node in coordinator.menu(for: node) }
        outline.hoveredNode = { [coordinator = context.coordinator] node in coordinator.hovered(node) }
        outline.appearanceChanged = { [coordinator = context.coordinator] in coordinator.redrawVisibleRows() }
        context.coordinator.outline = outline

        let scroll = NSScrollView()
        scroll.documentView = outline
        scroll.hasVerticalScroller = true
        scroll.hasHorizontalScroller = false
        scroll.autohidesScrollers = true
        scroll.drawsBackground = false
        scroll.borderType = .noBorder
        let host = CrossfadingHost(over: scroll)
        context.coordinator.host = host
        return host
    }

    func updateNSView(_ host: CrossfadingHost, context: Context) {
        context.coordinator.prompt = $prompt
        context.coordinator.sync(
            treeVersion: treeVersion, remadeVersion: remadeVersion, statusVersion: statusVersion,
            selected: selected)
    }
}

/// The scroll view's holder, which can lay a picture of it over it and fade
/// the picture away: what the outline crossfades through when the tree it
/// shows is replaced. The picture is pinned to the top-left corner and
/// clipped, so the outline resizing under it — the search band sliding in
/// over the tree — moves nothing in it; it is only what was there, going.
final class CrossfadingHost: NSView {
    let scroll: NSScrollView

    init(over scroll: NSScrollView) {
        self.scroll = scroll
        super.init(frame: .zero)
        scroll.autoresizingMask = [.width, .height]
        addSubview(scroll)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layout() {
        super.layout()
        scroll.frame = bounds
    }

    private static let duration: TimeInterval = 0.22

    /// Runs the change with the scroll view as it was held over it, fading;
    /// bare when there is nothing on screen to fade from, or the user asked
    /// for less motion.
    func crossfade(_ change: () -> Void) {
        guard window != nil, !bounds.isEmpty,
            !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion,
            let picture = picture()
        else {
            change()
            return
        }
        let ghost = NSImageView(frame: scroll.frame)
        ghost.image = picture
        ghost.imageScaling = .scaleNone
        ghost.imageAlignment = .alignTopLeft
        ghost.autoresizingMask = [.width, .height]
        ghost.clipsToBounds = true
        ghost.wantsLayer = true
        addSubview(ghost, positioned: .above, relativeTo: scroll)
        change()
        NSAnimationContext.runAnimationGroup { context in
            context.duration = Self.duration
            context.timingFunction = CAMediaTimingFunction(name: .easeOut)
            ghost.animator().alphaValue = 0
        } completionHandler: {
            ghost.removeFromSuperview()
        }
    }

    private func picture() -> NSImage? {
        guard let bitmap = scroll.bitmapImageRepForCachingDisplay(in: scroll.bounds) else { return nil }
        scroll.cacheDisplay(in: scroll.bounds, to: bitmap)
        let image = NSImage(size: scroll.bounds.size)
        image.addRepresentation(bitmap)
        return image
    }
}

@MainActor
private final class OutlineCoordinator: NSObject, NSOutlineViewDataSource, NSOutlineViewDelegate {
    let model: AppModel
    var prompt: Binding<TreePrompt?>
    weak var outline: FileTreeOutlineView?
    weak var host: CrossfadingHost?

    private var shownTreeVersion = -1
    private var shownRemadeVersion = -1
    private var drawnStatusVersion = -1
    private var followedSelection: String?
    private var applyingFolds = false

    private var tree: SidebarTree { model.sidebar }

    init(model: AppModel, prompt: Binding<TreePrompt?>) {
        self.model = model
        self.prompt = prompt
    }

    // MARK: driven from the model

    func sync(treeVersion: Int, remadeVersion: Int, statusVersion: Int, selected: String?) {
        guard let outline else { return }
        if treeVersion != shownTreeVersion {
            shownTreeVersion = treeVersion
            drawnStatusVersion = statusVersion
            let remade = remadeVersion != shownRemadeVersion
            shownRemadeVersion = remadeVersion
            let reload = {
                self.applyingFolds = true
                outline.reloadData()
                // One batch: a fold opened on its own re-tiles every row
                // under it, and a diff opens every folder it has, so opened
                // one at a time a large tree cost a full pass per folder.
                outline.beginUpdates()
                self.expandAsFolded(self.tree.shown)
                outline.endUpdates()
                self.applyingFolds = false
                // Another tree starts at its top; the same one filtered
                // keeps its place.
                if remade { outline.scroll(.zero) }
            }
            if remade, let host { host.crossfade(reload) } else { reload() }
            followedSelection = nil
        } else if statusVersion != drawnStatusVersion {
            drawnStatusVersion = statusVersion
            redrawVisibleRows()
        }
        if selected != followedSelection {
            followedSelection = selected
            follow(selected)
        }
    }

    private func expandAsFolded(_ nodes: [FileTreeNode]) {
        guard let outline else { return }
        for node in nodes where node.isDirectory && tree.isExpanded(node.id) {
            outline.expandItem(node)
            expandAsFolded(node.children)
        }
    }

    /// Puts the page's file on screen, selected, with the folds on the way
    /// to it open; no file, no selection.
    private func follow(_ path: String?) {
        guard let outline else { return }
        guard let path, let node = tree.shownNodes[path] else {
            outline.deselectAll(nil)
            return
        }
        for ancestor in FileTree.ancestors(of: path) {
            if let folder = tree.shownNodes[ancestor], !outline.isItemExpanded(folder) { outline.expandItem(folder) }
        }
        let row = outline.row(forItem: node)
        guard row >= 0 else { return }
        if outline.selectedRow != row { outline.selectRowIndexes([row], byExtendingSelection: false) }
        outline.scrollRowToVisible(row)
    }

    func redrawVisibleRows() {
        guard let outline else { return }
        let dark = outline.isDark
        outline.enumerateAvailableRowViews { rowView, row in
            guard let cell = rowView.view(atColumn: 0) as? FileTreeCellView,
                let node = outline.item(atRow: row) as? FileTreeNode
            else { return }
            self.configure(cell, for: node, expanded: outline.isItemExpanded(node), dark: dark)
        }
    }

    private func configure(_ cell: FileTreeCellView, for node: FileTreeNode, expanded: Bool, dark: Bool) {
        cell.show(
            node,
            status: tree.status(of: node.id),
            hasChanges: node.isDirectory && tree.foldersWithChanges.contains(node.id),
            expanded: expanded,
            dark: dark)
    }

    // MARK: NSOutlineViewDataSource

    func outlineView(_ outlineView: NSOutlineView, numberOfChildrenOfItem item: Any?) -> Int {
        ((item as? FileTreeNode)?.children ?? tree.shown).count
    }

    func outlineView(_ outlineView: NSOutlineView, child index: Int, ofItem item: Any?) -> Any {
        ((item as? FileTreeNode)?.children ?? tree.shown)[index]
    }

    func outlineView(_ outlineView: NSOutlineView, isItemExpandable item: Any) -> Bool {
        (item as? FileTreeNode)?.isDirectory ?? false
    }

    // MARK: NSOutlineViewDelegate

    func outlineView(_ outlineView: NSOutlineView, viewFor tableColumn: NSTableColumn?, item: Any) -> NSView? {
        guard let node = item as? FileTreeNode else { return nil }
        let cell =
            outlineView.makeView(withIdentifier: FileTreeCellView.identifier, owner: nil) as? FileTreeCellView
            ?? FileTreeCellView()
        configure(cell, for: node, expanded: outlineView.isItemExpanded(node), dark: outlineView.isDark)
        return cell
    }

    func outlineView(_ outlineView: NSOutlineView, rowViewForItem item: Any) -> NSTableRowView? {
        outlineView.makeView(withIdentifier: FileTreeRowView.identifier, owner: nil) as? FileTreeRowView
            ?? FileTreeRowView()
    }

    func outlineViewSelectionDidChange(_ notification: Notification) {
        guard let outline, outline.selectedRow >= 0,
            let node = outline.item(atRow: outline.selectedRow) as? FileTreeNode,
            !node.isDirectory, node.id != tree.selected
        else { return }
        model.act(onTree: .select(node.id))
    }

    func outlineViewItemDidExpand(_ notification: Notification) { folded(notification, open: true) }

    func outlineViewItemDidCollapse(_ notification: Notification) { folded(notification, open: false) }

    private func folded(_ notification: Notification, open: Bool) {
        // A fold applied on a reload is not one to record, and has no cell
        // to repaint yet: the rows are made after, each with its fold's
        // state. Finding the row is a scan of them all, so looked up here
        // for every folder a reload opened it made the reload quadratic.
        guard !applyingFolds, let outline, let node = notification.userInfo?["NSObject"] as? FileTreeNode
        else { return }
        let row = outline.row(forItem: node)
        if row >= 0, let cell = outline.view(atColumn: 0, row: row, makeIfNecessary: false) as? FileTreeCellView {
            cell.setExpanded(open)
        }
        guard !tree.isSearching else { return }
        tree.setExpanded(node.id, open)
    }

    // MARK: the outline's own gestures

    @objc func doubleClicked() {
        guard let outline, outline.clickedRow >= 0,
            let node = outline.item(atRow: outline.clickedRow) as? FileTreeNode, node.isDirectory
        else { return }
        if outline.isItemExpanded(node) { outline.collapseItem(node) } else { outline.expandItem(node) }
    }

    func menu(for node: FileTreeNode) -> NSMenu {
        NSHostingMenu(rootView: TreeRowMenu(path: node.id, prompt: prompt).environment(model))
    }

    /// The pointer has come to rest over a file: the page renders it now, so
    /// the click lands on a file already on screen rather than a loader.
    func hovered(_ node: FileTreeNode) {
        guard !node.isDirectory, node.id != tree.selected else { return }
        model.act(onTree: .intent(node.id))
    }
}

/// The outline with the web tree's keys and menu: Left on a file or a closed
/// folder climbs to the folder holding it, and a right click asks for the
/// row's menu without picking the row. The rows' tooltips are `PathTooltip`'s
/// rather than the system's, so a path stays one small line: the outline
/// watches the pointer over its rows and tells the tooltip which row's path
/// it is on.
private final class FileTreeOutlineView: NSOutlineView {
    var menuForNode: ((FileTreeNode) -> NSMenu?)?
    var appearanceChanged: (() -> Void)?
    /// Told once per row the pointer moves onto, not once per pixel.
    var hoveredNode: ((FileTreeNode) -> Void)?
    private var hoverTracking: NSTrackingArea?
    private var hoveredRow = -1

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
        let row = row(at: convert(event.locationInWindow, from: nil))
        let cell = row >= 0 ? view(atColumn: 0, row: row, makeIfNecessary: false) as? FileTreeCellView : nil
        PathTooltip.shared.hover(cell?.tip, at: event.locationInWindow, in: window)
        if row != hoveredRow {
            hoveredRow = row
            if row >= 0, let node = item(atRow: row) as? FileTreeNode { hoveredNode?(node) }
        }
    }

    override func mouseExited(with event: NSEvent) {
        super.mouseExited(with: event)
        hoveredRow = -1
        PathTooltip.shared.hide()
    }

    override func mouseDown(with event: NSEvent) {
        PathTooltip.shared.hide()
        super.mouseDown(with: event)
    }

    override func rightMouseDown(with event: NSEvent) {
        PathTooltip.shared.hide()
        super.rightMouseDown(with: event)
    }

    override func scrollWheel(with event: NSEvent) {
        PathTooltip.shared.hide()
        super.scrollWheel(with: event)
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if window == nil { PathTooltip.shared.hide() }
    }

    override func menu(for event: NSEvent) -> NSMenu? {
        let row = row(at: convert(event.locationInWindow, from: nil))
        guard row >= 0, let node = item(atRow: row) as? FileTreeNode else { return nil }
        return menuForNode?(node)
    }

    override func keyDown(with event: NSEvent) {
        if event.specialKey == .leftArrow, selectedRow >= 0,
            let node = item(atRow: selectedRow) as? FileTreeNode,
            !(node.isDirectory && isItemExpanded(node)),
            let parent = parent(forItem: node)
        {
            let row = row(forItem: parent)
            guard row >= 0 else { return }
            selectRowIndexes([row], byExtendingSelection: false)
            scrollRowToVisible(row)
            return
        }
        super.keyDown(with: event)
    }

    override func viewDidChangeEffectiveAppearance() {
        super.viewDidChangeEffectiveAppearance()
        appearanceChanged?()
    }
}

/// The selected row wears `TreeSelection`'s quiet fill and never counts as
/// emphasized, so the cell's labels keep their own colours.
private final class FileTreeRowView: NSTableRowView {
    static let identifier = NSUserInterfaceItemIdentifier("FileTreeRow")

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

    override func drawSelection(in dirtyRect: NSRect) {
        guard isSelected else { return }
        TreeSelection.fill.setFill()
        NSBezierPath(roundedRect: bounds.insetBy(dx: 10, dy: 0), xRadius: 5, yRadius: 5).fill()
    }
}

/// One row: icon, name, and the status letter or the changes dot at the
/// trailing edge, laid out by hand — a reused cell has nothing to solve.
/// The row is the web tree's size, 13pt text on a 30pt line, and the fields
/// are the cell's own rather than its `textField` and `imageView`, which the
/// source-list style would resize to the system's sidebar row size.
private final class FileTreeCellView: NSTableCellView {
    static let identifier = NSUserInterfaceItemIdentifier("FileTreeCell")
    static let rowHeight: CGFloat = 30

    private static let iconSize: CGFloat = 16
    private static let closedFolder = folderSymbol("folder.fill")
    private static let openFolder = folderSymbol("folder")
    private static let badgeFont = NSFont.monospacedSystemFont(ofSize: 11, weight: .semibold)

    /// A label's cell keeps `badgeInset` of padding around the text it
    /// draws, and reports an `intrinsicContentSize` without it — a field
    /// that narrow shears the trailing stem off the letter. Every letter is
    /// one monospaced glyph, so they all fit the same width, measured once;
    /// the padding comes back out of the frame when it is placed, so the
    /// letter sits where the trailing margin says it does.
    private static let badgeInset: CGFloat = 2
    private static let badgeWidth: CGFloat = {
        let field = NSTextField(labelWithString: "M")
        field.font = badgeFont
        field.alignment = .right
        return ceil(field.fittingSize.width)
    }()

    private let iconView = NSImageView()
    private let nameField = NSTextField(labelWithString: "")
    private let badgeField = NSTextField(labelWithString: "")
    private let dotView = NSView()

    private var isDirectory = false
    private var nameColor: NSColor = .labelColor
    /// The row's tooltip: the path, and the status when it has one.
    private(set) var tip = ""

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        identifier = Self.identifier

        iconView.imageScaling = .scaleProportionallyUpOrDown
        nameField.font = .systemFont(ofSize: 13)
        nameField.lineBreakMode = .byTruncatingMiddle
        nameField.maximumNumberOfLines = 1
        nameField.cell?.truncatesLastVisibleLine = true
        badgeField.font = Self.badgeFont
        badgeField.alignment = .right
        dotView.wantsLayer = true
        dotView.layer?.cornerRadius = 3

        for view in [iconView, nameField, badgeField, dotView] { addSubview(view) }
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func show(_ node: FileTreeNode, status: GitFileStatus?, hasChanges: Bool, expanded: Bool, dark: Bool) {
        isDirectory = node.isDirectory
        let ignored = status == .ignored
        nameField.stringValue = node.name
        if ignored {
            nameColor = .tertiaryLabelColor
        } else if let status {
            nameColor = status.nsColor(dark: dark)
        } else {
            nameColor = .labelColor
        }
        paintName()
        if node.isDirectory {
            setExpanded(expanded)
            iconView.contentTintColor = ignored ? .tertiaryLabelColor : .secondaryLabelColor
            iconView.alphaValue = 1
        } else {
            let tint = status.flatMap { $0 == .ignored ? nil : $0.hex(dark: dark) }
            iconView.image = FileIcon.image(for: node.id, dark: dark, tint: tint) ?? Self.document
            iconView.contentTintColor = nil
            iconView.alphaValue = ignored ? 0.5 : 1
        }
        if let status, let badge = status.badge {
            badgeField.stringValue = badge
            badgeField.textColor = status.nsColor(dark: dark)
            badgeField.isHidden = false
            dotView.isHidden = true
        } else {
            badgeField.isHidden = true
            dotView.isHidden = !hasChanges
            dotView.layer?.backgroundColor = NSColor.secondaryLabelColor.cgColor
        }
        tip = status.map { "\(node.id) — \($0.title.lowercased())" } ?? node.id
        needsLayout = true
    }

    private func paintName() {
        nameField.textColor = nameColor
    }

    func setExpanded(_ expanded: Bool) {
        guard isDirectory else { return }
        iconView.image = expanded ? Self.openFolder : Self.closedFolder
    }

    override func layout() {
        super.layout()
        let height = bounds.height
        let iconSize = Self.iconSize
        iconView.frame = NSRect(x: 0, y: (height - iconSize) / 2, width: iconSize, height: iconSize)
        var trailing = bounds.width - 4
        if !badgeField.isHidden {
            let width = Self.badgeWidth
            badgeField.frame = NSRect(
                x: trailing + Self.badgeInset - width, y: (height - 16) / 2, width: width, height: 16)
            trailing -= width - Self.badgeInset + 6
        } else if !dotView.isHidden {
            dotView.frame = NSRect(x: trailing - 8, y: (height - 6) / 2, width: 6, height: 6)
            trailing -= 14
        }
        let nameX = iconSize + 4
        let nameHeight = ceil(nameField.font!.ascender - nameField.font!.descender) + 2
        nameField.frame = NSRect(
            x: nameX, y: (height - nameHeight) / 2, width: max(0, trailing - nameX), height: nameHeight)
    }

    private static let document: NSImage = {
        let image = NSImage(systemSymbolName: "doc", accessibilityDescription: nil)!
        return image.withSymbolConfiguration(.init(pointSize: 12, weight: .regular))!
    }()

    private static func folderSymbol(_ name: String) -> NSImage {
        NSImage(systemSymbolName: name, accessibilityDescription: nil)!
            .withSymbolConfiguration(.init(pointSize: 12, weight: .regular))!
    }
}

/// What the sidebar asks before it acts, the way the web tree's confirm
/// dialog does: a yes to a discard.
enum TreePrompt: Identifiable, Equatable {
    case discard(paths: [String], of: String)

    var id: String {
        switch self {
        case .discard(_, let of): return "discard:\(of)"
        }
    }
}

/// The web tree's context menu on one row, worded natively.
private struct TreeRowMenu: View {
    let path: String
    @Binding var prompt: TreePrompt?
    @Environment(AppModel.self) private var model

    private var tree: SidebarTree { model.sidebar }
    private var node: FileTreeNode? { tree.nodes[path] }
    private var isDirectory: Bool { node?.isDirectory ?? false }
    private var name: String { node?.name ?? path }
    private var listing: ShellTree? { tree.listing }

    /// What a discard of this row would revert: the file, or the changed
    /// files under the folder.
    private var discardable: [String] {
        guard listing?.discardable == true else { return [] }
        if isDirectory { return tree.changedFiles(under: path) }
        guard let status = tree.statusByPath[path], status != .ignored else { return [] }
        return [path]
    }

    var body: some View {
        if !isDirectory {
            Button("Show History") { model.act(onTree: .history(path)) }
            Divider()
        }
        Button("Copy Path") { copy(path) }
        if let project = listing?.projectPath {
            Button("Copy Absolute Path") { copy(absolute(in: project)) }
            Button("Reveal in Finder") {
                NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: absolute(in: project))])
            }
        }
        if !discardable.isEmpty {
            Divider()
            Button("Discard Changes…") { prompt = .discard(paths: discardable, of: path) }
        }
    }

    private func absolute(in project: String) -> String {
        URL(fileURLWithPath: project).appendingPathComponent(path).path
    }

    private func copy(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }
}

/// The prompt, as an alert on the outline: a yes to a discard.
private struct TreePromptModifier: ViewModifier {
    @Binding var prompt: TreePrompt?
    @Environment(AppModel.self) private var model

    func body(content: Content) -> some View {
        content
            .alert("Discard Changes?", isPresented: shown, presenting: prompt) { prompt in
                Button("Discard", role: .destructive) {
                    if case .discard(let paths, _) = prompt { model.act(onTree: .discard(paths)) }
                }
                Button("Cancel", role: .cancel) {}
            } message: { prompt in
                if case .discard(let paths, let of) = prompt {
                    Text(
                        paths.count == 1
                            ? "Revert the working-tree changes to \(of)? This cannot be undone."
                            : "Revert the working-tree changes to \(paths.count) files under \(of)? This cannot be undone.")
                }
            }
    }

    private var shown: Binding<Bool> {
        Binding(
            get: { prompt != nil },
            set: { if !$0 { prompt = nil } })
    }
}

extension View {
    func treePrompts(_ prompt: Binding<TreePrompt?>) -> some View { modifier(TreePromptModifier(prompt: prompt)) }
}
