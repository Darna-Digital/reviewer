// The window's regions — the sidebar's project tree, the page island, the
// bottom pane — are islands: rounded panels of the web app's sheet colour,
// ringed by the separator, standing a few points apart on its frame colour
// (see `IslandPalette`), the way the JetBrains islands layout sets its tool
// windows beside the editor, and the sidebar floating beside the rail the
// way the current design floats one over its window. One fill for all
// three: the system's sidebar material was tried for the tree and came out
// a tone apart from the panels beside it. The toolbar and the rail are not
// islands: they are the window itself, bare, which is what the panels
// stand on.
import SwiftUI

enum IslandMetrics {
    static let radius: CGFloat = 10
    /// The run of frame between two panels, and between a panel and the
    /// window's edge.
    static let gap: CGFloat = 6

    static var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: radius, style: .continuous)
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
                IslandMetrics.shape.strokeBorder(Color(nsColor: .separatorColor), lineWidth: 1)
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
