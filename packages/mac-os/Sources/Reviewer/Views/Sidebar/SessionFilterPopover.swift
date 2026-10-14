// The sessions list's filter, as the web rail's popover: one control for
// both axes — the project the conversation was had in, and how far back
// to look. The projects are searchable because the list spans all of them
// at once, and there are as many as you have ever worked in; a column of
// radio items is a list you scroll to find the one you meant. Each stands
// under the avatar it is known by everywhere else (see `RepoAvatar`), and
// "All projects" keeps the badge's shape so the names stay in one column.
// Under each name stands the folder it lives in, the home folder folded to
// `~` — two checkouts of one repository share a name, and the path is what
// tells them apart — and the search reads the path as well as the name. A
// path too long for its row is cut at its end and says the whole of itself
// in a tooltip off the row's trailing edge, as a branch name does in the
// branch picker (see `RowTooltip`).
// The dates stand under a rule of their own, plain — a range needs no
// mark — and a pick on either axis puts the popover away.
//
// The keys are the branch popover's (see `popoverListKeys`): ↑/↓ walk the
// rows, wrapping at the ends, Return picks the lit one, Escape clears the
// search and then closes — with or without the field, which a single
// project goes without.
import SwiftUI

struct SessionFilterPopover: View {
    let filters: ShellSessionFilters
    let dismiss: () -> Void
    let choose: (_ project: String?, _ date: SessionDateFilter?) -> Void

    @State private var query = ""
    @State private var active = 0

    private static let width: CGFloat = 288
    private static let listHeight: CGFloat = 264
    private static let home = NSHomeDirectory()

    private var needle: String { query.trimmingCharacters(in: .whitespaces) }
    private var searching: Bool { !needle.isEmpty }
    /// More than one project is a choice; one is only a fact.
    private var hasProjects: Bool { filters.projects.count > 1 }

    private var shown: [ShellProjectTally] {
        guard searching else { return filters.projects }
        return filters.projects.filter {
            $0.name.localizedCaseInsensitiveContains(needle) || folded($0.path).localizedCaseInsensitiveContains(needle)
        }
    }

    /// Every row the keys can land on, in order: the projects, then the dates.
    private enum Line: Hashable {
        case allProjects
        case project(String)
        case date(SessionDateFilter)
    }

    private var lines: [Line] {
        var lines: [Line] = []
        if hasProjects {
            if !searching { lines.append(.allProjects) }
            lines += shown.map { .project($0.path) }
        }
        lines += SessionDateFilter.allCases.map { .date($0) }
        return lines
    }

    var body: some View {
        let lines = lines
        VStack(spacing: 0) {
            if hasProjects {
                field
                ThemedDivider()
                projects(lines)
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
        PaneSearchField(prompt: "Search projects", text: $query, focusesOnAppear: true)
            .padding(8)
    }

    private func projects(_ lines: [Line]) -> some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 1) {
                    if !searching {
                        FilterRow(lit: lines[safe: active] == .allProjects, checked: filters.project == ShellSessionFilters.allProjects) {
                            AllProjectsMark()
                            Text("All projects")
                                .lineLimit(1)
                        } pick: {
                            take(.allProjects)
                        }
                        .id(Line.allProjects)
                    }
                    ForEach(shown) { project in
                        ProjectFilterRow(
                            name: project.name, path: folded(project.path),
                            lit: lines[safe: active] == .project(project.path), checked: filters.project == project.path
                        ) {
                            take(.project(project.path))
                        }
                        .id(Line.project(project.path))
                    }
                    if shown.isEmpty {
                        Text("No projects match.")
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
        case .allProjects: choose(ShellSessionFilters.allProjects, nil)
        case .project(let path): choose(path, nil)
        case .date(let date): choose(nil, date)
        }
    }
}

/// The mark "All projects" wears in the avatars' column: a folder on the
/// row's own wash, the badge's size and corner.
private struct AllProjectsMark: View {
    var body: some View {
        Image(systemName: "folder")
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(.secondary)
            .frame(width: 20, height: 20)
            .background(Color.primary.opacity(0.08), in: RoundedRectangle(cornerRadius: 20 * 3 / 16))
    }
}

/// A project's row: its avatar, its name, and the folder it lives in
/// beneath, cut at the end when the row is too narrow for it.
private struct ProjectFilterRow: View {
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
