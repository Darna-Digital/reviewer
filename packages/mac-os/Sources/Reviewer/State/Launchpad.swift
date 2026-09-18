// The launchpad's state: whether it is out, how tall it stands — which is
// exactly how far the page under it is pushed — and the pull that is
// moving it, when one is.
//
// It slides out from under the toolbar and pushes the window's content —
// the sidebar and the page alike — down rather than covering it, as the web
// app's does (`tab-overview`): the app reads as having made room for itself
// instead of having been replaced. Open, it
// stands at the height its rows come to, held between one row and what the
// window can spare; a pull — the seam on its edge, or two fingers drawn
// down the toolbar — draws it out under the pointer, frame for frame, and
// lets it settle where it was let go of. Let go of shorter than the
// dismiss height, it goes back in: pulling it up to nothing is how you say
// you are done with it.
//
// Every move that is not a pull is animated here, in the model, on the one
// curve the web app's panel travels on, so the panel and the page it pushes
// can never disagree about where the seam between them is.
import AppKit
import Observation
import SwiftUI

@MainActor
@Observable
final class Launchpad {
    /// The web app's `PANEL_EASE`: a decelerating curve that covers nearly
    /// all of the distance in its first half and settles rather than stops.
    static let slide = Animation.timingCurve(0.22, 1, 0.36, 1, duration: 0.26)
    /// The shortest the panel is worth being: a row of cards.
    static let minHeight: CGFloat = 220
    /// Let go of shorter than this, the panel closes instead of sitting at
    /// its floor — well clear of the floor, so the last stretch of an
    /// ordinary resize is not spent worrying about dismissing it.
    static let dismissHeight: CGFloat = 140
    /// How much of the pushed page stays on screen however tall the panel.
    static let pageFloor: CGFloat = 192
    /// A press that travels less than this is a click on the seam.
    static let clickTravel: CGFloat = 2

    private(set) var isShown = false
    private(set) var height: CGFloat = Launchpad.minHeight
    /// A pull is moving the panel: it follows the pointer, unanimated.
    private(set) var isPulling = false
    /// The box under the toolbar the panel slides into — the whole window's
    /// content, sidebar and detail across, as `LaunchpadLayer` reports it —
    /// what the fitted height and the ceiling are worked out against.
    var canvas: CGSize = .zero {
        didSet { if isShown, height > maxHeight { height = maxHeight } }
    }
    /// How many cards the grid holds, as the strip last reported. A card
    /// coming or going while the panel is up may change the rows, and the
    /// panel follows them; a strip reported unchanged leaves a pulled
    /// height where it was put.
    var cards = 0 {
        didSet { if oldValue != cards { refit() } }
    }
    /// Called as the panel comes out, however it is asked for: the moment
    /// the active tab's picture has to be taken.
    @ObservationIgnored var onShow: (@MainActor () -> Void)?

    @ObservationIgnored private var pullBase: CGFloat = 0
    @ObservationIgnored private var pullCeiling: CGFloat = 0
    /// The pull shut the panel it started on; the pointer is still down,
    /// but the rest of the gesture is no longer about a panel on its way out.
    @ObservationIgnored private var pullSpent = false

    var grid: LaunchpadGrid {
        LaunchpadGrid(width: canvas.width, count: cards)
    }

    var maxHeight: CGFloat {
        max(Self.minHeight, canvas.height - Self.pageFloor)
    }

    /// Whatever the rows come to, between one row and what the window can
    /// spare — worked out afresh each time rather than kept, since a stored
    /// height is a height from another moment.
    var fittedHeight: CGFloat {
        min(max(grid.height, Self.minHeight), maxHeight)
    }

    func open() {
        guard !isShown else { return }
        isPulling = false
        animated { show(at: fittedHeight) }
    }

    func close() {
        guard isShown else { return }
        isPulling = false
        animated { isShown = false }
    }

    func toggle() {
        isShown ? close() : open()
    }

    /// The panel follows its rows — unless a pull is deciding the height
    /// already.
    private func refit() {
        guard isShown, !isPulling else { return }
        animated { height = fittedHeight }
    }

    /// The pointer went down on a seam, or two fingers on the toolbar. What
    /// follows is measured from here: a shut panel is pulled out from
    /// nothing, an open one from where it stands. A pull may take room away
    /// and give back only up to the height the rows come to: above that is
    /// empty panel.
    func beginPull() {
        pullBase = isShown ? height : 0
        pullCeiling = max(fittedHeight, pullBase)
        pullSpent = false
    }

    /// The pointer moved `travel` points down since the pull began. The
    /// panel follows it from the first point, so nothing pops in — and back
    /// in again, so the gesture is reversible at the point it began. An open
    /// panel pulled up past the dismiss height goes altogether, animated,
    /// and the rest of the gesture is no longer about it.
    func pull(travel: CGFloat) {
        guard !pullSpent else { return }
        let pulled = min(pullCeiling, pullBase + travel)
        if pullBase > 0, pulled <= Self.dismissHeight {
            pullSpent = true
            close()
            return
        }
        guard isPulling || isShown || pulled >= 1 else { return }
        isPulling = true
        if pulled < 1 {
            isShown = false
            return
        }
        if !isShown { show(at: pulled) }
        height = pulled
    }

    /// The pointer came up. Let go of short of the dismiss height the panel
    /// goes back in; let go of anywhere under its floor it settles onto it.
    func endPull() {
        guard isPulling else { return }
        isPulling = false
        guard isShown else { return }
        if height <= Self.dismissHeight {
            animated { isShown = false }
        } else if height < Self.minHeight {
            animated { height = Self.minHeight }
        }
    }

    /// A press on a seam that did not travel: the seam pulled out of a shut
    /// panel opens it onto its rows, and pressed under an open one puts it
    /// back — one edge, pressed the same way, whichever side of it the panel
    /// is on.
    func click() {
        isPulling = false
        toggle()
    }

    private func show(at target: CGFloat) {
        height = target
        isShown = true
        onShow?()
    }

    private func animated(_ change: () -> Void) {
        let reduceMotion = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
        withAnimation(reduceMotion ? nil : Self.slide, change)
    }
}

/// The launchpad's grid, worked out rather than measured: as many columns
/// of cards as the panel's width takes at the card's narrowest, each column
/// widened to fill — up to the card's widest, past which the grid stands
/// centred — and the rows that many columns make of the cards. The panel
/// is sized from it before it moves, so it starts its slide already the
/// right height rather than growing into it on the way down; the view lays
/// the cards out by the same numbers, so the two cannot disagree.
struct LaunchpadGrid {
    static let inset: CGFloat = 16
    static let gap: CGFloat = 16
    static let cardMinWidth: CGFloat = 260
    static let cardMaxWidth: CGFloat = 400
    static let pictureAspect: CGFloat = 16 / 10
    static let captionSpacing: CGFloat = 8
    static let captionHeight: CGFloat = 18
    /// The last row ends above the collapse tab's room rather than behind it.
    static let foot: CGFloat = 40

    let width: CGFloat
    let count: Int

    var columns: Int {
        max(1, Int((width - 2 * Self.inset + Self.gap) / (Self.cardMinWidth + Self.gap)))
    }

    var cardWidth: CGFloat {
        let room = width - 2 * Self.inset - CGFloat(columns - 1) * Self.gap
        return max(1, min(Self.cardMaxWidth, room / CGFloat(columns)))
    }

    var cardHeight: CGFloat {
        cardWidth / Self.pictureAspect + Self.captionSpacing + Self.captionHeight
    }

    var rows: Int {
        count == 0 ? 0 : (count + columns - 1) / columns
    }

    var height: CGFloat {
        Self.inset + CGFloat(rows) * cardHeight + CGFloat(max(0, rows - 1)) * Self.gap + Self.foot
    }

    var items: [GridItem] {
        Array(repeating: GridItem(.fixed(cardWidth), spacing: Self.gap), count: columns)
    }
}
