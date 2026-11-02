// The sessions list, drawn by hand in the sidebar from what the page
// reports while it is on the sessions surface (see `ShellSessions`) in the
// web list's shape: one line per session, the title and nothing else, with
// the one mark that changes at the trailing edge — the orb of a working
// agent, a red dot where a turn ended badly, the accent dot for a session
// that moved since it was last opened — and the delete control taking the
// mark's place under the pointer.
//
// The rows are a native table (see `SessionsTable`) rather than a SwiftUI
// stack: a list hundreds of sessions long, a dozen of them with an agent at
// work, has to scroll as the system's own lists do. The picked row wears
// the tree's quiet wash like the sidebar's other lists (see
// `TreeSelection`), so the two read as one.
//
// What the web rail carries stands at the head of the list instead: a
// search field, and a filter menu for the project and how far back to look
// — both of them the page's query, so they narrow every session the server
// has rather than the pages loaded so far. A sweep of rows deleted together
// is asked about here, in the list's own alert.
import SwiftUI

struct SessionsList: View {
    @Environment(AppModel.self) private var model
    @State private var deletePrompt: [String]?

    var body: some View {
        if let list = model.sessions {
            VStack(spacing: 0) {
                SessionsHeader(filters: list.filters)
                if list.isEmpty {
                    SessionsPlaceholder(loading: list.loading, searching: !list.filters.search.isEmpty)
                } else {
                    SessionsTable(model: model, list: list) { deletePrompt = $0 }
                }
            }
            .alert("Delete \(deletePrompt?.count ?? 0) sessions?", isPresented: deletePromptShown, presenting: deletePrompt) { ids in
                Button("Delete \(ids.count)", role: .destructive) { model.act(onSessions: .delete(ids)) }
                Button("Cancel", role: .cancel) {}
            } message: { _ in
                Text("Their conversations go with them. This can't be undone.")
            }
        } else {
            // The surface is up and its first list is on its way.
            SessionsPlaceholder(loading: true, searching: false)
        }
    }

    private var deletePromptShown: Binding<Bool> {
        Binding(
            get: { deletePrompt != nil },
            set: { if !$0 { deletePrompt = nil } })
    }
}

/// The search over every session and the filter menu beside it — the web
/// rail's two controls, the search the pane bars' own field.
private struct SessionsHeader: View {
    let filters: ShellSessionFilters
    @Environment(AppModel.self) private var model
    @State private var query = ""

    var body: some View {
        HStack(spacing: 6) {
            MinimalSearchField(prompt: "Search sessions", text: $query)
            SessionFilterMenu(filters: filters)
        }
        .sidebarSearchBand()
        // The field is the source of what is searched, but not the only
        // copy: the page holds the query, so a header made afresh — the
        // sidebar put away and brought back — starts from what it has.
        .onAppear { query = filters.search }
        .onChange(of: query) { _, text in
            guard text != filters.search else { return }
            model.act(onSessions: .search(text))
        }
    }
}

/// The button the filter popover hangs off: the filter glyph, or the
/// avatar of the project the list is narrowed to, so the sidebar says
/// whose sessions these are without the popover open; and a dot while
/// anything is set, as the web's has, since the list is never quietly
/// narrower than it looks.
private struct SessionFilterMenu: View {
    let filters: ShellSessionFilters
    @Environment(AppModel.self) private var model
    @State private var open = false

    var body: some View {
        Button { open.toggle() } label: {
            ZStack {
                if let project = filters.projects.first(where: { $0.path == filters.project }) {
                    RepoAvatar(name: project.name)
                } else {
                    Image(systemName: "line.3.horizontal.decrease")
                        .font(.system(size: 11, weight: .medium))
                }
            }
            .foregroundStyle(.secondary)
            .frame(width: 16, height: 16)
            .overlay(alignment: .topTrailing) {
                if filters.isNarrowed {
                    Circle()
                        .fill(Color.accentColor)
                        .frame(width: 5, height: 5)
                        .offset(x: 2, y: -2)
                }
            }
            .glassCircleControl()
        }
        .buttonStyle(.plain)
        .help("Filter sessions")
        .popover(isPresented: $open, arrowEdge: .bottom) {
            SessionFilterPopover(filters: filters, dismiss: { open = false }) { project, date in
                model.act(onSessions: .filter(project: project, date: date))
            }
        }
        .closesOnNavigation($open)
    }
}

private struct SessionsPlaceholder: View {
    let loading: Bool
    let searching: Bool

    var body: some View {
        VStack {
            Spacer()
            if loading {
                Orb(size: 16, label: "Loading")
            } else {
                Text(searching ? "Nothing matches" : "No sessions")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}
