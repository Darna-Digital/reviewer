// The bottom pane: a bar with a row of flat tabs between its four surfaces
// — Branches, History, Terminal and Run, the web dock's own strip — and the
// mark that puts the pane away, then the surface beneath, the way Xcode's
// debug area is laid out. The tabs are the system's accessory-bar toggles,
// the flat switch Finder's and Xcode's bars wear: no bezel at rest, a tint
// while on, so the bar reads as a strip of names rather than a run of
// buttons. The rail reaches the same surfaces (see
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
        HStack(spacing: 2) {
            ForEach(BottomPaneTab.allCases) { tab in
                SurfaceTab(tab: tab, isOn: model.bottomTab == tab) {
                    model.show(bottomTab: tab)
                }
            }
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

}

/// One surface's tab: a toggle in the accessory-bar style that lights while
/// its surface is up. A surface is left by going to another, never by
/// pressing its tab again, so the toggle answers only to being switched on.
private struct SurfaceTab: View {
    let tab: BottomPaneTab
    let isOn: Bool
    let select: () -> Void

    var body: some View {
        Toggle(isOn: Binding(get: { isOn }, set: { if $0 { select() } })) {
            Text(tab.title)
                .font(.system(size: 11, weight: .medium))
                .padding(.horizontal, 2)
        }
        .toggleStyle(.button)
        .buttonStyle(.accessoryBar)
        .help(tab.title)
    }
}
