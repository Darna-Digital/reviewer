// The rail's glass label (see `GlassRailTabs`), held out under the
// toolbar's controls. The rail draws its label as an overlay beside
// itself; the toolbar cannot, its items being cut to the bar, so the
// label here is drawn in a borderless panel hung under the window as a
// child — the way `RowTooltip` hangs its own — that lets every click
// through to the page under it. The panel spans the window's width and
// stays up, empty, once it has been shown: the label comes and goes
// inside it, and springs from control to control across it on the rail's
// own curves, which a panel moved by its frame could not do.
//
// It keeps the rail's timing across the whole bar: it comes up once the
// pointer has rested on a control, then follows the pointer from control
// to control at once — across the air between them too — until the
// pointer leaves the controls. A press puts it away until the pointer
// moves on to another control, or another segment of the same one.
//
// The pointer is followed in AppKit rather than by SwiftUI's hover, so a
// control SwiftUI makes for itself — the split's sidebar toggle — can be
// given the label as well as one of the app's own (see `ToolbarWatcher`).
import AppKit
import SwiftUI

@MainActor
final class ToolbarGlassLabel {
    static let shared = ToolbarGlassLabel()

    struct Text: Equatable {
        let title: String
        let hint: String?
    }

    /// The room either side of the window, for a label wider than the
    /// control it names at the window's edge.
    private static let side: CGFloat = 160
    /// How far down from the window's top the panel reaches: the bar, and
    /// the label hung under it with the room its glass's shadow takes.
    private static let reach: CGFloat = 140
    /// How far under the control the label hangs.
    private static let gap: CGFloat = 6
    /// How long the pointer can be off every control — crossing the air
    /// between two — before the label is put away.
    private static let crossing: Duration = .milliseconds(120)

    private let panel: NSPanel
    private let state = ToolbarGlassLabelState()
    private weak var hovered: ToolbarHoverView?
    private var segment = 0
    /// Whether the label has come up for the pointer; once it has, it
    /// follows the pointer from control to control without waiting again.
    private var labelled = false
    private var wait: Task<Void, Never>?
    private var leaving: Task<Void, Never>?
    /// The control and segment just pressed, which the label keeps quiet
    /// over until the pointer moves to another.
    private var pressed: (view: ObjectIdentifier, segment: Int)?

    private init() {
        panel = NSPanel(
            contentRect: .zero, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: true)
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.ignoresMouseEvents = true
        panel.hidesOnDeactivate = true
        panel.isReleasedWhenClosed = false
        panel.animationBehavior = .none
        let host = NSHostingView(rootView: ToolbarGlassLabelView(state: state))
        host.sizingOptions = []
        panel.contentView = host

        NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown, .otherMouseDown]) { [weak self] event in
            MainActor.assumeIsolated { self?.press() }
            return event
        }
        NotificationCenter.default.addObserver(forName: NSMenu.didBeginTrackingNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.press() }
        }
    }

    fileprivate func pointer(over view: ToolbarHoverView, segment: Int) {
        leaving?.cancel()
        leaving = nil
        hovered = view
        self.segment = segment
        if let pressed, pressed.view == ObjectIdentifier(view), pressed.segment == segment { return }
        pressed = nil
        if labelled {
            present()
        } else if wait == nil {
            wait = Task {
                try? await Task.sleep(for: GlassRailTabsMetrics.hoverDelay)
                guard !Task.isCancelled else { return }
                wait = nil
                labelled = true
                present()
            }
        }
    }

    fileprivate func pointerLeft(_ view: ToolbarHoverView) {
        guard hovered === view else { return }
        hovered = nil
        leaving = Task {
            try? await Task.sleep(for: Self.crossing)
            guard !Task.isCancelled else { return }
            leaving = nil
            putAway()
        }
    }

    fileprivate func labelsChanged(of view: ToolbarHoverView) {
        guard hovered === view, labelled else { return }
        present()
    }

    fileprivate func forget(_ view: ToolbarHoverView) {
        guard hovered === view else { return }
        leaving?.cancel()
        leaving = nil
        hovered = nil
        putAway()
    }

    private func press() {
        guard let hovered else { return }
        pressed = (ObjectIdentifier(hovered), segment)
        quiet()
    }

    private func putAway() {
        pressed = nil
        quiet()
    }

    private func quiet() {
        wait?.cancel()
        wait = nil
        labelled = false
        state.shown = nil
    }

    private func present() {
        guard let view = hovered, let window = view.window, window.isVisible,
            view.labels.indices.contains(segment)
        else { return }
        let frame = NSRect(
            x: window.frame.minX - Self.side, y: window.frame.maxY - Self.reach,
            width: window.frame.width + Self.side * 2, height: Self.reach)
        if panel.frame != frame { panel.setFrame(frame, display: false) }
        panel.appearance = window.effectiveAppearance
        if panel.parent !== window {
            panel.parent?.removeChildWindow(panel)
            window.addChildWindow(panel, ordered: .above)
        }
        if !panel.isVisible { panel.orderFront(nil) }
        let control = view.screenRect(ofSegment: segment)
        let text = view.labels[segment]
        state.size = frame.size
        state.shown = ToolbarGlassLabelState.Shown(
            title: text.title, hint: text.hint,
            spot: CGPoint(x: control.midX - frame.minX, y: frame.maxY - control.minY + Self.gap))
    }
}

@MainActor @Observable
private final class ToolbarGlassLabelState {
    struct Shown: Equatable {
        let title: String
        let hint: String?
        /// The label's top centre, down from the panel's top-left corner.
        let spot: CGPoint
    }

    var shown: Shown?
    var size: CGSize = .zero
}

/// The label across the panel, placed by its centre so it can be sprung
/// from control to control, and scaled in from its own top edge — the
/// edge nearest the control it names.
private struct ToolbarGlassLabelView: View {
    let state: ToolbarGlassLabelState

    var body: some View {
        ZStack {
            if let shown = state.shown {
                GlassChordLabel(title: shown.title, hint: shown.hint)
                    .animation(RailMotion.of(.snappy(duration: 0.18)), value: shown.title)
                    .position(x: shown.spot.x, y: shown.spot.y + GlassRailTabsMetrics.labelHeight / 2)
                    .animation(RailMotion.of(.spring(response: 0.3, dampingFraction: 0.82)), value: shown.spot)
                    .transition(.scale(scale: 0.88, anchor: anchor(of: shown)).combined(with: .opacity))
            }
        }
        .frame(width: state.size.width, height: state.size.height)
        .animation(RailMotion.of(.snappy(duration: 0.2)), value: state.shown == nil)
    }

    /// The label's top centre, as a point of the whole panel the label is
    /// positioned across.
    private func anchor(of shown: ToolbarGlassLabelState.Shown) -> UnitPoint {
        guard state.size.width > 0, state.size.height > 0 else { return .top }
        return UnitPoint(x: shown.spot.x / state.size.width, y: shown.spot.y / state.size.height)
    }
}

/// Laid over a control, its size, to follow the pointer across it: one
/// label for the whole control, or one for each of the segments sharing
/// its width evenly. It takes no clicks of its own.
final class ToolbarHoverView: NSView {
    var labels: [ToolbarGlassLabel.Text] = [] {
        didSet {
            if labels != oldValue { ToolbarGlassLabel.shared.labelsChanged(of: self) }
        }
    }

    private var tracking: NSTrackingArea?

    override func hitTest(_ point: NSPoint) -> NSView? { nil }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let tracking { removeTrackingArea(tracking) }
        let area = NSTrackingArea(
            rect: .zero, options: [.mouseEnteredAndExited, .mouseMoved, .activeAlways, .inVisibleRect],
            owner: self)
        addTrackingArea(area)
        tracking = area
    }

    override func mouseEntered(with event: NSEvent) {
        silenceToolTips()
        follow(event)
    }
    override func mouseMoved(with event: NSEvent) { follow(event) }

    override func mouseExited(with event: NSEvent) {
        ToolbarGlassLabel.shared.pointerLeft(self)
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if window == nil { ToolbarGlassLabel.shared.forget(self) }
    }

    private func follow(_ event: NSEvent) {
        guard !labels.isEmpty, bounds.width > 0 else { return }
        let x = convert(event.locationInWindow, from: nil).x
        let segment = min(max(Int(x / segmentWidth), 0), labels.count - 1)
        ToolbarGlassLabel.shared.pointer(over: self, segment: segment)
    }

    /// The bar sets the system's tooltip on the item around a control —
    /// the one SwiftUI gives it, or the item's own label — and sets it
    /// again as it lays the item out, so it is taken off each time the
    /// pointer comes in, before its pause is up.
    private func silenceToolTips() {
        var view = superview
        while let current = view {
            if current.toolTip != nil { current.toolTip = nil }
            view = current.superview
        }
    }

    private var segmentWidth: CGFloat { bounds.width / CGFloat(max(labels.count, 1)) }

    fileprivate func screenRect(ofSegment segment: Int) -> NSRect {
        let local = NSRect(
            x: bounds.minX + segmentWidth * CGFloat(segment), y: bounds.minY,
            width: segmentWidth, height: bounds.height)
        guard let window else { return local }
        return window.convertToScreen(convert(local, to: nil))
    }
}

extension View {
    /// Names this control on the glass label under the bar, as `title`
    /// and the chord that reaches it.
    func toolbarGlassLabel(_ title: String, hint: String? = nil) -> some View {
        toolbarGlassLabel([ToolbarGlassLabel.Text(title: title, hint: hint)])
    }

    /// Names each of this control's segments — sharing its width evenly,
    /// in order — on the glass label under the bar.
    func toolbarGlassLabel(_ segments: [ToolbarGlassLabel.Text]) -> some View {
        background { ToolbarHoverAnchor(labels: segments) }
    }
}

private struct ToolbarHoverAnchor: NSViewRepresentable {
    let labels: [ToolbarGlassLabel.Text]

    func makeNSView(context: Context) -> ToolbarHoverView { ToolbarHoverView() }

    func updateNSView(_ view: ToolbarHoverView, context: Context) {
        view.labels = labels
    }

    static func dismantleNSView(_ view: ToolbarHoverView, coordinator: ()) {
        ToolbarGlassLabel.shared.forget(view)
    }
}
