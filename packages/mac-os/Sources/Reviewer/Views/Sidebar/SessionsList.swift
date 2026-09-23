// The sessions list, drawn by hand in the sidebar from what the page
// reports while it is on the sessions surface (see `ShellSessions`) in the
// web list's shape: one line per session, the title and nothing else, with
// the one mark that changes at the trailing edge — the orb of a working
// agent, a red dot where a turn ended badly, the accent dot for a session
// that moved since it was last opened — and the delete control taking the
// mark's place under the pointer.
//
// The rows are a `LazyVStack` in a `ScrollView`, as the merge-request list's
// are, rather than a `List`: a `List` row on macOS is an `NSTableView` cell,
// and a `TimelineView` inside one is never ticked, so the orb sat still —
// or not at all — in the accessory slot however it was drawn. A stack the
// window owns outright redraws the way the tabs and the work log do, and
// the picked row wears the tree's quiet wash like the sidebar's other
// lists (see `TreeSelection`), so the two read as one.
//
// What the web rail carries stands at the head of the list instead: a
// search field, and a filter menu for the project and how far back to look
// — both of them the page's query, so they narrow every session the server
// has rather than the pages loaded so far. The untruncated title stands in
// the row's tooltip.
//
// A row the pointer rests on has its conversation read ahead (see
// `Chats.prefetch`), so the click that tends to follow opens on the
// messages rather than a loading orb; the pointer passing over rows on its
// way somewhere else is too brief to count.
//
// Picking a row sends the page to that session; a shift- or ⌘-click sweeps
// more rows in without moving the page, and the menu or the delete key then
// acts on the sweep, as the web list's does — one row goes without asking,
// a sweep asks first. The menu lifts a single row into a tab of its own; and
// the foot of the list coming into view asks the page for its next page.
import SwiftUI

struct SessionsList: View {
    @Environment(AppModel.self) private var model
    /// The rows highlighted: the page's, until a click moves it ahead of the
    /// page's answer — a list that waited for the round trip would flash the
    /// old row back under the pointer first.
    @State private var selected: Set<String> = []
    /// The row the last plain click or arrow landed on: where a ⇧-click
    /// sweeps from.
    @State private var anchor: String?
    @State private var deletePrompt: [String]?
    @FocusState private var focused: Bool

    var body: some View {
        if let list = model.sessions {
            VStack(spacing: 0) {
                SessionsHeader(filters: list.filters)
                if list.isEmpty {
                    SessionsPlaceholder(loading: list.loading, searching: !list.filters.search.isEmpty)
                } else {
                    rows(of: list)
                }
            }
            .onChange(of: list.activeId, initial: true) { _, active in
                selected = active.map { [$0] } ?? []
                anchor = active
            }
            .alert("Delete \(deletePrompt?.count ?? 0) sessions?", isPresented: deletePromptShown, presenting: deletePrompt) { ids in
                Button("Delete \(ids.count)", role: .destructive) { confirmDelete(ids, in: list) }
                Button("Cancel", role: .cancel) {}
            } message: { _ in
                Text("Their conversations go with them. This can't be undone.")
            }
        } else {
            // The surface is up and its first list is on its way.
            SessionsPlaceholder(loading: true, searching: false)
        }
    }

    private func rows(of list: ShellSessions) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 1) {
                ForEach(list.sessions) { session in
                    SessionRow(session: session, selected: selected.contains(session.id)) {
                        pick(session.id, in: list)
                    }
                    .contextMenu { menu(for: session.id, in: list) }
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
                        .padding(.vertical, 6)
                }
            }
            .padding(.horizontal, 10)
            .padding(.bottom, 8)
        }
        .scrollIndicators(.hidden)
        .focusable()
        .focusEffectDisabled()
        .focused($focused)
        .onKeyPress(.upArrow) { step(-1, in: list) }
        .onKeyPress(.downArrow) { step(1, in: list) }
        .onDeleteCommand { delete(deletable(selected, in: list)) }
    }

    /// A plain click picks the row and sends the page to it; ⌘ adds the row
    /// to the sweep or takes it back out, and ⇧ sweeps every row between
    /// the last one picked and this one — neither moves the page. The click
    /// takes the keyboard too, so the arrows and the delete key act on what
    /// was just picked.
    private func pick(_ id: String, in list: ShellSessions) {
        focused = true
        let flags = NSEvent.modifierFlags
        if flags.contains(.command) {
            if selected.contains(id) && selected.count > 1 {
                selected.remove(id)
            } else {
                selected.insert(id)
            }
            return
        }
        if flags.contains(.shift), let from = anchor, let range = span(from: from, to: id, in: list) {
            selected.formUnion(range)
            return
        }
        anchor = id
        selected = [id]
        guard id != list.activeId else { return }
        model.act(onSessions: .select(id))
    }

    private func span(from: String, to: String, in list: ShellSessions) -> [String]? {
        let ids = list.sessions.map(\.id)
        guard let a = ids.firstIndex(of: from), let b = ids.firstIndex(of: to) else { return nil }
        return Array(ids[min(a, b)...max(a, b)])
    }

    /// The row beside the anchor, in the order shown — the first with none.
    private func step(_ offset: Int, in list: ShellSessions) -> KeyPress.Result {
        let ids = list.sessions.map(\.id)
        guard !ids.isEmpty else { return .ignored }
        let current = ids.firstIndex { $0 == anchor ?? list.activeId }
        let next = current.map { min(max($0 + offset, 0), ids.count - 1) } ?? 0
        anchor = ids[next]
        selected = [ids[next]]
        if ids[next] != list.activeId { model.act(onSessions: .select(ids[next])) }
        return .handled
    }

    /// The menu acts on the sweep when the row is in it, and on the row
    /// alone when it is not — a right-click off the sweep is about that row.
    @ViewBuilder
    private func menu(for id: String, in list: ShellSessions) -> some View {
        let sessions = selected.contains(id) ? deletable(selected, in: list) : [id]
        if sessions.count == 1, let id = sessions.first {
            Button("Open in a tab") { model.act(onSessions: .openInTab(id)) }
            Divider()
        }
        Button(sessions.count == 1 ? "Delete session" : "Delete \(sessions.count) sessions", role: .destructive) {
            delete(sessions)
        }
    }

    /// The rows the list can delete, in the list's order.
    private func deletable(_ ids: Set<String>, in list: ShellSessions) -> [String] {
        list.sessions.map(\.id).filter(ids.contains)
    }

    private func delete(_ ids: [String]) {
        if ids.count > 1 {
            deletePrompt = ids
        } else if let id = ids.first {
            model.act(onSessions: .delete([id]))
        }
    }

    /// The sweep is spent once it has been deleted: what is left highlighted
    /// is the page's row, as before the sweep began.
    private func confirmDelete(_ ids: [String], in list: ShellSessions) {
        selected = list.activeId.map { [$0] } ?? []
        model.act(onSessions: .delete(ids))
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
            PaneSearchField(prompt: "Search sessions", text: $query)
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
            // The bar style pads the glyph out to the search field's 24pt.
            .frame(width: 16, height: 16)
            .overlay(alignment: .topTrailing) {
                if filters.isNarrowed {
                    Circle()
                        .fill(Color.accentColor)
                        .frame(width: 5, height: 5)
                        .offset(x: 2, y: -2)
                }
            }
        }
        .buttonStyle(.accessoryBar)
        .help("Filter sessions")
        .popover(isPresented: $open, arrowEdge: .bottom) {
            SessionFilterPopover(filters: filters, dismiss: { open = false }) { project, date in
                model.act(onSessions: .filter(project: project, date: date))
            }
        }
    }
}

/// A session's row, at the web row's size — a 32pt line, the title at 14
/// — and a column at the trailing edge that the
/// mark and the delete control share — the web row's, which is why a title
/// with nothing beside it runs the whole width and is cut only once that
/// column opens under the pointer. A row already wearing a mark has the
/// column open, so the pointer swaps the mark for the ✕ rather than moving
/// the title. Picked, it wears the tree's wash; under the pointer, the same
/// faint one the tree's rows do. The ✕ is a button of its own inside the
/// row's, so pressing it deletes the session rather than picking it.
private struct SessionRow: View {
    let session: ShellSession
    let selected: Bool
    let pick: () -> Void
    @Environment(AppModel.self) private var model
    @State private var isHovering = false
    @State private var prefetch: Task<Void, Never>?

    private static let column: CGFloat = 20
    private static let gap: CGFloat = 6
    /// How long the pointer rests before the row's conversation is read
    /// ahead: past a pointer crossing the row, well short of the click.
    private static let restBeforePrefetch: Duration = .milliseconds(50)
    /// The web row's 160ms: long enough to read as the column opening,
    /// short enough that the title is never chasing the pointer.
    private static let opening = Animation.easeOut(duration: 0.16)

    var body: some View {
        Button(action: pick) { content }
            .buttonStyle(.plain)
            .onHover { hovering in
                isHovering = hovering
                prefetch?.cancel()
                prefetch = hovering ? Task { await prefetchAfterRest() } : nil
            }
            .help(session.title)
    }

    private func prefetchAfterRest() async {
        try? await Task.sleep(for: Self.restBeforePrefetch)
        guard !Task.isCancelled else { return }
        model.chats.prefetch(session.id)
    }

    private var content: some View {
        let open = session.mark != nil || isHovering
        return HStack(spacing: 0) {
            Text(session.title)
                .font(.system(size: 14))
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(maxWidth: .infinity, alignment: .leading)
            ZStack {
                if isHovering {
                    PaneBarButton(symbol: "xmark", help: "Delete session") {
                        model.act(onSessions: .delete([session.id]))
                    }
                } else if let mark = session.mark {
                    SessionMarkDot(mark: mark)
                }
            }
            .frame(width: Self.column, height: 18)
            // Laid out at its own size inside the width that opens, and faded
            // in with it rather than clipped to it: the ✕ is a bar button, and
            // its lit corners are rounded a little wider than the glyph's box
            // — a clip that tight cuts them square. Nothing shows through the
            // opening either way, since the column is only ever empty while it
            // is shut.
            .frame(width: open ? Self.column : 0, height: 18)
            .opacity(open ? 1 : 0)
            .padding(.leading, open ? Self.gap : 0)
        }
        .padding(.horizontal, 8)
        .frame(height: 32)
        .animation(Self.opening, value: open)
        .background(
            selected ? TreeSelection.color : isHovering ? Color.primary.opacity(0.05) : Color.clear,
            in: RoundedRectangle(cornerRadius: 7))
        .contentShape(Rectangle())
    }
}

/// The web row's three marks: the orb sweeping while an agent works, the
/// accent dot standing still for a session that has moved, and red where a
/// turn ended badly.
private struct SessionMarkDot: View {
    let mark: SessionMark

    var body: some View {
        if mark == .running {
            // At 14pt the orb's 15/28 lattice is only 7.5pt across. Its
            // low-opacity resting dots disappear into the sidebar's vibrant
            // material even though the same canvas reads clearly in the
            // toolbar. Use the toolbar scale and explicit semantic ink here;
            // it still fits the row's 20×18 accessory slot.
            Orb(size: 18, label: mark.label)
                .foregroundStyle(.primary)
        } else {
            Image(systemName: "circle.fill")
                .font(.system(size: 7))
                .foregroundStyle(mark == .error ? Color.red : Color.accentColor)
                .accessibilityLabel(mark.label)
        }
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
