// The bottom pane: a bar with a segmented switch between its four surfaces
// — Branches, History, Terminal and Run, the web dock's own strip — and the
// mark that puts the pane away, then the surface beneath, the way Xcode's
// debug area is laid out. The rail reaches the same surfaces (see
// `AppRail`); the switch here is for when the pane is already up. The
// window decides whether the pane is shown and how tall it stands, and
// resizes it by the seam above it. Put away, the pane leaves nothing
// behind; the shells behind the Terminal keep running, and the history
// keeps its place.
import SwiftUI

struct BottomPane: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(spacing: 0) {
            header
            content
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
        .frame(height: PaneMetrics.barHeight + 4)
        .overlay(alignment: .bottom) { Divider() }
    }

    @ViewBuilder
    private var content: some View {
        switch model.bottomTab {
        case .branches:
            BranchesPane()
        case .history:
            HistoryPane()
        case .terminal:
            TerminalPane()
        case .run:
            RunPane()
        }
    }

    private var surface: Binding<BottomPaneTab> {
        Binding(get: { model.bottomTab }, set: { model.show(bottomTab: $0) })
    }
}
