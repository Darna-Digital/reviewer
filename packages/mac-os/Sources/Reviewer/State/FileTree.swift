// The shape of a file listing, the way the web app's tree lays it out: paths
// nested into folders, folders before files and each level in Finder's
// order, and a run of folders holding nothing but the next folded into one
// row — `src/lib/api` — so a deep package does not cost three clicks to open.
// A path ending in `/` is a folder with nothing in it yet.
//
// A node is a reference: the outline view keys its rows, its folds and its
// selection on the item it was handed, and identity is the one comparison
// that stays cheap on a folder holding the whole project. Nothing changes
// once built; a new listing is a new tree.
import Foundation

final class FileTreeNode: Identifiable, Hashable, @unchecked Sendable {
    /// The path, `/`-free — for a folded run of folders, the innermost's.
    let id: String
    /// What the row says: the last component, or the folded run joined.
    let name: String
    let isDirectory: Bool
    let children: [FileTreeNode]
    /// For the header a workspace stands each of its repositories under,
    /// the repository it is (see `SidebarTree.isMultiRoot`); nil for a
    /// file or a folder.
    let root: TreeRoot?

    init(id: String, name: String, isDirectory: Bool, children: [FileTreeNode], root: TreeRoot? = nil) {
        self.id = id
        self.name = name
        self.isDirectory = isDirectory
        self.children = children
        self.root = root
    }

    static func == (lhs: FileTreeNode, rhs: FileTreeNode) -> Bool { lhs === rhs }

    func hash(into hasher: inout Hasher) { hasher.combine(ObjectIdentifier(self)) }
}

enum FileTree {
    /// The tree of `paths`, each node's id under `prefix` when there is one
    /// — a repository's own tree, beneath its header in a workspace.
    static func build(paths: [String], prefix: String? = nil) -> [FileTreeNode] {
        let root = Draft(name: "")
        for path in paths {
            let isDirectory = path.hasSuffix("/")
            let components = path.split(separator: "/").map(String.init)
            guard !components.isEmpty else { continue }
            var cursor = root
            for (index, component) in components.enumerated() {
                let last = index == components.count - 1
                cursor = cursor.child(named: component, directory: !last || isDirectory)
            }
        }
        let under = prefix.map { "\($0)/" } ?? ""
        return root.children.values
            .map { child in child.finished(path: under + child.name) }
            .sorted(by: ordered)
    }

    /// Every node by its path, for what a row's menu needs to know about it.
    static func index(_ roots: [FileTreeNode]) -> [String: FileTreeNode] {
        var nodes: [String: FileTreeNode] = [:]
        func walk(_ list: [FileTreeNode]) {
            for node in list {
                nodes[node.id] = node
                walk(node.children)
            }
        }
        walk(roots)
        return nodes
    }

    /// The tree cut down to the files whose path holds `query`, with the
    /// folders on the way to them — what a search shows, every fold open.
    static func filter(_ roots: [FileTreeNode], matching query: String) -> [FileTreeNode] {
        let needle = query.trimmingCharacters(in: .whitespaces)
        guard !needle.isEmpty else { return roots }
        func keep(_ node: FileTreeNode) -> FileTreeNode? {
            if node.isDirectory {
                let kept = node.children.compactMap(keep)
                return kept.isEmpty
                    ? nil : FileTreeNode(id: node.id, name: node.name, isDirectory: true, children: kept, root: node.root)
            }
            return node.id.localizedCaseInsensitiveContains(needle) ? node : nil
        }
        return roots.compactMap(keep)
    }

    /// `a/b/c.ts` → `a`, `a/b`: the folders that must be open for it to show.
    static func ancestors(of path: String) -> [String] {
        let components = path.split(separator: "/").dropLast()
        var prefix = ""
        return components.map { component in
            prefix = prefix.isEmpty ? String(component) : "\(prefix)/\(component)"
            return prefix
        }
    }

    private static func ordered(_ a: FileTreeNode, _ b: FileTreeNode) -> Bool {
        if a.isDirectory != b.isDirectory { return a.isDirectory }
        return a.name.localizedStandardCompare(b.name) == .orderedAscending
    }

    private final class Draft {
        let name: String
        var isDirectory = false
        var children: [String: Draft] = [:]

        init(name: String) { self.name = name }

        func child(named name: String, directory: Bool) -> Draft {
            let child = children[name] ?? Draft(name: name)
            child.isDirectory = child.isDirectory || directory
            children[name] = child
            return child
        }

        func finished(path: String) -> FileTreeNode {
            guard isDirectory else {
                return FileTreeNode(id: path, name: name, isDirectory: false, children: [])
            }
            var run = self
            var runPath = path
            var runName = name
            while run.children.count == 1, let only = run.children.values.first, only.isDirectory {
                run = only
                runPath += "/\(only.name)"
                runName += "/\(only.name)"
            }
            let children = run.children.values.map { $0.finished(path: "\(runPath)/\($0.name)") }.sorted(by: ordered)
            return FileTreeNode(id: runPath, name: runName, isDirectory: true, children: children)
        }
    }
}
