// The toolbar's controls in the web app's window-bar shape: a chip with no
// fill of its own, tinted while the pointer is over it and held tinted
// while it is on — the SPA's ghost button — in place of the glass the
// system draws around every toolbar item. The items stay toolbar items, so
// the bar lays them out, tips them and lets the window be dragged between
// them as it does everything else; only the glass is put away (see
// `sharedBackgroundVisibility` where the items are declared). The chip is
// cut to the glass it stands in for — the height and the capsule of the
// system's own toolbar buttons — so a chip beside a glass toggle (the tabs'
// pinned pair, see `TabStripItems`) reads as its equal on one line, not a
// smaller square next to a pill. The rail's buttons wear the same tints,
// so the two bars read as one instrument.
import SwiftUI

enum BarChipMetrics {
    /// The system's toolbar glass button, which the chip stands beside.
    static let height: CGFloat = 36
    static let onTint: Double = 0.12
    static let hoverTint: Double = 0.06

    static var shape: Capsule {
        Capsule()
    }
}

/// The chip as a button style: the label decides its own width and the
/// style gives it the glass's height, its tints and its ink — secondary at
/// rest, primary once it is on or under the pointer — and sets it in the
/// middle of whatever height the toolbar hands the item, the line the
/// system's own buttons keep. A chip whose label is smaller than a glyph
/// — the project chip's avatar and name — takes a height of its own, so
/// it wears the same air around its content as the glass does around a
/// glyph rather than a taller band of it.
struct BarChipStyle: ButtonStyle {
    var isOn = false
    var height = BarChipMetrics.height

    func makeBody(configuration: Configuration) -> some View {
        BarChip(isOn: isOn, isPressed: configuration.isPressed, height: height) { configuration.label }
    }
}

private struct BarChip<Label: View>: View {
    let isOn: Bool
    let isPressed: Bool
    let height: CGFloat
    @ViewBuilder let label: Label
    @State private var isHovering = false

    var body: some View {
        label
            .foregroundStyle(isOn || isHovering ? .primary : .secondary)
            .frame(height: height)
            .background(fill, in: BarChipMetrics.shape)
            .contentShape(BarChipMetrics.shape)
            .onHover { isHovering = $0 }
            .frame(maxHeight: .infinity)
    }

    private var fill: Color {
        if isOn || isPressed { return .primary.opacity(BarChipMetrics.onTint) }
        if isHovering { return .primary.opacity(BarChipMetrics.hoverTint) }
        return .clear
    }
}

/// An icon-only chip's label: every glyph sits in the same square — a
/// circle, once the capsule is cut around it — so the chips come out the
/// same size whatever the symbol's own width.
private struct BarGlyph: ViewModifier {
    func body(content: Content) -> some View {
        content
            .labelStyle(.iconOnly)
            .font(.system(size: 14, weight: .medium))
            .frame(width: BarChipMetrics.height, height: BarChipMetrics.height)
    }
}

extension View {
    func barGlyph() -> some View { modifier(BarGlyph()) }
}
