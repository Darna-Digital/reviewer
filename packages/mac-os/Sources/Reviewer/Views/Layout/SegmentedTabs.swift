// The system's segmented control in its macOS 27 tabs role — the one whose
// selection is a glass puck that can be grabbed and dragged from segment
// to segment, rather than the flat fill a value picker wears — held
// directly rather than through a `Picker`. It stands where the toolbar
// switches between Code and Sessions (see `TabStripItems`) and where the
// settings pick the window's appearance (see `SettingsView`).
//
// SwiftUI's picker rebuilds the control on every update, setting each
// segment's image again and deselecting every segment before selecting the
// right one; an update that lands while the puck is sliding knocks it off
// its course, and a press brings several — the press itself, then whatever
// the press changed coming back (the strip over the bridge, the window
// re-themed). This one is touched only where something has changed, so
// the slide the press started is left to finish. In a form the picker also
// drops each segment's icon and keeps only its word, where this one keeps
// both. On 26, which has no tabs role, it is the plain segmented control.
import AppKit
import SwiftUI

struct SegmentedTabs: NSViewRepresentable {
    struct Segment: Equatable {
        let id: String
        let title: String
        let symbol: String
        /// Whether the word stands beside the icon, or only names the
        /// segment to the tooltip and VoiceOver.
        let showsTitle: Bool
    }

    let segments: [Segment]
    let selection: String
    /// Whether the control stretches across the width it is offered, its
    /// segments sharing it evenly, rather than standing at its own size.
    let fillsWidth: Bool
    let select: (String) -> Void
    /// The themes' accents, read here — in the body of the view that makes
    /// the control — so a theme change redraws the lit segment.
    private let accent: AccentKey

    init(segments: [Segment], selection: String, fillsWidth: Bool = false, select: @escaping (String) -> Void) {
        self.segments = segments
        self.selection = selection
        self.fillsWidth = fillsWidth
        self.select = select
        accent = AccentKey(palette: ChromePalette.shared)
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> NSSegmentedControl {
        let control = NSSegmentedControl()
        control.trackingMode = .selectOne
        if #available(macOS 27, *) { control.role = .tabs }
        control.target = context.coordinator
        control.action = #selector(Coordinator.pressed(_:))
        return control
    }

    func updateNSView(_ control: NSSegmentedControl, context: Context) {
        let coordinator = context.coordinator
        coordinator.select = select
        if coordinator.segments != segments {
            coordinator.segments = segments
            // Icons alone share the width evenly, as the toolbar's own
            // segmented items do, and so does a control stretched across a
            // row; otherwise each segment with a word beside its icon is
            // cut to what it holds.
            let fitsContent = !fillsWidth && segments.contains(where: \.showsTitle)
            control.segmentDistribution = fitsContent ? .fit : .fillEqually
            control.segmentCount = segments.count
            for (index, segment) in segments.enumerated() {
                control.setImage(
                    NSImage(systemSymbolName: segment.symbol, accessibilityDescription: segment.title),
                    forSegment: index)
                control.setImageScaling(.scaleNone, forSegment: index)
                control.setLabel(segment.showsTitle ? segment.title : "", forSegment: index)
                control.setToolTip(segment.title, forSegment: index)
            }
        }
        // Lit in the theme's accent, as the pane's tabs and the diff's
        // add-a-comment button are — the one colour every lit control
        // shares. The colour is a dynamic one made afresh on every read, so
        // it is set when the themes' accents change rather than compared.
        if coordinator.accent != accent {
            coordinator.accent = accent
            control.selectedSegmentBezelColor = IslandPalette.accent
        }
        let selected = segments.firstIndex { $0.id == selection } ?? -1
        if control.selectedSegment != selected {
            control.selectedSegment = selected
        }
    }

    /// The control's own height — SwiftUI's control size, which it sets on
    /// the control, decides it — at the width offered, when it fills one.
    func sizeThatFits(_ proposal: ProposedViewSize, nsView control: NSSegmentedControl, context: Context) -> CGSize? {
        guard fillsWidth, let width = proposal.width else { return nil }
        return CGSize(width: width, height: control.fittingSize.height)
    }

    final class Coordinator: NSObject {
        var segments: [Segment] = []
        var accent: AccentKey?
        var select: (String) -> Void = { _ in }

        @objc func pressed(_ control: NSSegmentedControl) {
            guard segments.indices.contains(control.selectedSegment) else { return }
            select(segments[control.selectedSegment].id)
        }
    }
}

/// The light and dark themes' accents, as what the lit segment is redrawn
/// on.
struct AccentKey: Equatable {
    let light: String?
    let dark: String?

    @MainActor
    init(palette: ChromePalette) {
        light = palette.tokens(for: .light)?.accent
        dark = palette.tokens(for: .dark)?.accent
    }
}
