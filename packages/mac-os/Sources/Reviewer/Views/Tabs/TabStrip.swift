// The window tabs, on the toolbar: Code, Git and Sessions as icons, each
// session by its title, and the mark that mints one — the row the web
// app's window bar draws, on the window's own bar, from the picture the
// island sends up (see `WindowTabStrip`). Toolbar toggles rather than views
// of our own: the bar groups them under one piece of glass and draws the
// one that is on, so the row is laid out and lit the way the system lays
// out and lights everything else on it. A press goes back down to the
// island's strip, which is the one that switches.
import SwiftUI

struct TabStripItems: ToolbarContent {
    let model: AppModel

    var body: some ToolbarContent {
        ToolbarItemGroup(placement: .navigation) {
            ForEach(model.windowTabs.tabs) { tab in
                TabToggle(tab: tab, model: model)
            }
            Button { model.newSession() } label: {
                Label("New Session", systemImage: "plus")
                    .toolbarGlyph()
            }
            .help("New Session (⌘T)")
        }
    }
}

private struct TabToggle: View {
    let tab: WindowTab
    let model: AppModel

    var body: some View {
        Group {
            if tab.pinned {
                Toggle(isOn: isSelected) {
                    Label(tab.title, systemImage: tab.kind.symbol)
                        .toolbarGlyph()
                }
            } else {
                Toggle(isOn: isSelected) { label }
                    .labelStyle(.titleAndIcon)
            }
        }
        .toggleStyle(.button)
        .help(tab.title)
        .contextMenu {
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

    /// A session's title gets room either side of it: the toggle's pill is
    /// drawn to the label, and text set flush in it reads as a chip cut too
    /// close.
    private var label: some View {
        Label(tab.title, systemImage: tab.kind.symbol)
            .font(.system(size: 12, weight: .medium))
            .imageScale(.small)
            .lineLimit(1)
            .truncationMode(.tail)
            .frame(maxWidth: 180)
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
    }

    /// Only ever turned on: the tab in front stays in front when clicked
    /// again, as a tab does.
    private var isSelected: Binding<Bool> {
        Binding(
            get: { model.windowTabs.activeId == tab.id },
            set: { if $0 { model.select(tabId: tab.id) } })
    }
}

/// An icon-only toolbar control: every glyph sits in the same box, so the
/// pills the bar draws around them come out the same size whatever the
/// symbol's own width.
private struct ToolbarGlyph: ViewModifier {
    func body(content: Content) -> some View {
        content
            .labelStyle(.iconOnly)
            .font(.system(size: 13, weight: .medium))
            .frame(width: 24, height: 22)
    }
}

extension View {
    func toolbarGlyph() -> some View { modifier(ToolbarGlyph()) }
}
