// The session tabs on the toolbar, as an AppKit view of their own — built
// the way Rex builds its titlebar tabs, and for the same reasons.
//
// It is one toolbar item, and a flexible one: its width is held between the
// narrowest a single tab can be read at and what every tab would take at
// its widest, its preference for the widest sitting under the priority
// NSToolbar measures items at (see `widthPreference`). The bar lays out
// what is left after the items ahead of it and hands the row that width —
// the row is never taken off into the ›› menu, and never has to measure the
// window to stay out of it. That is only an AppKit item's to have: a
// SwiftUI view in a toolbar item is frozen at the size it first fits, so
// the window's toolbar is AppKit's too (see `WindowToolbar`).
//
// Inside it, every tab is the same width — the item's width shared out
// between them, up to a limit — on one capsule track, with a single raised
// surface under the tab in front that is under the tab pressed the moment
// it is pressed, as Rex's is — no slide from the last one. The track and
// the surface are in the shades the system's tabs beside it and along the
// bottom pane's bar wear (see `SegmentedTabs`). Hairlines
// between the tabs at rest, and titles that fade out over their last
// letters rather than ending in an ellipsis. Once the tabs would be
// narrower than a title can be read in they stop shrinking, and the row
// scrolls under the wheel or the trackpad, its ends fading where there are
// more tabs past them.
//
// The tabs take the mouse themselves rather than through gestures: a press
// selects at once, on the way down, as a tab bar does; a press that goes on
// to move is a drag along the row, run as AppKit's own tracking loop, the
// tab in hand under the pointer to the point while the tabs it passes
// spring aside, and the row scrolling on a display link while the pointer
// is held past either end. The island hears where the tab landed once, when
// it is let go. A middle click closes a tab, as a shift-click does, and the
// empty run of the bar beyond the tabs still drags the window.
import AppKit
import SwiftUI

@MainActor
final class SessionTabBar: NSView {
    private let model: AppModel
    private let track = TabTrackView()
    private let strip = NSView()
    private let surface = TabSurfaceView()
    private let newTab = NewTabButton()
    private let newTabLabel = ToolbarHoverView()
    /// The tabs in the row's order, which during a drag is the order it
    /// started in: the tabs move by where they are put, not by where they
    /// stand in this list, until the drag settles.
    private var tabs: [SessionTabView] = []
    private var activeId = ""
    /// The tab pressed, in front from the press on, until the strip comes
    /// back from the island with it in front — the bridge's round trip is
    /// not a wait a tab bar has.
    private var pressedId: String?
    private var stripActiveId = ""
    private var hoveredId: String?
    private var drag: TabDrag?
    private var scrollOffset: CGFloat = 0
    private var isWindowActive = false
    private var showsHints = false
    private var hasLaidOut = false
    /// Set while the window lays the bar out at a new width ahead of the
    /// row's own layout, which the row then animates to.
    private var isTakingWidth = false
    /// A strip that arrived while a tab was in hand, applied once it is
    /// let go — the row is the pointer's until then.
    private var deferredStrip = false
    private var widthPreference: NSLayoutConstraint!
    private var widthLimit: NSLayoutConstraint!
    private var widthFloor: NSLayoutConstraint!
    private var windowWatch: [NSObjectProtocol] = []

    init(model: AppModel) {
        self.model = model
        super.init(frame: NSRect(x: 0, y: 0, width: 200, height: TabBarMetrics.height))
        translatesAutoresizingMaskIntoConstraints = false
        heightAnchor.constraint(equalToConstant: TabBarMetrics.height).isActive = true
        widthFloor = widthAnchor.constraint(greaterThanOrEqualToConstant: TabBarMetrics.newTab)
        widthLimit = widthAnchor.constraint(lessThanOrEqualToConstant: TabBarMetrics.newTab)
        // Under NSLayoutPriorityFittingSizeCompression (50): the bar sizes
        // its items at their fitting size, which this then does not hold up
        // — the item comes out as narrow as its floor lets it, and the bar
        // stretches it towards the preference over whatever room is left.
        // Any higher and the bar reads the preference as the item's size,
        // and takes the whole item off into the ›› menu once it does not
        // fit, which is what a row of tabs in a narrow window always is.
        widthPreference = widthAnchor.constraint(equalToConstant: TabBarMetrics.newTab)
        widthPreference.priority = NSLayoutConstraint.Priority(49)
        NSLayoutConstraint.activate([widthFloor, widthLimit, widthPreference])

        strip.wantsLayer = true
        addSubview(track)
        addSubview(strip)
        strip.addSubview(surface)

        newTab.target = self
        newTab.action = #selector(mintSession)
        newTab.setAccessibilityLabel("New session")
        addSubview(newTab)
        newTabLabel.labels = [ToolbarGlassLabel.Text(title: "New session", hint: "⌘T")]
        newTabLabel.frame = newTab.bounds
        newTabLabel.autoresizingMask = [.width, .height]
        newTab.addSubview(newTabLabel)

        setAccessibilityElement(true)
        setAccessibilityRole(.tabGroup)
        setAccessibilityLabel("Sessions")

        NotificationCenter.default.addObserver(
            self, selector: #selector(commandHoldChanged), name: CommandHold.didChange, object: nil)
        NotificationCenter.default.addObserver(
            self, selector: #selector(paletteChanged), name: ChromePalette.didChange, object: nil)
        CommandHold.shared.start()
        follow()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("SessionTabBar is not loaded from a nib") }

    override var isFlipped: Bool { true }

    /// The bar's empty run — past the tabs and the mark that mints one —
    /// is the toolbar's, and drags the window as the rest of the bar does.
    override var mouseDownCanMoveWindow: Bool { true }

    override func accessibilityChildren() -> [Any]? { tabs + [newTab] }

    // MARK: The strip

    /// Reads the island's strip and keeps reading it: the model is
    /// observable, so the bar is told the moment the strip changes and
    /// takes it on the next turn of the run loop, after the change is made.
    /// Each tab's agent is read along with it: a session's agent is the
    /// server's rather than the island's, and changes — switched in the
    /// composer, or first read — with the strip as it was.
    private func follow() {
        withObservationTracking {
            for tab in model.windowTabs.sessions { _ = model.chats.agent(of: tab) }
        } onChange: { [weak self] in
            Task { @MainActor [weak self] in
                self?.follow()
            }
        }
        apply(model.windowTabs)
    }

    private func apply(_ strip: WindowTabStrip) {
        if drag != nil {
            deferredStrip = true
            return
        }
        let sessions = strip.sessions
        if strip.activeId != stripActiveId {
            stripActiveId = strip.activeId
            pressedId = nil
        }
        let active = pressedId ?? strip.activeId
        let selectionMoved = active != activeId
        activeId = active
        let kept = Dictionary(uniqueKeysWithValues: tabs.map { ($0.id, $0) })
        let wanted = Set(sessions.map(\.id))
        let orderChanged = sessions.map(\.id) != tabs.map(\.id)

        for view in tabs where !wanted.contains(view.id) { depart(view) }
        if let hoveredId, !wanted.contains(hoveredId) { self.hoveredId = nil }

        var arriving: [SessionTabView] = []
        tabs = sessions.map { tab in
            if let view = kept[tab.id] {
                view.tab = tab
                view.agent = model.chats.agent(of: tab)
                return view
            }
            let view = SessionTabView(tab: tab, bar: self)
            view.agent = model.chats.agent(of: tab)
            self.strip.addSubview(view, positioned: .above, relativeTo: surface)
            arriving.append(view)
            return view
        }

        if updateWidthConstraints() { takeWidth() }
        scrollOffset = min(scrollOffset, maxScroll)
        configureTabs()
        // The first strip is laid out as it stands; after that a tab coming
        // or going reshares the room between all of them. The tab in front
        // changing moves nothing: the surface is under it at once.
        let animated = hasLaidOut && orderChanged
        if animated {
            for view in arriving { view.prepareToArrive(at: target(forSlot: tabs.firstIndex(of: view)!)) }
        }
        if selectionMoved {
            reveal(selectedTab)
            putSurfaceUnderSelectedTab()
        }
        layoutRow(animated: animated)
        hasLaidOut = true
    }

    /// A tab closed: it fades where it stood while the row closes over it.
    private func depart(_ view: SessionTabView) {
        view.isDeparting = true
        NSAnimationContext.animate(TabBarMetrics.fade) {
            view.animator().alphaValue = 0
        } completion: {
            view.removeFromSuperview()
        }
    }

    private var selectedTab: SessionTabView? { tabs.first { $0.id == activeId } }

    private func putSurfaceUnderSelectedTab() {
        guard let selected = selectedTab, let slot = tabs.firstIndex(of: selected) else {
            surface.alphaValue = 0
            return
        }
        surface.frame = target(forSlot: slot)
        surface.alphaValue = 1
    }

    private func configureTabs() {
        for (slot, view) in tabs.enumerated() {
            view.configure(
                isSelected: view.id == activeId,
                isHovered: drag == nil && view.id == hoveredId,
                isLifted: drag?.id == view.id,
                showsDivider: showsDivider(at: slot),
                chord: slot < 9 ? "⌘\(slot + 1)" : nil,
                showsChord: showsHints,
                isWindowActive: isWindowActive)
        }
        track.isShown = tabs.count > 1 && isWindowActive
        surface.isWindowActive = isWindowActive
        surface.isLifted = drag?.id == activeId
    }

    /// The hairline before a tab, only between two tabs at rest: beside
    /// the tab in front its surface already says where it ends, and
    /// mid-drag every tab is on the move.
    private func showsDivider(at slot: Int) -> Bool {
        guard slot > 0, drag == nil else { return false }
        return [tabs[slot - 1], tabs[slot]].allSatisfy { $0.id != activeId }
    }

    // MARK: Width

    /// The floor is one tab at its narrowest — past that the row scrolls —
    /// and the limit every tab at its full width; with no tabs, the mark
    /// alone.
    /// Says whether they moved: a strip that only changes which tab is in
    /// front — the pair pressed, a tab picked — leaves them as they were,
    /// and the window is not laid out for it mid-slide.
    @discardableResult
    private func updateWidthConstraints() -> Bool {
        let mark = TabBarMetrics.newTab
        let lead = tabs.isEmpty ? 0 : TabBarMetrics.gap
        let count = CGFloat(tabs.count)
        let floor = tabs.isEmpty ? mark : TabBarMetrics.narrowest + lead + mark
        let limit = count * fullTabWidth + lead + mark
        guard floor != widthFloor.constant || limit != widthLimit.constant else { return false }
        widthFloor.constant = floor
        widthLimit.constant = limit
        widthPreference.constant = limit
        return true
    }

    /// Has the toolbar size the item to its new constraints now, rather
    /// than on the window's next pass: the row reshares the room it is
    /// about to have, not the room it had, so a tab joining a row that
    /// grows for it springs straight to its even share.
    private func takeWidth() {
        isTakingWidth = true
        window?.layoutIfNeeded()
        isTakingWidth = false
    }

    /// What the strip may take of the item: all of it but the mark on the
    /// row's end and the air before it.
    private var room: CGFloat {
        max(0, bounds.width - TabBarMetrics.newTab - TabBarMetrics.gap)
    }

    /// The width every tab takes given the room: what the longest title
    /// needs whole, as long as a tab is worth — so a lone "New session" is
    /// a short tab, not a long one with the mark adrift at its end — but
    /// never narrower than a title can be read in. The tabs stay one width,
    /// so the row reads as one even run.
    private var fullTabWidth: CGFloat {
        let longest = tabs.map(\.fittingWidth).max() ?? TabBarMetrics.widest
        return min(TabBarMetrics.widest, max(TabBarMetrics.narrowest, longest)).rounded(.up)
    }

    /// Every tab's width: an even share of the room, up to the full width
    /// and down to the narrowest, rounded down to the point so the tabs'
    /// edges — and the hairlines on them — fall on whole points.
    private var tabWidth: CGFloat {
        guard !tabs.isEmpty else { return fullTabWidth }
        let share = (room / CGFloat(tabs.count)).rounded(.down)
        return min(fullTabWidth, max(TabBarMetrics.narrowest, share))
    }

    private var contentWidth: CGFloat { tabWidth * CGFloat(tabs.count) }
    private var stripWidth: CGFloat { min(contentWidth, room) }
    private var maxScroll: CGFloat { max(0, contentWidth - stripWidth) }

    // MARK: Layout

    override func layout() {
        super.layout()
        guard !isTakingWidth else { return }
        scrollOffset = min(scrollOffset, maxScroll)
        layoutRow(animated: false)
    }

    /// The bar is resized by the toolbar, which says nothing to a view
    /// laid out by hand; the row is laid out again at every new width.
    override func setFrameSize(_ newSize: NSSize) {
        super.setFrameSize(newSize)
        needsLayout = true
    }

    /// Where a tab at rest stands in the strip, scrolled.
    private func target(forSlot slot: Int) -> NSRect {
        NSRect(
            x: CGFloat(slot) * tabWidth - scrollOffset, y: 0,
            width: tabWidth, height: TabBarMetrics.height)
    }

    /// Puts every piece where it belongs: the strip and its track, the mark
    /// after them, each tab at its slot — or where the drag has it — and
    /// the surface under the tab in front. Only what has somewhere new to
    /// be is touched, so a tab already springing towards its slot is left
    /// to arrive rather than set off again.
    private func layoutRow(animated: Bool) {
        let width = stripWidth
        let lead = tabs.isEmpty ? 0 : TabBarMetrics.gap
        let stripFrame = NSRect(x: 0, y: 0, width: width, height: TabBarMetrics.height)
        let markFrame = NSRect(
            x: width + lead, y: 0, width: TabBarMetrics.newTab, height: TabBarMetrics.height)

        var frames: [(NSView, NSRect)] = [(strip, stripFrame), (track, stripFrame), (newTab, markFrame)]
        for (slot, view) in tabs.enumerated() {
            var frame = target(forSlot: slot)
            if let drag {
                if view.id == drag.id {
                    frame.origin.x += carried(at: slot, by: drag)
                } else {
                    frame.origin.x += standsAside(at: slot, for: drag)
                }
            }
            frames.append((view, frame))
        }
        let selected = selectedTab.flatMap { tab in frames.first { $0.0 === tab }?.1 }
        if let selected { frames.append((surface, selected)) }

        let place = {
            for (view, frame) in frames where view.frame != frame {
                // The tab in hand is under the pointer, not chasing it, and
                // the surface under it goes with it.
                let held = self.drag.map { drag in
                    (view as? SessionTabView)?.id == drag.id || (view === self.surface && drag.id == self.activeId)
                } ?? false
                if animated && !held { view.animator().frame = frame } else { view.frame = frame }
            }
            let shown: CGFloat = selected == nil ? 0 : 1
            if self.surface.alphaValue != shown {
                if animated { self.surface.animator().alphaValue = shown } else { self.surface.alphaValue = shown }
            }
        }
        if animated {
            NSAnimationContext.animate(TabBarMetrics.slide, changes: place)
        } else {
            place()
        }
        updateEdgeFades()
    }

    /// The strip's ends: cut square where the row ends, and faded where it
    /// carries on past — the tab under the fade is the one that says there
    /// are more, where a hard edge would have it look cut off. Only while
    /// the row overflows: a mask otherwise would only cut the lifted tab's
    /// shadow.
    private func updateEdgeFades() {
        guard maxScroll > 0, let layer = strip.layer else {
            strip.layer?.mask = nil
            return
        }
        let mask = (layer.mask as? CAGradientLayer) ?? CAGradientLayer()
        let lift = TabBarMetrics.lift
        let ends = TabBarMetrics.edgeFade / max(1, strip.bounds.width)
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        mask.frame = strip.bounds.insetBy(dx: 0, dy: -lift)
        mask.startPoint = CGPoint(x: 0, y: 0.5)
        mask.endPoint = CGPoint(x: 1, y: 0.5)
        mask.colors = [NSColor.clear.cgColor, NSColor.black.cgColor, NSColor.black.cgColor, NSColor.clear.cgColor]
        mask.locations = [
            0,
            NSNumber(value: scrollOffset > 0.5 ? ends : 0),
            NSNumber(value: scrollOffset < maxScroll - 0.5 ? 1 - ends : 1),
            1,
        ]
        layer.mask = mask
        CATransaction.commit()
    }

    /// Scrolls the strip, as little as it takes, to have `tab` whole.
    private func reveal(_ tab: SessionTabView?) {
        guard let tab, let slot = tabs.firstIndex(of: tab) else { return }
        let start = CGFloat(slot) * tabWidth
        let end = start + tabWidth
        if start < scrollOffset {
            scrollOffset = start
        } else if end > scrollOffset + stripWidth {
            scrollOffset = end - stripWidth
        }
        scrollOffset = min(max(0, scrollOffset), maxScroll)
    }

    // MARK: Scrolling

    /// The wheel and the trackpad both scroll the row while it overflows:
    /// a sideways swipe as it goes, and a mouse's wheel turned up and down
    /// as the row's along. A row that fits has nothing to scroll and leaves
    /// the event to whatever is behind it.
    override func scrollWheel(with event: NSEvent) {
        guard maxScroll > 0, drag == nil else { return super.scrollWheel(with: event) }
        let sideways = abs(event.scrollingDeltaX) >= abs(event.scrollingDeltaY)
        var delta = sideways ? event.scrollingDeltaX : event.scrollingDeltaY
        if !event.hasPreciseScrollingDeltas { delta *= TabBarMetrics.lineScroll }
        scrollOffset = min(max(0, scrollOffset - delta), maxScroll)
        layoutRow(animated: false)
    }

    // MARK: Hover

    fileprivate func pointer(isOver hovering: Bool, _ view: SessionTabView) {
        guard drag == nil else { return }
        if hovering {
            hoveredId = view.id
        } else if hoveredId == view.id {
            hoveredId = nil
        }
        configureTabs()
    }

    // MARK: Pressing and dragging

    fileprivate func press(_ view: SessionTabView, with event: NSEvent) {
        if event.modifierFlags.contains(.shift) {
            model.closeTab(id: view.id)
            return
        }
        if view.id != activeId { model.select(tabId: view.id) }
        guard let window, let from = tabs.firstIndex(of: view) else { return }
        let start = contentX(of: event)
        var dragging = false
        window.trackEvents(
            matching: [.leftMouseDragged, .leftMouseUp], timeout: NSEvent.foreverDuration, mode: .eventTracking
        ) { event, stop in
            guard let event else { return }
            if event.type == .leftMouseUp {
                stop.pointee = true
                if dragging { self.settle() }
                return
            }
            let x = self.contentX(of: event)
            // Short of the threshold the drag never starts, so a press that
            // wanders a point or two on its way up is still a press.
            if !dragging {
                guard abs(x - start) >= TabBarMetrics.dragThreshold else { return }
                dragging = true
                self.lift(view, from: from, startingAt: start)
            }
            self.drag?.pointer = self.convert(event.locationInWindow, from: nil).x
            self.carry()
        }
    }

    /// Where an event falls along the row's content, scrolled — the frame
    /// a drag is measured in, so the row scrolling under a still pointer
    /// carries the tab along with it.
    private func contentX(of event: NSEvent) -> CGFloat {
        convert(event.locationInWindow, from: nil).x + scrollOffset
    }

    private func lift(_ view: SessionTabView, from slot: Int, startingAt start: CGFloat) {
        hoveredId = nil
        drag = TabDrag(id: view.id, from: slot, start: start)
        strip.addSubview(view, positioned: .above, relativeTo: nil)
        if view.id == activeId {
            strip.addSubview(surface, positioned: .below, relativeTo: view)
        }
        configureTabs()
        startEdgeScroll()
    }

    /// Lays the row out for where the pointer has the tab in hand: the tab
    /// there to the point, and its neighbours sprung aside.
    private func carry() {
        guard let drag else { return }
        let landing = landing(of: drag)
        let moved = landing != drag.landing
        self.drag?.landing = landing
        layoutRow(animated: moved)
    }

    /// The tab the pointer is over now — read off where it is rather than
    /// the tabs' own record of entering and leaving, which the drag's
    /// tracking loop kept from them while it ran.
    private func tabUnderPointer() -> SessionTabView? {
        guard let window else { return nil }
        let point = strip.convert(window.mouseLocationOutsideOfEventStream, from: nil)
        return tabs.first { $0.frame.contains(point) }
    }

    private func translation(of drag: TabDrag) -> CGFloat {
        guard let pointer = drag.pointer else { return 0 }
        return pointer + scrollOffset - drag.start
    }

    /// Where the tab in hand stands: where the pointer has taken it, held
    /// to the row — it stops with its leading edge at the row's start and
    /// its trailing edge at the end rather than being carried off the bar.
    private func carried(at slot: Int, by drag: TabDrag) -> CGFloat {
        let before = CGFloat(slot) * tabWidth
        let after = CGFloat(tabs.count - slot - 1) * tabWidth
        return min(max(translation(of: drag), -before), after)
    }

    /// How far a tab stands aside to leave the slot the tab in hand would
    /// drop into: one slot along, towards where that tab came from, for
    /// every tab between the slot it left and the one it is over.
    private func standsAside(at slot: Int, for drag: TabDrag) -> CGFloat {
        let landing = drag.landing
        if drag.from < slot, slot <= landing { return -tabWidth }
        if landing <= slot, slot < drag.from { return tabWidth }
        return 0
    }

    /// The slot the tab in hand would drop into: the distance it has been
    /// carried, in tabs, to the nearest — the tabs being one width, a
    /// neighbour is passed as its middle is crossed. Read off the distance
    /// every time rather than kept as it goes, so nothing can drift.
    private func landing(of drag: TabDrag) -> Int {
        guard tabWidth > 0 else { return drag.from }
        let slots = Int((translation(of: drag) / tabWidth).rounded())
        return min(max(drag.from + slots, 0), tabs.count - 1)
    }

    /// The tab let go. The row takes the order the tabs are already
    /// standing in and springs each into its slot — the ones aside are
    /// there already, and the tab in hand springs the last of the way
    /// home. The island hears where it landed: after the tab now before
    /// it, or before the one after it at the head of the row.
    private func settle() {
        stopEdgeScroll()
        guard let drag else { return }
        let landing = drag.landing
        if landing != drag.from {
            tabs.insert(tabs.remove(at: drag.from), at: landing)
        }
        self.drag = nil
        strip.addSubview(surface, positioned: .below, relativeTo: nil)
        hoveredId = tabUnderPointer()?.id
        configureTabs()
        layoutRow(animated: true)
        if landing != drag.from {
            if landing > 0 {
                model.moveTab(id: drag.id, beside: tabs[landing - 1].id, after: true)
            } else if tabs.count > 1 {
                model.moveTab(id: drag.id, beside: tabs[1].id, after: false)
            }
        }
        if deferredStrip {
            deferredStrip = false
            apply(model.windowTabs)
        }
    }

    // MARK: Scrolling at the edges

    private var edgeScroll: CADisplayLink?

    /// While a tab is held past either end of an overflowing row, the row
    /// scrolls under it on the display's own beat, faster the further past
    /// the pointer is — the tab staying under the pointer as it does.
    private func startEdgeScroll() {
        guard maxScroll > 0, edgeScroll == nil else { return }
        let link = displayLink(target: self, selector: #selector(edgeScrollTick))
        link.add(to: .main, forMode: .common)
        edgeScroll = link
    }

    private func stopEdgeScroll() {
        edgeScroll?.invalidate()
        edgeScroll = nil
    }

    @objc private func edgeScrollTick(_ link: CADisplayLink) {
        guard let pointer = drag?.pointer else { return }
        let zone = TabBarMetrics.edgeZone
        let past: CGFloat
        if pointer < zone {
            past = pointer - zone
        } else if pointer > stripWidth - zone {
            past = pointer - (stripWidth - zone)
        } else {
            return
        }
        let elapsed = link.targetTimestamp - link.timestamp
        let speed = min(abs(past) / zone, 2) * TabBarMetrics.edgeScrollSpeed
        let next = min(max(0, scrollOffset + (past < 0 ? -1 : 1) * speed * elapsed), maxScroll)
        guard next != scrollOffset else { return }
        scrollOffset = next
        carry()
    }

    // MARK: Actions

    fileprivate func select(_ view: SessionTabView) {
        guard view.id != activeId else { return }
        pressedId = view.id
        apply(model.windowTabs)
        model.select(tabId: view.id)
    }

    fileprivate func close(_ view: SessionTabView) {
        model.closeTab(id: view.id)
    }

    fileprivate func closeOthers(than view: SessionTabView) {
        for other in tabs where other !== view {
            model.closeTab(id: other.id)
        }
    }

    @objc private func mintSession() {
        model.newSession()
    }

    // MARK: Window, keyboard and palette

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        for watch in windowWatch { NotificationCenter.default.removeObserver(watch) }
        windowWatch = []
        guard let window else { return }
        let centre = NotificationCenter.default
        let names: [(Notification.Name, AnyObject?)] = [
            (NSWindow.didBecomeMainNotification, window),
            (NSWindow.didResignMainNotification, window),
            (NSApplication.didBecomeActiveNotification, NSApp),
            (NSApplication.didResignActiveNotification, NSApp),
        ]
        windowWatch = names.map { name, object in
            centre.addObserver(forName: name, object: object, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.windowActivityChanged() }
            }
        }
        windowActivityChanged()
    }

    /// The bar of the window in front is the live one, as the system draws
    /// its own: the track only there, and a window at the back keeps a
    /// flat surface under its tab in front (see `TabSurfaceView`).
    private func windowActivityChanged() {
        let active = NSApp.isActive && (window?.isMainWindow ?? false)
        guard active != isWindowActive else { return }
        isWindowActive = active
        configureTabs()
    }

    @objc private func commandHoldChanged() {
        showsHints = CommandHold.shared.isHeld
        configureTabs()
    }

    @objc private func paletteChanged() {
        track.needsDisplay = true
        surface.needsDisplay = true
        for view in tabs { view.paletteChanged() }
    }
}

/// A tab in hand: which one, the slot it was picked up from, where along
/// the content the press began, where the pointer is now along the bar,
/// and the slot it would drop into.
private struct TabDrag {
    let id: String
    let from: Int
    let start: CGFloat
    var pointer: CGFloat?
    var landing: Int

    init(id: String, from: Int, start: CGFloat) {
        self.id = id
        self.from = from
        self.start = start
        landing = from
    }
}

enum TabBarMetrics {
    /// The system's toolbar glass, which the pinned pair beside the row
    /// stand in.
    static let height: CGFloat = BarChipMetrics.height
    static let newTab: CGFloat = BarChipMetrics.height
    /// The air between the track and the mark that mints a session.
    static let gap: CGFloat = 6
    /// The narrowest a tab gets before the row scrolls instead — a short
    /// title's worth beside the slot at its tail.
    static let narrowest: CGFloat = 112
    /// The widest a tab gets; Rex's own.
    static let widest: CGFloat = 228
    /// How far the pointer travels before a press becomes a drag.
    static let dragThreshold: CGFloat = 4
    /// The room above and below the row kept for the lifted tab's shadow.
    static let lift: CGFloat = 12
    /// How long the row takes to fade out at an end it has more tabs past.
    static let edgeFade: CGFloat = 28
    /// How near either end a held tab starts the row scrolling, and how
    /// fast it scrolls, in points a second, at the edge itself.
    static let edgeZone: CGFloat = 24
    static let edgeScrollSpeed: CGFloat = 480
    /// What one notch of a mouse's wheel scrolls the row.
    static let lineScroll: CGFloat = 12
    /// The one spring the row moves on — the tabs standing aside mid-drag
    /// and settling, the row resharing its width — so that motions meeting
    /// each other end together.
    static let slide: Animation = .snappy(duration: 0.24, extraBounce: 0.08)
    /// The tint and trim coming and going on a tab.
    static let fade: Animation = .easeOut(duration: 0.15)
}

// MARK: - A tab

/// A session's tab: the session's title from its leading edge,
/// and a slot at its tail for whatever it has to say — the ✕ under the
/// pointer, the ⌘-number while ⌘ is held, and otherwise what its thread is
/// doing. The slot only takes room from the title while something is in
/// it, so a quiet tab's title runs the whole width; a title longer than its
/// room fades out over its last letters, so a tab of any width reads as the
/// start of its title rather than a word cut short.
///
/// It is named to accessibility as the radio button a tab is, its title
/// its label and whether it is in front its value.
@MainActor
private final class SessionTabView: NSView {
    var tab: WindowTab {
        didSet {
            guard tab != oldValue else { return }
            title.stringValue = tab.title
            updateHoverLabel()
            setAccessibilityLabel(tab.title)
            needsLayout = true
        }
    }
    var agent: ChatProviderKind? {
        didSet {
            guard agent != oldValue else { return }
            agentTile.agent = agent
        }
    }
    var id: String { tab.id }
    var isDeparting = false
    private weak var bar: SessionTabBar?

    /// The surface a tab carried along the row stands on when it is not
    /// the tab in front — which has the row's own under it — so it covers
    /// the titles it passes rather than showing them through.
    private let liftSurface = TabSurfaceView()
    private let divider = CALayer()
    private let agentTile = AgentTile()
    private let titleClip = NSView()
    private let title = NSTextField(labelWithString: "")
    private let titleFade = CAGradientLayer()
    private let closeButton = TabCloseButton()
    private let hintLabel = NSTextField(labelWithString: "")
    private let waitingDot = CALayer()
    private var orb: NSHostingView<Orb>?
    /// The tab named on the bar's glass label under the pointer, as the
    /// project picker and the sidebar's toggle are, with the chord that
    /// reaches it (see `ToolbarGlassLabel`) — the whole title, which the
    /// tab may only have room for the start of.
    private let hoverLabel = ToolbarHoverView()

    private var isSelected = false
    private var isHovered = false
    private var isLifted = false
    private var showsDivider = false
    private var chord: String?
    private var showsChord = false
    private var isWindowActive = false

    /// How far in from either edge the tab's ink starts — the agent's tile
    /// at the head, whatever is in the slot at the tail — so the two read
    /// as the same distance from the hairline between them.
    private static let edgeInset: CGFloat = 10
    /// The air between the title and the ink on either side of it.
    private static let titleSpacing: CGFloat = 7
    /// The box the slot's controls stand in — the ✕'s pressable circle.
    private static let slot: CGFloat = 20
    private static let waitingDotSize: CGFloat = 6
    private static let orbSize: CGFloat = 18
    /// How much of a title too long for its tab is faded out — the last
    /// letter or two, enough to read as running on.
    private static let titleFadeWidth: CGFloat = 20
    private static let titleFont = NSFont.systemFont(ofSize: 13)

    init(tab: WindowTab, bar: SessionTabBar) {
        self.tab = tab
        self.bar = bar
        super.init(frame: .zero)
        wantsLayer = true
        layerContentsRedrawPolicy = .onSetNeedsDisplay

        liftSurface.isLifted = true
        liftSurface.alphaValue = 0
        addSubview(liftSurface)

        title.font = Self.titleFont
        title.lineBreakMode = .byClipping
        title.cell?.truncatesLastVisibleLine = false
        title.stringValue = tab.title
        title.setAccessibilityElement(false)
        titleClip.wantsLayer = true
        titleClip.addSubview(title)
        titleFade.startPoint = CGPoint(x: 0, y: 0.5)
        titleFade.endPoint = CGPoint(x: 1, y: 0.5)
        titleFade.colors = [NSColor.black.cgColor, NSColor.black.cgColor, NSColor.clear.cgColor]
        addSubview(titleClip)
        addSubview(agentTile)

        closeButton.target = self
        closeButton.action = #selector(closeTab)
        closeButton.setAccessibilityLabel("Close \(tab.title)")
        closeButton.alphaValue = 0
        addSubview(closeButton)

        hintLabel.font = .monospacedDigitSystemFont(ofSize: 11, weight: .medium)
        hintLabel.textColor = .secondaryLabelColor
        hintLabel.alignment = .right
        hintLabel.alphaValue = 0
        addSubview(hintLabel)

        waitingDot.cornerRadius = 3
        layer?.addSublayer(waitingDot)
        layer?.addSublayer(divider)

        hoverLabel.frame = bounds
        hoverLabel.autoresizingMask = [.width, .height]
        addSubview(hoverLabel)
        updateHoverLabel()

        setAccessibilityElement(true)
        setAccessibilityRole(.radioButton)
        setAccessibilityLabel(tab.title)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("SessionTabView is not loaded from a nib") }

    override var isFlipped: Bool { true }
    override var mouseDownCanMoveWindow: Bool { false }
    override var wantsUpdateLayer: Bool { true }
    /// A press on a tab in a window at the back picks the tab as well as
    /// bringing the window forward, as a tab bar's does.
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    func configure(
        isSelected: Bool, isHovered: Bool, isLifted: Bool, showsDivider: Bool, chord: String?,
        showsChord: Bool, isWindowActive: Bool
    ) {
        let accessoryWas = accessory
        let changed =
            self.isSelected != isSelected || self.isHovered != isHovered || self.isLifted != isLifted
            || self.showsDivider != showsDivider || self.chord != chord || self.showsChord != showsChord
            || self.isWindowActive != isWindowActive
        guard changed else { return }
        self.isSelected = isSelected
        self.isHovered = isHovered
        self.isLifted = isLifted
        self.showsDivider = showsDivider
        self.chord = chord
        self.showsChord = showsChord
        self.isWindowActive = isWindowActive
        setAccessibilityValue(isSelected)
        if let chord { hintLabel.stringValue = chord }
        updateHoverLabel()
        setShown(liftSurface, isLifted && !isSelected, animated: true)
        needsDisplay = true
        if accessory != accessoryWas {
            NSAnimationContext.animate(TabBarMetrics.fade) { layoutContent(animated: true) }
        }
    }

    /// None while the tab is in hand: the label names what the pointer
    /// rests on, and a tab being carried is not being looked at.
    private func updateHoverLabel() {
        hoverLabel.labels = isLifted ? [] : [ToolbarGlassLabel.Text(title: tab.title, hint: chord)]
    }

    func paletteChanged() {
        needsDisplay = true
        liftSurface.needsDisplay = true
    }

    /// What the slot at the tab's tail holds, most pressing first: the ✕
    /// for the pointer reaching for it, the ⌘-number for a ⌘ held to look
    /// for it, the orb the web strip wears while the session's agent works,
    /// and the accent dot for a thread that has moved since it was last
    /// read. An agent still working outranks a thread waiting to be read —
    /// the orb says the tab is going to change again.
    private enum Accessory: Equatable { case none, close, hint, working, waiting }

    private var accessory: Accessory {
        if isHovered && !isLifted { return .close }
        if showsChord && chord != nil { return .hint }
        if tab.working { return .working }
        if tab.waiting { return .waiting }
        return .none
    }

    // MARK: Drawing

    override func updateLayer() {
        effectiveAppearance.performAsCurrentDrawingAppearance {
            CATransaction.begin()
            CATransaction.setAnimationDuration(0.15)
            divider.backgroundColor = NSColor.labelColor.withAlphaComponent(0.14).cgColor
            divider.opacity = showsDivider ? 1 : 0
            waitingDot.backgroundColor = NSColor.controlAccentColor.cgColor
            CATransaction.commit()
            title.textColor = .labelColor
        }
    }

    // MARK: Layout

    override func layout() {
        super.layout()
        layoutContent(animated: false)
    }

    override func setFrameSize(_ newSize: NSSize) {
        super.setFrameSize(newSize)
        needsLayout = true
    }

    /// As wide as the tab needs to show its title whole beside its agent,
    /// with the ✕ at its tail too, so the pointer coming to it does not cut
    /// the title short.
    var fittingWidth: CGFloat {
        let closeReach = max(Self.slot, TabCloseButton.inkWidth) / 2 + TabCloseButton.inkWidth / 2
        return Self.edgeInset + AgentTile.size + Self.titleSpacing + ceil(title.intrinsicContentSize.width)
            + Self.titleSpacing + closeReach + Self.edgeInset
    }

    /// How wide what the slot shows is drawn — not the box it stands in —
    /// so its far edge, not its box's, keeps `edgeInset` from the tab's.
    private var slotInkWidth: CGFloat {
        switch accessory {
        case .none: return 0
        case .close: return TabCloseButton.inkWidth
        case .hint: return hintLabel.frame.width
        case .working: return Self.orbSize
        case .waiting: return Self.waitingDotSize
        }
    }

    private func layoutContent(animated: Bool) {
        let height = bounds.height
        hintLabel.sizeToFit()
        let inkWidth = slotInkWidth
        let slotMidX = bounds.width - Self.edgeInset - inkWidth / 2
        let slotFrame = NSRect(
            x: slotMidX - Self.slot / 2, y: (height - Self.slot) / 2, width: Self.slot, height: Self.slot)
        let dot = Self.waitingDotSize

        CATransaction.begin()
        CATransaction.setDisableActions(!animated)
        liftSurface.frame = bounds
        divider.frame = NSRect(x: -0.5, y: (height - 14) / 2, width: 1, height: 14)
        waitingDot.frame = NSRect(x: slotMidX - dot / 2, y: (height - dot) / 2, width: dot, height: dot)
        waitingDot.opacity = accessory == .waiting ? 1 : 0
        CATransaction.commit()

        agentTile.frame = NSRect(
            x: Self.edgeInset, y: ((height - AgentTile.size) / 2).rounded(),
            width: AgentTile.size, height: AgentTile.size)
        let titleX = Self.edgeInset + AgentTile.size + Self.titleSpacing
        // Clear of the slot's box as well as its ink: the ✕ under the
        // pointer lights the whole circle it is pressed in.
        let slotStart = min(slotMidX - Self.slot / 2, slotMidX - inkWidth / 2)
        let titleEnd = inkWidth > 0 ? slotStart - Self.titleSpacing : bounds.width - Self.edgeInset
        let titleRoom = max(0, titleEnd - titleX)
        let titleSize = title.intrinsicContentSize
        title.frame = NSRect(
            x: 0, y: ((height - titleSize.height) / 2).rounded(),
            width: ceil(titleSize.width), height: titleSize.height)
        let clipFrame = NSRect(x: titleX, y: 0, width: titleRoom, height: height)
        if animated { titleClip.animator().frame = clipFrame } else { titleClip.frame = clipFrame }
        updateTitleFade(overflows: titleSize.width > titleRoom, room: titleRoom)

        closeButton.frame = slotFrame
        hintLabel.frame.origin = CGPoint(
            x: bounds.width - Self.edgeInset - hintLabel.frame.width, y: (height - hintLabel.frame.height) / 2)
        setShown(closeButton, accessory == .close, animated: animated)
        setShown(hintLabel, accessory == .hint, animated: animated)
        layoutOrb(in: slotFrame, animated: animated)
    }

    /// The fade over a title's last letters, cut to where the room ends —
    /// none at all for a title that fits.
    private func updateTitleFade(overflows: Bool, room: CGFloat) {
        guard let layer = titleClip.layer else { return }
        guard overflows, room > 0 else {
            layer.mask = nil
            return
        }
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        titleFade.frame = CGRect(x: 0, y: 0, width: room, height: bounds.height)
        let start = max(0, (room - Self.titleFadeWidth) / room)
        titleFade.locations = [0, NSNumber(value: start), 1]
        layer.mask = titleFade
        CATransaction.commit()
    }

    private func layoutOrb(in frame: NSRect, animated: Bool) {
        if accessory == .working, orb == nil {
            let orb = NSHostingView(rootView: Orb(size: Self.orbSize, label: "Working"))
            orb.alphaValue = 0
            addSubview(orb)
            self.orb = orb
        }
        guard let orb else { return }
        orb.frame = frame
        setShown(orb, accessory == .working, animated: animated)
    }

    private func setShown(_ view: NSView, _ shown: Bool, animated: Bool) {
        let alpha: CGFloat = shown ? 1 : 0
        guard view.alphaValue != alpha else { return }
        if animated { view.animator().alphaValue = alpha } else { view.alphaValue = alpha }
    }

    /// Hidden from the pointer while it is faded out, so a click on a quiet
    /// tab's tail picks the tab rather than closing it.
    override func hitTest(_ point: NSPoint) -> NSView? {
        let hit = super.hitTest(point)
        if hit === closeButton, accessory != .close { return self }
        if let orb, hit?.isDescendant(of: orb) ?? false { return self }
        let inert: [NSView] = [titleClip, title, hintLabel, liftSurface, agentTile]
        return inert.contains { $0 === hit } ? self : hit
    }

    // MARK: Mouse

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        for area in trackingAreas { removeTrackingArea(area) }
        addTrackingArea(
            NSTrackingArea(
                rect: .zero, options: [.mouseEnteredAndExited, .activeInActiveApp, .inVisibleRect],
                owner: self))
    }

    override func mouseEntered(with event: NSEvent) {
        guard !isDeparting else { return }
        bar?.pointer(isOver: true, self)
    }

    override func mouseExited(with event: NSEvent) {
        bar?.pointer(isOver: false, self)
    }

    override func mouseDown(with event: NSEvent) {
        guard !isDeparting else { return }
        bar?.press(self, with: event)
    }

    /// A middle click closes the tab, as it does a browser's.
    override func otherMouseUp(with event: NSEvent) {
        guard event.buttonNumber == 2, !isDeparting else { return super.otherMouseUp(with: event) }
        bar?.close(self)
    }

    override func menu(for event: NSEvent) -> NSMenu? {
        let menu = NSMenu()
        menu.addItem(withTitle: "Close tab", action: #selector(closeTab), keyEquivalent: "").target = self
        menu.addItem(withTitle: "Close other tabs", action: #selector(closeOtherTabs), keyEquivalent: "").target = self
        return menu
    }

    override func accessibilityPerformPress() -> Bool {
        bar?.select(self)
        return true
    }

    @objc private func closeTab() { bar?.close(self) }
    @objc private func closeOtherTabs() { bar?.closeOthers(than: self) }

    /// A tab joining the row: it stands in its slot from the first, at no
    /// width and see-through, and grows into it as the row reshares.
    func prepareToArrive(at frame: NSRect) {
        self.frame = NSRect(x: frame.minX, y: frame.minY, width: 0, height: frame.height)
        alphaValue = 0
        NSAnimationContext.animate(TabBarMetrics.fade) { animator().alphaValue = 1 }
    }
}

// MARK: - The agent

/// A session's agent as its app icon, as Rex marks its tabs: the vendor's
/// mark on the vendor's tile (see `AgentIcon`), edged with the hairline a
/// macOS icon has, so a white tile on a light bar still has an edge. Its place is kept while the agent is
/// still being read, so the title does not move when it arrives.
@MainActor
private final class AgentTile: NSView {
    var agent: ChatProviderKind? {
        didSet {
            setAccessibilityLabel(agent?.label)
            needsDisplay = true
        }
    }

    static let size: CGFloat = 18

    private let tile = CAGradientLayer()
    private let mark = NSImageView()

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        tile.cornerCurve = .continuous
        tile.borderWidth = 0.5
        layer?.addSublayer(tile)
        mark.imageScaling = .scaleProportionallyUpOrDown
        addSubview(mark)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("AgentTile is not loaded from a nib") }

    override var isFlipped: Bool { true }
    override var wantsUpdateLayer: Bool { true }

    override func updateLayer() {
        guard let agent else {
            tile.isHidden = true
            mark.image = nil
            return
        }
        let icon = AgentIcon.of(agent)
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        tile.isHidden = false
        tile.colors = [NSColor(hex: icon.top).cgColor, NSColor(hex: icon.bottom).cgColor]
        effectiveAppearance.performAsCurrentDrawingAppearance {
            tile.borderColor = NSColor.labelColor.withAlphaComponent(0.12).cgColor
        }
        CATransaction.commit()
        mark.image = icon.mark(of: agent)
        layoutMark(share: icon.markShare)
    }

    override func layout() {
        super.layout()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        tile.frame = bounds
        tile.cornerRadius = bounds.height * AgentIcon.cornerShare
        // The icon's top colour at the tile's top, whichever way up the
        // layer's geometry runs in this view.
        let top: CGFloat = tile.contentsAreFlipped() ? 0 : 1
        tile.startPoint = CGPoint(x: 0.5, y: top)
        tile.endPoint = CGPoint(x: 0.5, y: 1 - top)
        CATransaction.commit()
        if let agent { layoutMark(share: AgentIcon.of(agent).markShare) }
    }

    /// The mark's box: the share of the tile's height its icon gives it,
    /// square, centred — the mark is fitted into it at its own proportions.
    private func layoutMark(share: CGFloat) {
        let side = bounds.height * share
        mark.frame = NSRect(x: (bounds.width - side) / 2, y: (bounds.height - side) / 2, width: side, height: side)
    }
}

// MARK: - The track and the surface

/// The bar the tabs stand in: one capsule behind every tab, which the
/// surface under the tab in front stands up out of — the shade of the
/// system tabs' own track. Only for two tabs or more — a track round one
/// tab is a frame round nothing — and only in the window in front.
@MainActor
private final class TabTrackView: NSView {
    var isShown = false {
        didSet {
            guard isShown != oldValue else { return }
            NSAnimationContext.animate(TabBarMetrics.fade) { animator().alphaValue = isShown ? 1 : 0 }
        }
    }

    static let tint: CGFloat = 0.14

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        alphaValue = 0
        layer?.cornerCurve = .continuous
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("TabTrackView is not loaded from a nib") }

    override var wantsUpdateLayer: Bool { true }
    override var mouseDownCanMoveWindow: Bool { true }
    override func hitTest(_ point: NSPoint) -> NSView? { nil }

    override func updateLayer() {
        effectiveAppearance.performAsCurrentDrawingAppearance {
            let dark = effectiveAppearance.isDark
            layer?.backgroundColor = NSColor.labelColor.withAlphaComponent(dark ? Self.tint : Self.tint / 2).cgColor
        }
    }

    override func layout() {
        super.layout()
        layer?.cornerRadius = bounds.height / 2
    }
}

/// The surface the tab in front stands on, raised out of the track as the
/// system tabs' puck is: white in the light, the frame lifted to the puck's
/// grey in the dark; in a window at the back, a flatter tint, so only the
/// bar of the window that takes the keyboard looks pressable. Opaque either
/// way, so a tab carried over others covers their titles. Lifted with the
/// tab in hand, it throws a shadow.
@MainActor
final class TabSurfaceView: NSView {
    var isWindowActive = false { didSet { if isWindowActive != oldValue { needsDisplay = true } } }
    var isLifted = false { didSet { if isLifted != oldValue { needsDisplay = true } } }

    /// How far towards white the frame is lifted in the dark, in the window
    /// in front and in one at the back.
    private static let activeLift: CGFloat = 0.27
    private static let inactiveLift: CGFloat = 0.14

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        layer?.cornerCurve = .continuous
        layer?.shadowOpacity = 1
        layerContentsRedrawPolicy = .onSetNeedsDisplay
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("TabSurfaceView is not loaded from a nib") }

    override var wantsUpdateLayer: Bool { true }
    override func hitTest(_ point: NSPoint) -> NSView? { nil }

    override func updateLayer() {
        guard let layer else { return }
        effectiveAppearance.performAsCurrentDrawingAppearance {
            let dark = effectiveAppearance.isDark
            let frame = IslandPalette.frame
            let raised = isWindowActive || isLifted
            let fill: NSColor
            if dark {
                fill = frame.blended(withFraction: raised ? Self.activeLift : Self.inactiveLift, of: .white) ?? frame
            } else {
                fill = raised ? .white : frame.blended(withFraction: 0.07, of: .black) ?? frame
            }
            CATransaction.begin()
            CATransaction.setAnimationDuration(0.15)
            layer.backgroundColor = fill.cgColor
            layer.shadowColor = NSColor.black.withAlphaComponent(isLifted ? 0.24 : raised && !dark ? 0.08 : 0).cgColor
            layer.shadowRadius = isLifted ? 7 : 1.5
            layer.shadowOffset = CGSize(width: 0, height: isLifted ? -2 : -0.5)
            CATransaction.commit()
        }
    }

    override func layout() {
        super.layout()
        layer?.cornerRadius = bounds.height / 2
        layer?.shadowPath = CGPath(
            roundedRect: bounds, cornerWidth: bounds.height / 2, cornerHeight: bounds.height / 2, transform: nil)
    }

    override func setFrameSize(_ newSize: NSSize) {
        super.setFrameSize(newSize)
        needsLayout = true
    }
}

// MARK: - Buttons

/// A round control on the bar, tinted under the pointer and held tinted
/// while pressed — the chip the rest of the bar's controls wear (see
/// `BarChipStyle`), in AppKit.
@MainActor
class BarChipButton: NSButton {
    private var isPointerInside = false

    init(symbol: String, pointSize: CGFloat, weight: NSFont.Weight) {
        super.init(frame: .zero)
        isBordered = false
        bezelStyle = .regularSquare
        imagePosition = .imageOnly
        image = NSImage(systemSymbolName: symbol, accessibilityDescription: nil)?
            .withSymbolConfiguration(.init(pointSize: pointSize, weight: weight))
        wantsLayer = true
        layer?.cornerCurve = .continuous
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("BarChipButton is not loaded from a nib") }

    override var wantsUpdateLayer: Bool { true }
    override var mouseDownCanMoveWindow: Bool { false }
    /// The chip is the whole frame: a symbol image's insets would let
    /// Auto Layout grow the tinted frame past the size it is given.
    override var alignmentRectInsets: NSEdgeInsets { NSEdgeInsetsZero }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    var restingInk: NSColor { .secondaryLabelColor }

    override func updateLayer() {
        effectiveAppearance.performAsCurrentDrawingAppearance {
            let tint: CGFloat = isHighlighted ? BarChipMetrics.onTint : isPointerInside ? BarChipMetrics.hoverTint : 0
            layer?.backgroundColor = NSColor.labelColor.withAlphaComponent(tint).cgColor
            contentTintColor = isPointerInside || isHighlighted ? .labelColor : restingInk
        }
    }

    override func layout() {
        super.layout()
        layer?.cornerRadius = bounds.height / 2
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        for area in trackingAreas { removeTrackingArea(area) }
        addTrackingArea(
            NSTrackingArea(
                rect: .zero, options: [.mouseEnteredAndExited, .activeInActiveApp, .inVisibleRect],
                owner: self))
    }

    override func mouseEntered(with event: NSEvent) {
        isPointerInside = true
        needsDisplay = true
    }

    override func mouseExited(with event: NSEvent) {
        isPointerInside = false
        needsDisplay = true
    }
}

@MainActor
private final class NewTabButton: BarChipButton {
    init() { super.init(symbol: "plus", pointSize: 14, weight: .medium) }
}

/// The ✕ in a tab's slot: a smaller circle inside the tab, lit only under
/// the pointer so it reads as part of the tab until it is reached for.
@MainActor
private final class TabCloseButton: BarChipButton {
    init() { super.init(symbol: "xmark", pointSize: 9, weight: .bold) }

    /// How wide the ✕ is drawn. A symbol's image carries side bearings past
    /// its strokes, and its alignment rect only trims them vertically, so
    /// the strokes are measured: drawn once and read back for their extent.
    static let inkWidth: CGFloat = {
        guard let image = TabCloseButton().image else { return 0 }
        let scale: CGFloat = 4
        guard
            let rep = NSBitmapImageRep(
                bitmapDataPlanes: nil, pixelsWide: Int(image.size.width * scale),
                pixelsHigh: Int(image.size.height * scale), bitsPerSample: 8, samplesPerPixel: 4,
                hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0),
            let context = NSGraphicsContext(bitmapImageRep: rep)
        else { return image.size.width }
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = context
        image.draw(in: NSRect(x: 0, y: 0, width: rep.pixelsWide, height: rep.pixelsHigh))
        NSGraphicsContext.restoreGraphicsState()
        let inked = (0..<rep.pixelsWide).filter { x in
            (0..<rep.pixelsHigh).contains { y in (rep.colorAt(x: x, y: y)?.alphaComponent ?? 0) > 0.1 }
        }
        guard let first = inked.first, let last = inked.last else { return image.size.width }
        return CGFloat(last + 1 - first) / scale
    }()
}

// MARK: - ⌘ held

/// Whether ⌘ is being held on its own, which puts each tab's chord in the
/// slot at its tail — ⌘1 to ⌘9 — as Rex and Safari do.
///
/// Only after a moment, and only for ⌘ alone: ⌘ is on its way to a chord
/// far more often than it is held to look, and a row of numbers flashing up
/// for every ⌘C would be noise. Any key pressed while it is held makes it a
/// chord after all, and puts the numbers away; so does the app going to the
/// back, which takes the ⌘ key's release with it.
@MainActor
final class CommandHold {
    static let shared = CommandHold()
    static let didChange = Notification.Name("CommandHoldDidChange")

    private(set) var isHeld = false {
        didSet {
            if isHeld != oldValue { NotificationCenter.default.post(name: Self.didChange, object: self) }
        }
    }

    private static let patience: Duration = .milliseconds(450)
    private var pending: Task<Void, Never>?
    private var started = false

    func start() {
        guard !started else { return }
        started = true
        NSEvent.addLocalMonitorForEvents(matching: [.flagsChanged, .keyDown]) { [weak self] event in
            MainActor.assumeIsolated { self?.observe(event) }
            return event
        }
        NotificationCenter.default.addObserver(
            forName: NSApplication.didResignActiveNotification, object: nil, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.release() }
        }
    }

    private func observe(_ event: NSEvent) {
        let commandAlone =
            event.type == .flagsChanged
            && event.modifierFlags.intersection(.deviceIndependentFlagsMask) == .command
        if commandAlone { hold() } else { release() }
    }

    private func hold() {
        guard pending == nil, !isHeld else { return }
        pending = Task { [weak self] in
            try? await Task.sleep(for: Self.patience)
            guard !Task.isCancelled else { return }
            self?.pending = nil
            self?.isHeld = true
        }
    }

    private func release() {
        pending?.cancel()
        pending = nil
        isHeld = false
    }
}
