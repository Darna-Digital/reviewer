// The sessions list's filter, as the web rail's popover: one control for
// both axes — where the conversation was had, and how far back to look.
// A place is a saved workspace, which holds the sessions started in it, or
// a repository, which holds every session whose agent ran in it, opened
// alone or inside a workspace. They are searchable because the list spans
// all of them at once, and there are as many as you have ever worked in; a
// column of radio items is a list you scroll to find the one you meant.
// The workspaces stand under the glyph the opener gives them, the
// repositories under the avatar each is known by everywhere else (see
// `RepoAvatar`), and "Everywhere" keeps the badge's shape so the names stay
// in one column. Under each repository stands the folder it lives in, the
// home folder folded to `~` — two checkouts of one repository share a name,
// and the path is what tells them apart — and the search reads the path as
// well as the name. A path too long for its row is cut at its end and says
// the whole of itself in a tooltip off the row's trailing edge, as a branch
// name does in the branch picker (see `RowTooltip`).
// The dates stand under a rule of their own, plain — a range needs no
// mark — and a pick on either axis puts the popover away.
//
// The keys are the branch popover's (see `popoverListKeys`): ↑/↓ walk the
// rows, wrapping at the ends, Return picks the lit one, Escape clears the
// search and then closes — with or without the field, which a single
// place goes without.
import SwiftUI

struct SessionFilterPopover: View {
    let filters: ShellSessionFilters
    let dismiss: () -> Void
    let choose: (_ place: SessionPlace?, _ date: SessionDateFilter?) -> Void

    @State private var query = ""
    @State private var fieldWantsKeyboard = false
    @State private var active = 0

    static let workspaceSymbol = "square.on.square"

    private static let width: CGFloat = 288
    private static let listHeight: CGFloat = 320
    private static let home = NSHomeDirectory()

    private var needle: String { query.trimmingCharacters(in: .whitespaces) }
    private var searching: Bool { !needle.isEmpty }
    /// More than one place is a choice; one is only a fact.
    private var hasPlaces: Bool { filters.places.count > 1 }

    private var shownWorkspaces: [ShellWorkspaceTally] {
        guard searching else { return filters.places.workspaces }
        return filters.places.workspaces.filter { $0.name.localizedCaseInsensitiveContains(needle) }
    }

    private var shownRepos: [ShellRepoTally] {
        guard searching else { return filters.places.repos }
        return filters.places.repos.filter {
            $0.name.localizedCaseInsensitiveContains(needle) || folded($0.path).localizedCaseInsensitiveContains(needle)
        }
    }

    /// Every row the keys can land on, in order: the places, then the dates.
    private enum Line: Hashable {
        case place(SessionPlace)
        case date(SessionDateFilter)
    }

    private var lines: [Line] {
        var lines: [Line] = []
        if hasPlaces {
            if !searching { lines.append(.place(.all)) }
            lines += shownWorkspaces.map { .place(.workspace(id: $0.id)) }
            lines += shownRepos.map { .place(.repo(path: $0.path)) }
        }
        lines += SessionDateFilter.allCases.map { .date($0) }
        return lines
    }

    var body: some View {
        let lines = lines
        VStack(spacing: 0) {
            if hasPlaces {
                field
                ThemedDivider()
                places(lines)
                ThemedDivider()
            }
            dates(lines)
        }
        .frame(width: Self.width)
        .popoverListKeys(active: activeOrNone, count: lines.count, pick: { pick(at: $0, in: lines) }) { press in
            guard press.key == .escape, searching else { return false }
            query = ""
            return true
        }
        .onChange(of: query) { active = 0 }
        .onChange(of: lines.count) { _, count in active = count == 0 ? 0 : min(active, count - 1) }
    }

    private func folded(_ path: String) -> String {
        RepoRow.fold(path, home: Self.home)
    }

    private var activeOrNone: Binding<Int?> {
        Binding(get: { active }, set: { active = $0 ?? 0 })
    }

    private var field: some View {
        MinimalSearchField(prompt: "Search workspaces and repositories", text: $query, takesKeyboard: $fieldWantsKeyboard)
            .padding(8)
            .onAppear { fieldWantsKeyboard = true }
    }

    private func places(_ lines: [Line]) -> some View {
        let workspaces = shownWorkspaces
        let repos = shownRepos
        return ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 1) {
                    if !searching {
                        placeRow(.all, lit: lines[safe: active]) {
                            PlaceMark(systemName: "folder")
                            Text("Everywhere")
                                .lineLimit(1)
                        }
                    }
                    if !workspaces.isEmpty {
                        GroupLabel(title: "Workspaces")
                    }
                    ForEach(workspaces) { workspace in
                        placeRow(.workspace(id: workspace.id), lit: lines[safe: active]) {
                            PlaceMark(systemName: Self.workspaceSymbol)
                            Text(workspace.name)
                                .lineLimit(1)
                                .truncationMode(.middle)
                        }
                    }
                    if !repos.isEmpty {
                        GroupLabel(title: "Repositories")
                    }
                    ForEach(repos) { repo in
                        let place = SessionPlace.repo(path: repo.path)
                        RepoFilterRow(
                            name: repo.name, path: folded(repo.path),
                            lit: lines[safe: active] == .place(place), checked: filters.place == place
                        ) {
                            take(.place(place))
                        }
                        .id(Line.place(place))
                    }
                    if workspaces.isEmpty && repos.isEmpty {
                        Text("Nothing matches.")
                            .font(.system(size: 12))
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 10)
                    }
                }
                .padding(4)
            }
            .frame(maxHeight: Self.listHeight)
            .onChange(of: active) { _, index in
                guard lines.indices.contains(index) else { return }
                proxy.scrollTo(lines[index])
            }
        }
    }

    private func placeRow<Content: View>(
        _ place: SessionPlace, lit: Line?, @ViewBuilder content: () -> Content
    ) -> some View {
        FilterRow(lit: lit == .place(place), checked: filters.place == place) {
            content()
        } pick: {
            take(.place(place))
        }
        .id(Line.place(place))
    }

    private func dates(_ lines: [Line]) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            ForEach(SessionDateFilter.allCases) { date in
                FilterRow(lit: lines[safe: active] == .date(date), checked: filters.date == date) {
                    Text(date.label)
                        .lineLimit(1)
                } pick: {
                    take(.date(date))
                }
            }
        }
        .padding(4)
    }

    private func pick(at index: Int, in lines: [Line]) {
        guard lines.indices.contains(index) else { return }
        take(lines[index])
    }

    private func take(_ line: Line) {
        dismiss()
        switch line {
        case .place(let place): choose(place, nil)
        case .date(let date): choose(nil, date)
        }
    }
}

/// The mark a row without an avatar of its own wears in the avatars'
/// column: a glyph on the row's own wash, the badge's size and corner.
private struct PlaceMark: View {
    let systemName: String

    var body: some View {
        Image(systemName: systemName)
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(.secondary)
            .frame(width: 20, height: 20)
            .background(Color.primary.opacity(0.08), in: RoundedRectangle(cornerRadius: 20 * 3 / 16))
    }
}

/// The heading over the workspaces, and over the repositories.
private struct GroupLabel: View {
    let title: String

    var body: some View {
        Text(title)
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 6)
            .padding(.top, 8)
            .padding(.bottom, 2)
    }
}

/// A repository's row: its avatar, its name, and the folder it lives in
/// beneath, cut at the end when the row is too narrow for it.
private struct RepoFilterRow: View {
    let name: String
    let path: String
    let lit: Bool
    let checked: Bool
    let pick: () -> Void
    @State private var pathClipped = false

    private static let height: CGFloat = 42
    private static let pathFont = NSFont.systemFont(ofSize: 11)

    var body: some View {
        FilterRow(lit: lit, checked: checked, height: Self.height, tooltip: pathClipped ? path : nil) {
            RepoAvatar(name: name, size: 20)
            VStack(alignment: .leading, spacing: 1) {
                Text(name)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Text(path)
                    .font(Font(Self.pathFont))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .measuringClip(path, font: Self.pathFont, into: $pathClipped)
            }
        } pick: {
            pick()
        }
    }
}

/// One row: what it is, and a tick at the trailing edge for the one the
/// list is narrowed to. Lit by the keys in one wash and by the pointer in
/// a fainter one, kept apart so a list walked under a still pointer is not
/// fought over — the branch popover's rows, in their shape.
private struct FilterRow<Content: View>: View {
    let lit: Bool
    let checked: Bool
    var height: CGFloat = 32
    /// What the row says off its trailing edge while it is lit or pointed
    /// at — the whole of what it had to cut.
    var tooltip: String? = nil
    @ViewBuilder let content: Content
    let pick: () -> Void
    @State private var isHovering = false

    var body: some View {
        HStack(spacing: 8) {
            content
            Spacer(minLength: 4)
            Image(systemName: "checkmark")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color.accentColor)
                .opacity(checked ? 1 : 0)
        }
        .font(.system(size: 13))
        .padding(.horizontal, 6)
        .frame(height: height)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            Color.primary.opacity(lit ? 0.1 : isHovering ? 0.06 : 0),
            in: RoundedRectangle(cornerRadius: 6))
        .rowTooltip(tooltip, active: isHovering || lit)
        .contentShape(Rectangle())
        .onTapGesture(perform: pick)
        .onHover { isHovering = $0 }
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
