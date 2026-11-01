// The window tabs' pinned pair, Code and Sessions, as the system's own
// toggle buttons side by side in one pane of the bar's glass — the way
// Notes sets its format buttons, and the way SwiftUI's toolbar group had
// them — the one in front lit. A press lights the
// button pressed and puts the other out, and that is all it draws: no
// segment slides or stretches across, so the switch is done the moment it
// is clicked. They stand on the window's toolbar ahead of the sessions'
// own tabs (see `SessionTabBar`), both drawn from the picture the island
// sends up (see `WindowTabStrip`); a press goes back down to the island's
// strip, which is the one that switches.
//
// The two are one toolbar item, a row holding both buttons, not a group of
// two items: the bar sets the items of a group its own gap apart and
// pads each as an item of its own, which stood them wider than the pair
// ever stood; a row of its own spaces them as it is told. They
// are AppKit's buttons, not ones hosted in SwiftUI, so the bar wraps them
// in its glass as it does a control it knows (see `WindowToolbar`).
import AppKit

/// The pinned tabs — Code, Sessions — as a toolbar item of toggles: an
/// icon each, the one lit the way of working in front (see
/// `WindowTabStrip.lights`). A tab is left by going to another, never by
/// pressing it again, so a press on the tab in front is ignored; a press on
/// Sessions lit for a session's own tab is the way back to the list.
///
/// The tab pressed is held here until the strip comes back with it in
/// front: the button is lit at the press, and the strip read straight off
/// would still name the old tab for the trip over the bridge, lighting the
/// old one and then the new one again.
///
/// Each button is named on the glass label under the bar, with ⌘G on the
/// one it would cross to (see `ToolbarGlassLabel`).
@MainActor
final class ModeButtons: NSObject {
    let item: NSToolbarItem
    private let model: AppModel
    private let row = NSStackView()
    private var buttons: [ModeButton] = []
    private var pinned: [WindowTab] = []
    private var pressed: String?
    private var activeId = ""

    /// Air between the two, so the lit one's fill stands clear of the
    /// other's glyph — the bar's own gap between its items, kept inside
    /// the one pane of glass.
    private static let spacing: CGFloat = 6
    /// The glass round the lit one, the same on every side: the bar wraps
    /// its glass tight round the row, so the row carries its own margin —
    /// without it the lit fill runs into the glass's edge.
    private static let inset: CGFloat = 4

    init(model: AppModel, identifier: NSToolbarItem.Identifier) {
        self.model = model
        item = NSToolbarItem(itemIdentifier: identifier)
        super.init()
        item.label = "Code and sessions"
        row.orientation = .horizontal
        row.spacing = Self.spacing
        row.edgeInsets = NSEdgeInsets(top: Self.inset, left: Self.inset, bottom: Self.inset, right: Self.inset)
        item.view = row
        item.isBordered = true
        follow()
    }

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
            buttons = pinned.map { ModeButton(tab: $0, target: self) }
            row.setViews(buttons, in: .leading)
        }
        light(pressed ?? pinned.first { strip.lights($0) }?.id, canSwitch: strip.canSwitchMode)
    }

    /// The one tab lit, and ⌘G named on the other, the one it crosses to.
    private func light(_ lit: String?, canSwitch: Bool) {
        for button in buttons {
            button.state = button.tabId == lit ? .on : .off
            button.hint = canSwitch && button.tabId != lit ? "⌘G" : nil
        }
    }

    @objc fileprivate func buttonPressed(_ sender: ModeButton) {
        let id = sender.tabId
        let strip = model.windowTabs
        let lit = pinned.first { strip.lights($0) }?.id
        // A toggle puts itself out when pressed while lit; the press is
        // a way back to the tab, never a way out of it, so it stays lit.
        light(id, canSwitch: strip.canSwitchMode)
        guard strip.activeId != id else { return }
        if id != lit { pressed = id }
        model.select(tabId: id)
    }

    @objc fileprivate func closeSessions() {
        for tab in model.windowTabs.sessions {
            model.closeTab(id: tab.id)
        }
    }
}

/// One pinned tab: its icon, on a disc of the theme's accent while its
/// way of working is in front — the glyph white on it — and bare on the
/// bar's glass otherwise, named with its chord on the bar's glass label.
///
/// Drawn here rather than by the system's toolbar bezel, which lights a
/// shorter capsule round a smaller glyph than the pair is meant to wear:
/// a round disc most of the glass's height, the glyph about half of it.
@MainActor
private final class ModeButton: NSButton {
    let tabId: String
    private let tabTitle: String
    private let label = ToolbarHoverView()
    private let disc = CALayer()

    /// The disc: three quarters of the bar's 36pt glass, which leaves the
    /// glass the same 4pt round it on every side.
    static let size: CGFloat = 28
    private static let glyphPointSize: CGFloat = 15
    /// Air either side of the glyph inside the lit fill: Code's `</>` is
    /// wide enough to stretch its disc into a pill beside Sessions' circle.
    private static let glyphMargin: CGFloat = 6

    override var state: NSControl.StateValue {
        didSet { needsDisplay = true }
    }

    var hint: String? {
        didSet {
            if hint != oldValue { label.labels = [ToolbarGlassLabel.Text(title: tabTitle, hint: hint)] }
        }
    }

    init(tab: WindowTab, target: ModeButtons) {
        tabId = tab.id
        tabTitle = tab.title
        super.init(frame: .zero)
        setButtonType(.pushOnPushOff)
        isBordered = false
        image = NSImage(systemSymbolName: tab.kind.symbol, accessibilityDescription: tab.title)?
            .withSymbolConfiguration(.init(pointSize: Self.glyphPointSize, weight: .regular))
        imagePosition = .imageOnly
        imageScaling = .scaleNone
        wantsLayer = true
        disc.cornerCurve = .continuous
        layer?.insertSublayer(disc, at: 0)
        translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: max(Self.size, (image?.size.width ?? 0) + 2 * Self.glyphMargin)),
            heightAnchor.constraint(equalToConstant: Self.size),
        ])
        self.target = target
        action = #selector(ModeButtons.buttonPressed(_:))
        setAccessibilityLabel(tab.title)
        label.frame = bounds
        label.autoresizingMask = [.width, .height]
        addSubview(label)
        label.labels = [ToolbarGlassLabel.Text(title: tab.title, hint: nil)]
        let menu = NSMenu()
        menu.addItem(withTitle: "Close other tabs", action: #selector(ModeButtons.closeSessions), keyEquivalent: "")
            .target = target
        self.menu = menu
        NotificationCenter.default.addObserver(
            self, selector: #selector(paletteChanged), name: ChromePalette.didChange, object: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("ModeButton is not loaded from a nib") }

    override var wantsUpdateLayer: Bool { true }

    /// Lit in the theme's accent, as the bottom pane's tabs and the diff's
    /// add-a-comment button are — the one colour every lit control shares —
    /// rather than the system's blue, and drawn again when a theme changes.
    @objc private func paletteChanged() {
        needsDisplay = true
    }

    override func updateLayer() {
        let lit = state == .on
        effectiveAppearance.performAsCurrentDrawingAppearance {
            CATransaction.begin()
            CATransaction.setDisableActions(true)
            disc.backgroundColor = lit ? IslandPalette.accent.cgColor : NSColor.clear.cgColor
            CATransaction.commit()
        }
        contentTintColor = lit ? .white : .labelColor
    }

    override func layout() {
        super.layout()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        disc.frame = bounds
        disc.cornerRadius = bounds.height / 2
        CATransaction.commit()
    }
}
