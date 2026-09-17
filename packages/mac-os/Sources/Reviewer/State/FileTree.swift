// The sidebar's file tree, folded from the flat project-relative path list the
// server returns. Folders come first, then files, each group sorted the way
// Finder sorts (case-insensitive, numbers in natural order), and a file carries
// its git status so the tree can tint modified and untracked entries.
import Foundation

struct FileNode: Identifiable, Hashable, Sendable {
    /// The project-relative path — also what the file endpoints take.
    let path: String
    let name: String
    let status: GitFileStatus?
    /// `nil` for a file, which is what `OutlineGroup` reads as "no disclosure".
    let children: [FileNode]?

    var id: String { path }
    var isDirectory: Bool { children != nil }
}

enum FileTree {
    static func build(paths: [String], gitStatus: [GitStatusEntry]) -> [FileNode] {
        let status = Dictionary(gitStatus.map { ($0.path, $0.status) }, uniquingKeysWith: { first, _ in first })
        let root = Folder()
        for path in paths {
            root.insert(path.split(separator: "/").map(String.init), fullPath: path)
        }
        return root.nodes(prefix: "", status: status)
    }

    /// A mutable scratch trie; the immutable `FileNode` tree is produced once
    /// every path is in, so sorting happens per folder exactly once.
    private final class Folder {
        var folders: [String: Folder] = [:]
        var files: [String: String] = [:]

        func insert(_ components: [String], fullPath: String) {
            guard let head = components.first else { return }
            if components.count == 1 {
                files[head] = fullPath
                return
            }
            let child = folders[head] ?? Folder()
            folders[head] = child
            child.insert(Array(components.dropFirst()), fullPath: fullPath)
        }

        func nodes(prefix: String, status: [String: GitFileStatus]) -> [FileNode] {
            let folderNodes = folders.keys.sorted(by: finderOrder).map { name in
                let path = prefix.isEmpty ? name : "\(prefix)/\(name)"
                return FileNode(
                    path: path, name: name, status: nil,
                    children: folders[name]!.nodes(prefix: path, status: status))
            }
            let fileNodes = files.keys.sorted(by: finderOrder).map { name in
                let path = files[name]!
                return FileNode(path: path, name: name, status: status[path], children: nil)
            }
            return folderNodes + fileNodes
        }
    }

    private static func finderOrder(_ a: String, _ b: String) -> Bool {
        a.localizedStandardCompare(b) == .orderedAscending
    }
}
