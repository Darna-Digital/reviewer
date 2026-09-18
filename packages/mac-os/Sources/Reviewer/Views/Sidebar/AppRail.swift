// The rail: the column of icons down the leading edge of the window, the
// web app's mode rail drawn natively. The code surfaces stand at its head
// and at its foot the bottom pane's, which stand at the foot of the window
// — the way the web rail splits them, so the sidebar's tree and the page
// island both move from the same column. It measures 36pt with a
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
                RailButton(symbol: surface.symbol, title: surface.title,
                           isOn: model.codeSurface == surface) {
                    model.show(surface: surface)
                }
            }
            Spacer(minLength: 0)
            ForEach(BottomPaneTab.allCases) { tab in
                RailButton(symbol: tab.symbol, title: tab.title,
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
/// and the weight of its stroke — as the web rail's does.
private struct RailButton: View {
    let symbol: String
    let title: String
    let isOn: Bool
    let action: () -> Void
    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 14, weight: isOn ? .semibold : .regular))
                .foregroundStyle(isOn ? .primary : isHovering ? .primary : .secondary)
                .frame(width: 28, height: 28)
                .background(
                    isOn ? Color.primary.opacity(0.12) : isHovering ? Color.primary.opacity(0.06) : Color.clear,
                    in: RoundedRectangle(cornerRadius: 6))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
        .help(title)
    }
}
