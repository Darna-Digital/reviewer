// The one list every place a branch is picked opens — the sidebar's
// switcher, the compare picker beside it, the history's ref, the session
// bar's strip — as a popover: a field over the rows, the rows in their
// sections, and the keys the web app's pickers answer. Typing never
// leaves the field; ↑/↓ walk the rows under it, wrapping at the ends,
// Home and End jump, Return picks the lit row, Escape clears the search
// and then puts the popover away. A row picked is the picker's own
// answer — a checkout, a comparison, a log to follow; what else can be
// done to a branch is the row's menu, at the ellipsis and on a right
// click. A name too long for its row says the whole of itself in a
// tooltip at the row's trailing edge, and only then — for the row the
// pointer is on, or the one the keys walked to (see `RowTooltip`).
import SwiftUI

/// A row the popover offers: a branch, or one of the answers that needs
/// none — "Uncommitted changes", "All branches" — which stands at the
/// head of the list and steps aside while a search is on, since a filter
/// is a search for a branch.
struct BranchChoice: Identifiable, Hashable {
    let id: String
    let branch: BranchRef?
    let title: String
    let symbol: String
    let tint: Color?
    /// What trails the name: how far from upstream, or "lands here".
    let badge: String?
    /// Ticked — the branch the picker is on, where the pick is a setting.
    let checked: Bool

    static func branch(_ ref: BranchRef, badge: String? = nil, checked: Bool = false) -> BranchChoice {
        BranchChoice(
            id: ref.ref, branch: ref, title: ref.display,
            symbol: ref.isCurrent ? "star.fill" : ref.isRemote ? "cloud" : "arrow.triangle.branch",
            tint: ref.isCurrent ? .orange : nil, badge: badge, checked: checked)
    }

    static func answer(id: String, title: String, symbol: String, checked: Bool) -> BranchChoice {
        BranchChoice(id: id, branch: nil, title: title, symbol: symbol, tint: nil, badge: nil, checked: checked)
    }
}

/// A run of rows under a heading — or none, for the answers at the head
/// of the list. Recent is a shortcut for the unsearched list, so it too
/// is `hiddenWhileSearching`: a hit would only stand twice.
struct BranchChoiceSection: Identifiable {
    let id: String
    let title: String?
    let rows: [BranchChoice]
    var hiddenWhileSearching = false
}

/// How far a local branch stands from its upstream, the way the switcher
/// badges it: ↑ what it has to push, ↓ what it has to pull.
func branchDistance(_ branch: BranchInfo) -> String? {
    var parts: [String] = []
    if branch.ahead > 0 { parts.append("↑\(branch.ahead)") }
    if branch.behind > 0 { parts.append("↓\(branch.behind)") }
    return parts.isEmpty ? nil : parts.joined(separator: " ")
}

/// A row as the search leaves it on screen: under a key of its own even
/// where a branch stands in two sections, and at its place in the walk.
private struct Line: Identifiable {
    let key: String
    let choice: BranchChoice
    let index: Int
    var id: String { key }
}

private struct ShownSection: Identifiable {
    let id: String
    let title: String?
    let lines: [Line]
}

/// Which row is being read — the one under the pointer, or the one the
/// keys walked to since the pointer last moved over the list — kept out of
/// the popover's own state, so the pointer crossing rows as the list
/// scrolls redraws the rows it crossed and not the whole popover, its
/// search and its sections along with them.
@MainActor @Observable
private final class RowReading {
    var hovered: String?
    var walked: String?
    var key: String? { hovered ?? walked }
}

struct BranchPopover<Footer: View>: View {
    let sections: [BranchChoiceSection]
    let placeholder: String
    let pick: (BranchChoice) -> Void
    let dismiss: () -> Void
    /// The row's submenu — what can be done to the branch besides picking
    /// it — or nil where a pick is all a row is for.
    let actions: ((BranchRef) -> [BranchAction])?
    @ViewBuilder let footer: Footer

    @State private var query = ""
    @State private var active = 0
    @State private var reading = RowReading()
    @FocusState private var fieldFocused: Bool

    private static var width: CGFloat { 320 }
    private static var listHeight: CGFloat { 360 }

    private var searching: Bool { !needle.isEmpty }
    private var needle: String { query.trimmingCharacters(in: .whitespaces) }

    /// The sections as the search leaves them, empty ones dropped, every
    /// row numbered in the order the keys walk them.
    private var shown: [ShownSection] {
        var index = 0
        return sections.compactMap { section in
            if searching, section.hiddenWhileSearching { return nil }
            let rows = searching ? section.rows.filter { $0.title.localizedCaseInsensitiveContains(needle) } : section.rows
            guard !rows.isEmpty else { return nil }
            let lines = rows.map { choice in
                defer { index += 1 }
                return Line(key: "\(section.id)/\(choice.id)", choice: choice, index: index)
            }
            return ShownSection(id: section.id, title: section.title, lines: lines)
        }
    }

    var body: some View {
        let shown = shown
        let lines = shown.flatMap(\.lines)
        VStack(spacing: 0) {
            field(lines)
            ThemedDivider()
            if lines.isEmpty {
                Text("No branch matches.")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 80)
            } else {
                list(shown, lines)
            }
            footer
        }
        .frame(width: Self.width)
        .onKeyPress(.upArrow) { step(-1, in: lines) }
        .onKeyPress(.downArrow) { step(1, in: lines) }
        .onKeyPress(.home) { walk(to: 0, in: lines) }
        .onKeyPress(.end) { walk(to: lines.count - 1, in: lines) }
        .onKeyPress(.escape) {
            if searching { query = "" } else { dismiss() }
            return .handled
        }
        .onChange(of: query) {
            active = 0
            reading.walked = nil
        }
        .onChange(of: lines.count) { _, count in active = count == 0 ? 0 : min(active, count - 1) }
        // The field is focused only once it is on screen, a turn of the
        // run loop after the popover comes up.
        .onAppear { Task { @MainActor in fieldFocused = true } }
    }

    private func field(_ lines: [Line]) -> some View {
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
            TextField(placeholder, text: $query)
                .textFieldStyle(.plain)
                .font(.system(size: 12))
                .focused($fieldFocused)
                .autocorrectionDisabled()
                .onSubmit { pick(at: active, in: lines) }
        }
        .padding(.horizontal, 10)
        .frame(height: 32)
    }

    private func list(_ shown: [ShownSection], _ lines: [Line]) -> some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 1) {
                    ForEach(shown) { section in
                        if let title = section.title {
                            SectionHeader(title: title, count: section.lines.count)
                        }
                        ForEach(section.lines) { line in
                            ChoiceRow(
                                line: line, lit: line.index == active, reading: reading,
                                actions: actions.flatMap { actions in line.choice.branch.map { branch in { actions(branch) } } },
                                ran: dismiss
                            ) {
                                pick(at: line.index, in: lines)
                            }
                            .id(line.key)
                        }
                    }
                }
                .padding(4)
            }
            .frame(maxHeight: Self.listHeight)
            .onChange(of: active) { _, index in
                guard lines.indices.contains(index) else { return }
                proxy.scrollTo(lines[index].key)
            }
        }
    }

    private func step(_ offset: Int, in lines: [Line]) -> KeyPress.Result {
        guard !lines.isEmpty else { return .handled }
        return walk(to: (active + offset + lines.count) % lines.count, in: lines)
    }

    private func walk(to index: Int, in lines: [Line]) -> KeyPress.Result {
        guard lines.indices.contains(index) else { return .handled }
        active = index
        reading.walked = lines[index].key
        return .handled
    }

    private func pick(at index: Int, in lines: [Line]) {
        guard lines.indices.contains(index) else { return }
        dismiss()
        pick(lines[index].choice)
    }
}

extension BranchPopover where Footer == EmptyView {
    /// A picker whose rows are only for picking, with nothing under them.
    init(
        sections: [BranchChoiceSection], placeholder: String, pick: @escaping (BranchChoice) -> Void,
        dismiss: @escaping () -> Void
    ) {
        self.init(sections: sections, placeholder: placeholder, pick: pick, dismiss: dismiss, actions: nil) { EmptyView() }
    }
}

/// The rows' type, named once so the clip is measured in the font the
/// row sets the name in.
private var rowFont: NSFont { .systemFont(ofSize: 12) }

private struct SectionHeader: View {
    let title: String
    let count: Int

    var body: some View {
        HStack(spacing: 4) {
            Text(title)
            Text("\(count)")
                .font(.system(size: 10, weight: .regular).monospacedDigit())
                .foregroundStyle(.secondary)
        }
        .font(.system(size: 10, weight: .semibold))
        .foregroundStyle(.secondary)
        .padding(.horizontal, 8)
        .padding(.top, 8)
        .padding(.bottom, 2)
    }
}

/// One row: the glyph, the name — cut in the middle, the whole of it in
/// a tooltip at the trailing edge while it is cut and the row is being
/// read — the badge, the tick, and the ellipsis at the trailing edge once
/// the pointer or the keys are on the row, opening the row's submenu off
/// its trailing edge, as a right click does. Lit by the keys in one wash
/// and by the pointer in a fainter one, kept apart so a list walked under
/// a still pointer is not fought over.
private struct ChoiceRow: View {
    let line: Line
    let lit: Bool
    let reading: RowReading
    /// The branch's submenu, built only once it opens.
    let actions: (() -> [BranchAction])?
    let ran: () -> Void
    let pick: () -> Void
    @State private var clipped = false
    @State private var submenuOpen = false

    private var choice: BranchChoice { line.choice }

    var body: some View {
        let hovered = reading.hovered == line.key
        HStack(spacing: 8) {
            Image(systemName: choice.symbol)
                .foregroundStyle(choice.tint ?? Color.secondary)
                .frame(width: 14)
            Text(choice.title)
                .lineLimit(1)
                .truncationMode(.middle)
                .measuringClip(choice.title, font: rowFont, into: $clipped)
            Spacer(minLength: 4)
            if let badge = choice.badge {
                Text(badge)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
            if choice.checked {
                Image(systemName: "checkmark")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Color.accentColor)
            }
            if actions != nil {
                // The glyph holds the ellipsis's room on every row, so the
                // name is cut the same whether or not the row is lit; the
                // button itself is only drawn over the row being used.
                Image(systemName: "ellipsis.circle")
                    .hidden()
                    .overlay {
                        if hovered || lit || submenuOpen {
                            Button { submenuOpen.toggle() } label: { Image(systemName: "ellipsis.circle") }
                                .buttonStyle(.borderless)
                        }
                    }
            }
        }
        .font(Font(rowFont))
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            Color.primary.opacity(lit || submenuOpen ? 0.1 : hovered ? 0.06 : 0),
            in: RoundedRectangle(cornerRadius: 6))
        // The submenu opens where the tooltip would stand, so the tooltip
        // gives way to it.
        .rowTooltip(clipped ? choice.title : nil, active: reading.key == line.key && !submenuOpen)
        .contentShape(Rectangle())
        .onTapGesture(perform: pick)
        .onHover { inside in
            if inside {
                reading.hovered = line.key
                reading.walked = nil
            } else if reading.hovered == line.key {
                reading.hovered = nil
            }
        }
        .overlay {
            if actions != nil { SecondaryClick { submenuOpen = true } }
        }
        .popover(isPresented: $submenuOpen, arrowEdge: .trailing) {
            if let actions {
                BranchActionMenu(actions: actions()) {
                    submenuOpen = false
                    ran()
                }
            }
        }
    }
}
