// The window tabs, in the toolbar: Code and Sessions as icons, each session
// by its title, and the mark that mints one — the same row the web app's
// window bar draws, on the window's own bar. Toolbar toggles rather than views of our own: the bar
// groups them under one piece of glass and draws the one that is on, so
// the row is laid out and lit the way the system lays out and lights
// everything else on it.
import SwiftUI

struct TabStripItems: ToolbarContent {
    let model: AppModel

    var body: some ToolbarContent {
        ToolbarItemGroup(placement: .navigation) {
            ForEach(model.tabs) { tab in
                TabToggle(tab: tab, model: model)
            }
            Button { model.newSession() } label: {
                Label("New Session", systemImage: "plus")
                    .toolbarGlyph()
            }
            .help("New Session")
        }
    }
}

private struct TabToggle: View {
    let tab: WindowTab
    let model: AppModel

    var body: some View {
        Group {
            if tab.isPinned {
                Toggle(isOn: isSelected) {
                    Label(model.title(of: tab), systemImage: tab.symbol)
                        .toolbarGlyph()
                }
            } else {
                Toggle(isOn: isSelected) { label }
                    .labelStyle(.titleAndIcon)
            }
        }
        .toggleStyle(.button)
        .help(model.title(of: tab))
        .contextMenu {
            if !tab.isPinned {
                Button("Close Tab") { model.closeTab(id: tab.id) }
            }
            Button("Close Other Tabs") {
                for other in model.tabs where other.id != tab.id { model.closeTab(id: other.id) }
            }
        }
    }

    /// A session's title gets room either side of it: the toggle's pill is
    /// drawn to the label, and text set flush in it reads as a chip cut too
    /// close.
    private var label: some View {
        Label(model.title(of: tab), systemImage: tab.symbol)
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
            get: { model.selectedTabId == tab.id },
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

/// The project by name, with its recents and the folder panel behind it.
struct ProjectChip: View {
    @Environment(AppModel.self) private var model
    @State private var picking = false

    var body: some View {
        Button { picking.toggle() } label: {
            HStack(spacing: 6) {
                Text(initials)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 20, height: 20)
                    .background(Color.accentColor, in: RoundedRectangle(cornerRadius: 5))
                Text(model.workspace?.projectName ?? "Reviewer")
                    .font(.system(size: 13, weight: .semibold))
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 6)
            .frame(height: 24)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .fixedSize()
        .help("Switch project")
        .popover(isPresented: $picking, arrowEdge: .bottom) {
            ProjectPicker(dismiss: { picking = false })
        }
    }

    private var initials: String {
        let name = model.workspace?.projectName ?? "R"
        return String(name.prefix(2)).uppercased()
    }
}

private struct ProjectPicker: View {
    let dismiss: () -> Void
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let recents = model.workspace?.recents, !recents.isEmpty {
                Text("Recent")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 8)
                    .padding(.top, 4)
                ForEach(recents, id: \.self) { path in
                    PickerRow(title: URL(fileURLWithPath: path).lastPathComponent, subtitle: path,
                              isCurrent: path == model.workspace?.project) {
                        dismiss()
                        Task { await model.openProject(path: path) }
                    }
                }
                Divider().padding(.vertical, 4)
            }
            PickerRow(title: "Open Project…", subtitle: nil, isCurrent: false) {
                dismiss()
                model.chooseProject()
            }
        }
        .padding(6)
        .frame(width: 300)
    }
}

private struct PickerRow: View {
    let title: String
    let subtitle: String?
    let isCurrent: Bool
    let action: () -> Void
    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(.system(size: 13, weight: isCurrent ? .semibold : .regular))
                    if let subtitle {
                        Text(subtitle)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .truncationMode(.head)
                    }
                }
                Spacer(minLength: 0)
                if isCurrent {
                    Image(systemName: "checkmark")
                        .font(.system(size: 11, weight: .semibold))
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(isHovering ? Color.primary.opacity(0.08) : Color.clear, in: RoundedRectangle(cornerRadius: 6))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
    }
}

