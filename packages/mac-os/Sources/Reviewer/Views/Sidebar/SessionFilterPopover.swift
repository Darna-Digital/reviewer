// The sessions list's filter, as the web rail's popover: one control for
// both axes — the project the conversation was had in, and how far back
// to look. The projects are searchable because the list spans all of them
// at once, and there are as many as you have ever worked in; a column of
// radio items is a list you scroll to find the one you meant. Each stands
// under the avatar it is known by everywhere else (see `RepoAvatar`), and
// "All projects" keeps the badge's shape so the names stay in one column.
// The dates stand under a rule of their own, plain — a range needs no
// mark — and a pick on either axis puts the popover away.
//
// The field is the pane bars' own search field, and takes the keys the
// branch popover's does: ↑/↓ walk the rows under it, wrapping at the ends,
// Return picks the lit one, Escape clears the search and then closes.
import SwiftUI

struct SessionFilterPopover: View {
    let filters: ShellSessionFilters
    let dismiss: () -> Void
    let choose: (_ project: String?, _ date: SessionDateFilter?) -> Void

    @State private var query = ""
    @State private var active = 0

    private static let width: CGFloat = 288
    private static let listHeight: CGFloat = 224

    private var needle: String { query.trimmingCharacters(in: .whitespaces) }
    private var searching: Bool { !needle.isEmpty }
    /// More than one project is a choice; one is only a fact.
    private var hasProjects: Bool { filters.projects.count > 1 }

    private var shown: [ShellProjectTally] {
        searching ? filters.projects.filter { $0.name.localizedCaseInsensitiveContains(needle) } : filters.projects
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
                Divider()
                projects(lines)
                Divider()
            }
            dates(lines)
        }
        .frame(width: Self.width)
        .onChange(of: query) { active = 0 }
        .onChange(of: lines.count) { _, count in active = count == 0 ? 0 : min(active, count - 1) }
    }

    private var field: some View {
        PaneSearchField(prompt: "Search projects", text: $query, focusesOnAppear: true, command: take(command:))
            .padding(8)
    }

    /// The keys the field hands over: the arrows walk the rows, Return
    /// picks, Escape clears the search and then closes.
    private func take(command selector: Selector) -> Bool {
        switch selector {
        case #selector(NSResponder.moveUp(_:)):
            step(-1, in: lines.count)
        case #selector(NSResponder.moveDown(_:)):
            step(1, in: lines.count)
        case #selector(NSResponder.insertNewline(_:)):
            pick(at: active, in: lines)
        case #selector(NSResponder.cancelOperation(_:)):
            if searching { query = "" } else { dismiss() }
        default:
            return false
        }
        return true
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
                        FilterRow(lit: lines[safe: active] == .project(project.path), checked: filters.project == project.path) {
                            RepoAvatar(name: project.name, size: 20)
                            Text(project.name)
                                .lineLimit(1)
                                .truncationMode(.middle)
                        } pick: {
                            take(.project(project.path))
                        }
                        .help(project.path)
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

    private func step(_ offset: Int, in count: Int) {
        guard count > 0 else { return }
        active = (active + offset + count) % count
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

/// One row: what it is, and a tick at the trailing edge for the one the
/// list is narrowed to. Lit by the keys in one wash and by the pointer in
/// a fainter one, kept apart so a list walked under a still pointer is not
/// fought over — the branch popover's rows, in their shape.
private struct FilterRow<Content: View>: View {
    let lit: Bool
    let checked: Bool
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
        .frame(height: 32)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            Color.primary.opacity(lit ? 0.1 : isHovering ? 0.06 : 0),
            in: RoundedRectangle(cornerRadius: 6))
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
