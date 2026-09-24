// The page island and the bottom pane are islands: rounded panels of the
// web app's sheet colour, ringed by a hairline, standing a few points
// apart on its frame colour (see `IslandPalette`), the way the JetBrains
// islands layout sets its tool windows beside the editor. The ring is the
// hairline rather than the separator: on the app's own palette the two are
// the one system colour, but a theme draws its separator at the weight of a
// control's edge, and a panel ringed in that stood out against the rules
// inside it and the web islands beside it, whose own edges are hairlines. The sidebar is
// not one: it is the system's glass, cut to a floating pane on the same
// frame (see `FloatingSidebarPane`), and its corners are the islands'. The toolbar and
// the rail are not islands either: they are the window itself, bare, which
// is what the panels stand on.
import SwiftUI

enum IslandMetrics {
    /// A fixed corner for what is drawn inside a panel rather than as one —
    /// a drop zone over the composer. Panels themselves take `shape`.
    static let radius: CGFloat = 16
    /// The panels' own corner: the window's, which macOS 27 turns at 16pt,
    /// less the margin a panel stands off it — the corner that runs parallel
    /// to the window's where a panel sits in one. Fixed rather than worked
    /// out from the window by a concentric shape: that answers only for the
    /// corners that stand near the window's, and turned a panel with none
    /// of its own there — the page over an open bottom pane — square.
    static let panelRadius: CGFloat = 8
    /// The run of frame between two panels.
    static let gap: CGFloat = 6
    /// The run of frame between a panel and the window's edge: the inset
    /// the system gives its sidebar's glass, so an island's bottom edge
    /// stands level with the sidebar's beside it.
    static let margin: CGFloat = 8

    static var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: panelRadius, style: .continuous)
    }
}

extension View {
    func island() -> some View {
        modifier(IslandPanel())
    }
}

private struct IslandPanel: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(Color(nsColor: IslandPalette.island))
            .clipShape(IslandMetrics.shape)
            .overlay {
                IslandMetrics.shape.strokeBorder(Color(nsColor: IslandPalette.hairline), lineWidth: 1)
            }
    }
}

/// The gap between two panels, as a handle: dragging it resizes the panel
/// it belongs to, live, since the terminal and the web view both reflow as
/// it moves. Between columns it moves the width of the panel before it;
/// between rows it moves the height of the panel after it — the sidebar
/// grows to the right, the bottom pane grows upward. The gap is too thin to
/// aim at, so the handle reaches a few points over the edges either side of
/// it, above the panels it parts.
struct IslandSeam: View {
    enum Between {
        case columns
        case rows
    }

    let between: Between
    @Binding var size: CGFloat
    let range: ClosedRange<CGFloat>
    @State private var sizeAtDragStart: CGFloat?

    private static let reach: CGFloat = 3

    var body: some View {
        let thickness = IslandMetrics.gap + 2 * Self.reach
        Color.clear
            .frame(
                width: between == .columns ? thickness : nil,
                height: between == .rows ? thickness : nil
            )
            .padding(between == .columns ? .horizontal : .vertical, -Self.reach)
            .zIndex(1)
            .contentShape(Rectangle())
            .onHover { hovering in
                if hovering { cursor.push() } else { NSCursor.pop() }
            }
            .gesture(
                DragGesture(minimumDistance: 1, coordinateSpace: .global)
                    .onChanged { drag in
                        // The drag reports its whole translation each change,
                        // so the size it started from is what it applies to.
                        let start = sizeAtDragStart ?? size
                        sizeAtDragStart = start
                        size = min(range.upperBound, max(range.lowerBound, start + travel(of: drag)))
                    }
                    .onEnded { _ in sizeAtDragStart = nil }
            )
    }

    private func travel(of drag: DragGesture.Value) -> CGFloat {
        switch between {
        case .columns: return drag.translation.width
        case .rows: return -drag.translation.height
        }
    }

    private var cursor: NSCursor {
        switch between {
        case .columns: return .resizeLeftRight
        case .rows: return .resizeUpDown
        }
    }
}
