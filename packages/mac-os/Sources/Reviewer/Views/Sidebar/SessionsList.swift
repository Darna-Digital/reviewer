// The sessions list as a native source list, drawn from what the page
// reports while it is on the sessions surface (see `ShellSessions`) in the
// web list's shape: one line per session, the title and nothing else, with
// the one mark that changes at the trailing edge — the pulse of a working
// agent, a red dot where a turn ended badly, the accent dot for a session
// that moved since it was last opened — and the delete control taking the
// mark's place under the pointer. The cloud runs stand in a group of their
// own above, as they do in the web list.
//
// What the web rail carries stands at the head of the list instead: a
// search field, and a filter menu for the project and how far back to look
// — both of them the page's query, so they narrow every session the server
// has rather than the pages loaded so far. The untruncated title stands in
// the row's tooltip.
//
// Picking a row sends the page to that session; the menu lifts it into a
// tab of its own, or deletes it; and the foot of the list coming into view
// asks the page for its next page.
import SwiftUI

struct SessionsList: View {
    @Environment(AppModel.self) private var model
    /// The row highlighted: the page's, until a click moves it ahead of the
    /// page's answer — a list that waited for the round trip would flash the
    /// old row back under the pointer first.
    @State private var selected: String?

    var body: some View {
        if let list = model.sessions {
            VStack(spacing: 0) {
                SessionsHeader(filters: list.filters, count: list.sessions.count, hasMore: list.hasMore)
                if list.isEmpty {
                    SessionsPlaceholder(loading: list.loading, searching: !list.filters.search.isEmpty)
                } else {
                    rows(of: list)
                }
            }
            .onChange(of: list.activeId, initial: true) { _, active in selected = active }
        }
    }

    private func rows(of list: ShellSessions) -> some View {
        List(selection: $selected) {
            if !list.cloudRuns.isEmpty {
                Section("Cloud") {
                    ForEach(list.cloudRuns) { run in
                        SessionRow(session: run)
                            .tag(run.id)
                    }
                }
            }
            Section {
                ForEach(list.sessions) { session in
                    SessionRow(session: session)
                        .tag(session.id)
                        .contextMenu {
                            Button("Open in a Tab") { model.act(onSessions: .openInTab(session.id)) }
                            Divider()
                            Button("Delete Session", role: .destructive) {
                                model.act(onSessions: .delete(session.id))
                            }
                        }
                        .onAppear {
                            if session.id == list.sessions.last?.id && list.hasMore {
                                model.act(onSessions: .loadMore)
                            }
                        }
                }
                if list.hasMore {
                    Text("Loading more…")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .listRowSeparator(.hidden)
                        .selectionDisabled()
                }
            } header: {
                if !list.cloudRuns.isEmpty { Text("Sessions") }
            }
        }
        .listStyle(.sidebar)
        .scrollContentBackground(.hidden)
        .onChange(of: selected) { _, picked in
            guard let picked, picked != list.activeId else { return }
            model.act(onSessions: .select(picked))
        }
    }
}

/// The search over every session and the filter menu beside it — the web
/// rail's two controls, in the changed-files layout's shape — then how many
/// sessions the list holds: of the ones loaded so far, while the server has
/// more to give.
private struct SessionsHeader: View {
    let filters: ShellSessionFilters
    let count: Int
    let hasMore: Bool
    @Environment(AppModel.self) private var model
    @State private var query = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                SearchField(query: $query)
                SessionFilterMenu(filters: filters)
            }
            Text(count == 1 ? "1 session" : "\(count)\(hasMore ? "+" : "") sessions")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .padding(.leading, 4)
        }
        .padding(.horizontal, 10)
        .padding(.top, 8)
        .padding(.bottom, 6)
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

private struct SearchField: View {
    @Binding var query: String

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
            TextField("Search sessions", text: $query)
                .textFieldStyle(.plain)
                .font(.system(size: 12))
            if !query.isEmpty {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(.tertiary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 7)
        .frame(height: 24)
        .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 6))
    }
}

/// The web filter popover as a pull-down: the projects with a session in
/// them, each with its count, over how far back to look, the chosen one in
/// each ticked. The projects are left out while there is only one to name.
/// The button carries a dot while anything is set, as the web's does: the
/// list is never quietly narrower than it looks.
private struct SessionFilterMenu: View {
    let filters: ShellSessionFilters
    @Environment(AppModel.self) private var model

    var body: some View {
        Menu {
            if filters.projects.count > 1 {
                Section("Project") {
                    Toggle("All projects", isOn: projectBinding(ShellSessionFilters.allProjects))
                    ForEach(filters.projects) { project in
                        Toggle(isOn: projectBinding(project.path)) {
                            Text("\(project.name)  \(project.count)")
                        }
                        .help(project.path)
                    }
                }
            }
            Section("Updated") {
                ForEach(SessionDateFilter.allCases) { date in
                    Toggle(date.label, isOn: dateBinding(date))
                }
            }
        } label: {
            Image(systemName: "line.3.horizontal.decrease")
                .font(.system(size: 11, weight: .medium))
                .frame(width: 24, height: 24)
                .overlay(alignment: .topTrailing) {
                    if filters.isNarrowed {
                        Circle()
                            .fill(Color.accentColor)
                            .frame(width: 5, height: 5)
                            .padding(3)
                    }
                }
        }
        .menuStyle(.borderlessButton)
        .menuIndicator(.hidden)
        .fixedSize()
        .help("Filter sessions")
    }

    private func projectBinding(_ path: String) -> Binding<Bool> {
        Binding(
            get: { filters.project == path },
            set: { on in if on { model.act(onSessions: .filter(project: path, date: nil)) } })
    }

    private func dateBinding(_ date: SessionDateFilter) -> Binding<Bool> {
        Binding(
            get: { filters.date == date },
            set: { on in if on { model.act(onSessions: .filter(project: nil, date: date)) } })
    }
}

/// A session's row: its title, and at the trailing edge its mark — or, with
/// the pointer over it, the delete control in the mark's place, so the title
/// runs to the same edge on every row. The row carries no gesture of its
/// own: on macOS a gesture on a row's content takes the mouse-down before
/// the list does, and the row is never selected.
private struct SessionRow: View {
    let session: ShellSession
    @Environment(AppModel.self) private var model
    @State private var isHovering = false

    var body: some View {
        HStack(spacing: 6) {
            Text(session.title)
                .font(.system(size: 13))
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer(minLength: 4)
            ZStack {
                if isHovering && session.kind == .session {
                    PaneBarButton(symbol: "xmark", help: "Delete session") {
                        model.act(onSessions: .delete(session.id))
                    }
                } else if let mark = session.mark {
                    SessionMarkDot(mark: mark)
                }
            }
            .frame(width: 20, height: 18)
        }
        .frame(height: 24)
        .contentShape(Rectangle())
        .onHover { isHovering = $0 }
        .help(session.title)
    }
}

/// The web row's three marks, in the system's ink: the accent colour pulsing
/// while an agent works, standing still for a session that has moved, and
/// red where a turn ended badly.
private struct SessionMarkDot: View {
    let mark: SessionMark

    var body: some View {
        Image(systemName: "circle.fill")
            .font(.system(size: 7))
            .foregroundStyle(mark == .error ? Color.red : Color.accentColor)
            .symbolEffect(.pulse, isActive: mark == .running)
            .accessibilityLabel(mark.label)
    }
}

private struct SessionsPlaceholder: View {
    let loading: Bool
    let searching: Bool

    var body: some View {
        VStack {
            Spacer()
            if loading {
                ProgressView()
                    .controlSize(.small)
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
