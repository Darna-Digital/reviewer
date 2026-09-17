// The native sidebar: agent sessions on top, the project tree beneath. Both
// are rows of one `List` so the system sidebar styling, selection highlight
// and keyboard navigation apply to everything; the selection is the tab id,
// which is how picking a row opens (or switches to) its tab, and how
// switching tabs from the strip highlights the matching row.
import SwiftUI

struct SidebarView: View {
    @Environment(AppModel.self) private var model
    @State private var agentsExpanded = true
    @State private var filesExpanded = true

    /// The sessions list is long-lived and project-wide; the sidebar shows
    /// only the newest few so the tree stays within reach, and a session
    /// already open in a tab stays listed however old it is.
    private static let recentSessionLimit = 8

    private var visibleChats: [ChatSummary] {
        let recent = model.chats.prefix(Self.recentSessionLimit)
        let open = model.chats.filter { model.sessions[$0.id] != nil && !recent.contains($0) }
        return Array(recent) + open
    }

    var body: some View {
        List(selection: selection) {
            Section("Agents", isExpanded: $agentsExpanded) {
                if model.chats.isEmpty {
                    Text(model.hasProject ? "No sessions yet" : "Open a project to start one")
                        .foregroundStyle(.secondary)
                        .font(.callout)
                }
                ForEach(visibleChats) { chat in
                    ChatRow(chat: chat)
                        .tag(EditorTab.chatId(chat.id))
                        .contextMenu {
                            Button("Delete Session", role: .destructive) {
                                Task { await model.deleteChat(id: chat.id) }
                            }
                        }
                }
            }
            Section(model.workspace?.projectName ?? "Files", isExpanded: $filesExpanded) {
                if model.isLoadingFiles && model.fileTree.isEmpty {
                    ProgressView().controlSize(.small)
                }
                OutlineGroup(model.fileTree, children: \.children) { node in
                    FileRow(node: node)
                        .tag(node.isDirectory ? "dir:\(node.path)" : EditorTab.fileId(node.path))
                }
            }
        }
        .listStyle(.sidebar)
    }

    /// Folders carry a tag too so the disclosure rows highlight when clicked,
    /// but only a file or session tag becomes a tab.
    private var selection: Binding<String?> {
        Binding(
            get: { model.selectedTabId },
            set: { id in
                guard let id, !id.hasPrefix("dir:") else { return }
                model.activate(tabId: id)
            })
    }
}

struct ChatRow: View {
    let chat: ChatSummary

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: chat.turnState == .running ? "circle.dotted.circle" : "bubble.left.and.text.bubble.right")
                .foregroundStyle(chat.turnState == .running ? Color.accentColor : Color.secondary)
                .symbolEffect(.pulse, isActive: chat.turnState == .running)
            VStack(alignment: .leading, spacing: 2) {
                Text(chat.title.isEmpty ? "Untitled session" : chat.title)
                    .lineLimit(1)
                Text("\(chat.provider.rawValue) · \(chat.branch)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            if chat.turnState == .error {
                Image(systemName: "exclamationmark.circle")
                    .foregroundStyle(.red)
            }
        }
    }
}

struct FileRow: View {
    let node: FileNode

    var body: some View {
        Label {
            Text(node.name)
                .foregroundStyle(tint)
        } icon: {
            Image(systemName: node.isDirectory ? "folder" : FileIcons.symbol(for: node.name))
                .foregroundStyle(node.isDirectory ? Color.accentColor : Color.secondary)
        }
    }

    private var tint: Color {
        switch node.status {
        case .modified, .renamed: return .orange
        case .added, .untracked: return .green
        case .deleted: return .red
        case .ignored: return .secondary
        case nil: return .primary
        }
    }
}

enum FileIcons {
    static func symbol(for name: String) -> String {
        switch (name as NSString).pathExtension.lowercased() {
        case "swift", "ts", "tsx", "js", "jsx", "rb", "py", "go", "rs", "c", "h", "cpp", "m", "java", "kt":
            return "chevron.left.forwardslash.chevron.right"
        case "md", "txt", "rst":
            return "doc.text"
        case "json", "yaml", "yml", "toml", "plist":
            return "curlybraces"
        case "png", "jpg", "jpeg", "gif", "webp", "svg", "icns":
            return "photo"
        case "sh", "zsh", "bash":
            return "terminal"
        case "lock":
            return "lock"
        default:
            return "doc"
        }
    }
}
