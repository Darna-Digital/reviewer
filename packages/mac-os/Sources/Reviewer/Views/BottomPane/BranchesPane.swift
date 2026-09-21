// The Branches surface, laid out as the web app's branches dock is: a
// search over every branch along the top — the field Terminal and Run
// carry, at the bar's leading edge — then the switcher's own model as
// a list — Recent, Local folded by folder, Remote folded by remote, each
// section and folder collapsing on its header — with the branch you are on
// starred and the others carrying their distance from upstream. A row
// selects; a double-click checks out; the context menu is the switcher's,
// and the empty space under the rows has the surface's own — a new branch,
// update, push.
import SwiftUI

struct BranchesPane: View {
    @Environment(AppModel.self) private var model
    @State private var query = ""
    @State private var selected: String?
    /// Sections folded shut — Remote to begin with, as the switcher has it.
    @State private var closedSections: Set<String> = ["remote"]
    /// Folders opened, everything else being shut to begin with.
    @State private var openFolders: Set<String> = []

    private var searching: Bool { !query.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        VStack(spacing: 0) {
            PaneBar {
                PaneSearchField(prompt: "Search", text: $query)
                    .frame(width: PaneMetrics.toolbarSearchWidth)
                Spacer(minLength: 0)
            }
            list
        }
        .task(id: model.workspace?.project) { await model.loadBranches() }
    }

    private var rows: [BranchRow] {
        sectionRows(local: model.branches, remote: model.remoteBranches)
    }

    /// Recent, Local and Remote. A search opens every section and folder,
    /// since the match may be inside a folded one.
    private func sectionRows(local: [BranchInfo], remote: [RemoteBranchInfo]) -> [BranchRow] {
        let indent = 0
        let locals = local.filter { matches($0.name) }
        let remotes = remote.filter { matches($0.name) }
        let recent = Array(locals.prefix(5))
        var rows: [BranchRow] = []
        rows += section("recent", title: "Recent", indent: indent, count: recent.count) {
            recent.map { .branch(BranchRef($0), in: "recent", name: $0.name, indent: indent + 1, trailing: distance(of: $0)) }
        }
        rows += section("local", title: "Local", indent: indent, count: locals.count) {
            foldered("local", indent: indent, refs: locals.map(BranchRef.init)) { ref in
                local.first { $0.name == ref.ref }.flatMap(distance(of:))
            }
        }
        rows += section("remote", title: "Remote", indent: indent, count: remotes.count) {
            foldered("remote", indent: indent, refs: remotes.map(BranchRef.init)) { ref in
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
        _ section: String, indent: Int, refs: [BranchRef], trailing: (BranchRef) -> String?
    ) -> [BranchRow] {
        refs.groupedByFolder().flatMap { folder -> [BranchRow] in
            guard let name = folder.name else {
                return folder.items.map {
                    .branch($0, in: section, name: $0.display, indent: indent + 1, trailing: trailing($0))
                }
            }
            let id = "\(section)/\(name)"
            let open = searching || openFolders.contains(id)
            let header = BranchRow.folder(id: id, name: name, open: open, indent: indent + 1)
            guard open else { return [header] }
            return [header] + folder.items.map {
                .branch($0, in: section, name: $0.leaf, indent: indent + 2, trailing: trailing($0))
            }
        }
    }

    private func toggleSection(_ id: String) {
        if closedSections.contains(id) { closedSections.remove(id) } else { closedSections.insert(id) }
    }

    private func toggleFolder(_ id: String) {
        if openFolders.contains(id) { openFolders.remove(id) } else { openFolders.insert(id) }
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
                case .section(let id, let title, let count, let open, let indent):
                    SectionHeader(title: title, count: count, open: open, indent: indent) { toggleSection(id) }
                        .headerRow()
                case .folder(let id, let name, let open, let indent):
                    FolderHeader(name: name, open: open, indent: indent) { toggleFolder(id) }
                        .headerRow()
                case .branch(let ref, _, let name, let indent, let trailing):
                    BranchRowView(branch: ref, name: name, trailing: trailing, indent: indent)
                        .tag(row.id)
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets())
                        .contextMenu { BranchActions(branch: ref) }
                        .onTapGesture(count: 2) {
                            guard !ref.isCurrent else { return }
                            model.checkout(ref.ref)
                        }
                }
            }
        }
        .listStyle(.plain)
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

/// One line of the surface: a section's header, a folder's, or a branch,
/// each knowing how deep it stands. A branch is keyed by the section it
/// stands in as well as its ref, since Recent repeats Local's branches and
/// the list's diff misplaces rows whose ids collide.
private enum BranchRow: Identifiable {
    case section(id: String, title: String, count: Int, open: Bool, indent: Int)
    case folder(id: String, name: String, open: Bool, indent: Int)
    case branch(BranchRef, in: String, name: String, indent: Int, trailing: String?)

    var id: String {
        switch self {
        case .section(let id, _, _, _, _): return "section:\(id)"
        case .folder(let id, _, _, _): return "folder:\(id)"
        case .branch(let ref, let section, _, _, _): return "branch:\(section):\(ref.ref)"
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
            .listRowInsets(EdgeInsets())
    }
}

/// One line of the outline, laid out as the sidebar's `NSOutlineView` lays
/// its rows: a level in per level of depth, then the disclosure slot —
/// the chevron for a row that folds, kept empty for one that does not, so
/// a folder and a branch beside it start their icons on one line and a
/// child's icon stands one level in from its parent's label — then the
/// row's own content. A row that folds toggles on a click; a leaf takes
/// no gesture of its own, so the list's selection gets the click.
private struct OutlineRow<Content: View>: View {
    let indent: Int
    let open: Bool?
    let toggle: (() -> Void)?
    @ViewBuilder let content: Content

    init(indent: Int, open: Bool? = nil, toggle: (() -> Void)? = nil, @ViewBuilder content: () -> Content) {
        self.indent = indent
        self.open = open
        self.toggle = toggle
        self.content = content()
    }

    var body: some View {
        let row = HStack(spacing: 6) {
            Chevron(open: open)
            content
        }
        .padding(.leading, CGFloat(indent) * PaneMetrics.indentUnit)
        .frame(height: PaneMetrics.rowHeight)
        .contentShape(Rectangle())
        if let toggle {
            row.onTapGesture(perform: toggle)
        } else {
            row
        }
    }
}

/// The disclosure slot: a chevron turned down while open, or the same
/// width of nothing for a row that has nothing to fold.
private struct Chevron: View {
    let open: Bool?

    var body: some View {
        Group {
            if let open {
                Image(systemName: "chevron.right")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .rotationEffect(.degrees(open ? 90 : 0))
            } else {
                Color.clear
            }
        }
        .frame(width: 12, height: 12)
    }
}

/// The glyph a row is known by — a branch, a star, a folder — in one
/// square, so the labels after them line up whatever the symbol's width.
private struct RowGlyph: View {
    let symbol: String
    var tint: Color = .secondary

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: 11))
            .foregroundStyle(tint)
            .frame(width: PaneMetrics.indentUnit, height: PaneMetrics.indentUnit)
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
        OutlineRow(indent: indent, open: open, toggle: toggle) {
            Text(title)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
            Text("\(count)")
                .font(.system(size: 11).monospacedDigit())
                .foregroundStyle(.tertiary)
            Spacer(minLength: 0)
        }
    }
}

/// A folder of branches: the chevron, the folder, its name.
private struct FolderHeader: View {
    let name: String
    let open: Bool
    let indent: Int
    let toggle: () -> Void

    var body: some View {
        OutlineRow(indent: indent, open: open, toggle: toggle) {
            RowGlyph(symbol: "folder")
            Text(name)
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Spacer(minLength: 0)
        }
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
        OutlineRow(indent: indent) {
            RowGlyph(symbol: branch.isCurrent ? "star.fill" : "arrow.triangle.branch",
                     tint: branch.isCurrent ? .orange : .secondary)
            Text(name)
                .font(.system(size: 12, weight: branch.isCurrent ? .medium : .regular))
                .lineLimit(1)
                .truncationMode(.middle)
            Spacer(minLength: 8)
            if let trailing {
                DistanceLabel(distance: trailing, remote: branch.isRemote)
            }
        }
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
/// initials on a hue picked from its name. The chips and rows wear it at
/// 16pt; the welcome's recents at twice that, the lettering and the
/// corner scaled with it.
struct RepoAvatar: View {
    let name: String
    var size: CGFloat = 16

    private static let palette = [
        "#4c79ff", "#16a34a", "#d4861a", "#9333ea", "#dc2626", "#0891b2", "#db2777", "#65a30d",
    ]

    var body: some View {
        Text(Self.initials(of: name))
            .font(.system(size: size / 2, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(Color(hex: Self.hue(of: name)), in: RoundedRectangle(cornerRadius: size * 3 / 16))
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
