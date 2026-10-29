// A run of the rail's buttons as tabs: the icons stacked on a quiet track,
// and one piece of glass — the puck — standing under the one that is on.
// The system's own tabs are the model (see `SegmentedTabs`), but they only
// come laid out across, never down, so the rail's are drawn here: the puck
// springs from icon to icon when the surface changes, and can be taken in
// hand and slid along the track, swelling a little as it lifts — the
// system's puck magnifies what is under it; this one, having nothing of
// the system's lens to borrow, grows instead. A label on glass beside the
// rail names the surface and the chord that reaches it: the one under the
// pointer, once it has rested a moment, and the one under the puck while
// it is carried, when a trackpad that can tap back also gives one tap for
// each icon it crosses. Let go, the puck settles on the nearest icon and
// that surface comes up.
//
// A track can carry icons after its tabs that are not surfaces — the
// search, whose menu opens two lists — which wear the same icon, the same
// hover and the same label, so the pointer runs on from the tabs to them
// without a seam. The puck cannot be carried onto one, having no surface
// to stand for there, but it goes to stand under one while what it opens
// is up — the search's lists — and comes back to the surface after.
import AppKit
import SwiftUI

/// An icon on a rail track, as the label names it: what it is called and
/// the chord that reaches it.
struct RailTab: Identifiable, Equatable {
    let id: String
    let symbol: String
    let title: String
    let hint: String
}

struct GlassRailTabs<Extra: View>: View {
    typealias Tab = RailTab

    let tabs: [Tab]
    /// The icons after the tabs that are not surfaces, each drawn by
    /// `extra` — told whether the pointer is over it and whether it is on —
    /// and named by the label as a tab is.
    let extras: [Tab]
    /// The extra whose own thing is up, which the puck stands under in
    /// place of the surface's tab while it is.
    let activeExtra: String?
    /// The tab that is on, if any is: none while the page is on a surface
    /// the run does not serve, or the pane its tabs open is put away.
    let selection: String?
    /// A click on a tab, which the run's owner reads as it reads a click on
    /// a rail button — the bottom pane's lit tab puts the pane away.
    let press: (String) -> Void
    /// The puck let go over a tab, which always means that surface.
    let drop: (String) -> Void
    private let extra: (Tab, _ isHovered: Bool, _ isLit: Bool) -> Extra

    @State private var drag: PuckDrag?
    /// The icon under the pointer, read off the track as a whole so it
    /// follows the pointer from icon to icon without a gap between them.
    @State private var hovered: Int?
    /// Whether the label has come up for the pointer. It waits a moment
    /// the first time, as a tooltip does, and then follows the pointer
    /// from icon to icon at once until it leaves the track.
    @State private var hoverLabelled = false
    @State private var hoverWait: Task<Void, Never>?
    /// The icon just clicked, which the label keeps quiet over — a click
    /// puts a tooltip away — until the pointer moves to another.
    @State private var clicked: Int?
    /// The tab pressed or dropped on, held until the selection comes back
    /// naming it: a code surface is the page's to change, over the bridge,
    /// and a puck read straight off the selection would go back to the old
    /// tab for that trip and then over again.
    @State private var pending: String?

    private static var item: CGFloat { GlassRailTabsMetrics.item }
    private static var spacing: CGFloat { GlassRailTabsMetrics.spacing }
    private static var inset: CGFloat { GlassRailTabsMetrics.inset }
    private static var width: CGFloat { GlassRailTabsMetrics.width }
    private static var step: CGFloat { item + spacing }
    private static var dragThreshold: CGFloat { GlassRailTabsMetrics.dragThreshold }
    private static var liftedScale: CGFloat { GlassRailTabsMetrics.liftedScale }
    private static var labelHeight: CGFloat { GlassRailTabsMetrics.labelHeight }
    private static var labelGap: CGFloat { GlassRailTabsMetrics.labelGap }
    private static var hoverDelay: Duration { GlassRailTabsMetrics.hoverDelay }

    init(
        tabs: [Tab], extras: [Tab], activeExtra: String? = nil, selection: String?,
        press: @escaping (String) -> Void, drop: @escaping (String) -> Void,
        @ViewBuilder extra: @escaping (_ tab: Tab, _ isHovered: Bool, _ isLit: Bool) -> Extra
    ) {
        self.tabs = tabs
        self.extras = extras
        self.activeExtra = activeExtra
        self.selection = selection
        self.press = press
        self.drop = drop
        self.extra = extra
    }

    var body: some View {
        VStack(spacing: Self.spacing) {
            VStack(spacing: Self.spacing) {
                ForEach(Array(tabs.enumerated()), id: \.element.id) { index, tab in
                    glyph(tab, isLit: litIndex == index, isHovered: isHovered(index))
                }
            }
            // Behind the icons, and sized by them: the puck travels the
            // column the tabs make rather than deciding how tall it is.
            .background(alignment: .top) { puck }
            .contentShape(Rectangle())
            // The tabs' own, so the extras keep their clicks to themselves.
            .gesture(slide)
            ForEach(Array(extras.enumerated()), id: \.element.id) { index, item in
                let line = tabs.count + index
                extra(item, isHovered(line), litIndex == line)
            }
        }
        .padding(Self.inset)
        .frame(width: Self.width)
        .background(Color.primary.opacity(0.05), in: ControlShape.track(inset: Self.inset))
        .contentShape(ControlShape.track(inset: Self.inset))
        .onContinuousHover(perform: hover)
        .overlay(alignment: .topLeading) { label }
        .onChange(of: selection) { pending = nil }
        // An extra's menu takes its click for itself, so the track never
        // hears it; a menu opening while the pointer is on the track is
        // that click, and puts the label away as a click on a tab does.
        .onReceive(NotificationCenter.default.publisher(for: NSMenu.didBeginTrackingNotification)) { _ in
            guard let hovered else { return }
            clicked = hovered
            quietLabel()
        }
    }

    /// The tabs and the extras after them, as the pointer and the label
    /// count them.
    private var lines: [Tab] { tabs + extras }

    private func isHovered(_ line: Int) -> Bool {
        hovered == line && drag == nil
    }

    // MARK: The puck

    @ViewBuilder
    private var puck: some View {
        let lifted = drag?.moved == true
        ZStack(alignment: .top) {
            if let offset = puckOffset {
                Color.clear
                    .frame(width: Self.item, height: Self.item)
                    .glassEffect(.regular.interactive(), in: ControlShape.shape)
                    .shadow(color: .black.opacity(lifted ? 0.18 : 0), radius: 6, y: 2)
                    .scaleEffect(lifted ? Self.liftedScale : 1)
                    .offset(y: offset)
                    .transition(.scale(scale: 0.6).combined(with: .opacity))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        // In hand it keeps up with the pointer on a short, stiff spring;
        // let go, or sent to another tab, it travels on a softer one.
        .animation(RailMotion.of(lifted ? .interactiveSpring(response: 0.16, dampingFraction: 0.86) : .spring(response: 0.34, dampingFraction: 0.78)), value: puckOffset)
        .animation(RailMotion.of(.spring(response: 0.26, dampingFraction: 0.7)), value: lifted)
        .animation(RailMotion.of(.snappy(duration: 0.2)), value: puckOffset == nil)
    }

    /// Where the puck stands down the track: under the pointer while it is
    /// carried, and otherwise under the tab that is on — or the extra, past
    /// the tabs' column, the puck drawn out of it and under that icon.
    private var puckOffset: CGFloat? {
        if let drag, drag.moved { return drag.offset }
        return litIndex.map { CGFloat($0) * Self.step }
    }

    private var litIndex: Int? {
        if let drag, drag.moved { return drag.over }
        if let activeExtra, let index = extras.firstIndex(where: { $0.id == activeExtra }) {
            return tabs.count + index
        }
        guard let id = pending ?? selection else { return nil }
        return tabs.firstIndex { $0.id == id }
    }

    // MARK: The icons

    private func glyph(_ tab: Tab, isLit: Bool, isHovered: Bool) -> some View {
        RailTabGlyph(symbol: tab.symbol, isLit: isLit, isHovered: isHovered)
            .accessibilityElement()
            .accessibilityLabel(tab.title)
            .accessibilityAddTraits(isLit ? [.isButton, .isSelected] : .isButton)
            .accessibilityAction { press(tab.id) }
    }

    // MARK: Carrying it

    /// One gesture for a click and a drag both, told apart by how far the
    /// pointer went: a press anywhere on the tabs is under some tab, and
    /// the drag picks the puck up wherever the pointer is, even off the
    /// tab that is on — the puck comes to the pointer, as the system's does.
    /// It is read in the tabs' own column, so it is held to the tabs: the
    /// puck stops at the last of them rather than running on to an extra.
    private var slide: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                quietLabel()
                let moved = drag?.moved == true || abs(value.translation.height) > Self.dragThreshold
                let offset = clamped(value.location.y - Self.item / 2, over: tabs.count)
                let over = index(near: offset, over: tabs.count)
                if moved, let carried = drag, carried.moved, carried.over != over {
                    NSHapticFeedbackManager.defaultPerformer.perform(.alignment, performanceTime: .now)
                }
                drag = PuckDrag(offset: offset, over: over, moved: moved)
            }
            .onEnded { value in
                guard let ended = drag else { return }
                let over = ended.moved
                    ? ended.over
                    : index(near: clamped(value.location.y - Self.item / 2, over: tabs.count), over: tabs.count)
                let id = tabs[over].id
                if id != selection, !(ended.moved == false && litIndex == over) { pending = id }
                drag = nil
                if ended.moved {
                    drop(id)
                } else {
                    clicked = over
                    press(id)
                }
            }
    }

    /// An offset down a column of `count` icons, held to the first and last.
    private func clamped(_ offset: CGFloat, over count: Int) -> CGFloat {
        min(max(offset, 0), CGFloat(count - 1) * Self.step)
    }

    private func index(near offset: CGFloat, over count: Int) -> Int {
        min(max(Int((offset / Self.step).rounded()), 0), count - 1)
    }

    // MARK: The label

    /// The pointer over the track: the icon under it, and the label brought
    /// up for it once it has rested — or at once, if the label is already
    /// up and the pointer has only moved on to the next icon.
    private func hover(_ phase: HoverPhase) {
        switch phase {
        case .active(let location):
            let count = lines.count
            let over = index(near: clamped(location.y - Self.inset - Self.item / 2, over: count), over: count)
            hovered = over
            if clicked != nil, clicked != over { clicked = nil }
            guard !hoverLabelled, hoverWait == nil, clicked == nil else { return }
            hoverWait = Task {
                try? await Task.sleep(for: Self.hoverDelay)
                guard !Task.isCancelled else { return }
                hoverLabelled = true
                hoverWait = nil
            }
        case .ended:
            hovered = nil
            clicked = nil
            quietLabel()
        }
    }

    /// The hover's label put away, and its wait called off.
    private func quietLabel() {
        hoverWait?.cancel()
        hoverWait = nil
        hoverLabelled = false
    }

    /// What the label names and where it stands: the puck's tab, level with
    /// the puck, while it is carried; otherwise the hovered icon's, level
    /// with the icon, once the pointer has rested on it.
    private var labelled: (tab: Tab, offset: CGFloat)? {
        if let drag {
            return drag.moved ? (tabs[drag.over], drag.offset) : nil
        }
        guard hoverLabelled, clicked == nil, let hovered else { return nil }
        return (lines[hovered], CGFloat(hovered) * Self.step)
    }

    /// The surface and its chord, on glass beside the rail, following the
    /// pointer — on the puck's stiff spring while it is carried, and on a
    /// softer one stepping from icon to icon under a resting pointer.
    private var label: some View {
        let carried = drag?.moved == true
        return ZStack(alignment: .topLeading) {
            if let labelled {
                GlassChordLabel(title: labelled.tab.title, hint: labelled.tab.hint)
                    .animation(RailMotion.of(.snappy(duration: 0.18)), value: labelled.tab.id)
                    .offset(
                        x: Self.width + Self.labelGap,
                        y: Self.inset + labelled.offset + (Self.item - Self.labelHeight) / 2)
                    .animation(
                        RailMotion.of(
                            carried
                                ? .interactiveSpring(response: 0.16, dampingFraction: 0.86)
                                : .spring(response: 0.3, dampingFraction: 0.82)),
                        value: labelled.offset)
                    .transition(.scale(scale: 0.88, anchor: .leading).combined(with: .opacity))
            }
        }
        .animation(RailMotion.of(.snappy(duration: 0.2)), value: labelled == nil)
        .allowsHitTesting(false)
    }
}

extension GlassRailTabs where Extra == EmptyView {
    init(
        tabs: [Tab], selection: String?,
        press: @escaping (String) -> Void, drop: @escaping (String) -> Void
    ) {
        self.init(tabs: tabs, extras: [], selection: selection, press: press, drop: drop) { _, _, _ in EmptyView() }
    }
}

/// A name and the chord that reaches it, on glass: the label the rail
/// holds out beside its icons, and the toolbar's under its switch (see
/// `ToolbarGlassLabel`).
struct GlassChordLabel: View {
    let title: String
    let hint: String?

    var body: some View {
        HStack(spacing: 8) {
            Text(title)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.primary)
            if let hint {
                Text(hint)
                    .font(.system(size: 11))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 11)
        .frame(height: GlassRailTabsMetrics.labelHeight)
        .glassEffect(.regular, in: ControlShape.shape)
        .fixedSize()
    }
}

/// An icon on a rail track: secondary ink at rest, primary once it is on
/// or under the pointer, and a faint wash under the pointer where the puck
/// is not already standing — the same for a tab and for an extra, so the
/// two read as one run.
struct RailTabGlyph: View {
    let symbol: String
    let isLit: Bool
    let isHovered: Bool

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: 14))
            .foregroundStyle(isLit || isHovered ? .primary : .secondary)
            .frame(width: GlassRailTabsMetrics.item, height: GlassRailTabsMetrics.item)
            .background(Color.primary.opacity(isHovered && !isLit ? 0.06 : 0), in: ControlShape.shape)
            .contentShape(ControlShape.shape)
    }
}

/// The track's measures, outside the view since a generic type keeps no
/// stored statics.
enum GlassRailTabsMetrics {
    static let item: CGFloat = 28
    static let spacing: CGFloat = 4
    /// The track's air around the icons, which the puck stands in.
    static let inset: CGFloat = 2
    static let width = item + inset * 2
    /// How far the pointer has to move before a press becomes a drag, so a
    /// click that wanders a point is still a click.
    static let dragThreshold: CGFloat = 3
    static let liftedScale: CGFloat = 1.14
    static let labelHeight: CGFloat = 26
    static let labelGap: CGFloat = 8
    static let hoverDelay: Duration = .milliseconds(450)
}

/// The puck in hand: how far down the track it stands, the tab it is over,
/// and whether the press has gone far enough to be a drag at all.
private struct PuckDrag: Equatable {
    var offset: CGFloat
    var over: Int
    var moved: Bool
}

/// The rail's motion, or none at all when the user has asked for less.
enum RailMotion {
    static func of(_ animation: Animation) -> Animation? {
        NSWorkspace.shared.accessibilityDisplayShouldReduceMotion ? nil : animation
    }
}
