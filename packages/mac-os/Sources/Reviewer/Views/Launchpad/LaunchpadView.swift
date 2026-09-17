// The launchpad: every window tab laid out as a card over the window, each
// wearing the last picture taken of it, so the one you want is found by
// look rather than by title. Click a card to go there, its mark to close it,
// anywhere else — or Escape, or ⌘L again — to put the launchpad away.
import SwiftUI

struct LaunchpadView: View {
    @Environment(AppModel.self) private var model

    private let columns = [GridItem(.adaptive(minimum: 300, maximum: 420), spacing: 24)]

    var body: some View {
        ZStack {
            Rectangle()
                .fill(.ultraThinMaterial)
                .ignoresSafeArea()
                .onTapGesture { model.launchpadShown = false }
            ScrollView {
                LazyVGrid(columns: columns, spacing: 24) {
                    ForEach(model.tabs) { tab in
                        LaunchpadCard(tab: tab, image: model.snapshots[tab.id], isCurrent: tab.id == model.selectedTabId)
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
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color(nsColor: .windowBackgroundColor))
                if let image {
                    Image(nsImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } else {
                    Image(systemName: tab.symbol)
                        .font(.system(size: 28))
                        .foregroundStyle(.secondary)
                }
            }
            .aspectRatio(16 / 10, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(isCurrent ? Color.accentColor : Color.primary.opacity(0.12), lineWidth: isCurrent ? 2 : 1)
            )
            .overlay(alignment: .topTrailing) {
                if !tab.isPinned && isHovering {
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
                Image(systemName: tab.symbol)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                Text(model.title(of: tab))
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
