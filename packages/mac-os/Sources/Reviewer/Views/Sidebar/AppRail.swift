// The rail: the column of icons down the leading edge of the sidebar, the
// web app's mode rail drawn natively. The code surfaces stand at its head
// and the bottom pane's surfaces at its foot, the way the web rail splits
// them, so the sidebar's tree and the page island both move from the same
// column. It measures 36pt with a 28pt button in it — the web rail's own
// sizes — on the sidebar's paper, with a rule along its top and down its
// trailing edge, turning the corner between them, parting it from the
// tree the way a sheet's edge parts it from the frame.
import SwiftUI

struct AppRail: View {
    @Environment(AppModel.self) private var model

    static let width: CGFloat = 36
    static let footInset: CGFloat = 10

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
        // The foot keeps clear of the window's rounded corner, which would
        // otherwise cut into the last chip.
        .padding(.top, 4)
        .padding(.bottom, Self.footInset)
        .frame(width: Self.width)
        .frame(maxHeight: .infinity)
        .overlay {
            RailEdge(radius: 8)
                .stroke(Color(nsColor: .separatorColor), lineWidth: 1)
        }
        .disabled(!model.hasProject)
    }
}

/// The rail's rule: across its top and down its trailing edge as one
/// stroke, the corner between them rounded. Inset half a point so the
/// hairline lands on whole pixels rather than straddling the frame.
private struct RailEdge: Shape {
    let radius: CGFloat

    func path(in rect: CGRect) -> Path {
        let inset = rect.insetBy(dx: 0.5, dy: 0.5)
        var path = Path()
        path.move(to: CGPoint(x: inset.minX, y: inset.minY))
        path.addLine(to: CGPoint(x: inset.maxX - radius, y: inset.minY))
        path.addArc(center: CGPoint(x: inset.maxX - radius, y: inset.minY + radius),
                    radius: radius, startAngle: .degrees(-90), endAngle: .degrees(0), clockwise: false)
        path.addLine(to: CGPoint(x: inset.maxX, y: rect.maxY))
        return path
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
