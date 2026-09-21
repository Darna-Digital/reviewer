// The bottom pane: a bar with a row of flat tabs between its four surfaces
// — Branches, History, Terminal and Run, the web dock's own strip — and the
// mark that puts the pane away, then the surface beneath, the way Xcode's
// debug area is laid out. The tabs are the system's accessory-bar toggles,
// the flat switch Finder's and Xcode's bars wear: no bezel at rest, a tint
// while on, so the bar reads as a strip of names rather than a run of
// buttons. The bar stands at the web dock's own height — the 36pt strip
// the Find-symbol drawer beside it wears — at the pane bar's inset, so
// the two islands' bars line up along the foot of the window and the
// surface's own 28pt bar under it reads as a second line of the same
// instrument rather than a different one. The rail reaches the same
// surfaces (see `AppRail`); the switch here is for when the pane is
// already up. The window decides whether the pane is shown and how tall it stands, and
// resizes it by the seam above it. Put away, the pane leaves nothing
// behind; the shells behind the Terminal keep running, and the history
// keeps its place.
import SwiftUI

struct BottomPane: View {
    @Environment(AppModel.self) private var model

    /// The web dock's strip height, so the corner button's 28pt sits in
    /// four points of air above and below, as the drawer's does.
    static let barHeight: CGFloat = 36

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
        .frame(height: Self.barHeight)
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

/// The mark at the bar's trailing edge, at the web dock's own proportions
/// — its `PanelButton`: a 28pt ghost button in a 36pt bar, the glyph 16pt
/// inside it, the button's 4.5pt radius, and four points of air to the
/// island's edge — so the pane puts itself away with the same control the
/// Find-symbol drawer beside it closes with.
private struct CornerButton: View {
    let symbol: String
    let help: String
    let action: () -> Void

    static let size: CGFloat = 28
    static let inset: CGFloat = 4

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .medium))
                .frame(width: Self.size, height: Self.size)
        }
        .buttonStyle(CornerButtonStyle())
        .padding(.trailing, Self.inset)
        .help(help)
    }
}

private struct CornerButtonStyle: ButtonStyle {
    @State private var isHovering = false

    private static let shape = RoundedRectangle(cornerRadius: 4.5, style: .continuous)

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
