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
    let statusVersion: Int
    let selected: String?
    @Binding var prompt: TreePrompt?

    func makeCoordinator() -> OutlineCoordinator {
        OutlineCoordinator(model: model, prompt: $prompt)
    }

    func makeNSView(context: Context) -> NSScrollView {
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
        outline.appearanceChanged = { [coordinator = context.coordinator] in coordinator.redrawVisibleRows() }
        context.coordinator.outline = outline

        let scroll = NSScrollView()
        scroll.documentView = outline
        scroll.hasVerticalScroller = true
        scroll.hasHorizontalScroller = false
        scroll.autohidesScrollers = true
        scroll.drawsBackground = false
        scroll.borderType = .noBorder
        return scroll
    }

    func updateNSView(_ scroll: NSScrollView, context: Context) {
        context.coordinator.prompt = $prompt
        context.coordinator.sync(treeVersion: treeVersion, statusVersion: statusVersion, selected: selected)
    }
}

@MainActor
private final class OutlineCoordinator: NSObject, NSOutlineViewDataSource, NSOutlineViewDelegate {
    let model: AppModel
    var prompt: Binding<TreePrompt?>
    weak var outline: FileTreeOutlineView?

    private var shownTreeVersion = -1
    private var drawnStatusVersion = -1
    private var followedSelection: String?
    private var applyingFolds = false

    private var tree: SidebarTree { model.sidebar }

    init(model: AppModel, prompt: Binding<TreePrompt?>) {
        self.model = model
        self.prompt = prompt
    }

    // MARK: driven from the model

    func sync(treeVersion: Int, statusVersion: Int, selected: String?) {
        guard let outline else { return }
        if treeVersion != shownTreeVersion {
            shownTreeVersion = treeVersion
            drawnStatusVersion = statusVersion
            applyingFolds = true
            outline.reloadData()
            expandAsFolded(tree.shown)
            applyingFolds = false
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
        guard let outline, let node = notification.userInfo?["NSObject"] as? FileTreeNode else { return }
        let row = outline.row(forItem: node)
        if row >= 0, let cell = outline.view(atColumn: 0, row: row, makeIfNecessary: false) as? FileTreeCellView {
            cell.setExpanded(open)
        }
        guard !applyingFolds, !tree.isSearching else { return }
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
}

/// The outline with the web tree's keys and menu: Left on a file or a closed
/// folder climbs to the folder holding it, and a right click asks for the
/// row's menu without picking the row.
private final class FileTreeOutlineView: NSOutlineView {
    var menuForNode: ((FileTreeNode) -> NSMenu?)?
    var appearanceChanged: (() -> Void)?

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

extension NSView {
    fileprivate var isDark: Bool { effectiveAppearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua }
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

    private let iconView = NSImageView()
    private let nameField = NSTextField(labelWithString: "")
    private let badgeField = NSTextField(labelWithString: "")
    private let dotView = NSView()

    private var isDirectory = false
    private var nameColor: NSColor = .labelColor

    override var backgroundStyle: NSView.BackgroundStyle {
        didSet { paintName() }
    }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        identifier = Self.identifier

        iconView.imageScaling = .scaleProportionallyUpOrDown
        nameField.font = .systemFont(ofSize: 13)
        nameField.lineBreakMode = .byTruncatingMiddle
        nameField.maximumNumberOfLines = 1
        nameField.cell?.truncatesLastVisibleLine = true
        badgeField.font = .monospacedSystemFont(ofSize: 11, weight: .semibold)
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
        toolTip = status.map { "\(node.id) — \($0.title.lowercased())" } ?? node.id
        needsLayout = true
    }

    /// A plain name goes white on the selection the way a sidebar label
    /// does; a status hue stays its own, as in the web tree.
    private func paintName() {
        nameField.textColor =
            backgroundStyle == .emphasized && nameColor == .labelColor ? .alternateSelectedControlTextColor : nameColor
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
            let width = ceil(badgeField.intrinsicContentSize.width)
            badgeField.frame = NSRect(x: trailing - width, y: (height - 16) / 2, width: width, height: 16)
            trailing -= width + 6
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

/// What the sidebar asks before it acts, the way the web tree's inline
/// editor and confirm dialog do: a name for a new entry, a new name, a yes
/// to a deletion or a discard.
enum TreePrompt: Identifiable, Equatable {
    case create(in: String, entry: TreeItem.Kind)
    case rename(TreeItem)
    case delete(TreeItem)
    case discard(paths: [String], of: String)

    var id: String {
        switch self {
        case .create(let folder, let entry): return "create:\(entry.rawValue):\(folder)"
        case .rename(let item): return "rename:\(item.path)"
        case .delete(let item): return "delete:\(item.path)"
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
    private var item: TreeItem { TreeItem(kind: isDirectory ? .directory : .file, path: path) }
    private var folder: String { isDirectory ? path : FileTree.ancestors(of: path).last ?? "" }
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
        if listing?.editable == true {
            Divider()
            Button("New File…") { prompt = .create(in: folder, entry: .file) }
            Button("New Folder…") { prompt = .create(in: folder, entry: .directory) }
            Button("Rename…") { prompt = .rename(item) }
        }
        if !discardable.isEmpty {
            Divider()
            Button("Discard Changes…") { prompt = .discard(paths: discardable, of: path) }
        }
        if listing?.editable == true {
            Divider()
            Button("Delete…", role: .destructive) { prompt = .delete(item) }
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

/// The prompts, as alerts on the outline: a name to make, a new name, a yes.
private struct TreePromptModifier: ViewModifier {
    @Binding var prompt: TreePrompt?
    @Environment(AppModel.self) private var model
    @State private var name = ""

    func body(content: Content) -> some View {
        content
            .alert(createTitle, isPresented: shown(\.isCreate), presenting: prompt) { prompt in
                TextField("Name", text: $name)
                Button("Create") {
                    if case .create(let folder, let entry) = prompt {
                        model.act(onTree: .create(path: joined(folder, name), entry: entry))
                    }
                }
                .disabled(!validName)
                Button("Cancel", role: .cancel) {}
            } message: { _ in }
            .alert("Rename", isPresented: shown(\.isRename), presenting: prompt) { prompt in
                TextField("New name", text: $name)
                Button("Rename") {
                    if case .rename(let item) = prompt {
                        let folder = FileTree.ancestors(of: item.path).last ?? ""
                        model.act(onTree: .rename(from: item.path, to: joined(folder, name)))
                    }
                }
                .disabled(!validName)
                Button("Cancel", role: .cancel) {}
            } message: { _ in }
            .alert(deleteTitle, isPresented: shown(\.isDelete), presenting: prompt) { prompt in
                Button("Delete", role: .destructive) {
                    if case .delete(let item) = prompt { model.act(onTree: .delete([item])) }
                }
                Button("Cancel", role: .cancel) {}
            } message: { prompt in
                if case .delete(let item) = prompt {
                    Text("\(item.path)\n\nDeleted files go to the project's trash, so Undo can put them back.")
                }
            }
            .alert("Discard Changes?", isPresented: shown(\.isDiscard), presenting: prompt) { prompt in
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
            .onChange(of: prompt) { _, prompt in
                if case .rename(let item)? = prompt {
                    name = item.path.split(separator: "/").last.map(String.init) ?? item.path
                } else {
                    name = ""
                }
            }
    }

    private var validName: Bool {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        return !trimmed.isEmpty && !trimmed.contains("/")
    }

    private func joined(_ folder: String, _ name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        return folder.isEmpty ? trimmed : "\(folder)/\(trimmed)"
    }

    private var createTitle: String {
        switch prompt {
        case .create(let folder, let entry):
            let what = entry == .directory ? "New Folder" : "New File"
            return folder.isEmpty ? what : "\(what) in \(folder)"
        default: return "New"
        }
    }

    private var deleteTitle: String {
        if case .delete(let item)? = prompt { return item.kind == .directory ? "Delete this folder?" : "Delete this file?" }
        return "Delete?"
    }

    private func shown(_ kind: KeyPath<TreePrompt, Bool>) -> Binding<Bool> {
        Binding(
            get: { prompt.map { $0[keyPath: kind] } ?? false },
            set: { if !$0 { prompt = nil } })
    }
}

extension TreePrompt {
    var isCreate: Bool { if case .create = self { true } else { false } }
    var isRename: Bool { if case .rename = self { true } else { false } }
    var isDelete: Bool { if case .delete = self { true } else { false } }
    var isDiscard: Bool { if case .discard = self { true } else { false } }
}

extension View {
    func treePrompts(_ prompt: Binding<TreePrompt?>) -> some View { modifier(TreePromptModifier(prompt: prompt)) }
}
