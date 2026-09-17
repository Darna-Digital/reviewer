// The native sidebar: the project and branch pickers over the project tree,
// on the system's sidebar material running the full height of the window. Picking
// a file sends the code island to it; a file the island opens on its own —
// from a diff, a search — highlights here, so the row and the page always
// name the same file.
import SwiftUI

struct SidebarView: View {
    @Environment(AppModel.self) private var model
    @State private var filter = ""

    var body: some View {
        List(selection: selection) {
            Section(model.workspace?.projectName ?? "Files") {
                if model.isLoadingFiles && model.fileTree.isEmpty {
                    ProgressView().controlSize(.small)
                }
                OutlineGroup(FileTree.filter(model.fileTree, query: filter), children: \.children) { node in
                    FileRow(node: node)
                        .tag(node.isDirectory ? "dir:\(node.path)" : node.path)
                }
            }
        }
        .listStyle(.sidebar)
        .safeAreaInset(edge: .top, spacing: 0) {
            HStack(spacing: 6) {
                ProjectChip()
                BranchPicker()
                    .layoutPriority(-1)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 10)
            .padding(.bottom, 6)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { filterField }
    }

    /// The filter, at the foot of the tree the way Xcode's navigator has it.
    private var filterField: some View {
        HStack(spacing: 6) {
            Image(systemName: "line.3.horizontal.decrease.circle")
                .foregroundStyle(.secondary)
            TextField("Filter", text: $filter)
                .textFieldStyle(.plain)
            if !filter.isEmpty {
                Button { filter = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
        }
        .font(.callout)
        .padding(.horizontal, 8)
        .frame(height: 26)
        .background(.quaternary.opacity(0.5), in: Capsule())
        .padding(8)
    }

    /// Folders carry a tag too so the disclosure rows highlight when clicked,
    /// but only a file is opened.
    private var selection: Binding<String?> {
        Binding(
            get: { model.openFilePath },
            set: { path in
                guard let path, !path.hasPrefix("dir:") else { return }
                model.openFile(path: path)
            })
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
