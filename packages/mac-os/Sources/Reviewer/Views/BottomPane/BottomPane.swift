// The bottom pane, laid out as Xcode's debug area is: a strip along the top
// that only switches between the four surfaces — Branches, History,
// Terminal and Run — and puts the pane away, then the surface beneath, each
// opening on a bar of its own (see `PaneBar`) with what it is narrowed and
// acted on by. The tabs are the system's own (see `SegmentedTabs`): each
// surface's icon and name in a segment, the glass puck on the one that is
// up — the pane's one piece of glass, since the strip is its one layer of
// navigation; a surface's bar carries the system's small borderless
// controls instead. The strip stands at the web dock's own height — the
// 36pt strip the Find-symbol drawer beside it wears — so the two islands'
// bars line up along the foot of the window. The rail reaches the same
// surfaces (see `AppRail`); the switch here is for when the pane is
// already up. The window decides whether the pane is shown and how tall it
// stands, and resizes it by the seam above it. Put away, the pane leaves
// nothing behind; the shells behind the Terminal keep running, and the
// history keeps its place.
import Observation
import SwiftUI

struct BottomPane: View {
    @Environment(AppModel.self) private var model
    @State private var queries = BottomPaneQueries()

    /// The web dock's strip height, so the corner button's 28pt sits in
    /// four points of air above and below, as the drawer's does.
    static let barHeight: CGFloat = 36

    var body: some View {
        VStack(spacing: 0) {
            header
            content
        }
        .environment(queries)
    }

    private var header: some View {
        HStack(spacing: 0) {
            SegmentedTabs(
                segments: BottomPaneTab.allCases.map {
                    SegmentedTabs.Segment(id: $0.rawValue, title: $0.title, symbol: $0.symbol, showsTitle: true)
                },
                selection: model.bottomTab.rawValue,
                select: { id in
                    if let tab = BottomPaneTab(rawValue: id) { model.show(bottomTab: tab) }
                }
            )
            .controlSize(.large)
            .accessibilityLabel("Bottom pane")
            .padding(.leading, PaneMetrics.barInset)
            Spacer(minLength: 8)
            CornerButton(symbol: "chevron.down", help: "Hide the pane (⌘B)") {
                model.toggleBottomPane()
            }
        }
        .controlSize(.small)
        .frame(height: Self.barHeight)
        .overlay(alignment: .bottom) { ThemedDivider() }
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

/// What the surfaces' filter fields hold, kept above the surfaces so a
/// switch away and back finds the filter as it was left.
@MainActor
@Observable
final class BottomPaneQueries {
    var branches = ""
    var commands = ""
    var addingCommand = false
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
        .controlTooltip(help)
        .padding(.trailing, Self.inset)
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
