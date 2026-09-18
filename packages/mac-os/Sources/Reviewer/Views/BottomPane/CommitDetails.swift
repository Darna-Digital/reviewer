// The commit picked out of the history, beside the list, as the web app's
// details panel has it: its subject, its body, then its short sha, author
// and date on one line, its refs as badges, and the files it touched as a
// tree — single-child folder chains collapsed into one row, folders
// counting what is under them, files wearing their type icon and their
// status letter in its hue. A file picked opens the commit's diff on it.
import SwiftUI

struct CommitDetails: View {
    @Environment(AppModel.self) private var model
    @State private var closed: Set<String> = []

    private var history: CommitHistory { model.history }

    var body: some View {
        if let detail = history.selectedDetail {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    heading(detail)
                    files(detail)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 12)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .onChange(of: detail.sha) { _, _ in closed = [] }
        } else if let error = history.detailError {
            PanePlaceholder("Could not load this commit", symbol: "exclamationmark.triangle", detail: error)
        } else {
            ProgressView()
                .controlSize(.small)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func heading(_ detail: CommitDetail) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(detail.subject)
                .font(.system(size: 13, weight: .medium))
                .textSelection(.enabled)
            if !detail.body.isEmpty {
                Text(detail.body)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .lineSpacing(3)
                    .textSelection(.enabled)
            }
            HStack(spacing: 6) {
                Text(detail.shortSha)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(.primary.opacity(0.7))
                Text("·").foregroundStyle(.tertiary)
                Text(detail.author)
                    .lineLimit(1)
                    .help(detail.authorEmail.isEmpty ? detail.author : "\(detail.author) <\(detail.authorEmail)>")
                Text("·").foregroundStyle(.tertiary)
                Text(CommitDates.dateTime(detail.authoredAt))
                    .monospacedDigit()
            }
            .font(.system(size: 11))
            .foregroundStyle(.secondary)
            if !detail.refs.isEmpty {
                HStack(spacing: 4) {
                    ForEach(detail.refs, id: \.self) { RefBadge(ref: $0) }
                }
                .padding(.top, 2)
            }
        }
        .padding(.horizontal, 6)
    }

    private func files(_ detail: CommitDetail) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("\(detail.files.count) \(detail.files.count == 1 ? "file" : "files")")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .padding(.horizontal, 6)
                .padding(.bottom, 4)
            ForEach(CommitFileRows.rows(of: detail.files).filter { !$0.ancestors.contains(where: closed.contains) }) { row in
                switch row.kind {
                case .folder(let label, let count):
                    FolderRow(label: label, count: count, depth: row.depth, open: !closed.contains(row.path)) {
                        if closed.contains(row.path) { closed.remove(row.path) } else { closed.insert(row.path) }
                    }
                case .file(let file):
                    FileRow(file: file, depth: row.depth, selected: history.selectedFile == file.path) {
                        model.show(commitFile: file.path)
                    }
                }
            }
        }
    }
}

private struct FolderRow: View {
    let label: String
    let count: Int
    let depth: Int
    let open: Bool
    let toggle: () -> Void

    var body: some View {
        Button(action: toggle) {
            HStack(spacing: 6) {
                Image(systemName: "chevron.right")
                    .font(.system(size: 9, weight: .semibold))
                    .rotationEffect(.degrees(open ? 90 : 0))
                    .frame(width: 12)
                Text(label)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer(minLength: 8)
                Text("\(count)")
                    .font(.system(size: 11).monospacedDigit())
                    .opacity(0.6)
            }
            .font(.system(size: 12))
            .foregroundStyle(.secondary)
            .padding(.leading, 4 + CGFloat(depth) * 12)
            .padding(.trailing, 8)
            .frame(height: 26)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// A file the commit touched: its type icon, its name — struck through
/// once deleted — and its status letter in the status's own hue.
private struct FileRow: View {
    let file: CommitFile
    let depth: Int
    let selected: Bool
    let open: () -> Void
    @Environment(\.colorScheme) private var colorScheme
    @State private var isHovering = false

    private var name: String {
        file.path.split(separator: "/").last.map(String.init) ?? file.path
    }

    var body: some View {
        Button(action: open) {
            HStack(spacing: 6) {
                FileIconView(path: file.path)
                    .frame(width: 14, height: 14)
                Text(name)
                    .font(.system(size: 12))
                    .strikethrough(file.status == .deleted)
                    .foregroundStyle(file.status == .deleted ? .secondary : .primary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer(minLength: 8)
                Text(file.status.badge ?? "?")
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundStyle(file.status.color(dark: colorScheme == .dark))
            }
            .padding(.leading, 4 + CGFloat(depth) * 12)
            .padding(.trailing, 8)
            .frame(height: 26)
            .background(
                selected ? TreeSelection.color : isHovering ? Color.primary.opacity(0.05) : Color.clear,
                in: RoundedRectangle(cornerRadius: 5))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
        .help(file.oldPath.map { "\($0) → \(file.path)" } ?? file.path)
    }
}

/// The commit's files as the rows the details draw, the web panel's own
/// shaping: folders first, then files, both by name; a run of single-child
/// folders as one row named `a/b/c`; every folder counting the files under
/// it; and every row knowing the folders it stands under, so folding one
/// hides all of them.
enum CommitFileRows {
    struct Row: Identifiable {
        enum Kind {
            case folder(label: String, count: Int)
            case file(CommitFile)
        }

        let kind: Kind
        let depth: Int
        /// The row's own path — a folder's, or the file's.
        let path: String
        /// The folder rows this one stands under, outermost first.
        let ancestors: [String]

        var id: String {
            switch kind {
            case .folder: return "d:\(path)"
            case .file: return "f:\(path)"
            }
        }
    }

    private final class Node {
        let name: String
        var children: [String: Node] = [:]
        var order: [String] = []
        var file: CommitFile?

        init(name: String) { self.name = name }

        var fileCount: Int {
            file != nil ? 1 : children.values.reduce(0) { $0 + $1.fileCount }
        }

        /// The node with the single-child chain under it collapsed, and the
        /// label naming the whole chain.
        func collapsed() -> (label: String, node: Node) {
            var label = name
            var current = self
            while current.file == nil, current.children.count == 1, let only = current.children.values.first, only.file == nil {
                label += "/\(only.name)"
                current = only
            }
            return (label, current)
        }
    }

    static func rows(of files: [CommitFile]) -> [Row] {
        let root = Node(name: "")
        for file in files {
            var node = root
            let segments = file.path.split(separator: "/").map(String.init)
            for (index, segment) in segments.enumerated() {
                if node.children[segment] == nil {
                    node.children[segment] = Node(name: segment)
                    node.order.append(segment)
                }
                let child = node.children[segment]!
                if index == segments.count - 1 { child.file = file }
                node = child
            }
        }
        var rows: [Row] = []
        walk(root, depth: 0, path: "", ancestors: [], into: &rows)
        return rows
    }

    private static func walk(_ node: Node, depth: Int, path: String, ancestors: [String], into rows: inout [Row]) {
        let children = node.order.compactMap { node.children[$0] }
        let folders = children.filter { $0.file == nil }.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
        let leaves = children.filter { $0.file != nil }.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
        for folder in folders {
            let (label, deepest) = folder.collapsed()
            let folderPath = path.isEmpty ? label : "\(path)/\(label)"
            rows.append(Row(kind: .folder(label: label, count: deepest.fileCount), depth: depth, path: folderPath, ancestors: ancestors))
            walk(deepest, depth: depth + 1, path: folderPath, ancestors: ancestors + [folderPath], into: &rows)
        }
        for leaf in leaves {
            guard let file = leaf.file else { continue }
            rows.append(Row(kind: .file(file), depth: depth, path: file.path, ancestors: ancestors))
        }
    }
}
