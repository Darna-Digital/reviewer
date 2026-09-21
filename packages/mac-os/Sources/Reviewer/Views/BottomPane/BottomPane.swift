// The bottom pane: a bar with a row of flat tabs between its four surfaces
// — Branches, History, Terminal and Run, the web dock's own strip — and the
// mark that puts the pane away, then the surface beneath, the way Xcode's
// debug area is laid out. The tabs are the system's accessory-bar toggles,
// the flat switch Finder's and Xcode's bars wear: no bezel at rest, a tint
// while on, so the bar reads as a strip of names rather than a run of
// buttons. The strip stands at the pane bar's own height and inset, so
// the surface's bar under it reads as a second line of the same
// instrument rather than a different one. The rail reaches the same
// surfaces (see `AppRail`); the switch here is for when the pane is
// already up. The window decides whether the pane is shown and how tall it stands, and
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
        HStack(spacing: 0) {
            HStack(spacing: 2) {
                ForEach(BottomPaneTab.allCases) { tab in
                    SurfaceTab(tab: tab, isOn: model.bottomTab == tab) {
                        model.show(bottomTab: tab)
                    }
                }
            }
            .padding(.leading, PaneMetrics.barInset)
            Spacer(minLength: 8)
            CornerButton(symbol: "chevron.down", help: "Hide the pane (⌘B)") {
                model.toggleBottomPane()
            }
        }
        .controlSize(.small)
        .frame(height: PaneMetrics.barHeight)
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

/// The one motion the pane comes and goes with: a short settle with no
/// bounce, the tempo the system's sidebar slides at, and none at all when
/// the user asked for less motion.
enum PaneMotion {
    static var change: Animation? {
        NSWorkspace.shared.accessibilityDisplayShouldReduceMotion ? nil : .smooth(duration: 0.28)
    }
}

/// The mark in the island's top trailing corner: a flat button set into the
/// corner itself rather than inset from it, so it reads as a cap on the
/// bar. Its outer corner is cut at the island's own radius and its inner
/// one at a bar button's, and it stands the bar's full height, so the
/// wash that lights under the pointer fills the corner edge to edge.
private struct CornerButton: View {
    let symbol: String
    let help: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 11, weight: .medium))
                .frame(width: 32, height: PaneMetrics.barHeight)
        }
        .buttonStyle(CornerButtonStyle())
        .help(help)
    }
}

private struct CornerButtonStyle: ButtonStyle {
    @State private var isHovering = false

    private static let shape = UnevenRoundedRectangle(
        bottomLeadingRadius: 6,
        topTrailingRadius: IslandMetrics.radius,
        style: .continuous
    )

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(isHovering ? .primary : .secondary)
            .background(
                Color.primary.opacity(configuration.isPressed ? BarChipMetrics.onTint : isHovering ? BarChipMetrics.hoverTint : 0),
                in: Self.shape)
            .contentShape(Self.shape)
            .onHover { isHovering = $0 }
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
