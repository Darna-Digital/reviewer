// The split's own sidebar toggle, without its disc of glass. On the
// floating sidebar pane (see `FloatingSidebarPane`) the system's toggle
// stood as a disc of glass at the bar's line — the pane's top edge, so the
// disc rode over it — and glass on the pane's glass besides, which Tahoe,
// whose sidebar floated, never drew: its toggle stood on the pane as a bare
// glyph. So the toggle stays the system's — its place in the sidebar's run,
// its move to the detail's head as the column goes, the split's own slide —
// and only its border is put away. SwiftUI gives no hold on an item it
// makes itself, so the item is found by the identifier the split gives it.
//
// It has to be caught as the bar takes it in: an item already drawn keeps
// the disc it was drawn with until the bar next lays it out. So the watch
// on items being added starts as soon as this view joins the window —
// before SwiftUI has given the window its toolbar, and so before the
// toggle is added to it — and an item found already on the bar is
// unbordered and the bar asked to draw its items again.
//
// Caught there, the toggle is also named on the bar's glass label rather
// than in the system's tooltip (see `ToolbarGlassLabel`), laid over the
// item's view.
import AppKit
import SwiftUI

struct BorderlessSidebarToggle: NSViewRepresentable {
    let sidebarShown: Bool

    func makeNSView(context: Context) -> ToolbarWatcher { ToolbarWatcher() }

    func updateNSView(_ view: ToolbarWatcher, context: Context) {
        view.toggleHover.labels = [
            ToolbarGlassLabel.Text(title: sidebarShown ? "Hide sidebar" : "Show sidebar", hint: "⌃⌘S")
        ]
    }
}

final class ToolbarWatcher: NSView {
    private static let toggleIdentifier = NSToolbarItem.Identifier("com.apple.SwiftUI.navigationSplitView.toggleSidebar")
    private var toolbarWatch: NSKeyValueObservation?
    private var itemWatch: NSObjectProtocol?
    let toggleHover = ToolbarHoverView()

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if let itemWatch { NotificationCenter.default.removeObserver(itemWatch) }
        itemWatch = nil
        toolbarWatch = nil
        guard let window else { return }
        // Any toolbar's: the window's is not yet its own when the items
        // start arriving, and only the split's toggle is touched.
        itemWatch = NotificationCenter.default.addObserver(
            forName: NSToolbar.willAddItemNotification, object: nil, queue: .main
        ) { [weak self] note in
            guard let item = note.userInfo?["item"] as? NSToolbarItem else { return }
            _ = MainActor.assumeIsolated { self?.adopt(item) }
        }
        toolbarWatch = window.observe(\.toolbar, options: [.initial, .new]) { [weak self] window, _ in
            MainActor.assumeIsolated {
                guard let self, let toolbar = window.toolbar,
                      toolbar.items.contains(where: self.adopt)
                else { return }
                toolbar.validateVisibleItems()
                window.contentView?.needsLayout = true
            }
        }
    }

    /// Unborders and labels the item if it is the split's toggle, and says
    /// whether it was one still bordered.
    @discardableResult
    private func adopt(_ item: NSToolbarItem) -> Bool {
        guard item.itemIdentifier == Self.toggleIdentifier else { return false }
        if let view = item.view, toggleHover.superview !== view {
            toggleHover.frame = view.bounds
            toggleHover.autoresizingMask = [.width, .height]
            view.addSubview(toggleHover)
        }
        guard item.isBordered else { return false }
        item.isBordered = false
        return true
    }
}
