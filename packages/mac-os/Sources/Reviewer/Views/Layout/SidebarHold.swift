// The sidebar's move, as the views the detail embeds are told of it. The
// system slides the column in and out over a quarter second, and every
// frame of that the detail is a new width; a web view or a terminal given
// each width in turn lays itself out again for each one — WebKit waiting on
// its web process for the new size before it draws — and the slide
// stutters behind that work, the page dragging after the edge. So while the
// column moves, the views the detail embeds hold still at one width instead
// (see `HeldView`): the width they will stand at once the move is over when
// they are growing, so the sidebar sliding away uncovers a page already laid
// out for the room it leaves; their present width when they are shrinking,
// the sidebar sliding over them — with the one new layout at the end of the
// move rather than one for every frame of it.
import AppKit
import SwiftUI

/// A move of the sidebar, as the detail tells it: which way the column
/// went, and how much wider the islands stand once it has — less than
/// nothing when they shrink.
struct SidebarHold: Equatable {
    let sidebarShown: Bool
    let growth: CGFloat
}

extension EnvironmentValues {
    @Entry var sidebarHold: SidebarHold?
}

/// A view holding one of AppKit's or WebKit's — a terminal, a web view —
/// and keeping it at one width through a move of the sidebar: the width it
/// ends at when the move widens it, its present one when the move narrows
/// it, kept to the leading edge, where its lines start, and clipped at the
/// trailing one, until the move is over. The end is known from the hold's
/// growth and taken to be the first frame that reaches it, so the one
/// layout the move costs lands as the column stops; failing that, the first
/// pause in the resizing, or a long enough wait.
final class HeldView: NSView {
    private let content: NSView
    private var seenShown: Bool?
    private var settledWidth: CGFloat = 0
    private var hold: (width: CGFloat, end: CGFloat)?
    private var began: Date = .distantPast
    private var pause: Task<Void, Never>?

    private static let pause: Duration = .milliseconds(100)
    private static let longest: TimeInterval = 0.6

    init(holding content: NSView) {
        self.content = content
        super.init(frame: .zero)
        clipsToBounds = true
        addSubview(content)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("HeldView is made in code") }

    /// The sidebar as the detail last said it stood; a change is a move
    /// beginning.
    func follow(_ hold: SidebarHold?) {
        guard let hold else { return }
        defer { seenShown = hold.sidebarShown }
        guard let seenShown, seenShown != hold.sidebarShown, settledWidth > 0 else { return }
        begin(growth: hold.growth)
    }

    private func begin(growth: CGFloat) {
        let end = settledWidth + growth
        hold = (width: max(settledWidth, end), end: end)
        began = .now
        place()
        awaitPause()
    }

    override func resizeSubviews(withOldSize oldSize: NSSize) {
        if let hold {
            if abs(bounds.width - hold.end) < 1 || Date.now.timeIntervalSince(began) > Self.longest {
                end()
            } else {
                awaitPause()
            }
        } else {
            settledWidth = bounds.width
        }
        place()
    }

    private func awaitPause() {
        pause?.cancel()
        pause = Task { [weak self] in
            try? await Task.sleep(for: Self.pause)
            guard !Task.isCancelled else { return }
            self?.end()
        }
    }

    private func end() {
        pause?.cancel()
        pause = nil
        hold = nil
        settledWidth = bounds.width
        place()
    }

    private func place() {
        let width = hold?.width ?? bounds.width
        let frame = CGRect(x: 0, y: 0, width: width, height: bounds.height)
        if content.frame != frame { content.frame = frame }
    }
}

extension View {
    /// Keeps a page drawn natively out of the sidebar's move, as `HeldView`
    /// keeps the ones AppKit and WebKit draw (see `SidebarHeldPage`).
    func sidebarHeld() -> some View {
        modifier(SidebarHeldPage())
    }
}

/// A page SwiftUI draws in the detail — a conversation, its composer and
/// every reply in it — kept out of the sidebar's move. The move reaches
/// SwiftUI as one change of layout carried by an animation, and a view
/// left to it has its frame eased from the old width to the new one, frame
/// by frame; for a conversation that is its scroll view and the text view
/// of every reply on screen resized, and their text set again, on every
/// frame of the slide — more than a frame has time for, so the slide
/// stutters where the code page, a held web view, glides.
///
/// So the page takes its new width at once, without the animation, and is
/// laid out for it the one time; the island it stands on still eases to
/// its new edge, clipping the page to it as it goes. Only the page's own
/// geometry is kept out of the move, and only in the transaction that
/// moves the sidebar: anything the page animates of its own keeps its
/// animation.
private struct SidebarHeldPage: ViewModifier {
    @Environment(\.sidebarHold) private var sidebarHold

    func body(content: Content) -> some View {
        content.transaction(value: sidebarHold?.sidebarShown) { $0.animation = nil }
    }
}
