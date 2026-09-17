// The Branches surface, laid out as the web app's branches dock is: a
// search over every branch along the top, then the switcher's own model as
// a list — Recent, Local folded by folder, Remote folded by remote, each
// section and folder collapsing on its header — with the branch you are on
// starred and the others carrying their distance from upstream. A project
// of several roots lists each root's branches under a header of its own,
// the current root's open. A row selects; a double-click checks out; the
// context menu is the switcher's, and the empty space under the rows has
// the surface's own — a new branch, update, push. The actions run in the
// root a branch belongs to, followed first when it is not the current one.
import SwiftUI

struct BranchesPane: View {
    @Environment(AppModel.self) private var model
    @State private var query = ""
    @State private var selected: String?
    /// Sections folded shut — Remote to begin with, as the switcher has it.
    @State private var closedSections: Set<String> = ["remote"]
    /// Folders opened, everything else being shut to begin with.
    @State private var openFolders: Set<String> = []
    /// Roots opened or shut by hand; until then the current root is open.
    @State private var openRoots: Set<String>?

    private var searching: Bool { !query.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        VStack(spacing: 0) {
            PaneBar {
                PaneFilterField(prompt: "Search branches", text: $query)
                    .frame(maxWidth: 320)
                Spacer(minLength: 0)
            }
            list
        }
        .task(id: model.workspace?.current) { await model.loadBranches() }
    }

    private var rows: [BranchRow] {
        if model.projectBranches.count > 1 {
            return model.projectBranches.flatMap(rows(of:))
        }
        return sectionRows(
            prefix: "", scope: BranchScope(repoPath: nil, head: model.currentBranch ?? "—"),
            local: model.branches, remote: model.remoteBranches)
    }

    private var currentRoots: Set<String> {
        openRoots ?? Set([model.workspace?.current].compactMap { $0 })
    }

    private func rows(of entry: RepoBranches) -> [BranchRow] {
        let path = entry.repo.path
        let open = searching || currentRoots.contains(path)
        let header = BranchRow.repo(entry, open: open)
        guard open else { return [header] }
        return [header] + sectionRows(
            prefix: "\(path):", scope: BranchScope(repoPath: path, head: entry.repo.branch ?? "—"),
            local: entry.branches, remote: entry.remoteBranches)
    }

    /// Recent, Local and Remote for one root. A search opens every section
    /// and folder, since the match may be inside a folded one.
    private func sectionRows(prefix: String, scope: BranchScope, local: [BranchInfo], remote: [RemoteBranchInfo])
        -> [BranchRow]
    {
        let indent = scope.repoPath == nil ? 0 : 1
        let locals = local.filter { matches($0.name) }
        let remotes = remote.filter { matches($0.name) }
        let recent = Array(locals.prefix(5))
        var rows: [BranchRow] = []
        rows += section("\(prefix)recent", title: "Recent", indent: indent, count: recent.count) {
            recent.map { .branch(BranchRef($0), name: $0.name, scope: scope, indent: indent + 1, trailing: distance(of: $0)) }
        }
        rows += section("\(prefix)local", title: "Local", indent: indent, count: locals.count) {
            foldered("\(prefix)local", indent: indent, refs: locals.map(BranchRef.init), scope: scope) { ref in
                local.first { $0.name == ref.ref }.flatMap(distance(of:))
            }
        }
        rows += section("\(prefix)remote", title: "Remote", indent: indent, count: remotes.count) {
            foldered("\(prefix)remote", indent: indent, refs: remotes.map(BranchRef.init), scope: scope) { ref in
                remote.first { $0.name == ref.ref }?.remote
            }
        }
        return rows
    }

    private func section(_ id: String, title: String, indent: Int, count: Int, children: () -> [BranchRow]) -> [BranchRow] {
        guard count > 0 else { return [] }
        let open = searching || !closedSections.contains(id)
        let header = BranchRow.section(id: id, title: title, count: count, open: open, indent: indent)
        return open ? [header] + children() : [header]
    }

    /// A section's branches folded by folder.
    private func foldered(
        _ section: String, indent: Int, refs: [BranchRef], scope: BranchScope, trailing: (BranchRef) -> String?
    ) -> [BranchRow] {
        refs.groupedByFolder().flatMap { folder -> [BranchRow] in
            guard let name = folder.name else {
                return folder.items.map { .branch($0, name: $0.display, scope: scope, indent: indent + 1, trailing: trailing($0)) }
            }
            let id = "\(section)/\(name)"
            let open = searching || openFolders.contains(id)
            let header = BranchRow.folder(id: id, name: name, open: open, indent: indent + 1)
            guard open else { return [header] }
            return [header] + folder.items.map {
                .branch($0, name: $0.leaf, scope: scope, indent: indent + 2, trailing: trailing($0))
            }
        }
    }

    private func toggleSection(_ id: String) {
        if closedSections.contains(id) { closedSections.remove(id) } else { closedSections.insert(id) }
    }

    private func toggleFolder(_ id: String) {
        if openFolders.contains(id) { openFolders.remove(id) } else { openFolders.insert(id) }
    }

    private func toggleRoot(_ path: String) {
        var roots = currentRoots
        if roots.contains(path) { roots.remove(path) } else { roots.insert(path) }
        openRoots = roots
    }

    private func matches(_ name: String) -> Bool {
        let needle = query.trimmingCharacters(in: .whitespaces)
        return needle.isEmpty || name.localizedCaseInsensitiveContains(needle)
    }

    private func distance(of branch: BranchInfo) -> String? {
        var parts: [String] = []
        if branch.ahead > 0 { parts.append("↑\(branch.ahead)") }
        if branch.behind > 0 { parts.append("↓\(branch.behind)") }
        return parts.isEmpty ? nil : parts.joined(separator: " ")
    }

    private var list: some View {
        let rows = rows
        return List(selection: $selected) {
            ForEach(rows) { row in
                switch row {
                case .repo(let entry, let open):
                    RepoHeader(entry: entry, open: open, current: entry.repo.path == model.workspace?.current) {
                        toggleRoot(entry.repo.path)
                    }
                    .headerRow()
                case .section(let id, let title, let count, let open, let indent):
                    SectionHeader(title: title, count: count, open: open, indent: indent) { toggleSection(id) }
                        .headerRow()
                case .folder(let id, let name, let open, let indent):
                    FolderHeader(name: name, open: open, indent: indent) { toggleFolder(id) }
                        .headerRow()
                case .branch(let ref, let name, let scope, let indent, let trailing):
                    BranchRowView(branch: ref, name: name, trailing: trailing, indent: indent)
                        .tag(row.id)
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 1, leading: 8, bottom: 1, trailing: 8))
                        .contextMenu { BranchActions(branch: ref, scope: scope) }
                        .onTapGesture(count: 2) {
                            guard !ref.isCurrent else { return }
                            model.inRepo(scope.repoPath) { model.checkout(ref.ref) }
                        }
                }
            }
        }
        .listStyle(.inset)
        .scrollContentBackground(.hidden)
        .contextMenu {
            Button("New Branch…") { model.branchPrompt = .create(startPoint: nil) }
            Divider()
            Button("Update") { model.fetch() }
            Button("Push…") { model.push() }
        }
        .overlay {
            if rows.isEmpty {
                if searching {
                    PanePlaceholder("No branches match “\(query.trimmingCharacters(in: .whitespaces))”",
                                    symbol: "magnifyingglass")
                } else {
                    PanePlaceholder("No branches", symbol: "arrow.triangle.branch")
                }
            }
        }
    }
}

/// One line of the surface: a root's header, a section's, a folder's, or
/// a branch, each knowing how deep it stands.
private enum BranchRow: Identifiable {
    case repo(RepoBranches, open: Bool)
    case section(id: String, title: String, count: Int, open: Bool, indent: Int)
    case folder(id: String, name: String, open: Bool, indent: Int)
    case branch(BranchRef, name: String, scope: BranchScope, indent: Int, trailing: String?)

    var id: String {
        switch self {
        case .repo(let entry, _): return "repo:\(entry.repo.path)"
        case .section(let id, _, _, _, _): return "section:\(id)"
        case .folder(let id, _, _, _): return "folder:\(id)"
        case .branch(let ref, _, let scope, _, _): return "branch:\(scope.repoPath ?? ""):\(ref.ref)"
        }
    }
}

private extension View {
    /// A header stands in the list but is not a row of it: it cannot be
    /// selected, and it draws no rule.
    func headerRow() -> some View {
        self
            .selectionDisabled()
            .listRowSeparator(.hidden)
            .listRowInsets(EdgeInsets(top: 1, leading: 8, bottom: 1, trailing: 8))
    }
}

private struct Chevron: View {
    let open: Bool

    var body: some View {
        Image(systemName: "chevron.right")
            .font(.system(size: 9, weight: .semibold))
            .foregroundStyle(.secondary)
            .rotationEffect(.degrees(open ? 90 : 0))
            .frame(width: 12)
    }
}

/// A section's header: the chevron, its name, and how many it holds.
private struct SectionHeader: View {
    let title: String
    let count: Int
    let open: Bool
    let indent: Int
    let toggle: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            Chevron(open: open)
            Text(title)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
            Text("\(count)")
                .font(.system(size: 11))
                .foregroundStyle(.tertiary)
            Spacer(minLength: 0)
        }
        .padding(.leading, CGFloat(indent) * 14)
        .frame(height: 26)
        .contentShape(Rectangle())
        .onTapGesture(perform: toggle)
    }
}

/// A folder of branches: the chevron, the folder, its name.
private struct FolderHeader: View {
    let name: String
    let open: Bool
    let indent: Int
    let toggle: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            Chevron(open: open)
            Image(systemName: "folder")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .frame(width: 14)
            Text(name)
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Spacer(minLength: 0)
        }
        .padding(.leading, CGFloat(indent) * 14)
        .frame(height: 26)
        .contentShape(Rectangle())
        .onTapGesture(perform: toggle)
    }
}

/// One root of a project of several: its avatar and name, and the branch it
/// is on at the trailing edge.
private struct RepoHeader: View {
    let entry: RepoBranches
    let open: Bool
    let current: Bool
    let toggle: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            Chevron(open: open)
            RepoAvatar(name: entry.repo.name)
            Text(entry.repo.name)
                .font(.system(size: 12, weight: current ? .medium : .regular))
                .lineLimit(1)
            Spacer(minLength: 8)
            Text(entry.repo.branch ?? "detached")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(maxWidth: 200, alignment: .trailing)
        }
        .frame(height: 28)
        .contentShape(Rectangle())
        .onTapGesture(perform: toggle)
    }
}

/// A branch: starred while it is the one you are on, a branch mark
/// otherwise; its name; and at the trailing edge how far it stands from
/// upstream, or the remote it is on.
private struct BranchRowView: View {
    let branch: BranchRef
    let name: String
    let trailing: String?
    let indent: Int

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: branch.isCurrent ? "star.fill" : "arrow.triangle.branch")
                .font(.system(size: 11))
                .foregroundStyle(branch.isCurrent ? Color.orange : Color.secondary)
                .frame(width: 14)
            Text(name)
                .font(.system(size: 12, weight: branch.isCurrent ? .medium : .regular))
                .lineLimit(1)
                .truncationMode(.middle)
            Spacer(minLength: 8)
            if let trailing {
                DistanceLabel(distance: trailing, remote: branch.isRemote)
            }
        }
        .padding(.leading, CGFloat(indent) * 14)
        .frame(height: 26)
        .contentShape(Rectangle())
    }
}

/// `↑2 ↓1` in the outgoing and incoming hues, or a remote's name.
private struct DistanceLabel: View {
    let distance: String
    let remote: Bool

    var body: some View {
        if remote {
            Text(distance)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
        } else {
            HStack(spacing: 4) {
                ForEach(distance.split(separator: " ").map(String.init), id: \.self) { part in
                    Text(part)
                        .font(.system(size: 11).monospacedDigit())
                        .foregroundStyle(part.hasPrefix("↑") ? Color.green : Color.blue)
                }
            }
        }
    }
}

/// The square initials badge a root is known by, the web app's own: its
/// initials on a hue picked from its name.
struct RepoAvatar: View {
    let name: String

    private static let palette = [
        "#4c79ff", "#16a34a", "#d4861a", "#9333ea", "#dc2626", "#0891b2", "#db2777", "#65a30d",
    ]

    var body: some View {
        Text(Self.initials(of: name))
            .font(.system(size: 8, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: 16, height: 16)
            .background(Color(hex: Self.hue(of: name)), in: RoundedRectangle(cornerRadius: 3))
    }

    static func initials(of name: String) -> String {
        let words = name.split { " -_./".contains($0) }.filter { !$0.isEmpty }
        if words.isEmpty { return String(name.prefix(2)).uppercased() }
        if words.count == 1 { return String(words[0].prefix(2)).uppercased() }
        return String([words[0].first, words[1].first].compactMap { $0 }).uppercased()
    }

    static func hue(of name: String) -> String {
        var hash: Int32 = 0
        for scalar in name.utf16 {
            hash = hash &* 31 &+ Int32(scalar)
        }
        return palette[Int(hash.magnitude) % palette.count]
    }
}
