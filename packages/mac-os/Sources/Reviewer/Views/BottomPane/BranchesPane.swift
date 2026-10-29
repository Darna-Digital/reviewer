// The Branches surface, laid out as Xcode's Source Control navigator is:
// every repository of the workspace at the outline's top level — its
// avatar, its name, the branch it is on — and under each the switcher's own
// model, Recent, Local folded by folder and Remote folded by remote, each
// repository, section and folder collapsing on its header, with the branch
// a repository is on starred and the others carrying their distance from
// upstream. A workspace of one repository goes straight to its sections.
// The bar over the list holds a new branch, update and push for the
// repository the page is on, and the filter over every branch. A row
// selects; a double-click checks the branch out in its repository; a right
// click turns the page to that repository and opens the switcher's own row
// menu at the pointer (see `BranchActionMenu`), and the empty space under
// the rows has the surface's context menu — a new branch, update, push.
import ReviewerShared
import SwiftUI

struct BranchesPane: View {
    @Environment(AppModel.self) private var model
    @Environment(BottomPaneQueries.self) private var queries
    @State private var selected: String?
    /// The repositories, sections and folders whose disclosure was turned
    /// from how they start: every repository and section open but Remote,
    /// every folder shut.
    @State private var flipped: Set<String> = []

    private var query: String { queries.branches }
    private var searching: Bool { !query.trimmingCharacters(in: .whitespaces).isEmpty }
    private var multiRoot: Bool { model.roots.count > 1 }
    private var focusedName: String { model.focusedRoot?.name ?? "the repository" }

    var body: some View {
        @Bindable var queries = queries
        VStack(spacing: 0) {
            PaneBar {
                PaneBarButton(symbol: "plus", help: multiRoot ? "New branch in \(focusedName)…" : "New branch…") {
                    model.branchPrompt = .create(startPoint: nil)
                }
                PaneBarSeparator()
                PaneBarButton(symbol: "arrow.down", help: multiRoot ? "Update \(focusedName)" : "Update") { model.fetch() }
                PaneBarButton(symbol: "arrow.up", help: multiRoot ? "Push \(focusedName)…" : "Push…") { model.push() }
                Spacer(minLength: 0)
                PaneFilterField(text: $queries.branches)
            }
            list
        }
        .task(id: model.roots.map(\.path)) { await loadBranches() }
    }

    private func loadBranches() async {
        await withTaskGroup(of: Void.self) { group in
            for root in model.roots {
                group.addTask { await root.loadBranches() }
            }
        }
    }

    private var rows: [BranchRow] {
        guard multiRoot else {
            return model.roots.first.map { sectionRows(of: $0, indent: 0) } ?? []
        }
        let groups = model.roots.compactMap { root -> [BranchRow]? in
            let children = sectionRows(of: root, indent: 1)
            if searching && children.isEmpty { return nil }
            let open = searching || isOpen(root.path, byDefault: true)
            let header = BranchRow.repository(root, open: open)
            return open ? [header] + children : [header]
        }
        return groups.enumerated().flatMap { index, group -> [BranchRow] in
            guard index > 0, case .repository(let root, _) = group.first else { return group }
            return [.rule(before: root.path)] + group
        }
    }

    /// A repository's Recent, Local and Remote. A search opens every
    /// section and folder, since the match may be inside a folded one.
    private func sectionRows(of root: RootModel, indent: Int) -> [BranchRow] {
        let locals = root.branches.filter { matches($0.name) }
        let remotes = root.remoteBranches.filter { matches($0.name) }
        let recent = Array(locals.prefix(5))
        var rows: [BranchRow] = []
        rows += section("recent", in: root, title: "Recent", indent: indent, count: recent.count) { id in
            recent.map { .branch(BranchRef($0), root: root, in: id, name: $0.name, indent: indent + 1, trailing: distance(of: $0)) }
        }
        rows += section("local", in: root, title: "Local", indent: indent, count: locals.count) { id in
            foldered(id, root: root, indent: indent, refs: locals.map(BranchRef.init)) { ref in
                root.branches.first { $0.name == ref.ref }.flatMap(distance(of:))
            }
        }
        rows += section("remote", in: root, title: "Remote", indent: indent, count: remotes.count) { id in
            foldered(id, root: root, indent: indent, refs: remotes.map(BranchRef.init)) { ref in
                root.remoteBranches.first { $0.name == ref.ref }?.remote
            }
        }
        return rows
    }

    private func section(
        _ name: String, in root: RootModel, title: String, indent: Int, count: Int,
        children: (String) -> [BranchRow]
    ) -> [BranchRow] {
        guard count > 0 else { return [] }
        let id = "\(root.path)|\(name)"
        let open = searching || isOpen(id, byDefault: name != "remote")
        let header = BranchRow.section(id: id, title: title, count: count, open: open, indent: indent)
        return open ? [header] + children(id) : [header]
    }

    /// A section's branches folded by folder.
    private func foldered(
        _ section: String, root: RootModel, indent: Int, refs: [BranchRef], trailing: (BranchRef) -> String?
    ) -> [BranchRow] {
        refs.groupedByFolder().flatMap { folder -> [BranchRow] in
            guard let name = folder.name else {
                return folder.items.map {
                    .branch($0, root: root, in: section, name: $0.display, indent: indent + 1, trailing: trailing($0))
                }
            }
            let id = "\(section)/\(name)"
            let open = searching || isOpen(id, byDefault: false)
            let header = BranchRow.folder(id: id, name: name, open: open, indent: indent + 1)
            guard open else { return [header] }
            return [header] + folder.items.map {
                .branch($0, root: root, in: section, name: $0.leaf, indent: indent + 2, trailing: trailing($0))
            }
        }
    }

    private func isOpen(_ id: String, byDefault open: Bool) -> Bool {
        open != flipped.contains(id)
    }

    private func toggle(_ id: String) {
        if flipped.contains(id) { flipped.remove(id) } else { flipped.insert(id) }
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

    private func checkout(_ ref: BranchRef, in root: RootModel) {
        guard !ref.isCurrent else { return }
        if multiRoot {
            model.checkout(ref.ref, in: root)
        } else {
            model.checkout(ref.ref)
        }
    }

    private var list: some View {
        let rows = rows
        return List(selection: $selected) {
            ListEdgeSpacer()
            ForEach(rows) { row in
                switch row {
                case .rule:
                    // A flat line in the island's hairline rather than a
                    // `Divider`, which a list draws as its own separator, a
                    // good deal brighter than the rules round the pane.
                    Rectangle()
                        .fill(Color(nsColor: IslandPalette.hairline))
                        .frame(height: 1)
                        .padding(.vertical, 4)
                        .headerRow()
                case .repository(let root, let open):
                    RepositoryHeader(root: root, open: open) { toggle(root.path) }
                        .headerRow()
                case .section(let id, let title, let count, let open, let indent):
                    SectionHeader(title: title, count: count, open: open, indent: indent) { toggle(id) }
                        .headerRow()
                case .folder(let id, let name, let open, let indent):
                    FolderHeader(name: name, open: open, indent: indent) { toggle(id) }
                        .headerRow()
                case .branch(let ref, let root, _, let name, let indent, let trailing):
                    BranchRowView(branch: ref, name: name, trailing: trailing, indent: indent)
                        .tag(row.id)
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets())
                        .branchActionMenu(for: ref, in: root)
                        .onTapGesture(count: 2) { checkout(ref, in: root) }
                }
            }
            ListEdgeSpacer()
        }
        .listStyle(.plain)
        .environment(\.defaultMinListRowHeight, 0)
        .contentMargins(.horizontal, 0, for: .scrollContent)
        .scrollContentBackground(.hidden)
        .selectionInk()
        .themedRows()
        .contextMenu {
            Button("New branch…") { model.branchPrompt = .create(startPoint: nil) }
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

/// One line of the surface: a repository's header, a section's, a
/// folder's, or a branch, each knowing how deep it stands. A branch is
/// keyed by its repository and the section it stands in as well as its
/// ref, since Recent repeats Local's branches, two repositories can share a
/// branch's name, and the list's diff misplaces rows whose ids collide.
private enum BranchRow: Identifiable {
    /// The hairline parting one repository's rows from the next's.
    case rule(before: String)
    case repository(RootModel, open: Bool)
    case section(id: String, title: String, count: Int, open: Bool, indent: Int)
    case folder(id: String, name: String, open: Bool, indent: Int)
    case branch(BranchRef, root: RootModel, in: String, name: String, indent: Int, trailing: String?)

    var id: String {
        switch self {
        case .rule(let path): return "rule:\(path)"
        case .repository(let root, _): return "repository:\(root.path)"
        case .section(let id, _, _, _, _): return "section:\(id)"
        case .folder(let id, _, _, _): return "folder:\(id)"
        case .branch(let ref, _, let section, _, _, _): return "branch:\(section):\(ref.ref)"
        }
    }
}

/// The switcher's row menu, opened by a right click on the row: at the
/// pointer rather than off the row's trailing edge, a row of the pane
/// running the pane's whole width, and the row washed while it is up, as
/// the switcher's row is.
private struct BranchActionMenuOnRow: ViewModifier {
    let branch: BranchRef
    let root: RootModel
    @Environment(AppModel.self) private var model
    @State private var openAt: UnitPoint?

    private var open: Binding<Bool> {
        Binding(get: { openAt != nil }, set: { if !$0 { openAt = nil } })
    }

    func body(content: Content) -> some View {
        content
            .background(Color.primary.opacity(openAt == nil ? 0 : 0.1), in: RoundedRectangle(cornerRadius: 5))
            .overlay {
                SecondaryClick { point in
                    model.focus(root: root)
                    openAt = point
                }
            }
            .popover(isPresented: open, attachmentAnchor: .point(openAt ?? .center), arrowEdge: .trailing) {
                BranchActionMenu(
                    actions: model.branchActions(for: branch), litFirst: false, close: { openAt = nil }
                ) {
                    openAt = nil
                }
            }
    }
}

private extension View {
    func branchActionMenu(for branch: BranchRef, in root: RootModel) -> some View {
        modifier(BranchActionMenuOnRow(branch: branch, root: root))
    }

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
/// row's own content. Every level is laid out alike — a repository, a
/// section, a folder, a branch — so each steps in by the same amount, as
/// the Source Control navigator's do. The rows keep the bar's inset, so
/// the outermost chevrons stand in the column of the bar's buttons above.
/// A row that folds toggles on a click; a leaf takes no gesture of its
/// own, so the list's selection gets the click.
private struct OutlineRow<Content: View>: View {
    let indent: Int
    let open: Bool?
    let toggle: (() -> Void)?
    @ViewBuilder let content: Content

    /// What the list's own margin leaves to take the outermost chevron
    /// under the + on the bar above.
    private static var inset: CGFloat { 4 }
    /// One step of the outline's grid, down and across alike: each row is
    /// this tall, and each level stands this far in from the one above.
    private static var step: CGFloat { 20 }

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
        .padding(.leading, CGFloat(indent) * Self.step)
        .frame(height: Self.step)
        .padding(.horizontal, Self.inset)
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

/// A repository's header, as the Source Control navigator heads one: its
/// avatar, its name, and the branch it is on.
private struct RepositoryHeader: View {
    let root: RootModel
    let open: Bool
    let toggle: () -> Void

    var body: some View {
        OutlineRow(indent: 0, open: open, toggle: toggle) {
            RepoAvatar(name: root.name, size: 16)
            Text(root.name)
                .font(.system(size: 12, weight: .semibold))
                .lineLimit(1)
            if let branch = root.branch {
                Text(branch)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            Spacer(minLength: 0)
        }
        .help(root.path)
    }
}

/// A section's header, laid out as a folder is: the chevron, the
/// section's own glyph — Recent's clock, Local's machine, Remote's
/// network — its name, and how many it holds.
private struct SectionHeader: View {
    let title: String
    let count: Int
    let open: Bool
    let indent: Int
    let toggle: () -> Void

    private var symbol: String {
        switch title {
        case "Recent": return "clock"
        case "Local": return "laptopcomputer"
        default: return "network"
        }
    }

    var body: some View {
        OutlineRow(indent: indent, open: open, toggle: toggle) {
            RowGlyph(symbol: symbol)
            Text(title)
                .font(.system(size: 12, weight: .medium))
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

    var body: some View {
        Text(RepoMonogram.initials(of: name))
            .font(.system(size: size / 2, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(Color(hex: RepoMonogram.hue(of: name)), in: RoundedRectangle(cornerRadius: size * 3 / 16))
    }
}
