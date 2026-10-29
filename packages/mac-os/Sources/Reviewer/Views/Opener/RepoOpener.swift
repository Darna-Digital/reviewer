// The opener: the saved workspaces and every git repository the machine
// holds, laid out as a Finder window — the sidebar's glass pane down the
// leading edge with Workspaces, Recents, Favorites and All Repositories at
// its head and, under Locations, each folder the walk found repositories
// in; the picked list's name as the window's title on the toolbar, with the
// search at the toolbar's trailing edge; and the list as the system's own
// table, sortable on any column, with a status bar along the foot saying
// while the walk is still on. Workspaces are several repositories opened
// together (see `WorkspacesTable`); New workspace makes one, from the
// repositories picked in the table when several are. A repository's row
// opens it on its own with a double-click or Return, and its menu opens it
// with its dev commands started and the Run surface up, adds it beside the
// repositories open now, opens it in a window of its own — a second
// Reviewer, with a server of its own — stars it among the favourites, or
// reaches the folder in Finder. It is the window up while no project is
// (the workspace hands over to it, see `ContentView`),
// and the one ⌘O, ⇧⌘1 and the project chip bring up over an open
// workspace; a repository opened in it hands back — the workspace forward,
// the opener away. Everything it does goes through the same calls the File
// menu makes, so it is one more way to the picker rather than a picker of
// its own.
import AppKit
import SwiftUI

struct RepoOpenerWindow: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openWindow) private var openWindow
    @Environment(\.dismissWindow) private var dismissWindow

    var body: some View {
        RepoOpener()
            .serverErrorAlert()
            .onChange(of: model.projectOpens) {
                openWindow(id: ReviewerWindow.workspace)
                dismissWindow(id: ReviewerWindow.opener)
            }
    }
}

/// Which list the table shows — the sidebar's pick.
private enum OpenerList: Hashable {
    case workspaces
    case recents
    case favorites
    case all
    case location(String)

    var title: String {
        switch self {
        case .workspaces: return "Workspaces"
        case .recents: return "Recents"
        case .favorites: return "Favorites"
        case .all: return "All repositories"
        case .location(let path): return URL(fileURLWithPath: path).lastPathComponent
        }
    }

    /// Recents newest first, as Finder's are; everything else by name.
    var defaultSort: [KeyPathComparator<RepoRow>] {
        self == .recents
            ? [KeyPathComparator(\RepoRow.lastOpenedOrder, order: .reverse)]
            : [KeyPathComparator(\RepoRow.name)]
    }
}

private struct RepoOpener: View {
    @Environment(AppModel.self) private var model
    @State private var list: OpenerList? = .workspaces
    @State private var query = ""
    @State private var selected: Set<RepoRow.ID> = []
    @State private var sortOrder = OpenerList.recents.defaultSort
    @State private var editing: WorkspaceDraft?

    private var catalog: RepoCatalog { model.catalog }

    var body: some View {
        NavigationSplitView {
            OpenerSidebar(list: $list)
        } detail: {
            Group {
                if let empty {
                    OpenerEmptyView(empty: empty)
                } else if list == .workspaces {
                    WorkspacesTable(workspaces: workspaces, editing: $editing)
                } else {
                    OpenerTable(rows: rows, selected: $selected, sortOrder: $sortOrder, editing: $editing)
                }
            }
                .safeAreaInset(edge: .bottom, spacing: 0) { OpenerStatusBar() }
                .navigationTitle(list?.title ?? "Repositories")
        }
        .toolbar { OpenerToolbar(newWorkspace: newWorkspace) }
        .searchable(text: $query, placement: .toolbar, prompt: "Search")
        .sheet(item: $editing) { draft in
            WorkspaceEditor(draft: draft)
                .environment(model)
        }
        .task { catalog.load() }
        // Workspaces is the list the window opens on; with none saved yet,
        // the recent repositories are, and with none of those either,
        // everything is the list to pick the first one from.
        .onChange(of: catalog.hasLoaded) { settleInitialList() }
        .onChange(of: catalog.workspacesLoaded) { settleInitialList() }
        .onChange(of: list) { sortOrder = (list ?? .all).defaultSort }
        .frame(minWidth: 820, minHeight: 440)
    }

    private func settleInitialList() {
        guard catalog.hasLoaded, catalog.workspacesLoaded else { return }
        if list == .workspaces && catalog.workspaces.isEmpty { list = .recents }
        if list == .recents && catalog.recents.isEmpty { list = .all }
    }

    /// A new workspace, starting from the repositories picked in the table.
    private func newWorkspace() {
        let picked = rows.map(\.path).filter(selected.contains)
        editing = WorkspaceDraft(roots: list == .workspaces ? [] : picked)
    }

    private var needle: String { query.trimmingCharacters(in: .whitespaces) }

    private var workspaces: [SavedWorkspace] {
        guard !needle.isEmpty else { return catalog.workspaces }
        return catalog.workspaces.filter { workspace in
            workspace.name.localizedCaseInsensitiveContains(needle)
                || workspace.rootNames.contains { $0.localizedCaseInsensitiveContains(needle) }
        }
    }

    private var rows: [RepoRow] {
        let listed: [RepoRow]
        switch list {
        case .recents: listed = catalog.recents
        case .favorites: listed = catalog.favoriteRows
        case .location(let path): listed = catalog.rows(under: path)
        case .all, .workspaces, .none: listed = catalog.rows
        }
        let needle = query.trimmingCharacters(in: .whitespaces)
        let matched = needle.isEmpty
            ? listed
            : listed.filter {
                $0.name.localizedCaseInsensitiveContains(needle) || $0.path.localizedCaseInsensitiveContains(needle)
            }
        return matched.sorted(using: sortOrder)
    }

    private var empty: OpenerEmpty? {
        if list == .workspaces {
            guard workspaces.isEmpty else { return nil }
            if !needle.isEmpty { return .noMatch(needle) }
            return .none(
                title: "No workspaces",
                detail: "A workspace opens several repositories together. Choose New workspace, or pick repositories in a list and choose Open together.")
        }
        guard rows.isEmpty else { return nil }
        if !needle.isEmpty { return .noMatch(needle) }
        if catalog.isScanning && catalog.rows.isEmpty { return .scanning }
        switch list {
        case .recents:
            return .none(title: "No recent repositories", detail: "Repositories you open will show up here.")
        case .favorites:
            return .none(title: "No favorite repositories", detail: "Right-click a repository and choose Add to favorites.")
        case .location(let path):
            return .none(title: "No repositories", detail: "\(RepoRow.fold(path, home: NSHomeDirectory())) holds no repositories any more. Scan again to look afresh.")
        case .all, .workspaces, nil:
            return .none(title: "No repositories", detail: "None were found under your home folder. Scan again, or use Open other… to pick one.")
        }
    }
}

/// Why the table has nothing to show.
private enum OpenerEmpty {
    case noMatch(String)
    case scanning
    case none(title: String, detail: String)
}

/// The system's own placeholder in the table's place — the search kind for
/// a search that found nothing, plain for a list with nothing in it.
private struct OpenerEmptyView: View {
    let empty: OpenerEmpty

    var body: some View {
        Group {
            switch empty {
            case .noMatch(let needle):
                ContentUnavailableView.search(text: needle)
            case .scanning:
                ContentUnavailableView {
                    Label("Looking for repositories", systemImage: "magnifyingglass")
                } description: {
                    Text("The walk through your folders is still on.")
                }
            case .none(let title, let detail):
                ContentUnavailableView {
                    Label(title, systemImage: "folder")
                } description: {
                    Text(detail)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.background)
    }
}

/// Recents, favourites and everything at the head, then a row per folder
/// holding repositories, with how many at its trailing edge.
private struct OpenerSidebar: View {
    @Environment(AppModel.self) private var model
    @Binding var list: OpenerList?

    var body: some View {
        List(selection: $list) {
            Label {
                HStack {
                    Text("Workspaces")
                    Spacer(minLength: 8)
                    if !model.catalog.workspaces.isEmpty {
                        Text(model.catalog.workspaces.count, format: .number)
                            .font(.system(size: 11).monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                }
            } icon: {
                Image(systemName: "square.stack.3d.up")
            }
            .tag(OpenerList.workspaces)
            Label("Recents", systemImage: "clock")
                .tag(OpenerList.recents)
            Label("Favorites", systemImage: "star")
                .tag(OpenerList.favorites)
            Label("All repositories", systemImage: "square.grid.2x2")
                .tag(OpenerList.all)
            Section("Locations") {
                ForEach(model.catalog.locations) { location in
                    Label {
                        HStack {
                            Text(location.name)
                                .lineLimit(1)
                                .truncationMode(.middle)
                            Spacer(minLength: 8)
                            Text(location.count, format: .number)
                                .font(.system(size: 11).monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                    } icon: {
                        Image(systemName: "folder")
                    }
                    .help(location.display)
                    .tag(OpenerList.location(location.path))
                }
            }
        }
        .listStyle(.sidebar)
        .navigationSplitViewColumnWidth(min: 180, ideal: 220, max: 320)
    }
}

/// The repositories as the system lists documents: name under its avatar,
/// the folder it sits in, and when it was last opened here, the rows
/// striped as Finder's are.
private struct OpenerTable: View {
    @Environment(AppModel.self) private var model
    let rows: [RepoRow]
    @Binding var selected: Set<RepoRow.ID>
    @Binding var sortOrder: [KeyPathComparator<RepoRow>]
    @Binding var editing: WorkspaceDraft?

    var body: some View {
        Table(rows, selection: $selected, sortOrder: $sortOrder) {
            TableColumn("Name", value: \.name) { row in
                HStack(spacing: 8) {
                    RepoAvatar(name: row.name)
                    Text(row.name)
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
            }
            .width(min: 140, ideal: 200)
            TableColumn("Location", value: \.location) { row in
                Text(row.location)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .help(row.path)
            }
            .width(min: 120, ideal: 220)
            TableColumn("Date last opened", value: \.lastOpenedOrder) { row in
                Text(row.lastOpened.map(OpenerDates.format) ?? "—")
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .width(min: 130, ideal: 190)
        }
        .tableStyle(.inset(alternatesRowBackgrounds: true))
        .contextMenu(forSelectionType: RepoRow.ID.self) { ids in
            if ids.count > 1 {
                let paths = ordered(ids)
                Button("Open together as a workspace…") { editing = WorkspaceDraft(roots: paths) }
                if model.hasProject {
                    Button("Add to this workspace") { add(paths) }
                }
            } else if let path = ids.first {
                Button("Open") { open(path) }
                Button("Open and run") { openAndRun(path) }
                if model.hasProject {
                    Button("Add to this workspace") { add([path]) }
                        .disabled(model.root(at: path) != nil)
                }
                Button("Open in new window") { model.openProjectInNewWindow(path: path) }
                Divider()
                if model.catalog.isFavorite(path) {
                    Button("Remove from favorites") { model.catalog.toggleFavorite(path) }
                } else {
                    Button("Add to favorites") { model.catalog.toggleFavorite(path) }
                }
                Divider()
                Button("Show in Finder") { revealInFinder(path) }
                Button("Copy path") { copy(path) }
            }
        } primaryAction: { ids in
            openPicked(ids)
        }
        .onKeyPress(.return) {
            guard !selected.isEmpty else { return .ignored }
            openPicked(selected)
            return .handled
        }
    }

    /// One repository opens on its own; several are the start of a
    /// workspace, named before it opens.
    private func openPicked(_ ids: Set<RepoRow.ID>) {
        if ids.count > 1 {
            editing = WorkspaceDraft(roots: ordered(ids))
        } else if let path = ids.first {
            open(path)
        }
    }

    /// The picked rows in the order the table shows them.
    private func ordered(_ ids: Set<RepoRow.ID>) -> [String] {
        rows.map(\.path).filter(ids.contains)
    }

    /// Repositories opened beside the ones open now, the opener handing back.
    private func add(_ paths: [String]) {
        Task {
            await model.setRoots((model.workspace?.roots.map(\.path) ?? []) + paths.filter { model.root(at: $0) == nil })
            dismissToWorkspace()
        }
    }

    @Environment(\.openWindow) private var openWindow
    @Environment(\.dismissWindow) private var dismissWindow

    private func dismissToWorkspace() {
        openWindow(id: ReviewerWindow.workspace)
        dismissWindow(id: ReviewerWindow.opener)
    }

    private func open(_ path: String) {
        Task { await model.openProject(path: path) }
    }

    private func openAndRun(_ path: String) {
        Task { await model.openProjectAndRun(path: path) }
    }

    private func revealInFinder(_ path: String) {
        NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: path)])
    }

    private func copy(_ path: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(path, forType: .string)
    }
}

/// The toolbar's own controls beside the search: the walk again, and the
/// folder panel for a repository the index does not list.
private struct OpenerToolbar: ToolbarContent {
    @Environment(AppModel.self) private var model
    let newWorkspace: () -> Void

    var body: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            Button(action: newWorkspace) {
                Label("New workspace…", systemImage: "plus.square.on.square")
            }
            .help("Keep several repositories together, to open them in one go")
        }
        ToolbarItem(placement: .primaryAction) {
            Button {
                model.catalog.rescan()
            } label: {
                Label("Scan again", systemImage: "arrow.clockwise")
            }
            .disabled(model.catalog.isScanning)
            .help("Look for repositories again")
        }
        ToolbarItem(placement: .primaryAction) {
            Button {
                model.chooseProject()
            } label: {
                Label("Open other…", systemImage: "folder")
            }
            .help("Open a repository the list does not show")
        }
    }
}

/// Finder's status bar, shown only while the walk is still filling the
/// list in or when it failed; an idle list needs no footer.
private struct OpenerStatusBar: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if model.catalog.isScanning {
            bar {
                Orb(size: 13)
                Text("Looking for repositories…")
            }
        } else if let error = model.catalog.loadError {
            bar {
                Image(systemName: "exclamationmark.triangle")
                Text(error)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
        }
    }

    private func bar<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        HStack(spacing: 8) {
            Spacer(minLength: 0)
            content()
            Spacer(minLength: 0)
        }
        .font(.system(size: 11))
        .foregroundStyle(.secondary)
        .padding(.horizontal, 12)
        .frame(height: 24)
        .background(.bar)
        .overlay(alignment: .top) { ThemedDivider() }
    }
}

@MainActor
enum OpenerDates {
    /// "Today at 11:50", "Yesterday at 01:28", "18 September 2026 at 23:26" —
    /// the way Finder dates its rows.
    private static let formatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .long
        formatter.timeStyle = .short
        formatter.doesRelativeDateFormatting = true
        return formatter
    }()

    static func format(_ date: Date) -> String {
        formatter.string(from: date)
    }
}
