// The window tabs, on the toolbar: Code, Git and Sessions as icons, each
// session by its title with its ✕, and the mark that mints one — the row
// the web app's window bar draws, on the window's own bar, from the picture
// the island sends up (see `WindowTabStrip`). Toolbar items rather than
// views of our own, so the bar lays out and tips the row the way it does
// everything else on it, but in the web bar's own chips rather than the
// system's glass (see `BarChipStyle`). A press goes back down to the
// island's strip, which is the one that switches.
import SwiftUI

struct TabStripItems: ToolbarContent {
    let model: AppModel

    var body: some ToolbarContent {
        ToolbarItemGroup(placement: .navigation) {
            ForEach(model.windowTabs.tabs) { tab in
                if tab.pinned {
                    PinnedTab(tab: tab, model: model)
                } else {
                    SessionTab(tab: tab, model: model)
                }
            }
            Button { model.newSession() } label: {
                Label("New Session", systemImage: "plus")
                    .barGlyph()
            }
            .buttonStyle(BarChipStyle())
            .help("New Session (⌘T)")
        }
        .sharedBackgroundVisibility(.hidden)
    }
}

/// A pinned tab is its icon and nothing else, so it wears the same square
/// — and the same states — as the buttons at either end of the bar.
private struct PinnedTab: View {
    let tab: WindowTab
    let model: AppModel

    var body: some View {
        Button { model.select(tabId: tab.id) } label: {
            Label(tab.title, systemImage: tab.kind.symbol)
                .barGlyph()
        }
        .buttonStyle(BarChipStyle(isOn: model.windowTabs.activeId == tab.id))
        .help(tab.title)
        .contextMenu { TabContextMenu(tab: tab, model: model) }
    }
}

/// A session's tab: its title, and a slot at its tail the ✕ stands in —
/// always on the tab in front, and under the pointer on the rest, as the
/// web strip shows it. The slot is the tab's whether or not the ✕ is in
/// it, so a tab neither resizes nor leaves a hole as the control comes and
/// goes. The ✕ is laid over the tab rather than set inside its label: a
/// button inside a button's label never gets the click, the outer one
/// does, so the tab's button leaves the slot empty and the ✕ stands on top
/// of it. A shift-click closes too, so a tab can go without aiming for
/// its ✕.
private struct SessionTab: View {
    let tab: WindowTab
    let model: AppModel
    @State private var isHovering = false

    private static let maxWidth: CGFloat = 208
    private static let closeSlot: CGFloat = 18
    private static let trailingInset: CGFloat = 4

    var body: some View {
        let isActive = model.windowTabs.activeId == tab.id
        Button(action: pressed) {
            HStack(spacing: 6) {
                Text(tab.title)
                    .font(.system(size: 13))
                    .lineLimit(1)
                    .truncationMode(.tail)
                Color.clear
                    .frame(width: Self.closeSlot, height: Self.closeSlot)
            }
            .padding(.leading, 10)
            .padding(.trailing, Self.trailingInset)
            .frame(maxWidth: Self.maxWidth)
        }
        .buttonStyle(BarChipStyle(isOn: isActive))
        .overlay(alignment: .trailing) {
            if isActive || isHovering {
                TabCloseButton(title: tab.title) { model.closeTab(id: tab.id) }
                    .frame(width: Self.closeSlot, height: Self.closeSlot)
                    .padding(.trailing, Self.trailingInset)
            }
        }
        .onHover { isHovering = $0 }
        .help(tab.title)
        .contextMenu { TabContextMenu(tab: tab, model: model) }
    }

    private func pressed() {
        if NSEvent.modifierFlags.contains(.shift) {
            model.closeTab(id: tab.id)
        } else {
            model.select(tabId: tab.id)
        }
    }
}

/// The ✕ in a session tab's slot: a smaller chip inside the chip, lit only
/// under the pointer so it reads as part of the tab until it is reached
/// for. Its own button, so pressing it closes the tab rather than picking
/// it.
private struct TabCloseButton: View {
    let title: String
    let action: () -> Void
    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            Image(systemName: "xmark")
                .font(.system(size: 10, weight: .semibold))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .foregroundStyle(.primary.opacity(isHovering ? 1 : 0.7))
                .background(
                    isHovering ? Color.primary.opacity(BarChipMetrics.onTint) : Color.clear,
                    in: RoundedRectangle(cornerRadius: 4))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
        .help("Close \(title)")
        .accessibilityLabel("Close \(title)")
    }
}

private struct TabContextMenu: View {
    let tab: WindowTab
    let model: AppModel

    var body: some View {
        if !tab.pinned {
            Button("Close Tab") { model.closeTab(id: tab.id) }
        }
        Button("Close Other Tabs") {
            for other in model.windowTabs.tabs where other.id != tab.id && !other.pinned {
                model.closeTab(id: other.id)
            }
        }
    }
}
