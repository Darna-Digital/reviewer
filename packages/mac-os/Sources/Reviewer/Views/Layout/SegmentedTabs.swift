// The system's segmented control in its macOS 27 tabs role — the one whose
// selection is a glass puck that can be grabbed and dragged from segment
// to segment, rather than the flat fill a value picker wears — held
// directly rather than through a `Picker`. It stands where the toolbar
// switches between Code and Sessions (see `TabStripItems`), where the
// settings pick the window's appearance (see `SettingsView`) and across the
// bottom pane's bar (see `BottomPane`).
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
    /// Whether each segment names itself in the system's tooltip, or leaves
    /// naming it to a label of the holder's own (see `ToolbarGlassLabel`).
    let showsToolTips: Bool
    let select: (String) -> Void
    /// The themes' accents, read here — in the body of the view that makes
    /// the control — so a theme change redraws the lit segment.
    private let accent: AccentKey

    init(
        segments: [Segment], selection: String, fillsWidth: Bool = false, showsToolTips: Bool = true,
        select: @escaping (String) -> Void
    ) {
        self.segments = segments
        self.selection = selection
        self.fillsWidth = fillsWidth
        self.showsToolTips = showsToolTips
        self.select = select
        accent = AccentKey(palette: ChromePalette.shared)
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> NSSegmentedControl {
        let control = NSSegmentedControl()
        control.trackingMode = .selectOne
        // The tabs role is in the macOS 27 SDK, which comes with the Swift
        // 6.4 toolchain; a build on Xcode 26 has neither and gets the plain
        // control. Releases are built on Xcode 27 (see `release.yml`).
        #if compiler(>=6.4)
        if #available(macOS 27, *) { control.role = .tabs }
        #endif
        control.target = context.coordinator
        control.action = #selector(Coordinator.pressed(_:))
        return control
    }

    func updateNSView(_ control: NSSegmentedControl, context: Context) {
        let coordinator = context.coordinator
        coordinator.select = select
        if coordinator.segments != segments || coordinator.controlSize != control.controlSize {
            coordinator.segments = segments
            coordinator.controlSize = control.controlSize
            // Icons alone share the width evenly, as the toolbar's own
            // segmented items do, and so does a control stretched across a
            // row; otherwise each segment with a word beside its icon is
            // cut to what it holds.
            let fitsContent = !fillsWidth && segments.contains(where: \.showsTitle)
            control.segmentDistribution = fitsContent ? .fit : .fillEqually
            control.segmentCount = segments.count
            let font = NSFont.systemFont(ofSize: NSFont.systemFontSize(for: control.controlSize))
            for (index, segment) in segments.enumerated() {
                control.setImage(Self.image(of: segment, font: font), forSegment: index)
                control.setImageScaling(.scaleNone, forSegment: index)
                control.setLabel("", forSegment: index)
                control.setToolTip(showsToolTips ? segment.title : nil, forSegment: index)
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

    /// A segment's icon, and its word beside it when it shows one, as one
    /// image. The word is drawn into the image rather than set as the
    /// segment's label: on macOS 27 the control sets the selected segment's
    /// label in bold, which an image has no weight for. Drawn as a template,
    /// so it takes the control's ink like a label would, with the air a
    /// labelled segment has built into its sides — a segment holding only
    /// an image is given less of its own.
    private static func image(of segment: Segment, font: NSFont) -> NSImage? {
        guard let symbol = NSImage(systemSymbolName: segment.symbol, accessibilityDescription: segment.title) else {
            return nil
        }
        guard segment.showsTitle else { return symbol }
        let icon = symbol.withSymbolConfiguration(.init(pointSize: font.pointSize, weight: .regular)) ?? symbol
        let title = NSAttributedString(string: segment.title, attributes: [.font: font])
        let titleSize = title.size()
        let height = ceil(max(icon.size.height, titleSize.height))
        let width = ceil(titleSideInset * 2 + icon.size.width + titleSpacing + titleSize.width)
        let image = NSImage(size: NSSize(width: width, height: height), flipped: false) { _ in
            icon.draw(in: NSRect(
                x: titleSideInset, y: ((height - icon.size.height) / 2).rounded(),
                width: icon.size.width, height: icon.size.height))
            title.draw(at: NSPoint(
                x: titleSideInset + icon.size.width + titleSpacing, y: ((height - titleSize.height) / 2).rounded()))
            return true
        }
        image.isTemplate = true
        image.accessibilityDescription = segment.title
        return image
    }

    private static let titleSpacing: CGFloat = 4
    private static let titleSideInset: CGFloat = 8

    /// The control's own size — SwiftUI's control size, which it sets on
    /// the control, decides its height — or its height at the width
    /// offered, when it fills one. Left to SwiftUI, a representable takes
    /// whatever width it is offered whether it fills it or not, and the
    /// control spreads its segments out across it.
    func sizeThatFits(_ proposal: ProposedViewSize, nsView control: NSSegmentedControl, context: Context) -> CGSize? {
        let fitting = control.fittingSize
        guard fillsWidth, let width = proposal.width else { return fitting }
        return CGSize(width: width, height: fitting.height)
    }

    @MainActor
    final class Coordinator: NSObject {
        var segments: [Segment] = []
        var controlSize: NSControl.ControlSize?
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
