// The sessions list as a native source list, drawn from what the page
// reports while it is on the sessions surface (see `ShellSessions`) in the
// web list's shape: one line per session, the title and nothing else, with
// the one mark that changes at the trailing edge — the pulse of a working
// agent, a red dot where a turn ended badly, the accent dot for a session
// that moved since it was last opened — and the delete control taking the
// mark's place under the pointer. The cloud runs stand in a group of their
// own above, as they do in the web list. Picking a row sends the page to
// that session; the menu lifts it into a tab of its own, or deletes it; and
// the foot of the list coming into view asks the page for its next page.
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
                SessionsHeader(count: list.sessions.count, hasMore: list.hasMore)
                if list.isEmpty {
                    SessionsPlaceholder(loading: list.loading)
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
                        SessionRow(session: run, deletable: false)
                            .tag(run.id)
                    }
                }
            }
            Section {
                ForEach(list.sessions) { session in
                    SessionRow(session: session, deletable: true)
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

/// How many sessions the list holds — of the ones loaded so far, while the
/// server has more to give.
private struct SessionsHeader: View {
    let count: Int
    let hasMore: Bool

    var body: some View {
        HStack {
            Text(count == 1 ? "1 session" : "\(count)\(hasMore ? "+" : "") sessions")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
            Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.top, 2)
        .padding(.bottom, 4)
    }
}

/// A session's row: its title, and at the trailing edge its mark — or, with
/// the pointer over it, the delete control in the mark's place, so the title
/// runs to the same edge on every row.
private struct SessionRow: View {
    let session: ShellSession
    let deletable: Bool
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
                if isHovering && deletable {
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
        .help("\(session.title) — \(session.origin)")
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

    var body: some View {
        VStack {
            Spacer()
            if loading {
                ProgressView()
                    .controlSize(.small)
            } else {
                Text("No sessions")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}
