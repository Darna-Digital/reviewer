// The window's toolbar, as AppKit's own NSToolbar under a delegate of the
// app's rather than the one SwiftUI makes from `.toolbar` content — on a
// window AppKit makes too, whose hosted views leave its toolbar alone (see
// `WorkspaceWindow`).
//
// Because the session tabs have to be a flexible item: one the bar sizes
// to the room it has, from a single tab's width up to every tab at its
// widest, never taking it off into the ›› menu. NSToolbar does that for an
// item whose view says so in Auto Layout (see `SessionTabBar`), and only
// for one of its own — SwiftUI hosts every item it makes in a view frozen
// at the size it first fits, so a row of tabs on SwiftUI's bar either runs
// off the end or has to measure the window to stay short of it.
//
// What the bar holds, in two runs. The sidebar's: the project picker and
// the sidebar's toggle at its trailing edge, both on the bar whether the
// sidebar is open or folded away. Folded, the bar gives the run room for
// one item beside the traffic lights; the toggle is the one it keeps, and
// the picker goes to the ›› menu. Between the runs, the system's tracking
// separator, which holds the sidebar's to the column's edge as it is
// dragged or slides away. Over the detail: the pinned pair, Code and
// Sessions, the system's toggle buttons in one pane of the toolbar's glass
// (see `ModeButtons`), and the session tabs after them — the pair and the tabs
// only once there is a project to switch between.
import AppKit
import SwiftUI

@MainActor
final class WindowToolbar: NSObject, NSToolbarDelegate, NSMenuDelegate {
    private let model: AppModel
    private let toolbar = NSToolbar(identifier: "ReviewerWindow")
    private var items: [NSToolbarItem.Identifier: NSToolbarItem] = [:]
    private let sidebarToggle = SidebarToggle()
    private lazy var modeButtons = ModeButtons(model: model, identifier: Self.mode)
    private let modeMenu = NSMenu()
    private let sessionsMenu = NSMenu()

    private static let picker = NSToolbarItem.Identifier("reviewer.projectPicker")
    private static let toggle = NSToolbarItem.Identifier("reviewer.sidebarToggle")
    private static let mode = NSToolbarItem.Identifier("reviewer.mode")
    private static let sessions = NSToolbarItem.Identifier("reviewer.sessions")

    init(model: AppModel) {
        self.model = model
        super.init()
        toolbar.delegate = self
        toolbar.displayMode = .iconOnly
        toolbar.allowsUserCustomization = false
        toolbar.allowsDisplayModeCustomization = false
        modeMenu.delegate = self
        sessionsMenu.delegate = self
        sidebarToggle.button.target = self
        sidebarToggle.button.action = #selector(toggleSidebar)
        follow()
    }

    /// The full-height unified toolbar, not the compact one: only under it
    /// does the system run the sidebar's pane up to the window's top edge,
    /// with the traffic lights and the sidebar's toggle inside it, as Music
    /// has it. Compact keeps a title bar strip above the pane.
    func install(in window: NSWindow) {
        window.toolbar = toolbar
        window.toolbarStyle = .unified
    }

    /// Keeps the bar's state with the model's: the pair and the tabs only
    /// with a project open, and the toggle named for what it would do.
    /// Nothing is placed for the sidebar: the separator holds the sidebar's
    /// run to its edge, and the rest to the detail.
    private func follow() {
        let (hasProject, sidebarShown) = withObservationTracking {
            (model.hasProject, model.sidebarShown)
        } onChange: { [weak self] in
            Task { @MainActor [weak self] in self?.follow() }
        }
        sidebarToggle.sidebarShown = sidebarShown
        items[Self.toggle]?.menuFormRepresentation?.title = sidebarToggle.title
        items[Self.mode]?.isHidden = !hasProject
        items[Self.sessions]?.isHidden = !hasProject
    }

    func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        [.flexibleSpace, Self.picker, Self.toggle, .sidebarTrackingSeparator, Self.mode, Self.sessions]
    }

    func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        toolbarDefaultItemIdentifiers(toolbar)
    }

    func toolbar(
        _ toolbar: NSToolbar, itemForItemIdentifier identifier: NSToolbarItem.Identifier,
        willBeInsertedIntoToolbar flag: Bool
    ) -> NSToolbarItem? {
        let item = NSToolbarItem(itemIdentifier: identifier)
        switch identifier {
        case Self.picker:
            item.label = "Workspace"
            item.view = hosted(ProjectPicker().environment(model))
            item.isBordered = false
            item.menuFormRepresentation = menuItem("Open workspace…", #selector(openWorkspace))
        case Self.toggle:
            item.label = "Sidebar"
            item.view = sidebarToggle
            item.isBordered = false
            item.menuFormRepresentation = menuItem(sidebarToggle.title, #selector(toggleSidebar))
            // The one item the folded sidebar's run has room for is this
            // one, the way back to the sidebar; the picker goes to ›› first.
            item.visibilityPriority = .high
        case Self.mode:
            let group = modeButtons.item
            group.isHidden = !model.hasProject
            group.menuFormRepresentation = submenuItem(group.label, modeMenu)
            items[identifier] = group
            return group
        case Self.sessions:
            item.label = "Sessions"
            item.view = SessionTabBar(model: model)
            item.isBordered = false
            item.menuFormRepresentation = submenuItem(item.label, sessionsMenu)
            item.isHidden = !model.hasProject
            // The tabs give way before anything else on the bar does.
            item.visibilityPriority = .low
        default:
            return nil
        }
        items[identifier] = item
        return item
    }

    // MARK: The ›› menu
    //
    // An item whose view is our own has nothing to show in the bar's ››
    // menu unless it says what it is as a menu item: the picker as what ⌘O
    // does, the pair and the tabs as menus of the tabs they hold, read as
    // the menu opens.

    private func menuItem(_ title: String, _ action: Selector) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: "")
        item.target = self
        return item
    }

    private func submenuItem(_ title: String, _ menu: NSMenu) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        item.submenu = menu
        return item
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        let strip = model.windowTabs
        menu.removeAllItems()
        let tabs = menu === modeMenu ? strip.tabs.filter(\.pinned) : strip.sessions
        for tab in tabs {
            let item = menuItem(tab.title, #selector(selectTab(_:)))
            item.representedObject = tab.id
            item.state = strip.lights(tab) ? .on : .off
            menu.addItem(item)
        }
        if menu === sessionsMenu {
            if !tabs.isEmpty { menu.addItem(.separator()) }
            menu.addItem(menuItem("New session", #selector(newSession)))
        }
    }

    @objc private func openWorkspace() { model.showOpener() }
    @objc private func toggleSidebar() { model.toggleSidebar() }
    @objc private func newSession() { model.newSession() }

    @objc private func selectTab(_ sender: NSMenuItem) {
        guard let id = sender.representedObject as? String else { return }
        model.select(tabId: id)
    }

    /// A SwiftUI control as an item's view, at the size it asks for.
    private func hosted(_ view: some View) -> NSView {
        let host = NSHostingView(rootView: view)
        host.sizingOptions = [.intrinsicContentSize]
        host.translatesAutoresizingMaskIntoConstraints = false
        return host
    }
}

/// The sidebar's toggle as the bar's own chip, a bare glyph on the
/// sidebar's glass rather than the disc of glass a bordered item wears —
/// Tahoe's floating sidebar never had a toggle in glass on its glass —
/// named on the bar's glass label rather than in a tooltip (see
/// `ToolbarGlassLabel`). It keeps the islands' margin clear after it, so
/// the column's edge, where the sidebar is dragged wider, is not under it.
@MainActor
private final class SidebarToggle: NSView {
    let button = BarChipButton(symbol: "sidebar.left", pointSize: 14, weight: .regular)
    private let label = ToolbarHoverView()

    var sidebarShown = true {
        didSet {
            label.labels = [ToolbarGlassLabel.Text(title: title, hint: "⌃⌘S")]
            button.setAccessibilityLabel(title)
        }
    }

    var title: String { sidebarShown ? "Hide sidebar" : "Show sidebar" }

    /// The picker's chip beside it: its height, and the air it keeps either
    /// side of its label, so the two read as one pair of chips.
    private static let height: CGFloat = 30
    private static let sidePadding: CGFloat = 8

    init() {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        button.translatesAutoresizingMaskIntoConstraints = false
        addSubview(button)
        label.frame = button.bounds
        label.autoresizingMask = [.width, .height]
        button.addSubview(label)
        NSLayoutConstraint.activate([
            button.widthAnchor.constraint(
                equalToConstant: ceil(button.image?.size.width ?? 0) + Self.sidePadding * 2),
            button.heightAnchor.constraint(equalToConstant: Self.height),
            button.leadingAnchor.constraint(equalTo: leadingAnchor),
            button.topAnchor.constraint(equalTo: topAnchor),
            button.bottomAnchor.constraint(equalTo: bottomAnchor),
            trailingAnchor.constraint(equalTo: button.trailingAnchor, constant: IslandMetrics.margin),
        ])
        sidebarShown = true
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("SidebarToggle is not loaded from a nib") }}
