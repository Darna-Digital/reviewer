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
// What the bar holds is what SwiftUI's held, in the same runs. In the
// sidebar's run, beside the traffic lights: the project picker and the
// sidebar's toggle at its trailing edge, as Music and Notes have them.
// Then the system's tracking separator, which holds the run to the
// sidebar's edge as the column is dragged or slides away. Over the
// detail: the pinned pair, Code and Sessions, the system's segmented
// control in the toolbar's glass (see `ModeSwitch`), and the session tabs
// after them. The pair and the tabs
// only once there is a project to switch between.
//
import AppKit
import SwiftUI

@MainActor
final class WindowToolbar: NSObject, NSToolbarDelegate {
    private let model: AppModel
    private let toolbar = NSToolbar(identifier: "ReviewerWindow")
    private let sidebarToggle = SidebarToggleButton()
    private var items: [NSToolbarItem.Identifier: NSToolbarItem] = [:]

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
        sidebarToggle.target = self
        sidebarToggle.action = #selector(toggleSidebar)
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
    /// with a project open, the toggle named for what it would do, and the
    /// project picker on the bar only while the sidebar it heads is — a
    /// column's items are the column's, as SwiftUI kept them.
    private func follow() {
        let (hasProject, sidebarShown) = withObservationTracking {
            (model.hasProject, model.sidebarShown)
        } onChange: { [weak self] in
            Task { @MainActor [weak self] in self?.follow() }
        }
        sidebarToggle.sidebarShown = sidebarShown
        items[Self.picker]?.isHidden = !sidebarShown
        items[Self.mode]?.isHidden = !hasProject
        items[Self.sessions]?.isHidden = !hasProject
    }

    @objc private func toggleSidebar() {
        model.toggleSidebar()
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
            item.isHidden = !model.sidebarShown
        case Self.toggle:
            item.label = "Sidebar"
            item.view = sidebarToggle
            item.isBordered = false
        case Self.mode:
            item.label = "Code and sessions"
            item.view = ModeSwitch(model: model)
            item.isHidden = !model.hasProject
        case Self.sessions:
            item.label = "Sessions"
            item.view = SessionTabBar(model: model)
            item.isBordered = false
            item.isHidden = !model.hasProject
            // The tabs give way before anything else on the bar does.
            item.visibilityPriority = .low
        default:
            return nil
        }
        items[identifier] = item
        return item
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
/// sidebar's glass rather than the disc of glass the system's toggle wears
/// — Tahoe's floating sidebar never had a toggle in glass on its glass —
/// named on the bar's glass label rather than in a tooltip (see
/// `ToolbarGlassLabel`). Asks the model, which asks the split, so the
/// column slides at AppKit's pace and the binding hears of it.
@MainActor
private final class SidebarToggleButton: BarChipButton {
    private let label = ToolbarHoverView()

    var sidebarShown = true {
        didSet {
            label.labels = [
                ToolbarGlassLabel.Text(title: sidebarShown ? "Hide sidebar" : "Show sidebar", hint: "⌃⌘S")
            ]
            setAccessibilityLabel(sidebarShown ? "Hide sidebar" : "Show sidebar")
        }
    }

    /// The air the picker beside it keeps above and below its own label.
    private static let size: CGFloat = 30

    init() {
        super.init(symbol: "sidebar.left", pointSize: 14, weight: .regular)
        translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: Self.size),
            heightAnchor.constraint(equalToConstant: Self.size),
        ])
        label.frame = bounds
        label.autoresizingMask = [.width, .height]
        addSubview(label)
        sidebarShown = true
    }
}
