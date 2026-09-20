// The palette: the web app's search dialog drawn natively, as a Liquid
// Glass pane hung near the top of the window over the page — a breadcrumb
// naming the list that is up, one box, one list. It opens on Commands
// (⌘K), and some of those rows lead deeper rather than acting: Files (also
// ⇧⇧) is a name search over every path, Text (also ⌘⇧F) greps the working
// tree with the match modifiers (case, whole word, regex) on the box's
// trailing edge, Git holds the git actions and leads on to Branches, which
// checks one out. The keyboard drives it the way the web one is driven:
// ↑/↓ walk the list, Home and End jump to its ends, Return runs the row,
// Backspace on an empty box walks back up the trail, Escape — or a click
// beside the pane — puts it away.
//
// The pane is glass rather than an opaque sheet so the code stays visible
// through it: a result is read against what it will open over. What it
// holds is the model's (`CommandPalette`); the only state here is which
// row the keyboard is on. The list itself is AppKit's (`PaletteList`), so
// five hundred grep hits scroll as a table does, on reused rows.
import SwiftUI

struct PaletteOverlay: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .top) {
                // A clear backdrop, so the pane is the one thing that changes
                // and a click anywhere else is how the mouse dismisses it.
                Color.black.opacity(0.08)
                    .ignoresSafeArea()
                    .onTapGesture { model.palette.close() }
                PalettePanel()
                    .frame(width: min(680, proxy.size.width - 32))
                    .frame(maxHeight: proxy.size.height * 0.7)
                    .padding(.top, proxy.size.height * 0.12)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

private struct PalettePanel: View {
    @Environment(AppModel.self) private var model
    @State private var active = 0
    @FocusState private var fieldFocused: Bool

    private var palette: CommandPalette { model.palette }

    var body: some View {
        @Bindable var palette = palette
        let rows = palette.rows
        VStack(spacing: 0) {
            header(palette: $palette)
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
        .onKeyPress(.home) { active = 0; return .handled }
        .onKeyPress(.end) { active = max(0, rows.count - 1); return .handled }
        .onKeyPress(.escape) { palette.close(); return .handled }
        // Backspace with nothing left to delete walks back up the trail;
        // with a query in the box it is the box's.
        .onKeyPress(.delete) { palette.query.isEmpty && palette.back() ? .handled : .ignored }
        .onExitCommand { palette.close() }
        .onChange(of: rows.count) { _, count in active = count == 0 ? 0 : min(active, count - 1) }
        .onChange(of: palette.query) { active = 0 }
        .onChange(of: palette.mode) { active = 0 }
        .onAppear {
            // The web view under the pane holds the window's focus, and
            // SwiftUI moves it to the field only once the field is on
            // screen — a turn of the run loop after this.
            Task { @MainActor in fieldFocused = true }
        }
    }

    // MARK: header

    private func header(palette: Bindable<CommandPalette>) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            crumbs
                .padding(.top, 10)
                .padding(.horizontal, 12)
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField(palette.wrappedValue.mode.placeholder, text: palette.query)
                    .textFieldStyle(.plain)
                    .font(.system(size: 15))
                    .focused($fieldFocused)
                    .autocorrectionDisabled()
                    .onSubmit { run(rowAt: active) }
                if palette.wrappedValue.mode == .text {
                    grepToggles(palette: palette)
                }
            }
            .padding(.horizontal, 14)
            .frame(height: 44)
        }
    }

    /// Where you are in the palette: the trail from the command list down
    /// to the list that is up, each earlier step a way back to it.
    private var crumbs: some View {
        HStack(spacing: 4) {
            ForEach(Array(palette.mode.crumbs.enumerated()), id: \.element) { position, crumb in
                if position > 0 {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 9, weight: .semibold))
                }
                if crumb == palette.mode {
                    Text(crumb.title)
                        .foregroundStyle(.primary)
                        .padding(.horizontal, 4)
                } else {
                    Button(crumb.title) { palette.show(crumb) }
                        .buttonStyle(CrumbStyle())
                }
            }
        }
        .font(.system(size: 11))
        .foregroundStyle(.secondary)
    }

    /// The `git grep` flags, as the web box wears them: three glyphs on
    /// the trailing edge, each lit while it is on.
    private func grepToggles(palette: Bindable<CommandPalette>) -> some View {
        HStack(spacing: 2) {
            GrepToggle(glyph: "Aa", label: "Match case", isOn: palette.options.caseSensitive)
            GrepToggle(glyph: "ab", label: "Match whole word", isOn: palette.options.wholeWord)
            GrepToggle(glyph: ".*", label: "Use regular expression", isOn: palette.options.regex)
        }
    }

    // MARK: list

    @ViewBuilder
    private func list(_ rows: [PaletteRow]) -> some View {
        if rows.isEmpty {
            EmptyResults(palette: palette)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 28)
                .padding(.horizontal, 14)
        } else {
            PaletteList(
                rows: rows, query: palette.query, options: palette.options, mode: palette.mode, active: $active
            ) { index in
                run(rowAt: index)
            }
            .frame(maxHeight: PaletteList.height(of: rows))
        }
    }

    // MARK: footer

    private func footer(_ rows: [PaletteRow]) -> some View {
        HStack(spacing: 4) {
            Text(summary(rows))
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer(minLength: 8)
            KeyCap("↵")
            Text(palette.mode.enterLabel)
            Text("·")
            KeyCap("esc")
            Text("to close")
        }
        .font(.system(size: 11))
        .foregroundStyle(.secondary)
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
    }

    /// What the text search found — the other lists speak for themselves.
    private func summary(_ rows: [PaletteRow]) -> String {
        guard palette.mode == .text, !rows.isEmpty else { return "" }
        let files = Set(rows.map(\.group)).count
        var text = "\(rows.count) \(rows.count == 1 ? "match" : "matches") in \(files) \(files == 1 ? "file" : "files")"
        if palette.matches.truncated { text += " (first results only)" }
        return text
    }

    // MARK: keys

    private func step(_ offset: Int, in count: Int) {
        guard count > 0 else { return }
        active = (active + offset + count) % count
    }

    private func run(rowAt index: Int) {
        let rows = palette.rows
        guard rows.indices.contains(index) else { return }
        palette.run(rows[index])
    }
}

/// A crumb that is a way back: a quiet chip, lit under the pointer.
private struct CrumbStyle: ButtonStyle {
    @State private var isHovering = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(isHovering ? .primary : .secondary)
            .padding(.horizontal, 4)
            .padding(.vertical, 2)
            .background(Color.primary.opacity(isHovering ? 0.08 : 0), in: RoundedRectangle(cornerRadius: 5))
            .contentShape(Rectangle())
            .onHover { isHovering = $0 }
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

private struct EmptyResults: View {
    let palette: CommandPalette

    var body: some View {
        Text(message)
            .font(.system(size: 13))
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
    }

    private var message: String {
        let typed = palette.query.trimmingCharacters(in: .whitespaces)
        switch palette.mode {
        case .commands, .git:
            return "No commands found."
        case .branches:
            return typed.isEmpty ? "This repository has no branches." : "No branches match."
        case .files:
            if let error = palette.searchError { return error }
            return typed.isEmpty ? "Type to find a file by name." : "No files match."
        case .text:
            if palette.searchError != nil { return "Could not search this repository." }
            if typed.count < CommandPalette.minimumQueryLength { return "Type to search." }
            return palette.isSearching ? "Searching…" : "No matches found."
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
