// The window tabs, on the toolbar: Code and Sessions as icons, each
// session by its title with its ✕, and the mark that mints one — the row
// the web app's window bar draws, on the window's own bar, from the picture
// the island sends up (see `WindowTabStrip`). The pinned pair are the
// system's own toggles in the one pane of glass the bar gives a group —
// the way Notes sets its format buttons — the one that is on lit the way
// the system lights it; the sessions after them, and the mark that mints
// one, wear the web bar's chips instead, cut to the glass's own height and
// capsule, so a row of titles reads as the SPA's strip on the pinned
// pair's line rather than a run of glass buttons (see `BarChipStyle`). A
// press goes back down to the island's strip, which is the one that
// switches.
//
// The pinned pair are a toolbar item each, laid out and tipped by the bar
// as it does everything else on it. The sessions are not: they are one
// item holding a row this file lays out itself, because a tab is dragged
// along that row to reorder it and the tabs it passes have to slide out of
// its way under the pointer — which means one view that knows where every
// tab stands and can move them all against each other (see
// `SessionTabRow`), not a run of items the toolbar places one by one.
//
// That row scrolls sideways once the sessions outrun the bar, as the web
// strip does, rather than leaning on what the bar would otherwise do with
// an item too wide for it: NSToolbar does not cut an item short, it takes
// it off the bar whole and puts it in the ›› menu — and every session tab
// being in the one item, they all went at once, which is the state a
// window with a few sessions open would get into. So the row measures the
// run the bar leaves it and keeps inside it (see `BarRunWidth`), and the
// tabs past the strip's end are scrolled to.
import AppKit
import SwiftUI

struct TabStripItems: ToolbarContent {
    let model: AppModel

    var body: some ToolbarContent {
        ToolbarItemGroup(placement: .navigation) {
            ForEach(model.windowTabs.tabs.filter(\.pinned)) { tab in
                PinnedTab(tab: tab, model: model)
            }
        }
        ToolbarItemGroup(placement: .navigation) {
            SessionTabRow(model: model)
        }
        .sharedBackgroundVisibility(.hidden)
    }
}

/// A pinned tab is its icon and nothing else: a system toggle on the bar,
/// which draws it in the toolbar's own glass and lights it while its way
/// of working is in front (see `WindowTabStrip.lights`). A tab is left by
/// going to another, never by pressing it again, so a press on the tab in
/// front is ignored; a press on Sessions lit for a session's own tab is
/// the way back to the list, whichever way the toggle reads it.
private struct PinnedTab: View {
    let tab: WindowTab
    let model: AppModel

    var body: some View {
        Toggle(isOn: isInFront) {
            Label(tab.title, systemImage: tab.kind.symbol)
        }
        .toggleStyle(.button)
        // Lit in the theme's accent, as the pane's tabs and the diff's
        // add-a-comment button are — the one colour every lit control shares;
        // on the app's own palette that colour is the system's accent, which
        // is what the toggle would have worn anyway. Set as a tint and no
        // more: an ink would give the bar's glass a hover the system's items
        // do not have, and wrapping the toggle in a view of its own loses
        // it the bar's glass altogether.
        .tint(Color(nsColor: IslandPalette.accent))
        .help(tab.title)
        .contextMenu { TabContextMenu(tab: tab, model: model) }
    }

    private var isInFront: Binding<Bool> {
        Binding(
            get: { model.windowTabs.lights(tab) },
            set: { _ in
                guard model.windowTabs.activeId != tab.id else { return }
                model.select(tabId: tab.id)
            })
    }
}

/// The sessions, and the mark that mints one, as one row.
///
/// The row holds an order of its own rather than drawing the island's
/// straight off. A tab dragged along it moves under the pointer frame by
/// frame and the tabs it passes stand aside as it crosses their middle,
/// which is a reorder every few hundredths of a second: asking the island
/// for each of them and waiting for the strip to come back would put the
/// bridge between the pointer and the tab under it. So the row rearranges
/// itself as the drag goes and tells the island once, when the tab is let
/// go — and the strip that comes back, being the order the row is already
/// in, changes nothing on screen.
///
/// Nothing changes places while the drag is on. The row keeps the order it
/// started in and moves the tabs with two offsets: the tab in hand stands
/// where the pointer has it, to the frame and to the point, and the ones
/// it has passed stand a tab's width aside, sprung, so the gap it would
/// drop into opens and closes under it. Neither offset is ever the other's
/// to correct, which is what a row that reordered itself mid-drag would
/// have to do — its own slot moving out from under it by a tab's width
/// every time the row settled.
private struct SessionTabRow: View {
    let model: AppModel
    @State private var order: [WindowTab] = []
    /// What each tab measures, for the arithmetic below: a tab is as wide
    /// as its title up to a limit, so there is no one width to work from.
    @State private var widths: [String: CGFloat] = [:]
    @State private var drag: TabDrag?
    /// The run of the bar the row has to stay inside, the mark that mints
    /// a session included (see `BarRunWidth`) — nothing until the bar has
    /// laid the row out once, which the strip reads as no limit yet.
    @State private var run: CGFloat = 0
    /// How far the strip has been scrolled, which is only read to know
    /// whether there is more of the row at either end (see `edges`).
    @State private var scrolled: CGFloat = 0

    /// The air between chips, which counts as part of the distance a tab
    /// has to travel to pass its neighbour.
    private static let gap: CGFloat = 4
    /// What a tab is reckoned to be before it has been measured, which is
    /// only ever for the frame between a tab appearing and its first
    /// layout.
    private static let unmeasured: CGFloat = 120
    /// The one spring the row moves on: the tabs standing aside mid-drag,
    /// and the whole row settling into its new order once the tab is let
    /// go. One spring for both because they meet at that moment — a tab
    /// standing aside has to come to rest exactly as its slot arrives
    /// under it, and two curves would show the difference.
    private static let slide: Animation = .snappy(duration: 0.22, extraBounce: 0.1)
    /// The room the strip's clip leaves above and below the tabs, for the
    /// tab in hand to be lifted into.
    private static let lift: CGFloat = 12
    /// How long the strip takes to fade out at an end it has more tabs
    /// past — about a title's last word.
    private static let fade: CGFloat = 28

    var body: some View {
        // With no session open the strip is nothing wide, and the row's
        // spacing after it would push the mark off the pinned pair by more
        // than the bar's own gap — the one the pinned pair stand off the
        // sidebar's glass by. So the empty row spaces nothing, and the mark
        // stands where the bar puts it.
        HStack(spacing: order.isEmpty ? 0 : Self.gap) {
            strip
            Button { model.newSession() } label: {
                Label("New session", systemImage: "plus")
                    .barGlyph()
            }
            .buttonStyle(BarChipStyle())
            .help("New session (⌘T)")
        }
        .background { BarRunWidth { run = $0 } }
        // The row hands its run back before anything ahead of it on the
        // bar comes to take the room: the sidebar's column, which slides
        // out over the next fifth of a second, and the pinned pair, which
        // arrive with the project a moment after the row itself does. A
        // row that waited to be pushed would be a frame too wide, and a
        // frame is all it takes — the bar takes an item that does not fit
        // off into the ›› menu, and from there the row cannot see where
        // the row on the bar would stand, so it could never work out how
        // much shorter to be (see `BarRunWidth`). What it hands back it
        // takes again a moment later, measured afresh.
        .onChange(of: model.sidebarShown) { _, shown in
            if shown { run = max(0, run - SidebarWidths.max) }
        }
        .onChange(of: model.windowTabs.tabs) { was, now in
            if was.count(where: \.pinned) != now.count(where: \.pinned) { run = 0 }
            follow()
        }
        .onAppear { follow() }
    }

    /// The tabs, as far along the bar as the bar allows. The mark that
    /// mints a session stays out of the scroll, on the row's end, so it is
    /// there to press however many sessions are open.
    private var strip: some View {
        ScrollViewReader { scroll in
            ScrollView(.horizontal) {
                HStack(spacing: Self.gap) {
                    ForEach(Array(order.enumerated()), id: \.element.id) { slot, tab in
                        tabView(tab, at: slot)
                    }
                }
            }
            .scrollIndicators(.hidden)
            // The strip's own clip is put away for a mask cut to the same
            // width but taller: what scrolls past the ends is still taken
            // off, and the tab in hand — a shade bigger, with a shadow
            // under it — is not cut off at the tabs' own height.
            .scrollClipDisabled()
            .frame(width: width, height: BarChipMetrics.height)
            .mask { edges }
            .onScrollGeometryChange(for: CGFloat.self) { $0.contentOffset.x } action: { _, x in
                scrolled = x
            }
            .onChange(of: model.windowTabs.activeId, initial: true) { reveal(with: scroll) }
            .onChange(of: order) { reveal(with: scroll) }
        }
    }

    private func tabView(_ tab: WindowTab, at slot: Int) -> some View {
        SessionTab(tab: tab, model: model, lifted: drag?.id == tab.id) { press(tab) }
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: {
                widths[tab.id] = $0
            }
            // Standing aside is sprung; being carried is not — the tab in
            // hand is under the pointer, not chasing it. The spring is
            // inside the second offset, so it is the only one of the two
            // it is ever applied to.
            .offset(x: standsAside(at: slot))
            .animation(Self.slide, value: standsAside(at: slot))
            .offset(x: carried(tab, at: slot))
            // The tab in hand passes over the others rather than under
            // them.
            .zIndex(drag?.id == tab.id ? 1 : 0)
            .gesture(reorder(tab, at: slot))
    }

    /// The strip's ends: cut square where the row ends, and faded out
    /// where it carries on past — the tab under the fade is the one that
    /// says there are more, and a hard edge would have it look cut off
    /// rather than scrolled past. Both ends are the one gradient, its
    /// stops moved to the edge they are not wanted at, so a fade comes and
    /// goes rather than appearing whole.
    private var edges: some View {
        let ends = width > 0 ? Self.fade / width : 0
        return LinearGradient(
            stops: [
                .init(color: .clear, location: 0),
                .init(color: .black, location: scrolled > 1 ? ends : 0),
                .init(color: .black, location: scrolled + width < content - 1 ? 1 - ends : 1),
                .init(color: .clear, location: 1),
            ],
            startPoint: .leading, endPoint: .trailing
        )
        .padding(.vertical, -Self.lift)
        .animation(.easeOut(duration: 0.15), value: scrolled > 1)
        .animation(.easeOut(duration: 0.15), value: scrolled + width < content - 1)
    }

    /// What the tabs come to, laid end to end.
    private var content: CGFloat {
        guard let last = order.indices.last else { return 0 }
        return order.reduce(0) { $0 + width(of: $1) } + CGFloat(last) * Self.gap
    }

    /// How wide the strip stands: the tabs' own width while they fit, and
    /// what the bar leaves once they do not — the run less the mark on the
    /// row's end and the air before it. Nothing at all until the bar has
    /// said, which is the one frame between the row appearing and its
    /// first layout: a window opening on a dozen sessions would lay the
    /// row out at its full length for that frame, and the bar, seeing an
    /// item longer than itself, would have taken it off and put it in the
    /// ›› menu before ever giving it a width to measure against — with no
    /// way back, since a row in the menu cannot see where the row on the
    /// bar would stand.
    private var width: CGFloat {
        guard run > 0 else { return 0 }
        return min(content, max(0, run - BarChipMetrics.height - Self.gap))
    }

    /// Keeps the tab in front in view: one reached by ⌘1–9 or ⌘⇧[, and the
    /// freshly minted one at the row's end, are scrolled to rather than
    /// left past the strip's edge. Never mid-drag — the row is the
    /// pointer's then, and the order changing under it is the drag's own
    /// doing.
    private func reveal(with scroll: ScrollViewProxy) {
        let id = model.windowTabs.activeId
        guard drag == nil, order.contains(where: { $0.id == id }) else { return }
        withAnimation(Self.slide) { scroll.scrollTo(id) }
    }

    /// The island's order, taken as the row's own — except mid-drag, where
    /// the row's is the one the pointer is working and the island has yet
    /// to hear about it.
    private func follow() {
        guard drag == nil else { return }
        order = model.windowTabs.sessions
    }

    private func press(_ tab: WindowTab) {
        if NSEvent.modifierFlags.contains(.shift) {
            model.closeTab(id: tab.id)
        } else {
            model.select(tabId: tab.id)
        }
    }

    private func width(of tab: WindowTab) -> CGFloat {
        widths[tab.id] ?? Self.unmeasured
    }

    /// The distance from one slot to the next along the row.
    private func step(to slot: Int) -> CGFloat {
        width(of: order[slot]) + Self.gap
    }

    /// Where the tab in hand stands: where the pointer has taken it, held
    /// to the row — it stops with its leading edge at the row's start and
    /// its trailing edge at the end rather than being carried off the bar.
    private func carried(_ tab: WindowTab, at slot: Int) -> CGFloat {
        guard let drag, drag.id == tab.id else { return 0 }
        let before = (0..<slot).reduce(0) { $0 + step(to: $1) }
        let after = ((slot + 1)..<order.count).reduce(0) { $0 + step(to: $1) }
        return min(max(drag.translation, -before), after)
    }

    /// How far a tab stands aside to leave the slot the tab in hand would
    /// drop into: one slot along, towards where that tab came from, for
    /// every tab between the slot it left and the one it is over.
    private func standsAside(at slot: Int) -> CGFloat {
        guard let drag, slot != drag.from else { return 0 }
        let landing = landing(of: drag)
        let held = step(to: drag.from)
        if drag.from < slot, slot <= landing { return -held }
        if landing <= slot, slot < drag.from { return held }
        return 0
    }

    /// The slot the tab in hand would drop into: the one it has been
    /// carried into, counting a slot for each neighbour whose middle it
    /// has crossed. Read off the distance travelled every time rather than
    /// kept as it goes, so the tab is wherever the pointer says it is and
    /// nothing can drift.
    private func landing(of drag: TabDrag) -> Int {
        var slot = drag.from
        var left = drag.translation
        // Whichever way the tab set off, it keeps going that way: crossing
        // a neighbour's middle leaves what is left of the distance short
        // of that neighbour's far side, which is to say pointing back the
        // way it came, and a walk that read that as a step back would take
        // every crossing straight off again.
        if left > 0 {
            while slot + 1 < order.count, left > step(to: slot + 1) / 2 {
                left -= step(to: slot + 1)
                slot += 1
            }
        } else {
            while slot > 0, -left > step(to: slot - 1) / 2 {
                left += step(to: slot - 1)
                slot -= 1
            }
        }
        return slot
    }

    private func reorder(_ tab: WindowTab, at slot: Int) -> some Gesture {
        // Short of the threshold the drag never starts, so a press that
        // wanders a point or two on its way up is still a press.
        DragGesture(minimumDistance: 4)
            .onChanged { value in
                if drag?.id != tab.id { drag = TabDrag(id: tab.id, from: slot) }
                drag?.translation = value.translation.width
            }
            .onEnded { _ in
                guard drag?.id == tab.id else { return }
                settle()
            }
    }

    /// The tab let go. The row takes the order the tabs are already
    /// standing in and drops both offsets at once, on the spring the tabs
    /// standing aside are already moving on: each of them is put in the
    /// slot it has been standing in all along, so it does not move at all,
    /// and the tab in hand springs the last of the way home from wherever
    /// the pointer left it. The island hears where it landed — after the
    /// tab now before it, or before the one after it at the head of the
    /// row. A tab put back where it started is no move and nobody is told.
    private func settle() {
        guard let drag else { return }
        let landing = landing(of: drag)
        withAnimation(Self.slide) {
            if landing != drag.from {
                order.insert(order.remove(at: drag.from), at: landing)
            }
            self.drag = nil
        }
        guard landing != drag.from else { return }
        if landing > 0 {
            model.moveTab(id: drag.id, beside: order[landing - 1].id, after: true)
        } else if order.count > 1 {
            model.moveTab(id: drag.id, beside: order[1].id, after: false)
        }
    }
}

/// A tab in hand: which one, the slot it was picked up from and how far
/// the pointer has carried it since.
private struct TabDrag {
    let id: String
    let from: Int
    var translation: CGFloat = 0
}

/// How much of the bar is the row's: from where the row begins to the
/// window's trailing edge, less the air the bar keeps there.
///
/// Measured because the bar will not clip. An item wider than the run left
/// to it is not cut short — it is taken off the bar whole and put in the
/// ›› menu, and every session tab being in the one item, they go together
/// — so the row has to know its run before it lays out and keep inside it,
/// and the bar never has cause to take it anywhere.
///
/// Read off the window rather than the toolbar, which has no public run of
/// items to ask what it gave each of them. What the row wants is where it
/// begins, once the sidebar's column and the pinned pair have had their
/// share, and a view standing in the row can say that in the window's own
/// coordinates; the row is last on the bar, so what follows it to the
/// window's edge is the row's.
private struct BarRunWidth: NSViewRepresentable {
    let measured: (CGFloat) -> Void

    func makeNSView(context: Context) -> BarRunProbe { BarRunProbe(measured: measured) }

    func updateNSView(_ probe: BarRunProbe, context: Context) { probe.measured = measured }
}

private final class BarRunProbe: NSView {
    var measured: (CGFloat) -> Void
    /// The air the row leaves at the window's trailing edge, which is the
    /// bar's own: an item laid right up against the edge is one the bar
    /// takes off into the ›› menu rather than draw that close.
    private static let trailing: CGFloat = 16
    /// How long a longer run has to hold before the row is given it (see
    /// `measure`).
    private static let settling: TimeInterval = 0.4
    /// What the row gives up for as long as the window's edge is in hand.
    /// The row follows a resize a frame behind — the bar is laid out on
    /// the new width before the row hears the window's; this is that frame
    /// paid for in advance, and taken back once the edge is let go.
    private static let resizing: CGFloat = 128
    /// What a row taken off the bar gives up at a time to get back on.
    private static let retreat: CGFloat = 64
    private var given: CGFloat?
    private var growing: CGFloat?
    private var growth: Timer?

    init(measured: @escaping (CGFloat) -> Void) {
        self.measured = measured
        super.init(frame: .zero)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("BarRunProbe is not loaded from a nib") }

    deinit { NotificationCenter.default.removeObserver(self) }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        let centre = NotificationCenter.default
        centre.removeObserver(self)
        guard let window else { return }
        // The row moves without moving: as the sidebar's column comes and
        // goes, and as the pinned pair arrive with the project, the bar
        // slides the row along — which puts it somewhere else in the
        // window without changing its frame in the view that holds it, so
        // nothing on the view itself would say so. The window's own update
        // is watched instead: it comes round after every pass of the event
        // loop, and so after every move the bar makes, and what it costs
        // is a coordinate and a comparison.
        for name in [NSWindow.didUpdateNotification, NSWindow.didResizeNotification] {
            centre.addObserver(self, selector: #selector(measure), name: name, object: window)
        }
        measure()
    }

    /// A shorter run is the row's at once; a longer one only once it has
    /// held for a moment.
    ///
    /// Because the row gets one chance. A row too long for the bar is not
    /// cut short, it is taken off and put in the ›› menu, and from there it
    /// cannot see where the row on the bar would stand, so it cannot work
    /// out how much shorter to be and can never come back — a window
    /// opened on a dozen sessions loses the lot until it is resized. The
    /// one moment the row is measured wrong is while the bar is still
    /// filling: the pinned pair arrive with the project, after the row
    /// does, and until they land the row stands where they will be and
    /// reads the bar as longer than it will get. Every wrong answer that
    /// costs anything is a long one, so a long one waits and a short one
    /// does not.
    @objc private func measure() {
        guard let window, let bar = window.toolbar else { return }
        guard onTheBar(bar) else { return retreat() }
        let air = Self.trailing + (window.inLiveResize ? Self.resizing : 0)
        let run = max(0, window.frame.width - convert(bounds, to: nil).minX - air)
        // A run within a point of the one the row has is its own layout
        // coming back round, not the bar moving.
        if let given, abs(run - given) < 1 { return stopGrowing() }
        if let given, run < given {
            stopGrowing()
            self.given = run
            measured(run)
            return
        }
        guard growing.map({ abs(run - $0) >= 1 }) ?? true else { return }
        growing = run
        growth?.invalidate()
        growth = Timer.scheduledTimer(withTimeInterval: Self.settling, repeats: false) {
            [weak self] _ in
            MainActor.assumeIsolated {
                guard let self, let grown = self.growing else { return }
                self.stopGrowing()
                self.given = grown
                self.measured(grown)
            }
        }
    }

    /// Taken off the bar all the same — a window edge dragged in faster
    /// than the row could follow it. The row cannot see from the ›› menu
    /// how much shorter it would have to be, so it gives up a step of its
    /// run on every pass of the event loop until the bar has something
    /// short enough to take back, and measures afresh once it is back.
    private func retreat() {
        guard let given, given > 0 else { return }
        stopGrowing()
        let shorter = max(0, given - Self.retreat)
        self.given = shorter
        measured(shorter)
    }

    /// Whether the row is still on the bar. Taken off it, it is laid out
    /// all the same — somewhere of the ›› menu's own choosing — and a run
    /// measured from there is a number about nothing.
    private func onTheBar(_ bar: NSToolbar) -> Bool {
        bar.visibleItems?.contains { item in
            item.view.map(isDescendant(of:)) ?? false
        } ?? false
    }

    private func stopGrowing() {
        growth?.invalidate()
        growth = nil
        growing = nil
    }
}

/// A session's tab: its title, and a slot at its tail the ✕ stands in —
/// always on the tab in front, and under the pointer on the rest, as the
/// web strip shows it. The slot is the tab's whether or not the ✕ is in
/// it, so a tab neither resizes nor leaves a hole as the control comes and
/// goes. What the thread is doing shares that slot, so a thread going
/// quiet neither resizes the tab nor leaves a hole, and reaching for the ✕
/// trades one for the other. The ✕ is laid over the tab rather than set
/// inside its label: a button inside a button's label never gets the
/// click, the outer one does, so the tab leaves the slot empty and the ✕
/// stands on top of it. A shift-click closes too, so a tab can go without
/// aiming for its ✕.
///
/// A tab is not a button, for all that it reads as one: it answers a press
/// and a drag both (see `SessionTabRow`), and a button would take the
/// mouse-up that ends a drag as a press of its own and switch to the tab
/// that had just been dropped. It is a chip with the two gestures on it
/// instead, named to the accessibility tree as the button it stands in
/// for.
private struct SessionTab: View {
    let tab: WindowTab
    let model: AppModel
    /// Whether it is the tab being dragged, which is lifted off the row:
    /// a shade bigger, on the tint it wears when it is on, with a shadow
    /// under it.
    let lifted: Bool
    let press: () -> Void
    @State private var isHovering = false

    private static let maxWidth: CGFloat = 208
    private static let closeSlot: CGFloat = 20
    /// Where a tab's title begins, which the empty row stands the mark
    /// that mints a session on (see `SessionTabRow`).
    fileprivate static let leadingInset: CGFloat = 14
    private static let trailingInset: CGFloat = 8

    var body: some View {
        let isActive = model.windowTabs.activeId == tab.id
        let showsClose = isActive || isHovering
        HStack(spacing: 6) {
            Text(tab.title)
                .font(.system(size: 13))
                .lineLimit(1)
                .truncationMode(.tail)
            ZStack {
                Color.clear
                if !showsClose { TabMark(tab: tab) }
            }
            .frame(width: Self.closeSlot, height: Self.closeSlot)
        }
        .padding(.leading, Self.leadingInset)
        .padding(.trailing, Self.trailingInset)
        .frame(maxWidth: Self.maxWidth)
        .barChip(isOn: isActive, isPressed: lifted)
        .overlay(alignment: .trailing) {
            if showsClose {
                TabCloseButton(title: tab.title) { model.closeTab(id: tab.id) }
                    .frame(width: Self.closeSlot, height: Self.closeSlot)
                    .padding(.trailing, Self.trailingInset)
            }
        }
        .scaleEffect(lifted ? 1.04 : 1)
        .shadow(color: .black.opacity(lifted ? 0.28 : 0), radius: 7, y: 2)
        .onHover { isHovering = $0 }
        .onTapGesture(perform: press)
        .help(tab.title)
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel(tab.title)
        .accessibilityAction { press() }
        .contextMenu { TabContextMenu(tab: tab, model: model) }
    }
}

/// What a session's thread is doing, in the slot the ✕ shares: the orb the
/// web strip wears while its agent works, and otherwise the accent dot for
/// a thread that has moved since it was last read. An agent still working
/// outranks a thread waiting to be read — the orb says the tab is going to
/// change again, which is the more useful of the two.
private struct TabMark: View {
    let tab: WindowTab

    var body: some View {
        if tab.working {
            Orb(size: 18, label: "Working")
        } else if tab.waiting {
            Circle()
                .fill(Color.accentColor)
                .frame(width: 6, height: 6)
                .accessibilityLabel("Waiting")
        }
    }
}

/// The ✕ in a session tab's slot: a smaller chip inside the chip — round,
/// as the tab's ends are — lit only under the pointer so it reads as part
/// of the tab until it is reached for. Its own button, so pressing it
/// closes the tab rather than picking it.
private struct TabCloseButton: View {
    let title: String
    let action: () -> Void
    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            Image(systemName: "xmark")
                .font(.system(size: 10, weight: .semibold))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .foregroundStyle(.primary.opacity(isHovering ? 1 : 0.7))
                .background(
                    isHovering ? Color.primary.opacity(BarChipMetrics.onTint) : Color.clear,
                    in: Circle())
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
        .help("Close \(title)")
        .accessibilityLabel("Close \(title)")
    }
}

private struct TabContextMenu: View {
    let tab: WindowTab
    let model: AppModel

    var body: some View {
        if !tab.pinned {
            Button("Close tab") { model.closeTab(id: tab.id) }
        }
        Button("Close other tabs") {
            for other in model.windowTabs.tabs where other.id != tab.id && !other.pinned {
                model.closeTab(id: other.id)
            }
        }
    }
}
