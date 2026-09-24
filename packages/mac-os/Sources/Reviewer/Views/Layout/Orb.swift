// The mark an agent wears while it is working: a 3×3 lattice of dots with a
// swell crossing it on the diagonal — the web app's `Orb` (the "S2" orb from
// aicss.dev/components/orbs), drawn natively so the tabs, the session rows
// and the work log wear the same mark here as they do in the browser.
//
// Every dot runs the one wave; what makes it a sweep rather than a pulse is
// the phase shift. The five diagonals are spread over the whole period rather
// than across it, so the corner-to-corner crest and the wrap back to the near
// corner are the same beat and the rhythm never hitches. The shifts run the
// clock forward, so an orb that has just appeared is already mid-sweep
// instead of building its first wave from rest.
//
// The geometry is the web's, tuned on a 28pt stage and scaled to `size`, so
// the dots keep their proportion whatever they are drawn at. One `Canvas`
// rather than nine animated circles: the wave is sampled from the timeline's
// clock and painted, which is a single layer redrawing rather than nine views
// re-laying out sixty times a second.
import SwiftUI

struct Orb: View {
    var size: CGFloat = 20
    /// Announces the wait. Omit where neighbouring copy already names it.
    var label: String?

    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { timeline in
            Canvas { context, _ in
                let seconds = timeline.date.timeIntervalSinceReferenceDate
                for cell in Self.cells {
                    let swell = reduceMotion ? nil : Self.swell(at: seconds, shift: cell.shift)
                    context.fill(Self.dot(cell, swell: swell, size: size), with: .style(.foreground.opacity(opacity(swell))))
                }
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(label == nil)
        .accessibilityLabel(label ?? "")
    }

    /// Held still, the resting opacity is too faint to read as anything at
    /// all, so a lattice that cannot move shows itself plainly instead.
    private func opacity(_ swell: Double?) -> Double {
        guard let swell else { return 0.5 }
        let rest = colorScheme == .dark ? 0.2 : 0.14
        return rest + (1 - rest) * swell
    }

    private struct Cell {
        let x: Int
        let y: Int
        /// How far into the wave this dot already is, as a fraction of a period.
        let shift: Double
    }

    private static let grid = 3
    private static let pitch: CGFloat = 6
    private static let diameter: CGFloat = 3
    private static let stage: CGFloat = 28
    private static let period: Double = 1.7
    /// The share of the period the swell occupies. A dot held at rest for the
    /// back half of the cycle reads as a step rather than a sweep, so the
    /// crest is wide enough that three diagonals are always in motion at once.
    private static let crest = 0.72
    private static let peakScale = 1.18
    private static let diagonals = 2 * (grid - 1) + 1

    /// The lattice occupies 15 of the 28pt stage, so it is inset by the 6.5
    /// that centres it — the web's `translate(6.5px, 6.5px)`.
    private static let inset = (stage - (CGFloat(grid - 1) * pitch + diameter)) / 2

    private static let cells: [Cell] = (0..<(grid * grid)).map { at in
        let x = at % grid
        let y = at / grid
        let diagonal = x + y
        return Cell(x: x, y: y, shift: Double(diagonals - 1 - diagonal) / Double(diagonals))
    }

    /// A raised cosine over the crest, flat at rest for what is left of the
    /// period: 0 at either end of the swell and 1 at its peak.
    private static func swell(at seconds: TimeInterval, shift: Double) -> Double {
        let phase = (seconds / period + shift).truncatingRemainder(dividingBy: 1)
        guard phase < crest else { return 0 }
        return (1 - cos(2 * .pi * phase / crest)) / 2
    }

    private static func dot(_ cell: Cell, swell: Double?, size: CGFloat) -> Path {
        let scale = size / stage
        let centre = CGPoint(
            x: (inset + CGFloat(cell.x) * pitch + diameter / 2) * scale,
            y: (inset + CGFloat(cell.y) * pitch + diameter / 2) * scale)
        let swollen = 1 + (peakScale - 1) * (swell ?? 0)
        let radius = diameter / 2 * scale * swollen
        return Path(ellipseIn: CGRect(x: centre.x - radius, y: centre.y - radius, width: radius * 2, height: radius * 2))
    }
}
