// The editor's tab bar. SwiftUI's own `TabView` renders a centred segmented
// control on macOS, which is not what an editor wants, so this is the
// Xcode-style strip drawn by hand out of system materials: a row of titles on
// the window's bar material, the current one lifted to the content
// background, a close affordance that appears on hover and turns into a dot
// while the buffer is unsaved.
import SwiftUI

struct TabStrip: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 0) {
                    ForEach(model.tabs) { tab in
                        TabItem(tab: tab, isSelected: tab.id == model.selectedTabId)
                            .id(tab.id)
                        Divider().frame(height: 18)
                    }
                }
            }
            .onChange(of: model.selectedTabId) { _, id in
                if let id { withAnimation { proxy.scrollTo(id) } }
            }
        }
        .frame(height: 34)
        .background(.bar)
        .overlay(alignment: .bottom) { Divider() }
    }
}

private struct TabItem: View {
    let tab: EditorTab
    let isSelected: Bool
    @Environment(AppModel.self) private var model
    @State private var isHovering = false

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 11))
                .foregroundStyle(isSelected ? Color.accentColor : Color.secondary)
            Text(title)
                .font(.system(size: 12))
                .lineLimit(1)
                .foregroundStyle(isSelected ? .primary : .secondary)
            closeButton
        }
        .padding(.horizontal, 12)
        .frame(height: 34)
        .frame(minWidth: 120, maxWidth: 240)
        .background(isSelected ? Color(nsColor: .controlBackgroundColor) : Color.clear)
        .contentShape(Rectangle())
        .onTapGesture { model.selectedTabId = tab.id }
        .onHover { isHovering = $0 }
        .contextMenu {
            Button("Close Tab") { model.closeTab(id: tab.id) }
            Button("Close Other Tabs") {
                for other in model.tabs where other.id != tab.id { model.closeTab(id: other.id) }
            }
        }
    }

    /// The dot stays visible on a dirty tab so unsaved work is never hidden
    /// behind a hover; a clean tab only shows the close mark under the mouse.
    @ViewBuilder
    private var closeButton: some View {
        let dirty = isDirty
        Button {
            model.closeTab(id: tab.id)
        } label: {
            Image(systemName: isHovering ? "xmark" : "circle.fill")
                .font(.system(size: isHovering ? 9 : 7, weight: .bold))
                .frame(width: 16, height: 16)
                .background(isHovering ? Color.secondary.opacity(0.18) : Color.clear, in: RoundedRectangle(cornerRadius: 4))
        }
        .buttonStyle(.plain)
        .foregroundStyle(.secondary)
        .opacity(isHovering || dirty ? 1 : 0)
        .help("Close tab")
    }

    private var title: String {
        switch tab.kind {
        case .file(let path): return URL(fileURLWithPath: path).lastPathComponent
        case .chat(let id): return model.sessions[id]?.title ?? "Session"
        }
    }

    private var icon: String {
        switch tab.kind {
        case .file(let path): return FileIcons.symbol(for: path)
        case .chat: return "sparkles"
        }
    }

    private var isDirty: Bool {
        guard case .file(let path) = tab.kind else { return false }
        return model.openFiles[path]?.isDirty ?? false
    }
}
