// The toolbar's controls in the web app's window-bar shape: a 28pt chip with
// no fill of its own, tinted while the pointer is over it and held tinted
// while it is on — the SPA's ghost button — in place of the glass the
// system draws around every toolbar item. The items stay toolbar items, so
// the bar lays them out, tips them and lets the window be dragged between
// them as it does everything else; only the glass is put away (see
// `sharedBackgroundVisibility` where the items are declared). The rail's
// buttons wear the same tints, so the two bars read as one instrument.
import SwiftUI

enum BarChipMetrics {
    static let height: CGFloat = 28
    static let radius: CGFloat = 6
    static let onTint: Double = 0.12
    static let hoverTint: Double = 0.06
    /// How far below the bar's middle a chip rides. The traffic lights are
    /// circles among squares and read low against them set on one line, so
    /// the squares give way by a point, as the web bar's do.
    static let rideBelow: CGFloat = 1

    static var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: radius)
    }
}

/// The chip as a button style: the label decides its own width and the
/// style gives it the bar's height, its tints and its ink — secondary at
/// rest, primary once it is on or under the pointer — and sets it in the
/// middle of whatever height the toolbar hands the item, a point low.
struct BarChipStyle: ButtonStyle {
    var isOn = false

    func makeBody(configuration: Configuration) -> some View {
        BarChip(isOn: isOn, isPressed: configuration.isPressed) { configuration.label }
    }
}

private struct BarChip<Label: View>: View {
    let isOn: Bool
    let isPressed: Bool
    @ViewBuilder let label: Label
    @State private var isHovering = false

    var body: some View {
        label
            .foregroundStyle(isOn || isHovering ? .primary : .secondary)
            .frame(height: BarChipMetrics.height)
            .background(fill, in: BarChipMetrics.shape)
            .contentShape(BarChipMetrics.shape)
            .onHover { isHovering = $0 }
            .padding(.top, 2 * BarChipMetrics.rideBelow)
            .frame(maxHeight: .infinity)
    }

    private var fill: Color {
        if isOn || isPressed { return .primary.opacity(BarChipMetrics.onTint) }
        if isHovering { return .primary.opacity(BarChipMetrics.hoverTint) }
        return .clear
    }
}

/// An icon-only chip's label: every glyph sits in the same square, so the
/// chips come out the same size whatever the symbol's own width.
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
