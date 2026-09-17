// The open-file strip, under the window tabs: the code page's tabs drawn
// natively, in the web strip's own shape — the file's type icon, its name,
// italic while the tab is only a preview, a pin marker when pinned, and a
// close control that shows on the active tab or on hover, traded for a dot
// while the buffer is unsaved. The strip scrolls rather than shrinking its
// tabs; tabs drag into any order; a double click settles a preview; the
// context menu pins and closes.
//
// Nothing here owns a tab: every click is sent to the page island, which
// keeps the strip and reports it back changed — see `FileTabStrip` and the
// SPA's `tabs.shell`.
import SwiftUI

struct FileTabStripView: View {
    let strip: FileTabStrip
    @Environment(AppModel.self) private var model

    private static let height: CGFloat = 36

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 4) {
                    ForEach(Array(strip.tabs.enumerated()), id: \.element.id) { index, tab in
                        FileTabChip(tab: tab, isActive: tab.path == strip.active, index: index)
                            .id(tab.path)
                    }
                }
                .padding(.horizontal, 8)
                .frame(height: Self.height)
            }
            .onChange(of: strip.active, initial: true) { _, active in
                guard let active else { return }
                proxy.scrollTo(active)
            }
        }
        .frame(height: Self.height)
        .background(.bar)
        .overlay(alignment: .bottom) { Divider() }
    }
}

private struct FileTabChip: View {
    let tab: FileTab
    let isActive: Bool
    /// The tab's place in the strip's order, which is where a drop lands.
    let index: Int
    @Environment(AppModel.self) private var model
    @Environment(\.colorScheme) private var colorScheme
    @State private var isHovering = false
    @State private var isTargeted = false

    var body: some View {
        HStack(spacing: 6) {
            FileIconView(icon: tab.icon, dark: colorScheme == .dark)
            Text(tab.name)
                .font(.system(size: 13))
                .italic(tab.preview)
                .lineLimit(1)
                .truncationMode(.tail)
            if tab.pinned {
                Image(systemName: "pin.fill")
                    .font(.system(size: 9))
                    .foregroundStyle(.tertiary)
            }
            closeSlot
        }
        .padding(.leading, 10)
        .padding(.trailing, 6)
        .frame(height: 28)
        .frame(maxWidth: 224)
        .foregroundStyle(isActive || isHovering ? .primary : .secondary)
        .background(background, in: RoundedRectangle(cornerRadius: 6))
        .overlay {
            if isTargeted {
                RoundedRectangle(cornerRadius: 6).strokeBorder(Color.accentColor, lineWidth: 1.5)
            }
        }
        .contentShape(Rectangle())
        .onHover { isHovering = $0 }
        .onTapGesture(count: 2) { model.act(onFileTab: .keep(tab.path)) }
        .onTapGesture { model.act(onFileTab: .select(tab.path)) }
        .help(tab.path)
        .draggable(tab.path)
        .dropDestination(for: String.self) { paths, _ in
            guard let path = paths.first, path != tab.path else { return false }
            model.act(onFileTab: .move(path, toIndex: index))
            return true
        } isTargeted: { isTargeted = $0 }
        .contextMenu {
            Button(tab.pinned ? "Unpin Tab" : "Pin Tab") { model.act(onFileTab: .togglePin(tab.path)) }
            Divider()
            Button("Close") { model.act(onFileTab: .close(tab.path)) }
            Button("Close Others") { model.act(onFileTab: .closeOthers(tab.path)) }
            Button("Close All") { model.act(onFileTab: .closeAll) }
        }
    }

    private var background: Color {
        if isActive { return Color.secondary.opacity(0.16) }
        if isHovering { return Color.secondary.opacity(0.08) }
        return .clear
    }

    /// A fixed slot at the tail, so the chip neither resizes nor leaves a
    /// hole as the control comes and goes.
    private var closeSlot: some View {
        ZStack {
            if tab.dirty && !isHovering {
                Circle()
                    .fill(Color.accentColor)
                    .frame(width: 6, height: 6)
            }
            if isHovering || (isActive && !tab.dirty) {
                Button { model.act(onFileTab: .close(tab.path)) } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 9, weight: .semibold))
                        .frame(width: 18, height: 18)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .opacity(0.7)
                .help("Close")
            }
        }
        .frame(width: 18, height: 18)
    }
}

private struct FileIconView: View {
    let icon: FileIcon
    let dark: Bool

    var body: some View {
        Group {
            if let image = icon.image(dark: dark) {
                Image(nsImage: image)
                    .resizable()
                    .interpolation(.high)
            } else {
                Image(systemName: "doc")
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: 16, height: 16)
    }
}
