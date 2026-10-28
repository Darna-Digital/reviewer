// The rail: the column of icons down the leading edge of the window, the
// web app's mode rail drawn natively. The code surfaces stand at its head,
// the search under them, and at its foot the bottom pane's, which stand at
// the foot of the window — the way the web rail splits them, so the
// sidebar's tree and the page island both move from the same column. Each
// of the two runs is a set of tabs in glass (see `GlassRailTabs`), the puck
// under the surface that is up, which can be slid along to another. It measures 36pt with a
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

    /// The room the rail takes beside what stands next to it.
    var footprint: CGFloat { Self.width + inset }

    var body: some View {
        VStack(spacing: 8) {
            GlassRailTabs(
                tabs: CodeSurface.allCases.map {
                    RailTab(id: $0.railID, symbol: $0.symbol, title: $0.title, hint: $0.railShortcut.hint)
                },
                extras: [SearchRailMenu.tab],
                activeExtra: model.showsSearch ? SearchRailMenu.tab.id : nil,
                selection: model.codeSurface?.railID,
                press: showSurface,
                drop: showSurface
            ) { _, isHovered, isLit in
                SearchRailMenu(isHovered: isHovered, isLit: isLit)
            }
            Spacer(minLength: 0)
            GlassRailTabs(
                tabs: BottomPaneTab.allCases.map {
                    RailTab(id: $0.rawValue, symbol: $0.symbol, title: $0.title, hint: $0.railShortcut.hint)
                },
                selection: model.bottomExpanded ? model.bottomTab.rawValue : nil,
                press: { id in BottomPaneTab(rawValue: id).map(model.toggle(bottomTab:)) },
                drop: { id in BottomPaneTab(rawValue: id).map(model.show(bottomTab:)) })
        }
        .padding(.top, 4)
        // The foot stands off the glass's bottom edge by the same gap the
        // rail stands off its leading edge, so the last chip sits squarely
        // in the sidebar's corner — and, the chip being 4pt taller than a
        // regular button held off that edge by the composer's 8pt, its
        // centre lands level with the Commit buttons' beside it.
        .padding(.bottom, IslandMetrics.gap)
        .frame(width: Self.width)
        .frame(maxHeight: .infinity)
        .padding(.leading, inset)
        .disabled(!model.hasProject)
    }

    private func showSurface(_ id: String) {
        if let surface = CodeSurface.allCases.first(where: { $0.railID == id }) {
            model.show(surface: surface)
        }
    }
}

private extension CodeSurface {
    /// The surface as the rail's tabs name it.
    var railID: String { String(describing: self) }
}

private extension AppModel {
    /// Whether one of the search's lists is up — a file by name, or a grep
    /// of the working tree — which the rail's search stands lit for.
    var showsSearch: Bool {
        palette.isShown && (palette.mode == .files || palette.mode == .text)
    }
}

/// Searching the project is something you do *to* the surfaces above, not
/// a fourth surface, so it follows them on their track without the puck
/// ever standing on it, as the web rail's search follows its modes — and
/// like the web's it is a menu, not a button: there are two lists worth
/// opening straight into, and the gestures for both are hard to guess, so
/// the menu names them and shows the keys. It takes no rail chord of its
/// own (see `RailShortcut`): the searches keep theirs, and the bottom
/// pane's slots stay where they are.
private struct SearchRailMenu: View {
    @Environment(AppModel.self) private var model
    let isHovered: Bool
    let isLit: Bool

    static let tab = RailTab(
        id: "search", symbol: "magnifyingglass", title: "Search", hint: "⇧⌘O  ⇧⌘F")

    var body: some View {
        Menu {
            SearchMenuItems(model: model)
        } label: {
            RailTabGlyph(symbol: Self.tab.symbol, isLit: isLit, isHovered: isHovered)
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .accessibilityLabel(Self.tab.title)
    }
}
