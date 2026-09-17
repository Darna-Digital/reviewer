// The window tabs, in the toolbar: Code and Sessions as icons, each session
// by its title, and the mark that mints one — the same row the web app's
// window bar draws, on the window's own bar. The project chip is here too,
// for the sidebar to lead with.
import SwiftUI

struct TabStrip: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        HStack(spacing: 2) {
            ForEach(model.tabs) { tab in
                TabItem(tab: tab, isSelected: tab.id == model.selectedTabId)
            }
            Button { model.newSession() } label: {
                Image(systemName: "plus")
                    .font(.system(size: 12, weight: .medium))
                    .frame(width: 26, height: 26)
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)
            .help("New Session")
            .disabled(!model.hasProject)
        }
    }
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

private struct TabItem: View {
    let tab: WindowTab
    let isSelected: Bool
    @Environment(AppModel.self) private var model
    @State private var isHovering = false

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: tab.symbol)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(isSelected ? .primary : .secondary)
            if !tab.isPinned {
                Text(model.title(of: tab))
                    .font(.system(size: 12, weight: isSelected ? .medium : .regular))
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .foregroundStyle(isSelected ? .primary : .secondary)
                    .frame(maxWidth: 180, alignment: .leading)
                closeButton
            }
        }
        .padding(.horizontal, tab.isPinned ? 8 : 10)
        .frame(height: 28)
        .background(
            isSelected ? Color.primary.opacity(0.12) : isHovering ? Color.primary.opacity(0.06) : Color.clear,
            in: RoundedRectangle(cornerRadius: 7))
        .contentShape(Rectangle())
        .onTapGesture { model.select(tabId: tab.id) }
        .onHover { isHovering = $0 }
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

    private var closeButton: some View {
        Button {
            model.closeTab(id: tab.id)
        } label: {
            Image(systemName: "xmark")
                .font(.system(size: 9, weight: .bold))
                .frame(width: 16, height: 16)
                .background(isHovering ? Color.primary.opacity(0.1) : Color.clear, in: RoundedRectangle(cornerRadius: 4))
        }
        .buttonStyle(.plain)
        .foregroundStyle(.secondary)
        .opacity(isHovering || isSelected ? 1 : 0)
        .help("Close tab")
    }
}
