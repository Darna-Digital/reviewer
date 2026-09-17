// The bottom pane: a bar with a segmented switch between its two surfaces
// — the Terminal and the Run — and the mark that puts the pane away, then
// the surface beneath, the way Xcode's debug area is laid out. The rail
// reaches the same surfaces (see `AppRail`); the switch here is for when
// the pane is already up. Put away, the pane leaves nothing behind; the
// shells behind the Terminal keep running.
import SwiftUI

struct BottomPane: View {
    @Environment(AppModel.self) private var model

    private static let minHeight: CGFloat = 120

    var body: some View {
        if model.bottomExpanded {
            VStack(spacing: 0) {
                header
                content
                    .frame(height: model.bottomHeight)
            }
            .overlay(alignment: .top) { seam }
        }
    }

    private var header: some View {
        HStack(spacing: 8) {
            Picker("Surface", selection: surface) {
                ForEach(BottomPaneTab.allCases) { tab in
                    Text(tab.title).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .controlSize(.small)
            .fixedSize()
            Spacer(minLength: 8)
            PaneBarButton(symbol: "chevron.down", help: "Hide the pane (⌘B)") {
                model.toggleBottomPane()
            }
        }
        .padding(.leading, 8)
        .padding(.trailing, 6)
        .frame(height: PaneMetrics.barHeight)
        .background(.bar)
        .overlay(alignment: .top) { Divider() }
    }

    @ViewBuilder
    private var content: some View {
        switch model.bottomTab {
        case .terminal:
            TerminalPane()
        case .run:
            RunPane()
        }
    }

    private var surface: Binding<BottomPaneTab> {
        Binding(get: { model.bottomTab }, set: { model.show(bottomTab: $0) })
    }

    /// The seam is the pane's top rule: a hit area straddling it that
    /// resizes the pane live, since the terminal and the island both
    /// reflow as it moves.
    private var seam: some View {
        Rectangle()
            .fill(Color.clear)
            .frame(height: 7)
            .offset(y: -3)
            .contentShape(Rectangle())
            .onHover { hovering in
                if hovering { NSCursor.resizeUpDown.push() } else { NSCursor.pop() }
            }
            .gesture(
                DragGesture(minimumDistance: 1, coordinateSpace: .global)
                    .onChanged { drag in
                        // The drag reports its whole translation each change,
                        // so the height it started from is what it applies to.
                        let start = dragStart ?? model.bottomHeight
                        dragStart = start
                        model.bottomHeight = max(Self.minHeight, start - drag.translation.height)
                    }
                    .onEnded { _ in dragStart = nil }
            )
    }

    @State private var dragStart: CGFloat?
}
