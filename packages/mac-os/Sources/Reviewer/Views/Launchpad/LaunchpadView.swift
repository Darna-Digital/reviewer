// The launchpad: every window tab laid out as a card over the window, each
// wearing the last picture taken of it, so the one you want is found by
// look rather than by title. Click a card to go there, its mark to close it,
// anywhere else — or Escape, or ⌘L again — to put the launchpad away. The
// tabs are the island's (see `WindowTabStrip`); the pictures are the
// shell's, taken of the page as each tab is left.
import SwiftUI

struct LaunchpadView: View {
    @Environment(AppModel.self) private var model

    private let gap: CGFloat = 32
    private var columns: [GridItem] { [GridItem(.adaptive(minimum: 300, maximum: 420), spacing: gap)] }

    var body: some View {
        ZStack {
            Rectangle()
                .fill(.ultraThinMaterial)
                .ignoresSafeArea()
                .onTapGesture { model.launchpadShown = false }
            ScrollView {
                LazyVGrid(columns: columns, spacing: gap) {
                    ForEach(model.windowTabs.tabs) { tab in
                        LaunchpadCard(tab: tab, image: model.snapshots[tab.id], isCurrent: tab.id == model.windowTabs.activeId)
                    }
                }
                .frame(maxWidth: 1400)
                .padding(48)
                .frame(maxWidth: .infinity)
            }
        }
        .focusable()
        .focusEffectDisabled()
        .onExitCommand { model.launchpadShown = false }
    }
}

private struct LaunchpadCard: View {
    let tab: WindowTab
    let image: NSImage?
    let isCurrent: Bool
    @Environment(AppModel.self) private var model
    @State private var isHovering = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // The rounded rect alone decides the card's size; the snapshot is
            // drawn as an overlay so a `.fill`-scaled image can't push the
            // card wider than its grid cell.
            RoundedRectangle(cornerRadius: 10)
                .fill(Color(nsColor: IslandPalette.island))
                .aspectRatio(16 / 10, contentMode: .fit)
                .overlay {
                    if let image {
                        Image(nsImage: image)
                            .resizable()
                            .scaledToFill()
                    } else {
                        Image(systemName: tab.kind.symbol)
                            .font(.system(size: 28))
                            .foregroundStyle(.secondary)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .strokeBorder(isCurrent ? Color.accentColor : Color.primary.opacity(0.12), lineWidth: isCurrent ? 2 : 1)
                )
                .overlay(alignment: .topTrailing) {
                    if !tab.pinned && isHovering {
                        Button { model.closeTab(id: tab.id) } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 18))
                                .symbolRenderingMode(.palette)
                                .foregroundStyle(.white, .black.opacity(0.6))
                        }
                        .buttonStyle(.plain)
                        .padding(8)
                        .help("Close tab")
                    }
                }
                .shadow(color: .black.opacity(isHovering ? 0.25 : 0.12), radius: isHovering ? 14 : 8, y: 4)
            HStack(spacing: 6) {
                Image(systemName: tab.kind.symbol)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                Text(tab.title)
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
            }
            .padding(.horizontal, 2)
        }
        .scaleEffect(isHovering ? 1.02 : 1)
        .animation(.easeOut(duration: 0.12), value: isHovering)
        .contentShape(Rectangle())
        .onTapGesture { model.select(tabId: tab.id) }
        .onHover { isHovering = $0 }
    }
}
