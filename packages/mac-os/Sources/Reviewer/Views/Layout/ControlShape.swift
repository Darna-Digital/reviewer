// The one corner every control in the app is cut to — a tab and the puck
// on it, a toggle, a field, a chip, a button's bezel or hover wash, the
// chat's box — so the window reads as one hand rather than capsules beside
// squares beside pills. It is the corner the system gives an accessory
// bar button's bezel (the sidebar's title wears it), with the continuous
// curve the system draws it in. The system's own controls are asked for
// the same: the tabs and the search fields as rounded rectangles (see
// `SegmentedTabs`, `PaneSearchField`) and every SwiftUI button with a
// border through `controlShape()` at the root of each window.
//
// What holds controls rather than being one — an island, a panel, a
// popover, a toast, a message — keeps its own larger radius. A track a
// control slides in (the rail's) is cut concentric round it: the control's
// corner plus the inset between them, so the gap reads even all the way
// round.
import SwiftUI

enum ControlShape {
    static let radius: CGFloat = 6

    static var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: radius, style: .continuous)
    }

    /// The track a control stands in, `inset` in from its edge.
    static func track(inset: CGFloat) -> RoundedRectangle {
        RoundedRectangle(cornerRadius: radius + inset, style: .continuous)
    }
}

extension View {
    /// Every SwiftUI button with a border under this view cut to the
    /// controls' corner.
    func controlShape() -> some View {
        buttonBorderShape(.roundedRectangle(radius: ControlShape.radius))
    }
}
