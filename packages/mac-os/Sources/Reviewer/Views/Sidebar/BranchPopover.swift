// The one list every place a branch is picked opens — the sidebar's
// switcher, the compare picker beside it, the history's ref, the session
// bar's strip — as a popover: a field over the rows, the rows in their
// sections, and the keys the web app's pickers answer. Typing never
// leaves the field; ↑/↓ walk the rows under it, wrapping at the ends,
// Home and End jump, Return picks the lit row, → opens the lit row's
// submenu and ← in it comes back, Escape clears the search and then puts
// the popover away. A row picked is the picker's own answer — a checkout,
// a comparison, a log to follow; what else can be done to a branch is the
// row's menu, at the ellipsis and on a right click. A name too long for
// its row says the whole of itself in a tooltip at the row's trailing
// edge, and only then — for the row the pointer is on, or the one the
// keys walked to (see `RowTooltip`).
import SwiftUI

extension View {
    /// The row of buttons at a picker popover's foot: their pills lined up
    /// with the rows' highlight above, and clear of the popover's rounded
    /// corners below.
    func popoverFooterBar() -> some View {
        buttonStyle(.accessoryBar)
            .controlSize(.small)
            .padding(.horizontal, BranchPopover<EmptyView>.listInset)
            .padding(.top, 6)
            .padding(.bottom, 9)
    }
}

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
    /// A second line under the name, on one line cut in the middle — the
    /// branch a repository is on, in the repository picker.
    var detail: String? = nil
    /// What hovering the row says beyond what it shows — where a
    /// repository lives, which is noise in the row itself.
    var tooltip: String? = nil
    /// The glyph before `detail` — a branch's, where the detail is one —
    /// or nil for a detail that is no branch.
    var detailSymbol: String? = nil
    /// The names whose monograms stand in the glyph's place — a
    /// repository's, so a row wears the colour it wears everywhere else, or
    /// a workspace's repositories', overlapping.
    var monograms: [String] = []

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

/// The submenu open, and on which row — one at a time across the list —
/// and whether the keys opened it, which lights its first item.
private struct Submenu: Equatable {
    let key: String
    let fromKeys: Bool
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
    /// A row whose pick leads further in — a repository, opening its
    /// branches — rather than being the answer: the popover stays up for
    /// what comes next instead of going away under it.
    var drillsIn: (BranchChoice) -> Bool = { _ in false }
    @ViewBuilder let footer: Footer

    @State private var query = ""
    @State private var active = 0
    @State private var reading = RowReading()
    @State private var submenu: Submenu?
    @FocusState private var fieldFocused: Bool

    private static var width: CGFloat { 320 }
    private static var listHeight: CGFloat { 360 }
    /// The air between the rows' highlight and the popover's edges.
    static var listInset: CGFloat { 6 }
    /// How the list — and the popover around it — moves to a new height: a
    /// gentle ease, for a change of size the eye follows rather than a
    /// press it answers.
    static var resize: Animation { .smooth(duration: 0.32) }

    /// Which rows these are: another step's, not a search of these.
    private var stepKey: String { sections.map(\.id).joined(separator: "\n") }

    @State private var contentHeight: CGFloat = 0

    private var searching: Bool { !needle.isEmpty }
    private var needle: String { query.trimmingCharacters(in: .whitespaces) }

    /// The sections as the search leaves them, empty ones dropped, every
    /// row numbered in the order the keys walk them.
    private var shown: [ShownSection] {
        var index = 0
        return sections.compactMap { section in
            if searching, section.hiddenWhileSearching { return nil }
            let rows = searching
                ? section.rows.filter {
                    $0.title.localizedCaseInsensitiveContains(needle)
                        || ($0.detail?.localizedCaseInsensitiveContains(needle) ?? false)
                }
                : section.rows
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
        .popoverKeys { press in take(press, in: lines) }
        .onChange(of: query) {
            active = 0
            reading.walked = nil
        }
        .onChange(of: lines.count) { _, count in active = count == 0 ? 0 : min(active, count - 1) }
        // A submenu put away hands the keys back to the search, so ↑/↓ go
        // on walking the branches from where they were.
        .onChange(of: submenu) { _, open in
            if open == nil { Task { @MainActor in fieldFocused = true } }
        }
        // The field is focused only once it is on screen, a turn of the
        // run loop after the popover comes up.
        .onAppear { Task { @MainActor in fieldFocused = true } }
        // Rows swapped for another step's — a repository's branches after
        // the repositories — start the search and the walk over.
        .onChange(of: sections.map(\.id)) {
            query = ""
            active = 0
        }
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
        }
        .padding(.horizontal, 10)
        .frame(height: 32)
    }

    private func list(_ shown: [ShownSection], _ lines: [Line]) -> some View {
        ScrollViewReader { proxy in
            ScrollView {
                // Rows swapped for another step's crossfade, the old over
                // the new, while the list eases to the new rows' height —
                // keyed by the step so a search, which only narrows the
                // same rows, does not fade them.
                ZStack(alignment: .top) {
                    LazyVStack(alignment: .leading, spacing: 1) {
                        ForEach(shown) { section in
                            if let title = section.title {
                                SectionHeader(title: title, count: section.lines.count)
                            }
                            ForEach(section.lines) { line in
                                ChoiceRow(
                                    line: line, lit: line.index == active, reading: reading,
                                    actions: actions.flatMap { actions in line.choice.branch.map { branch in { actions(branch) } } },
                                    submenu: submenuBinding(for: line.key),
                                    ran: dismiss
                                ) {
                                    pick(at: line.index, in: lines)
                                }
                                .id(line.key)
                            }
                        }
                    }
                    .padding(Self.listInset)
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { measured in
                        // The list opens at its height, and from then on
                        // eases to a new one — a search narrowing it, its
                        // rows swapped for the next step's — and the
                        // popover with it.
                        withAnimation(contentHeight > 0 ? Self.resize : nil) {
                            contentHeight = measured
                        }
                    }
                    .id(stepKey)
                    .transition(.opacity)
                }
            }
            // While the rows fit, no indicator at all: a list easing taller
            // holds rows taller than its frame for the length of the ease,
            // and the indicator would flash over them each time.
            .scrollIndicators(contentHeight > Self.listHeight ? .automatic : .hidden)
            // As tall as its rows, up to the cap: a scroll view takes all the
            // height it is offered, which left a short list scrollable, its
            // indicator over the rows and its last row against the footer.
            .frame(height: min(max(contentHeight, 1), Self.listHeight))
            .scrollBounceBehavior(.basedOnSize)
            .onChange(of: active) { _, index in
                guard lines.indices.contains(index) else { return }
                proxy.scrollTo(lines[index].key)
            }
        }
    }

    /// The list's keys (see `popoverKeys`). While a submenu is open it is
    /// the topmost popover and hears them instead.
    private func take(_ press: PopoverKeyPress, in lines: [Line]) -> Bool {
        switch press.key {
        case .up: step(-1, in: lines)
        case .down: step(1, in: lines)
        case .home: walk(to: 0, in: lines)
        case .end: walk(to: lines.count - 1, in: lines)
        case .enter: pick(at: active, in: lines)
        case .right: return openSubmenu(in: lines, caretAtEnd: press.caretAtEnd)
        case .escape: if searching { query = "" } else { dismiss() }
        case .left, .delete: return false
        }
        return true
    }

    /// → opens the lit row's submenu, its first item lit, as a menu's
    /// submenu opens — once the caret has nowhere further right to go.
    private func openSubmenu(in lines: [Line], caretAtEnd: Bool) -> Bool {
        guard actions != nil, caretAtEnd, lines.indices.contains(active), lines[active].choice.branch != nil else {
            return false
        }
        submenu = Submenu(key: lines[active].key, fromKeys: true)
        return true
    }

    private func submenuBinding(for key: String) -> Binding<Submenu?> {
        Binding(
            get: { submenu?.key == key ? submenu : nil },
            set: { open in
                if let open { submenu = open } else if submenu?.key == key { submenu = nil }
            })
    }

    private func step(_ offset: Int, in lines: [Line]) {
        guard let index = walkedRow(from: active, by: offset, in: lines.count) else { return }
        walk(to: index, in: lines)
    }

    private func walk(to index: Int, in lines: [Line]) {
        guard lines.indices.contains(index) else { return }
        active = index
        reading.walked = lines[index].key
    }

    private func pick(at index: Int, in lines: [Line]) {
        guard lines.indices.contains(index) else { return }
        let choice = lines[index].choice
        if !drillsIn(choice) { dismiss() }
        pick(choice)
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
    @Binding var submenu: Submenu?
    let ran: () -> Void
    let pick: () -> Void
    @State private var clipped = false

    private var choice: BranchChoice { line.choice }
    private var submenuOpen: Bool { submenu != nil }

    private var submenuShown: Binding<Bool> {
        Binding(get: { submenu != nil }, set: { if !$0 { submenu = nil } })
    }

    private func toggleSubmenu() {
        submenu = submenuOpen ? nil : Submenu(key: line.key, fromKeys: false)
    }

    var body: some View {
        let hovered = reading.hovered == line.key
        HStack(spacing: 8) {
            if choice.monograms.count > 1 {
                WorkspaceGlyph(names: choice.monograms, size: 18)
            } else if let monogram = choice.monograms.first {
                RepoAvatar(name: monogram, size: 18)
            } else {
                Image(systemName: choice.symbol)
                    .foregroundStyle(choice.tint ?? Color.secondary)
                    .frame(width: 14)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(choice.title)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .measuringClip(choice.title, font: rowFont, into: $clipped)
                if let detail = choice.detail {
                    HStack(spacing: 3) {
                        if let symbol = choice.detailSymbol {
                            Image(systemName: symbol)
                                .font(.system(size: 9))
                        }
                        Text(detail)
                            .lineLimit(1)
                            .truncationMode(.middle)
                    }
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .help(detail)
                }
            }
            Spacer(minLength: 4)
            if let badge = choice.badge {
                Text(badge)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .fixedSize()
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
                            Button(action: toggleSubmenu) { Image(systemName: "ellipsis.circle") }
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
        .rowTooltip(choice.tooltip ?? (clipped ? choice.title : nil), active: reading.key == line.key && !submenuOpen)
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
            if actions != nil { SecondaryClick { submenu = Submenu(key: line.key, fromKeys: false) } }
        }
        .popover(isPresented: submenuShown, arrowEdge: .trailing) {
            if let actions {
                BranchActionMenu(actions: actions(), litFirst: submenu?.fromKeys ?? false, close: { submenu = nil }) {
                    submenu = nil
                    ran()
                }
            }
        }
    }
}
