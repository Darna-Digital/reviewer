// The wheel on a pull request's page, handed between the page and what
// stands in it. The page scrolls as one, the way a web page does: the
// overview first, then the files and the diff under it, stood at the
// page's own height — so once the overview has gone by they fill the page
// exactly, the tree held at the left and the diff scrolling beside it (see
// `PullRequestPage`). But the tree and the diff are scrollers of their
// own, an outline and a web view, and the window hands a wheel turned over
// one of them to it, never to the page they stand in: the overview would
// only ever go by with the pointer on it, and come back only from the top
// of a page it is no longer on.
//
// So the page decides who a gesture is for as it starts, where AppKit
// latches a gesture to a view, and keeps to it for the gesture's momentum
// too. While any of the overview is showing, a gesture over the files or
// the diff is the page's: down takes the overview away, up brings it back.
// Once it is gone, down is theirs, and up is too until they stand at their
// top — the outline's own clip says so, the web view's page says so over
// the bridge (`IslandHost.scrolledToTop`) — and from there up is the
// page's again. A gesture the page took down and ran out of overview with
// carries on into the diff, so one long swipe reads from the title into
// the code; one going up stops at the overview, since the diff tops out
// with a bounce of its own first. A gesture starting over the overview is
// left to the page's scroll view itself, as is a sideways one anywhere.
//
// The page is moved by its clip rather than by handing the events to its
// scroll view: AppKit's scroll view latches a gesture by its began phase,
// and the gestures taken here began over another view. The same clip says
// when the overview is all gone, for the bar to take its place: read off
// the clip's own bounds, which every move of the page goes through, rather
// than SwiftUI's scroll geometry, which did not hear of the moves made
// here.
import AppKit
import Observation
import SwiftUI
import WebKit

@MainActor
@Observable
final class ScrollHandoff {
    /// Whether the page is scrolled as far as it goes — the overview all
    /// gone, the files and the diff filling the page.
    private(set) var overviewGone = false

    /// Whether the web view's page stands at its top.
    @ObservationIgnored var pageAtTop: () -> Bool = { true }

    @ObservationIgnored fileprivate weak var page: NSScrollView?
    /// A view standing exactly over the files and the diff, for where a
    /// gesture lands to be read against.
    @ObservationIgnored fileprivate weak var workbench: NSView?

    @ObservationIgnored private var monitor: Any?
    @ObservationIgnored private var boundsObservers: [any NSObjectProtocol] = []
    @ObservationIgnored private var owner: Owner?

    private enum Owner {
        /// The page's scroll view, by its clip.
        case page
        /// Whoever the window hands the event to: the page's scroll view
        /// over the overview, the tree or the diff over the workbench.
        case window
    }

    /// The page back to its top, eased, as the bar's button asks.
    func scrollToTop() {
        guard let page else { return }
        ease(page, toOffsetFromTop: 0)
    }

    /// The overview scrolled away, eased, so the files and the diff fill
    /// the page — a comment followed from the assign bar is shown in the
    /// diff, and the diff must be on screen for it to be seen.
    func scrollToWorkbench() {
        guard let page else { return }
        ease(page, toOffsetFromTop: page.maximumOffsetFromTop)
    }

    private func ease(_ page: NSScrollView, toOffsetFromTop offset: CGFloat) {
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.3
            context.allowsImplicitAnimation = true
            page.contentView.animator().setBoundsOrigin(page.origin(atOffsetFromTop: offset))
        }
        page.reflectScrolledClipView(page.contentView)
    }

    /// The page at its top without a move — another pull request opened
    /// on it, which is a page of its own.
    func resetToTop() {
        page?.setOffsetFromTop(0)
    }

    fileprivate func attach() {
        observeBounds()
        guard monitor == nil else { return }
        monitor = NSEvent.addLocalMonitorForEvents(matching: .scrollWheel) { [weak self] event in
            let taken = MainActor.assumeIsolated { self?.takes(event) ?? false }
            return taken ? nil : event
        }
    }

    fileprivate func detach() {
        if let monitor { NSEvent.removeMonitor(monitor) }
        boundsObservers.forEach(NotificationCenter.default.removeObserver)
        monitor = nil
        boundsObservers = []
        owner = nil
    }

    /// The clip moving, and the document growing or shrinking under a page
    /// that stays put — a description still loading, a window made taller.
    private func observeBounds() {
        guard boundsObservers.isEmpty, let clip = page?.contentView else { return }
        clip.postsBoundsChangedNotifications = true
        let watched: [(NSView?, Notification.Name)] = [
            (clip, NSView.boundsDidChangeNotification),
            (clip, NSView.frameDidChangeNotification),
            (page?.documentView, NSView.frameDidChangeNotification),
        ]
        boundsObservers = watched.compactMap { view, name in
            guard let view else { return nil }
            return NotificationCenter.default.addObserver(forName: name, object: view, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.measure() }
            }
        }
        measure()
    }

    private func measure() {
        guard let page else { return }
        let gone = page.maximumOffsetFromTop > 0 && page.offsetFromTop >= page.maximumOffsetFromTop - 0.5
        if gone != overviewGone {
            withAnimation(.easeOut(duration: 0.18)) { overviewGone = gone }
        }
    }

    /// Whether the page takes this event itself, moving by it, rather than
    /// letting the window hand it on.
    private func takes(_ event: NSEvent) -> Bool {
        guard let page, let workbench, page.window != nil, event.window === page.window else { return false }
        if startsGesture(event) { owner = nil }
        if owner == nil {
            // A gesture's first events can carry no motion yet; it is only
            // given to someone once it says which way it is going.
            guard event.scrollingDeltaX != 0 || event.scrollingDeltaY != 0 else { return false }
            owner = decideOwner(of: event, page: page, workbench: workbench)
        }
        guard owner == .page else { return false }
        let leftover = page.scroll(by: event)
        // Down past the overview's end: the rest of the gesture is the
        // diff's. Up is not carried over — see the note at the top.
        if leftover < 0 {
            owner = .window
            return false
        }
        return true
    }

    /// A gesture starts with a finger landing, or with each turn of a
    /// wheel that has no phases — every one of those is a gesture alone.
    private func startsGesture(_ event: NSEvent) -> Bool {
        if event.phase.contains(.began) || event.phase.contains(.mayBegin) { return true }
        return event.phase.isEmpty && event.momentumPhase.isEmpty
    }

    private func decideOwner(of event: NSEvent, page: NSScrollView, workbench: NSView) -> Owner {
        guard abs(event.scrollingDeltaY) > abs(event.scrollingDeltaX) else { return .window }
        let point = workbench.convert(event.locationInWindow, from: nil)
        guard workbench.bounds.contains(point) else { return .window }
        let overviewShowing = page.offsetFromTop < page.maximumOffsetFromTop - 0.5
        if overviewShowing { return .page }
        let goingUp = event.scrollingDeltaY > 0
        return goingUp && innerAtTop(under: event, page: page) ? .page : .window
    }

    /// Whether the scroller under the pointer — the diff, the tree — has
    /// nowhere further up to go.
    private func innerAtTop(under event: NSEvent, page: NSScrollView) -> Bool {
        guard let content = page.window?.contentView, let frame = content.superview,
            let hit = content.hitTest(frame.convert(event.locationInWindow, from: nil))
        else { return true }
        if hit.ancestor(ofType: WKWebView.self) != nil { return pageAtTop() }
        if let inner = hit.enclosingScrollView, inner !== page {
            return inner.offsetFromTop <= 0.5
        }
        return true
    }
}

extension NSScrollView {
    /// How far the document is scrolled from its top, whichever way up it
    /// is drawn, and less the inset the clip leaves above it.
    fileprivate var offsetFromTop: CGFloat {
        guard let document = documentView else { return 0 }
        let clip = contentView.bounds
        if document.isFlipped { return clip.minY + contentInsets.top }
        return document.frame.height - clip.maxY
    }

    fileprivate var maximumOffsetFromTop: CGFloat {
        guard let document = documentView else { return 0 }
        return max(0, document.frame.height - contentView.bounds.height + contentInsets.top + contentInsets.bottom)
    }

    fileprivate func setOffsetFromTop(_ offset: CGFloat) {
        contentView.scroll(to: origin(atOffsetFromTop: offset))
        reflectScrolledClipView(contentView)
    }

    /// The clip's origin with the page `offset` down from its top, kept to
    /// the page.
    fileprivate func origin(atOffsetFromTop offset: CGFloat) -> NSPoint {
        var origin = contentView.bounds.origin
        guard let document = documentView else { return origin }
        let clamped = min(max(offset, 0), maximumOffsetFromTop)
        origin.y = document.isFlipped ? clamped - contentInsets.top : document.frame.height - contentView.bounds.height - clamped
        return origin
    }

    /// Moves the document by one wheel event and answers with what of the
    /// event's motion was left over at an end — signed as the event's
    /// delta is, so positive is upward. A wheel without precise deltas
    /// counts in lines.
    fileprivate func scroll(by event: NSEvent) -> CGFloat {
        let delta = event.hasPreciseScrollingDeltas ? event.scrollingDeltaY : event.scrollingDeltaY * verticalLineScroll
        let wanted = offsetFromTop - delta
        let reachable = min(max(wanted, 0), maximumOffsetFromTop)
        setOffsetFromTop(reachable)
        return reachable - wanted
    }
}

extension NSView {
    fileprivate func ancestor<T: NSView>(ofType type: T.Type) -> T? {
        var view: NSView? = self
        while let current = view {
            if let match = current as? T { return match }
            view = current.superview
        }
        return nil
    }
}

/// Stood behind the files and the diff, sized to them: it finds the page's
/// scroll view around it, and keeps the handoff listening while it is in a
/// window.
struct ScrollHandoffAnchor: NSViewRepresentable {
    let handoff: ScrollHandoff

    func makeNSView(context: Context) -> AnchorView {
        AnchorView(handoff: handoff)
    }

    func updateNSView(_ nsView: AnchorView, context: Context) {}

    final class AnchorView: NSView {
        private let handoff: ScrollHandoff

        init(handoff: ScrollHandoff) {
            self.handoff = handoff
            super.init(frame: .zero)
        }

        @available(*, unavailable)
        required init?(coder: NSCoder) { fatalError("AnchorView is made in code") }

        override func hitTest(_ point: NSPoint) -> NSView? { nil }

        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            if window == nil {
                handoff.detach()
            } else {
                handoff.page = enclosingScrollView
                handoff.workbench = self
                handoff.attach()
            }
        }
    }
}
