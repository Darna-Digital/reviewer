// The orb (see `Orb`) for AppKit rows, drawn by Core Animation: the same
// lattice and the same sweep, handed to the render server as nine looping
// animations rather than sampled on the main thread. A SwiftUI `Orb` costs a
// `TimelineView` tick and a canvas repaint every frame for every orb, which
// a list with a dozen agents at work spends on the main thread sixty times
// a second — the same thread that has to keep up with the scroll. These
// cost nothing once they are added.
//
// Each dot's loop is phased off the wall clock, as `Orb` samples it, so the
// row's orb beats with the tab's for the same session, and an orb that
// comes back on screen in a reused row picks up mid-sweep rather than
// starting its wave over.
import AppKit

final class OrbView: NSView {
    private let size: CGFloat
    private let dots: [CALayer]

    /// Points along one period of the wave, the keyframes the loop runs
    /// through: enough that the swell's curve reads as a curve at the
    /// lattice's few points of travel.
    private static let samples = 48

    init(size: CGFloat, label: String? = nil) {
        self.size = size
        dots = Orb.cells.map { _ in CALayer() }
        super.init(frame: NSRect(x: 0, y: 0, width: size, height: size))
        wantsLayer = true
        for (dot, cell) in zip(dots, Orb.cells) {
            // `Orb` lays the lattice out top-down; a layer's origin is at
            // the bottom, so the rows are turned over to keep the sweep
            // running the same way.
            let rect = Orb.dot(cell, swell: nil, size: size).boundingRect
            dot.frame = CGRect(x: rect.minX, y: size - rect.maxY, width: rect.width, height: rect.height)
            dot.cornerRadius = rect.width / 2
            layer?.addSublayer(dot)
        }
        setAccessibilityElement(label != nil)
        setAccessibilityLabel(label)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override var intrinsicContentSize: NSSize { NSSize(width: size, height: size) }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        restart()
    }

    override func viewDidChangeEffectiveAppearance() {
        super.viewDidChangeEffectiveAppearance()
        restart()
    }

    override var isHidden: Bool {
        didSet { if isHidden != oldValue { restart() } }
    }

    /// Paints the dots in the appearance's ink and sets them sweeping —
    /// again, whenever the view lands in a window or the appearance turns,
    /// since the opacities the loop runs through are the scheme's.
    private func restart() {
        let dark = effectiveAppearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
        var ink = NSColor.labelColor.cgColor
        effectiveAppearance.performAsCurrentDrawingAppearance { ink = NSColor.labelColor.cgColor }
        let still = window == nil || isHidden || NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        for (dot, cell) in zip(dots, Orb.cells) {
            dot.removeAllAnimations()
            dot.backgroundColor = ink
            dot.opacity = Float(still ? Orb.stillOpacity : Orb.opacity(0, dark: dark))
            if !still { dot.add(Self.sweep(shift: cell.shift, dark: dark), forKey: "sweep") }
        }
        CATransaction.commit()
    }

    private static func sweep(shift: Double, dark: Bool) -> CAAnimation {
        let swells = (0...samples).map { step in
            Orb.swell(at: Double(step) / Double(samples) * Orb.period, shift: shift)
        }
        let opacity = CAKeyframeAnimation(keyPath: "opacity")
        opacity.values = swells.map { Orb.opacity($0, dark: dark) }
        let scale = CAKeyframeAnimation(keyPath: "transform.scale")
        scale.values = swells.map { 1 + (Orb.peakScale - 1) * $0 }
        let loop = CAAnimationGroup()
        loop.animations = [opacity, scale]
        loop.duration = Orb.period
        loop.repeatCount = .infinity
        // The keyframes are one period from the clock's zero; starting the
        // loop this far into them puts it where `Orb` would be right now.
        let clock = Date.timeIntervalSinceReferenceDate
        loop.timeOffset = clock.truncatingRemainder(dividingBy: Orb.period)
        return loop
    }
}
