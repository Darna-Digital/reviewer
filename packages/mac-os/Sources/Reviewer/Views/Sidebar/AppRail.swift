// The rail: the column of icons down the leading edge of the window, the
// web app's mode rail drawn natively. The code surfaces stand at its head,
// the search under them, and at its foot the bottom pane's, which stand at
// the foot of the window — the way the web rail splits them, so the
// sidebar's tree and the page island both move from the same column. It measures 36pt with a
// 28pt button in it — the web rail's own sizes — held off the edge it
// stands by. It stands on the system sidebar's glass, down its leading
// edge, off the glass's edge by the islands' gap, with no rule of its own
// between it and the tree; with the sidebar put away it stands on the
// bare frame beside the page island instead, off the window's edge by
// the islands' margin (see `ContentView`). On the sessions surface it is not
// drawn at all: what the web rail carries there stands at the head of the
// sidebar's list instead (see `AppModel.railShown`).
import SwiftUI

struct AppRail: View {
    @Environment(AppModel.self) private var model

    static let width: CGFloat = 36
    var inset: CGFloat = IslandMetrics.gap

    var body: some View {
        VStack(spacing: 4) {
            ForEach(CodeSurface.allCases) { surface in
                RailButton(symbol: surface.symbol, help: surface.railHelp,
                           isOn: model.codeSurface == surface) {
                    model.show(surface: surface)
                }
            }
            SearchRailMenu()
            Spacer(minLength: 0)
            ForEach(BottomPaneTab.allCases) { tab in
                RailButton(symbol: tab.symbol, help: tab.railHelp,
                           isOn: model.bottomExpanded && model.bottomTab == tab) {
                    model.toggle(bottomTab: tab)
                }
            }
        }
        .padding(.top, 4)
        .padding(.bottom, 4)
        .frame(width: Self.width)
        .frame(maxHeight: .infinity)
        .padding(.leading, inset)
        .disabled(!model.hasProject)
    }
}

/// A rail button is an icon with no word under it, so the one that is on
/// says so three ways at once — the chip it sits in, the weight of its ink,
/// and the weight of its stroke — as the web rail's does. Hovered, it
/// names its surface and the chord that reaches it.
private struct RailButton: View {
    let symbol: String
    let help: String
    let isOn: Bool
    let action: () -> Void
    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            RailGlyph(symbol: symbol, isOn: isOn, isHovering: isHovering)
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
        .help(help)
    }
}

/// Searching the project is something you do *to* the surfaces above, not
/// a fourth surface, so it follows them rather than joining them, as the
/// web rail's search does — and like the web's it is a menu, not a button:
/// there are two lists worth opening straight into, and the gestures for
/// both are hard to guess, so the menu names them and shows the keys. It
/// takes no rail chord of its own (see `RailShortcut`): the searches keep
/// theirs, and the bottom pane's slots stay where they are.
private struct SearchRailMenu: View {
    @Environment(AppModel.self) private var model
    @State private var isHovering = false

    var body: some View {
        Menu {
            SearchMenuItems(model: model)
        } label: {
            RailGlyph(symbol: "magnifyingglass", isOn: false, isHovering: isHovering)
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .onHover { isHovering = $0 }
        .help("Search")
    }
}

/// The icon in its chip, drawn the same whether a button or a menu wears
/// it, so the search's rail button is not a shape of its own.
private struct RailGlyph: View {
    let symbol: String
    let isOn: Bool
    let isHovering: Bool

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: 14, weight: isOn ? .semibold : .regular))
            .foregroundStyle(isOn ? .primary : isHovering ? .primary : .secondary)
            .frame(width: 28, height: 28)
            .background(
                isOn ? Color.primary.opacity(0.12) : isHovering ? Color.primary.opacity(0.06) : Color.clear,
                in: RoundedRectangle(cornerRadius: 6))
            .contentShape(Rectangle())
    }
}
