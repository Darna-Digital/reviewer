// The opener: every git repository the machine holds, laid out as a Finder
// window — the sidebar's glass pane down the leading edge with Recents,
// Favorites and All Repositories at its head and, under Locations, each
// folder the walk found repositories in; the picked list's name as the
// window's title on the toolbar, with the search at the toolbar's trailing
// edge; and the repositories as the system's own table — name, branch,
// where it sits, when it was last opened — sortable on any column, with a
// status bar along the foot counting them and saying while the walk is
// still on. A click picks a row, a double-click or Return opens it as the
// project, and the row's menu opens it with its dev commands started and
// the Run surface up, opens it in a window of its own — a second Reviewer,
// with a server of its own — stars it among the favourites, or reaches the
// folder in Finder. It is the window up while no project is
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
    case recents
    case favorites
    case all
    case location(String)

    var title: String {
        switch self {
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
    @State private var list: OpenerList? = .recents
    @State private var query = ""
    @State private var selected: RepoRow.ID?
    @State private var sortOrder = OpenerList.recents.defaultSort

    private var catalog: RepoCatalog { model.catalog }

    var body: some View {
        NavigationSplitView {
            OpenerSidebar(list: $list)
        } detail: {
            Group {
                if let empty {
                    OpenerEmptyView(empty: empty)
                } else {
                    OpenerTable(rows: rows, selected: $selected, sortOrder: $sortOrder)
                }
            }
                .safeAreaInset(edge: .bottom, spacing: 0) { OpenerStatusBar() }
                .navigationTitle(list?.title ?? "Repositories")
        }
        .toolbar { OpenerToolbar() }
        .searchable(text: $query, placement: .toolbar, prompt: "Search")
        .task { catalog.load() }
        // Recents is the list the window opens on; it is empty until a
        // repository has been opened here, when everything is the list to
        // pick the first one from.
        .onChange(of: catalog.hasLoaded) {
            if list == .recents && catalog.recents.isEmpty { list = .all }
        }
        .onChange(of: list) { sortOrder = (list ?? .all).defaultSort }
        .frame(minWidth: 820, minHeight: 440)
    }

    private var rows: [RepoRow] {
        let listed: [RepoRow]
        switch list {
        case .recents: listed = catalog.recents
        case .favorites: listed = catalog.favoriteRows
        case .location(let path): listed = catalog.rows(under: path)
        case .all, .none: listed = catalog.rows
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
        guard rows.isEmpty else { return nil }
        let needle = query.trimmingCharacters(in: .whitespaces)
        if !needle.isEmpty { return .noMatch(needle) }
        if catalog.isScanning && catalog.rows.isEmpty { return .scanning }
        switch list {
        case .recents:
            return .none(title: "No recent repositories", detail: "Repositories you open will show up here.")
        case .favorites:
            return .none(title: "No favorite repositories", detail: "Right-click a repository and choose Add to favorites.")
        case .location(let path):
            return .none(title: "No repositories", detail: "\(RepoRow.fold(path, home: NSHomeDirectory())) holds no repositories any more. Scan again to look afresh.")
        case .all, nil:
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
/// the branch it is on, the folder it sits in, and when it was last opened
/// here, the rows striped as Finder's are.
private struct OpenerTable: View {
    @Environment(AppModel.self) private var model
    let rows: [RepoRow]
    @Binding var selected: RepoRow.ID?
    @Binding var sortOrder: [KeyPathComparator<RepoRow>]

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
            TableColumn("Branch", value: \.branch) { row in
                Text(row.branch.isEmpty ? "—" : row.branch)
                    .foregroundStyle(row.branch.isEmpty ? .secondary : .primary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            .width(min: 90, ideal: 150)
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
            if let path = ids.first {
                Button("Open") { open(path) }
                Button("Open and run") { openAndRun(path) }
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
            if let path = ids.first { open(path) }
        }
        .onKeyPress(.return) {
            guard let selected else { return .ignored }
            open(selected)
            return .handled
        }
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

    var body: some ToolbarContent {
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
