// The native sidebar: a rail of the code surfaces down its leading edge —
// the web app's mode rail, as native buttons — and beside it the project
// and branch pickers over the tree island, the SPA's file tree drawn with no
// paper of its own so it stands on the sidebar's material like a native
// outline would. The rail moves the page island between the project, the
// diff and the merge requests; the tree follows the page, and a file picked
// in the tree is carried to the page.
import SwiftUI

struct SidebarView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        HStack(spacing: 0) {
            SurfaceRail()
            VStack(spacing: 0) {
                HStack(spacing: 6) {
                    ProjectChip()
                    BranchPicker()
                        .layoutPriority(-1)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 10)
                .padding(.bottom, 6)
                if model.hasProject {
                    IslandView(host: model.tree)
                } else {
                    Spacer()
                }
            }
        }
    }
}

/// The code surfaces, one button each, the one the page is on held down.
private struct SurfaceRail: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(spacing: 4) {
            ForEach(CodeSurface.allCases) { surface in
                RailButton(surface: surface, isOn: model.codeSurface == surface) {
                    model.show(surface: surface)
                }
                .disabled(!model.hasProject)
            }
            Spacer()
        }
        .padding(.horizontal, 4)
        .padding(.top, 2)
        .frame(width: 36)
    }
}

private struct RailButton: View {
    let surface: CodeSurface
    let isOn: Bool
    let action: () -> Void
    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            Image(systemName: surface.symbol)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(isOn ? .primary : .secondary)
                .frame(width: 28, height: 28)
                .background(
                    isOn ? Color.primary.opacity(0.12) : isHovering ? Color.primary.opacity(0.06) : Color.clear,
                    in: RoundedRectangle(cornerRadius: 6))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
        .help(surface.title)
    }
}
