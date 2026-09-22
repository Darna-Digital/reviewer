// The pieces the bottom pane's surfaces are built from, so they read as
// one instrument: the 28pt bar a column wears along its top — the tab
// strip, the filters, a detail's title all stand at that height, with the
// same 8pt inset the rows below keep — the footer a source list wears
// along its bottom (the system's own add and remove marks, as in Settings
// and Xcode), the flat bar button both carry, the one shape every field on
// a bar takes, and the dot that says whether a process is up. The pane is
// set at the small control size throughout: 11pt text in 22pt fields, the
// proportion of the system's own small controls, three points of air above
// and below in the bar.
//
// The Terminal and Run surfaces are the exception: they are laid out as
// the opener is (see `RepoOpener`) — a Finder window's proportions inside
// the island — so they carry the taller toolbar at the regular control
// size, with the system's own search field at its trailing edge and the
// actions grouped at its leading edge, and a table of plain rows under
// it.
import AppKit
import SwiftUI

enum PaneMetrics {
    static let barHeight: CGFloat = 28
    static let barInset: CGFloat = 8
    static let footerHeight: CGFloat = 24
    static let rowHeight: CGFloat = 22
    /// One level of an outline, the sidebar's own `indentationPerLevel`.
    static let indentUnit: CGFloat = 16
    static let listMinWidth: CGFloat = 200
    static let listIdealWidth: CGFloat = 240
    static let listMaxWidth: CGFloat = 380
    /// The toolbar a table column wears: regular controls, 22pt tall, with
    /// seven points of air above and below, as a window's toolbar gives them.
    static let toolbarHeight: CGFloat = 36
    static let toolbarSearchWidth: CGFloat = 180
    /// A table column stands wider than a source list: it has columns of
    /// its own to show, and the output beside it reflows to what is left.
    static let tableMinWidth: CGFloat = 300
    static let tableIdealWidth: CGFloat = 480
    static let tableMaxWidth: CGFloat = 720
    static let tableDetailMinWidth: CGFloat = 240
}

/// The split the Terminal and Run surfaces share: the table column down
/// the left at one width, the detail beside it taking the rest, parted by
/// a handle. The width is one setting for both surfaces, so switching
/// between them moves nothing — each HSplitView would size its own
/// columns afresh, and the table would jump back to its ideal width on
/// every switch. Opened fresh it stands at the ideal width; dragged, it
/// keeps the width across surfaces and launches, clamped so the detail
/// always has its minimum.
struct TableSplit<Table: View, Detail: View>: View {
    @ViewBuilder let table: Table
    @ViewBuilder let detail: Detail
    @AppStorage("bottom-table-width") private var savedTableWidth = 0.0
    @State private var draggedTableWidth: Double?

    var body: some View {
        GeometryReader { proxy in
            let range = Self.tableRange(in: proxy.size.width)
            let width = tableWidth(range: range)
            HStack(spacing: 0) {
                table
                    .frame(width: width)
                    .frame(maxHeight: .infinity)
                ColumnResizeHandle(width: Binding(get: { width }, set: { draggedTableWidth = $0 }),
                                   range: range, edge: .trailing) { savedTableWidth = $0 }
                detail
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }

    private func tableWidth(range: ClosedRange<Double>) -> Double {
        let wanted = draggedTableWidth ?? (savedTableWidth > 0 ? savedTableWidth : PaneMetrics.tableIdealWidth)
        return min(max(wanted, range.lowerBound), range.upperBound)
    }

    private static func tableRange(in paneWidth: CGFloat) -> ClosedRange<Double> {
        let widest = min(PaneMetrics.tableMaxWidth, paneWidth - PaneMetrics.tableDetailMinWidth)
        return PaneMetrics.tableMinWidth...max(PaneMetrics.tableMinWidth, widest)
    }
}

/// A hairline along one edge of a column, dragged to give the column more
/// or less room: a column's trailing edge grows it rightward, a leading
/// edge leftward. Measured in the window, as the composer's handles are,
/// since the handle moves with the edge it drags.
struct ColumnResizeHandle: View {
    @Binding var width: Double
    let range: ClosedRange<Double>
    let edge: HorizontalEdge
    let onRelease: (Double) -> Void
    @State private var startWidth: Double?

    var body: some View {
        ThemedDivider()
            .frame(width: 7)
            .contentShape(Rectangle())
            .onHover { hovering in
                if hovering { NSCursor.resizeLeftRight.push() } else { NSCursor.pop() }
            }
            .gesture(
                DragGesture(minimumDistance: 1, coordinateSpace: .global)
                    .onChanged { drag in
                        let start = startWidth ?? width
                        startWidth = start
                        let moved = edge == .trailing ? drag.translation.width : -drag.translation.width
                        var transaction = Transaction()
                        transaction.disablesAnimations = true
                        withTransaction(transaction) {
                            width = min(max(start + moved, range.lowerBound), range.upperBound)
                        }
                    }
                    .onEnded { _ in
                        startWidth = nil
                        onRelease(width)
                    })
    }
}

/// The two sizes a field comes in: the sidebar's, and the pane bar's a
/// step smaller, in the ratio the system's regular and small controls keep.
enum PaneFieldSize {
    case regular
    case small

    var height: CGFloat { self == .regular ? 24 : 22 }
    var fontSize: CGFloat { self == .regular ? 12 : 11 }
}

/// The quiet input the web bar draws, as a modifier so a picker, a chip and
/// a text field on the same bar come out the same height and radius.
private struct PaneFieldChrome: ViewModifier {
    let size: PaneFieldSize

    func body(content: Content) -> some View {
        content
            .padding(.horizontal, 7)
            .frame(height: size.height)
            .background(.quaternaryWash(0.5), in: RoundedRectangle(cornerRadius: 6))
    }
}

/// The glyph that leads a field — a magnifier, a branch, a calendar — at
/// the field's own text size.
private struct PaneFieldGlyph: ViewModifier {
    let size: PaneFieldSize

    func body(content: Content) -> some View {
        content
            .font(.system(size: size.fontSize, weight: .medium))
            .foregroundStyle(.secondary)
    }
}

extension View {
    func paneField(_ size: PaneFieldSize = .small) -> some View { modifier(PaneFieldChrome(size: size)) }
    func paneFieldGlyph(_ size: PaneFieldSize = .small) -> some View { modifier(PaneFieldGlyph(size: size)) }
}

/// The bar along the top of a detail column: what is shown, and what can
/// be done to it, on one line, parted from the content by a rule.
struct PaneBar<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        HStack(spacing: 8) { content }
            .controlSize(.small)
            .padding(.horizontal, PaneMetrics.barInset)
            .frame(height: PaneMetrics.barHeight)
            .frame(maxWidth: .infinity)
            .overlay(alignment: .bottom) { ThemedDivider() }
    }
}

/// The bar along the top of a table column, and of the detail beside it,
/// at a window toolbar's proportions: regular controls, the actions
/// grouped at the leading edge, the search at the trailing one. Both
/// columns wear it at the same height, so the rule under the one runs on
/// into the rule under the other.
struct PaneToolbar<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        HStack(spacing: 8) { content }
            .controlSize(.regular)
            .labelStyle(.iconOnly)
            .padding(.horizontal, PaneMetrics.barInset)
            .frame(height: PaneMetrics.toolbarHeight)
            .frame(maxWidth: .infinity)
            .overlay(alignment: .bottom) { ThemedDivider() }
    }
}

/// The system's own search field — the rounded one with the magnifier,
/// as a window toolbar carries it — over a table column. The text follows
/// every keystroke; a surface that searches on demand rather than as you
/// type passes `submit`, which fires on Return, on losing focus and on the
/// cancel mark, since clearing should take at once.
///
/// A field at the head of a picker takes the keys the picker answers —
/// ↑/↓ over the rows, Return, Escape — through `command`, which is handed
/// the field editor's selector and says whether it took it; the field
/// keeps whatever it declines. The same picker has the field focused as it
/// comes up (`focusesOnAppear`), a turn of the run loop after the view is
/// in a window.
struct PaneSearchField: NSViewRepresentable {
    let prompt: String
    @Binding var text: String
    var submit: (() -> Void)? = nil
    var focusesOnAppear = false
    var command: ((Selector) -> Bool)? = nil

    func makeNSView(context: Context) -> NSSearchField {
        let field = NSSearchField()
        field.placeholderString = prompt
        field.controlSize = .regular
        field.sendsSearchStringImmediately = true
        field.delegate = context.coordinator
        if focusesOnAppear {
            Task { @MainActor in field.window?.makeFirstResponder(field) }
        }
        return field
    }

    func updateNSView(_ field: NSSearchField, context: Context) {
        context.coordinator.text = $text
        context.coordinator.submit = submit
        context.coordinator.command = command
        if field.stringValue != text { field.stringValue = text }
    }

    func makeCoordinator() -> Coordinator { Coordinator(text: $text, submit: submit, command: command) }

    @MainActor
    final class Coordinator: NSObject, NSSearchFieldDelegate {
        var text: Binding<String>
        var submit: (() -> Void)?
        var command: ((Selector) -> Bool)?

        init(text: Binding<String>, submit: (() -> Void)?, command: ((Selector) -> Bool)?) {
            self.text = text
            self.submit = submit
            self.command = command
        }

        func control(_ control: NSControl, textView: NSTextView, doCommandBy selector: Selector) -> Bool {
            command?(selector) ?? false
        }

        func controlTextDidChange(_ notification: Notification) {
            guard let field = notification.object as? NSSearchField else { return }
            text.wrappedValue = field.stringValue
            if field.stringValue.isEmpty { submit?() }
        }

        func controlTextDidEndEditing(_ notification: Notification) {
            submit?()
        }
    }
}

/// The footer along the bottom of a source list: a rule, then the marks —
/// add and remove leading, the list's own actions trailing.
struct PaneFooter<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        HStack(spacing: 2) { content }
            .padding(.horizontal, 4)
            .frame(height: PaneMetrics.footerHeight)
            .frame(maxWidth: .infinity)
            .overlay(alignment: .top) { ThemedDivider() }
    }
}

/// A flat symbol button for the bars: the system's accessory-bar style,
/// which lights only on hover, in a square hit area.
struct PaneBarButton: View {
    let symbol: String
    let help: String
    var role: ButtonRole? = nil
    let action: () -> Void

    var body: some View {
        Button(role: role, action: action) {
            Image(systemName: symbol)
                .font(.system(size: 11, weight: .medium))
                .frame(width: 20, height: 18)
        }
        .buttonStyle(.accessoryBar)
        .help(help)
    }
}

/// Whether a process is up, as a dot: filled green while it runs, red
/// when it exited badly, grey once it exited cleanly, and only a ring
/// while it has not been started.
struct ProcessDot: View {
    let status: DevCommandView.Status
    let exitCode: Int?

    var body: some View {
        Group {
            if status == .stopped {
                Circle().strokeBorder(.tertiary, lineWidth: 1)
            } else {
                Circle().fill(tint)
            }
        }
        .frame(width: 8, height: 8)
    }

    private var tint: Color {
        switch status {
        case .running: return .green
        case .exited: return (exitCode ?? 0) == 0 ? Color.secondary.opacity(0.6) : .red
        case .stopped: return .clear
        }
    }
}

extension DevCommandView {
    var statusLabel: String {
        switch status {
        case .running: return "Running"
        case .exited:
            if let exitCode, exitCode != 0 { return "Exited (\(exitCode))" }
            return "Exited"
        case .stopped: return "Not running"
        }
    }

    var isRunning: Bool { status == .running }
    var exitedBadly: Bool { status == .exited && (exitCode ?? 0) != 0 }
    var isDockerDesktop: Bool { kind == .dockerDesktop }
    /// What the row shows as the command: the command line, or for Docker
    /// Desktop what the server does in its place.
    var commandLabel: String { isDockerDesktop ? "Start Docker Desktop" : command }
    /// The folder as a row shows it: the root as a single dot, as a shell
    /// would name it; nothing for Docker Desktop, which is not the
    /// repository's to run.
    var folderLabel: String { isDockerDesktop ? "" : (cwd.isEmpty ? "." : cwd) }
    var folderHelp: String {
        if isDockerDesktop { return "" }
        return cwd.isEmpty ? "Runs at the repository root" : "Runs in \(cwd)"
    }
}

/// The material a terminal is set on: the island's own, so the shell reads
/// as part of the pane rather than a hole in it.
struct TerminalWell<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(EdgeInsets(top: 6, leading: 8, bottom: 4, trailing: 4))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(nsColor: IslandPalette.island))
    }
}

/// A short placeholder for a column with nothing to show, sized for the
/// pane rather than a page, at the system's own unavailable-content
/// contrast: the title in the primary colour, the detail in the secondary.
struct PanePlaceholder<Actions: View>: View {
    let title: String
    let symbol: String
    var detail: String? = nil
    @ViewBuilder var actions: Actions

    init(_ title: String, symbol: String, detail: String? = nil, @ViewBuilder actions: () -> Actions = { EmptyView() }) {
        self.title = title
        self.symbol = symbol
        self.detail = detail
        self.actions = actions()
    }

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: symbol)
                .font(.system(size: 22, weight: .light))
                .foregroundStyle(.secondary)
            Text(title)
                .font(.system(size: 13, weight: .medium))
            if let detail {
                Text(detail)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 260)
            }
            actions
                .controlSize(.small)
                .padding(.top, 4)
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
