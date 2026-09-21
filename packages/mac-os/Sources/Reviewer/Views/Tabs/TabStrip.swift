// The window tabs, on the toolbar: Code and Sessions as icons, each
// session by its title with its ✕, and the mark that mints one — the row
// the web app's window bar draws, on the window's own bar, from the picture
// the island sends up (see `WindowTabStrip`). Toolbar items rather than
// views of our own, so the bar lays out and tips the row the way it does
// everything else on it. The pinned pair are the system's own toggles in
// the one pane of glass the bar gives a group — the way Notes sets its
// format buttons — the one that is on lit the way the system lights it;
// the sessions after them, and the mark that mints one, wear the web
// bar's chips instead, cut to the glass's own height and capsule, so a row
// of titles reads as the SPA's strip on the pinned pair's line rather than
// a run of glass buttons (see `BarChipStyle`). A press goes back down to
// the island's strip, which is the one that switches.
import SwiftUI

struct TabStripItems: ToolbarContent {
    let model: AppModel

    var body: some ToolbarContent {
        ToolbarItemGroup(placement: .navigation) {
            ForEach(model.windowTabs.tabs.filter(\.pinned)) { tab in
                PinnedTab(tab: tab, model: model)
            }
        }
        ToolbarItemGroup(placement: .navigation) {
            ForEach(model.windowTabs.tabs.filter { !$0.pinned }) { tab in
                SessionTab(tab: tab, model: model)
            }
            Button { model.newSession() } label: {
                Label("New session", systemImage: "plus")
                    .barGlyph()
            }
            .buttonStyle(BarChipStyle())
            .help("New session (⌘T)")
        }
        .sharedBackgroundVisibility(.hidden)
    }
}

/// A pinned tab is its icon and nothing else: a system toggle on the bar,
/// which draws it in the toolbar's own glass and lights it while its way
/// of working is in front (see `WindowTabStrip.lights`). A tab is left by
/// going to another, never by pressing it again, so a press on the tab in
/// front is ignored; a press on Sessions lit for a session's own tab is
/// the way back to the list, whichever way the toggle reads it.
private struct PinnedTab: View {
    let tab: WindowTab
    let model: AppModel

    var body: some View {
        Toggle(isOn: isInFront) {
            Label(tab.title, systemImage: tab.kind.symbol)
        }
        .toggleStyle(.button)
        // Lit in the theme's accent, as the pane's tabs and the diff's
        // add-a-comment button are — the one colour every lit control shares;
        // on the app's own palette that colour is the system's accent, which
        // is what the toggle would have worn anyway. Set as a tint and no
        // more: an ink would give the bar's glass a hover the system's items
        // do not have, and wrapping the toggle in a view of its own loses
        // it the bar's glass altogether.
        .tint(Color(nsColor: IslandPalette.accent))
        .help(tab.title)
        .contextMenu { TabContextMenu(tab: tab, model: model) }
    }

    private var isInFront: Binding<Bool> {
        Binding(
            get: { model.windowTabs.lights(tab) },
            set: { _ in
                guard model.windowTabs.activeId != tab.id else { return }
                model.select(tabId: tab.id)
            })
    }
}

/// A session's tab: its title, and a slot at its tail the ✕ stands in —
/// always on the tab in front, and under the pointer on the rest, as the
/// web strip shows it. The slot is the tab's whether or not the ✕ is in
/// it, so a tab neither resizes nor leaves a hole as the control comes and
/// goes. What the thread is doing shares that slot, so a thread going
/// quiet neither resizes the tab nor leaves a hole, and reaching for the ✕
/// trades one for the other. The ✕ is laid over the tab rather than set
/// inside its label: a button inside a button's label never gets the
/// click, the outer one does, so the tab's button leaves the slot empty
/// and the ✕ stands on top of it. A shift-click closes too, so a tab can
/// go without aiming for its ✕.
private struct SessionTab: View {
    let tab: WindowTab
    let model: AppModel
    @State private var isHovering = false

    private static let maxWidth: CGFloat = 208
    private static let closeSlot: CGFloat = 20
    private static let leadingInset: CGFloat = 14
    private static let trailingInset: CGFloat = 8

    var body: some View {
        let isActive = model.windowTabs.activeId == tab.id
        let showsClose = isActive || isHovering
        Button(action: pressed) {
            HStack(spacing: 6) {
                Text(tab.title)
                    .font(.system(size: 13))
                    .lineLimit(1)
                    .truncationMode(.tail)
                ZStack {
                    Color.clear
                    if !showsClose { TabMark(tab: tab) }
                }
                .frame(width: Self.closeSlot, height: Self.closeSlot)
            }
            .padding(.leading, Self.leadingInset)
            .padding(.trailing, Self.trailingInset)
            .frame(maxWidth: Self.maxWidth)
        }
        .buttonStyle(BarChipStyle(isOn: isActive))
        .overlay(alignment: .trailing) {
            if showsClose {
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

/// What a session's thread is doing, in the slot the ✕ shares: the orb the
/// web strip wears while its agent works, and otherwise the accent dot for
/// a thread that has moved since it was last read. An agent still working
/// outranks a thread waiting to be read — the orb says the tab is going to
/// change again, which is the more useful of the two.
private struct TabMark: View {
    let tab: WindowTab

    var body: some View {
        if tab.working {
            Orb(size: 18, label: "Working")
        } else if tab.waiting {
            Circle()
                .fill(Color.accentColor)
                .frame(width: 6, height: 6)
                .accessibilityLabel("Waiting")
        }
    }
}

/// The ✕ in a session tab's slot: a smaller chip inside the chip — round,
/// as the tab's ends are — lit only under the pointer so it reads as part
/// of the tab until it is reached for. Its own button, so pressing it
/// closes the tab rather than picking it.
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
                    in: Circle())
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
            Button("Close tab") { model.closeTab(id: tab.id) }
        }
        Button("Close other tabs") {
            for other in model.windowTabs.tabs where other.id != tab.id && !other.pinned {
                model.closeTab(id: other.id)
            }
        }
    }
}
