// The window tabs' pinned pair, Code and Sessions, as the system's own
// tabs — the segmented control in its macOS 27 tabs role, whose glass puck
// can be grabbed and dragged from one segment to the other as well as
// clicked. It stands on the window's toolbar ahead of the sessions' own
// tabs (see `SessionTabBar`), both drawn from the picture the island sends
// up (see `WindowTabStrip`); a press goes back down to the island's strip,
// which is the one that switches.
//
// The control is the toolbar item's own view, not one hosted in SwiftUI:
// the bar wraps a control it can see in the toolbar's glass, as it does
// the system's own segmented items, and a hosting view is no control it
// knows (see `WindowToolbar`).
import AppKit

/// The pinned tabs — Code, Sessions — as the system's tabs: an icon a
/// segment, in the toolbar's glass, the puck on the way of working in
/// front (see `WindowTabStrip.lights`) and draggable across to the other.
/// A tab is left by going to another, never by pressing it again, so a
/// press on the tab in front is ignored; a press on Sessions lit for a
/// session's own tab is the way back to the list — the control sends its
/// action on every press, the same segment included, so that press
/// reaches here even though the puck does not move.
///
/// The tab pressed is held here until the strip comes back with it in
/// front: the control has already slid its puck there, and a selection
/// read straight off the strip would still name the old tab for the trip
/// over the bridge, sending the puck back and then over again. The control
/// is only touched where something has changed, so a slide the press
/// started is left to finish.
///
/// Each segment is named on the glass label under the bar, with ⌘G on the
/// one it would cross to (see `ToolbarGlassLabel`).
@MainActor
final class ModeSwitch: NSSegmentedControl {
    private let model: AppModel
    private let label = ToolbarHoverView()
    private var pinned: [WindowTab] = []
    private var pressed: String?
    private var activeId = ""

    init(model: AppModel) {
        self.model = model
        super.init(frame: .zero)
        trackingMode = .selectOne
        segmentDistribution = .fillEqually
        // The tabs role is in the macOS 27 SDK, which comes with the Swift
        // 6.4 toolchain; a build on Xcode 26 has neither and gets the plain
        // control. Releases are built on Xcode 27 (see `release.yml`).
        #if compiler(>=6.4)
        if #available(macOS 27, *) { role = .tabs }
        #endif
        target = self
        action = #selector(segmentPressed)
        label.frame = bounds
        label.autoresizingMask = [.width, .height]
        addSubview(label)
        menu = Self.contextMenu(target: self)
        NotificationCenter.default.addObserver(
            self, selector: #selector(paletteChanged), name: ChromePalette.didChange, object: nil)
        paletteChanged()
        follow()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("ModeSwitch is not loaded from a nib") }

    private func follow() {
        let strip = withObservationTracking {
            model.windowTabs
        } onChange: { [weak self] in
            Task { @MainActor [weak self] in self?.follow() }
        }
        apply(strip)
    }

    private func apply(_ strip: WindowTabStrip) {
        if strip.activeId != activeId {
            activeId = strip.activeId
            pressed = nil
        }
        let pinned = strip.tabs.filter(\.pinned)
        if pinned.map(\.id) != self.pinned.map(\.id) || pinned.map(\.kind) != self.pinned.map(\.kind) {
            self.pinned = pinned
            segmentCount = pinned.count
            for (index, tab) in pinned.enumerated() {
                setImage(
                    NSImage(systemSymbolName: tab.kind.symbol, accessibilityDescription: tab.title),
                    forSegment: index)
                setImageScaling(.scaleNone, forSegment: index)
                setLabel("", forSegment: index)
            }
            invalidateIntrinsicContentSize()
        }
        let lit = (pressed ?? pinned.first { strip.lights($0) }?.id) ?? ""
        let selected = pinned.firstIndex { $0.id == lit } ?? -1
        if selectedSegment != selected { selectedSegment = selected }
        label.labels = pinned.map { tab in
            let crossesTo = strip.canSwitchMode && lit != tab.id
            return ToolbarGlassLabel.Text(title: tab.title, hint: crossesTo ? "⌘G" : nil)
        }
    }

    @objc private func segmentPressed() {
        guard pinned.indices.contains(selectedSegment) else { return }
        let id = pinned[selectedSegment].id
        guard model.windowTabs.activeId != id else { return }
        let lit = pinned.first { model.windowTabs.lights($0) }?.id
        if id != lit { pressed = id }
        model.select(tabId: id)
    }

    /// Lit in the theme's accent, as the pane's tabs and the diff's
    /// add-a-comment button are — the one colour every lit control shares.
    @objc private func paletteChanged() {
        selectedSegmentBezelColor = IslandPalette.accent
    }

    /// The control is one view, so its menu cannot know which segment it
    /// was opened over; what a pinned tab's menu offers is the same for
    /// either — the sessions closed — so it does not need to.
    private static func contextMenu(target: ModeSwitch) -> NSMenu {
        let menu = NSMenu()
        menu.addItem(withTitle: "Close other tabs", action: #selector(closeSessions), keyEquivalent: "").target = target
        return menu
    }

    @objc private func closeSessions() {
        for tab in model.windowTabs.sessions {
            model.closeTab(id: tab.id)
        }
    }
}
