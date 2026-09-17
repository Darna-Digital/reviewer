// The search dialog: the web app's palette drawn natively, as a Liquid
// Glass pane hung near the top of the window over the page — one box, one
// list, and a switch between the two things it searches. Files is a name
// search over every path; Text greps the working tree, with the match
// modifiers (case, whole word, regex) on the box's trailing edge. The
// keyboard drives it the way the web one is driven: ↑/↓ walk the list,
// Return opens the row, Escape — or a click beside the pane — puts it away.
//
// The pane is glass rather than an opaque sheet so the code stays visible
// through it: a result is read against what it will open over. What it
// holds is the model's (`QuickSearch`); the only state here is which row
// the keyboard is on.
import SwiftUI

struct SearchOverlay: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .top) {
                // A clear backdrop, so the pane is the one thing that changes
                // and a click anywhere else is how the mouse dismisses it.
                Color.black.opacity(0.08)
                    .ignoresSafeArea()
                    .onTapGesture { model.search.close() }
                SearchPanel()
                    .frame(width: min(680, proxy.size.width - 32))
                    .frame(maxHeight: proxy.size.height * 0.7)
                    .padding(.top, proxy.size.height * 0.12)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

private struct SearchPanel: View {
    @Environment(AppModel.self) private var model
    @State private var active = 0
    @FocusState private var fieldFocused: Bool

    private var search: QuickSearch { model.search }

    var body: some View {
        @Bindable var search = search
        let rows = search.rows
        VStack(spacing: 0) {
            header(search: $search)
            Divider()
            list(rows)
            Divider()
            footer(rows)
        }
        .glassEffect(.regular, in: .rect(cornerRadius: 18))
        .shadow(color: .black.opacity(0.22), radius: 28, y: 12)
        // Every way the field could hand focus to the list is answered
        // here instead, so the caret never leaves the box.
        .onKeyPress(.upArrow) { step(-1, in: rows.count); return .handled }
        .onKeyPress(.downArrow) { step(1, in: rows.count); return .handled }
        .onKeyPress(.escape) { search.close(); return .handled }
        .onExitCommand { search.close() }
        .onChange(of: rows.count) { _, count in active = count == 0 ? 0 : min(active, count - 1) }
        .onChange(of: search.query) { active = 0 }
        .onChange(of: search.mode) { active = 0 }
        .onAppear {
            // The web view under the pane holds the window's focus, and
            // SwiftUI moves it to the field only once the field is on
            // screen — a turn of the run loop after this.
            Task { @MainActor in fieldFocused = true }
        }
    }

    // MARK: header

    private func header(search: Bindable<QuickSearch>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Picker("Search", selection: search.mode) {
                ForEach(QuickSearchMode.allCases) { mode in
                    Text(mode.title).tag(mode)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .controlSize(.small)
            .fixedSize()
            .padding(.top, 10)
            .padding(.horizontal, 14)
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField(search.wrappedValue.mode.placeholder, text: search.query)
                    .textFieldStyle(.plain)
                    .font(.system(size: 15))
                    .focused($fieldFocused)
                    .autocorrectionDisabled()
                    .onSubmit { open(rowAt: active) }
                if search.wrappedValue.mode == .text {
                    grepToggles(search: search)
                }
            }
            .padding(.horizontal, 14)
            .frame(height: 44)
        }
    }

    /// The `git grep` flags, as the web box wears them: three glyphs on
    /// the trailing edge, each lit while it is on.
    private func grepToggles(search: Bindable<QuickSearch>) -> some View {
        HStack(spacing: 2) {
            GrepToggle(glyph: "Aa", label: "Match case", isOn: search.options.caseSensitive)
            GrepToggle(glyph: "ab", label: "Match whole word", isOn: search.options.wholeWord)
            GrepToggle(glyph: ".*", label: "Use regular expression", isOn: search.options.regex)
        }
    }

    // MARK: list

    @ViewBuilder
    private func list(_ rows: [QuickSearchRow]) -> some View {
        if rows.isEmpty {
            EmptyResults(search: search)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 28)
                .padding(.horizontal, 14)
        } else {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                            if search.mode == .text, rows[safe: index - 1]?.path != row.path {
                                FileHeading(path: row.path)
                            }
                            ResultRow(row: row, query: search.query, options: search.options, isActive: index == active)
                                .id(index)
                                // Hover moves the selection so the mouse and
                                // the keyboard never disagree about the row.
                                .onHover { if $0 { active = index } }
                                .onTapGesture { open(rowAt: index) }
                        }
                    }
                    .padding(6)
                }
                .onChange(of: active) { _, index in proxy.scrollTo(index, anchor: nil) }
            }
        }
    }

    // MARK: footer

    private func footer(_ rows: [QuickSearchRow]) -> some View {
        HStack(spacing: 4) {
            Text(summary(rows))
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer(minLength: 8)
            KeyCap("↵")
            Text("to open")
            Text("·")
            KeyCap("esc")
            Text("to close")
        }
        .font(.system(size: 11))
        .foregroundStyle(.secondary)
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
    }

    /// What the text search found — the file search speaks for itself.
    private func summary(_ rows: [QuickSearchRow]) -> String {
        guard search.mode == .text, !rows.isEmpty else { return "" }
        let files = Set(rows.map(\.path)).count
        var text = "\(rows.count) \(rows.count == 1 ? "match" : "matches") in \(files) \(files == 1 ? "file" : "files")"
        if search.matches.truncated { text += " (first results only)" }
        return text
    }

    // MARK: keys

    private func step(_ offset: Int, in count: Int) {
        guard count > 0 else { return }
        active = (active + offset + count) % count
    }

    private func open(rowAt index: Int) {
        let rows = search.rows
        guard rows.indices.contains(index) else { return }
        search.open(rows[index])
    }
}

private struct GrepToggle: View {
    let glyph: String
    let label: String
    @Binding var isOn: Bool

    var body: some View {
        Button { isOn.toggle() } label: {
            Text(glyph)
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(isOn ? .primary : .secondary)
                .frame(width: 24, height: 24)
                .background(isOn ? Color.primary.opacity(0.14) : Color.clear, in: RoundedRectangle(cornerRadius: 6))
        }
        .buttonStyle(.plain)
        .help(label)
    }
}

/// The file a run of text hits belongs to, over the run.
private struct FileHeading: View {
    let path: String

    var body: some View {
        Text(path)
            .font(.system(size: 11, weight: .medium, design: .monospaced))
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .truncationMode(.middle)
            .padding(.horizontal, 8)
            .padding(.top, 8)
            .padding(.bottom, 4)
    }
}

private struct ResultRow: View {
    let row: QuickSearchRow
    let query: String
    let options: GrepOptions
    let isActive: Bool

    var body: some View {
        HStack(spacing: 10) {
            if let line = row.line {
                Text(String(line))
                    .font(.system(size: 11, design: .monospaced))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                    .frame(width: 40, alignment: .trailing)
            } else {
                Image(systemName: "doc.text")
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
                    .frame(width: 16)
            }
            Text(label)
                .font(.system(size: 13, design: .monospaced))
                .lineLimit(1)
                .truncationMode(row.line == nil ? .middle : .tail)
            Spacer(minLength: 0)
            if isActive {
                Image(systemName: "return")
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(isActive ? Color.primary.opacity(0.1) : Color.clear, in: RoundedRectangle(cornerRadius: 8))
        .contentShape(Rectangle())
    }

    /// A file row: its directory dimmed ahead of its name. A text row: the
    /// line, its leading whitespace dropped, with the hit picked out of it.
    private var label: AttributedString {
        guard row.line != nil else {
            let slash = row.path.lastIndex(of: "/").map { row.path.index(after: $0) } ?? row.path.startIndex
            var directory = AttributedString(String(row.path[..<slash]))
            directory.foregroundColor = .secondary
            return directory + AttributedString(String(row.path[slash...]))
        }
        let text = String(row.text.drop(while: \.isWhitespace))
        var attributed = AttributedString(text)
        if let range = QuickSearch.matchRange(in: text, query: query, options: options),
            let lower = AttributedString.Index(range.lowerBound, within: attributed),
            let upper = AttributedString.Index(range.upperBound, within: attributed)
        {
            attributed[lower..<upper].backgroundColor = Color.accentColor.opacity(0.3)
        }
        return attributed
    }
}

private struct EmptyResults: View {
    let search: QuickSearch

    var body: some View {
        Text(message)
            .font(.system(size: 13))
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
    }

    private var message: String {
        let typed = search.query.trimmingCharacters(in: .whitespaces)
        switch search.mode {
        case .files:
            if let error = search.searchError { return error }
            return typed.isEmpty ? "Type to find a file by name." : "No files match."
        case .text:
            if search.searchError != nil { return "Could not search this \(search.scopeName)." }
            if typed.count < QuickSearch.minimumQueryLength { return "Type to search." }
            return search.isSearching ? "Searching…" : "No matches found."
        }
    }
}

/// A key, drawn the way the web footer draws one.
private struct KeyCap: View {
    let key: String

    init(_ key: String) { self.key = key }

    var body: some View {
        Text(key)
            .font(.system(size: 10, weight: .medium))
            .padding(.horizontal, 5)
            .padding(.vertical, 1)
            .background(Color.primary.opacity(0.08), in: RoundedRectangle(cornerRadius: 4))
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
