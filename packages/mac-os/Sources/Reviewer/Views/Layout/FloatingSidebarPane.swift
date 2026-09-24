// The sidebar as Tahoe drew it: a pane of glass floating inside the window,
// held off its leading, top and bottom edges by the islands' margin, and
// cut to the islands' own outline (see `IslandMetrics.shape`).
// macOS 27 runs the system's sidebar glass edge to edge with square
// corners and offers no switch back, so the column keeps the system's split
// and its glass — resizing, collapsing, the toggle, the toolbar's run, and
// the glass's own light and desktop tint — and lays the frame over the
// glass's outer margin, leaving the pane cut out of it. The surround stands
// over the column's content as well, so the tree scrolling up under the bar
// is trimmed at the pane's edge rather than showing in the margin. Only
// public drawing, laid over the column; nothing the system owns is reached
// into.
//
// No trailing margin: the detail column already stands off the sidebar's
// edge by the islands' gap (see `DetailColumn`), and that gap is the seam.
import SwiftUI

extension View {
    func floatingSidebarPane() -> some View {
        modifier(FloatingSidebarPane())
    }
}

private struct FloatingSidebarPane: ViewModifier {
    private static let paneInsets = EdgeInsets(
        top: IslandMetrics.margin, leading: IslandMetrics.margin,
        bottom: IslandMetrics.margin, trailing: 0)

    /// The column's content comes in by the pane's inset, so the rail and
    /// the tree keep the distance from the glass's edge they had from the
    /// window's. The top is left to the toolbar, whose height already
    /// clears the pane's top edge.
    private static let contentInsets = EdgeInsets(
        top: 0, leading: IslandMetrics.margin, bottom: IslandMetrics.margin, trailing: 0)

    func body(content: Content) -> some View {
        content
            .padding(Self.contentInsets)
            .overlay {
                surround
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
            }
    }

    /// The frame over everything in the column but the pane.
    private var surround: some View {
        Color(nsColor: IslandPalette.frame)
            .overlay {
                IslandMetrics.shape
                    .padding(Self.paneInsets)
                    .blendMode(.destinationOut)
            }
            .compositingGroup()
    }
}
