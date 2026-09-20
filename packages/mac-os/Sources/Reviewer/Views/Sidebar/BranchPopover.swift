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
// tooltip, and only then (see `ClipTooltip`).
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

struct BranchPopover<Actions: View, Footer: View>: View {
    let sections: [BranchChoiceSection]
    let placeholder: String
    let pick: (BranchChoice) -> Void
    let dismiss: () -> Void
    /// The row's menu — what can be done to the branch besides picking it
    /// — or nil where a pick is all a row is for.
    let actions: ((BranchRef) -> Actions)?
    @ViewBuilder let footer: Footer

    @State private var query = ""
    @State private var active = 0
    @FocusState private var fieldFocused: Bool

    private static var width: CGFloat { 320 }
    private static var listHeight: CGFloat { 360 }

    private var searching: Bool { !needle.isEmpty }
    private var needle: String { query.trimmingCharacters(in: .whitespaces) }

    /// The sections as the search leaves them, empty ones dropped.
    private var shown: [BranchChoiceSection] {
        sections.compactMap { section in
            if searching, section.hiddenWhileSearching { return nil }
            let rows = searching ? section.rows.filter { $0.title.localizedCaseInsensitiveContains(needle) } : section.rows
            guard !rows.isEmpty else { return nil }
            return BranchChoiceSection(id: section.id, title: section.title, rows: rows)
        }
    }

    /// Every row on screen, in order, each under a key of its own even
    /// where a branch stands in two sections.
    private var lines: [(key: String, choice: BranchChoice)] {
        shown.flatMap { section in section.rows.map { (key: "\(section.id)/\($0.id)", choice: $0) } }
    }

    var body: some View {
        let lines = lines
        VStack(spacing: 0) {
            field
            Divider()
            if lines.isEmpty {
                Text("No branch matches.")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 80)
            } else {
                list(lines)
            }
            footer
        }
        .frame(width: Self.width)
        .onKeyPress(.upArrow) { step(-1, in: lines.count) }
        .onKeyPress(.downArrow) { step(1, in: lines.count) }
        .onKeyPress(.home) { active = 0; return .handled }
        .onKeyPress(.end) { active = max(0, lines.count - 1); return .handled }
        .onKeyPress(.escape) {
            if searching { query = "" } else { dismiss() }
            return .handled
        }
        .onChange(of: query) { active = 0 }
        .onChange(of: lines.count) { _, count in active = count == 0 ? 0 : min(active, count - 1) }
        // The field is focused only once it is on screen, a turn of the
        // run loop after the popover comes up.
        .onAppear { Task { @MainActor in fieldFocused = true } }
    }

    private var field: some View {
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
            TextField(placeholder, text: $query)
                .textFieldStyle(.plain)
                .font(.system(size: 12))
                .focused($fieldFocused)
                .autocorrectionDisabled()
                .onSubmit { pick(at: active, in: self.lines) }
        }
        .padding(.horizontal, 10)
        .frame(height: 32)
    }

    private func list(_ lines: [(key: String, choice: BranchChoice)]) -> some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 1) {
                    ForEach(shown) { section in
                        if let title = section.title {
                            SectionHeader(title: title, count: section.rows.count)
                        }
                        ForEach(section.rows) { choice in
                            let key = "\(section.id)/\(choice.id)"
                            let index = lines.firstIndex { $0.key == key } ?? 0
                            ChoiceRow(choice: choice, lit: index == active, actions: actions) {
                                pick(at: index, in: lines)
                            }
                            .id(key)
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

    private func step(_ offset: Int, in count: Int) -> KeyPress.Result {
        guard count > 0 else { return .handled }
        active = (active + offset + count) % count
        return .handled
    }

    private func pick(at index: Int, in lines: [(key: String, choice: BranchChoice)]) {
        guard lines.indices.contains(index) else { return }
        dismiss()
        pick(lines[index].choice)
    }
}

extension BranchPopover where Actions == EmptyView, Footer == EmptyView {
    /// A picker whose rows are only for picking, with nothing under them.
    init(
        sections: [BranchChoiceSection], placeholder: String, pick: @escaping (BranchChoice) -> Void,
        dismiss: @escaping () -> Void
    ) {
        self.init(sections: sections, placeholder: placeholder, pick: pick, dismiss: dismiss, actions: nil) { EmptyView() }
    }
}

/// The rows' type, named once so the tooltip measures the name in the
/// font the row sets it in.
private var rowFont: NSFont { .systemFont(ofSize: 12) }

private struct SectionHeader: View {
    let title: String
    let count: Int

    var body: some View {
        HStack(spacing: 4) {
            Text(title)
            Text("\(count)")
                .foregroundStyle(.tertiary)
        }
        .font(.system(size: 10, weight: .semibold))
        .foregroundStyle(.secondary)
        .padding(.horizontal, 8)
        .padding(.top, 8)
        .padding(.bottom, 2)
    }
}

/// One row: the glyph, the name — cut in the middle, the whole of it in
/// a tooltip while it is cut — the badge, the tick, and the menu at the
/// trailing edge once the pointer or the keys are on the row. Lit by the
/// keys in one wash and by the pointer in a fainter one, kept apart so a
/// list walked under a still pointer is not fought over.
private struct ChoiceRow<Actions: View>: View {
    let choice: BranchChoice
    let lit: Bool
    let actions: ((BranchRef) -> Actions)?
    let pick: () -> Void
    @State private var isHovering = false

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: choice.symbol)
                .foregroundStyle(choice.tint ?? Color.secondary)
                .frame(width: 14)
            Text(choice.title)
                .lineLimit(1)
                .truncationMode(.middle)
                .clipTooltip(choice.title, font: rowFont)
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
            if let actions, let branch = choice.branch {
                Menu {
                    actions(branch)
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
                .menuStyle(.borderlessButton)
                .menuIndicator(.hidden)
                .fixedSize()
                .opacity(isHovering || lit ? 1 : 0)
            }
        }
        .font(Font(rowFont))
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            Color.primary.opacity(lit ? 0.1 : isHovering ? 0.06 : 0),
            in: RoundedRectangle(cornerRadius: 6))
        .contentShape(Rectangle())
        .onTapGesture(perform: pick)
        .onHover { isHovering = $0 }
        .modifier(RowMenu(actions: actions, branch: choice.branch))
    }
}

private struct RowMenu<Actions: View>: ViewModifier {
    let actions: ((BranchRef) -> Actions)?
    let branch: BranchRef?

    func body(content: Content) -> some View {
        if let actions, let branch {
            content.contextMenu { actions(branch) }
        } else {
            content
        }
    }
}
