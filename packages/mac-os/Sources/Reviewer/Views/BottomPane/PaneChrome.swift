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
// The Run surface is the exception: it is laid out as the opener is (see
// `RepoOpener`) — a Finder window's proportions inside the island — so it
// carries the taller toolbar at the regular control size, with the
// system's own search field at its trailing edge and the actions grouped
// at its leading edge, and a table of plain rows under it. The Terminal
// beside it keeps none of that: a shell is opened, picked and closed from
// a row of tabs, nothing more (see `TerminalPane`).
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

/// The split a table surface is laid out in: the table column down the
/// left at one width, the detail beside it taking the rest, parted by a
/// handle. The width is a setting rather than an HSplitView's own, which
/// would size its columns afresh and jump the table back to its ideal
/// width on every switch of surface. Opened fresh it stands at the ideal
/// width; dragged, it keeps the width across launches, clamped so the
/// detail always has its minimum.
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
///
/// The ring the field wears while it holds the keys is AppKit's, drawn in
/// `keyboardFocusIndicatorColor` — the system's accent, which takes no
/// tint and left a blue ring round the one box on a pane a theme had
/// painted throughout. So where a theme paints the scheme the system's
/// ring is turned off and one is laid round the field's capsule in the
/// theme's accent instead, the way the chat's own box is ringed (see
/// `ChatComposer`); on the app's own palette the field keeps the system's
/// ring, untouched. The ring is laid over the field rather than drawn by
/// it: an `NSSearchField` draws itself into its layer and never through
/// `draw(_:)`, so an override there paints nothing.
struct PaneSearchField: View {
    let prompt: String
    @Binding var text: String
    var submit: (() -> Void)? = nil
    var focusesOnAppear = false
    var command: ((Selector) -> Bool)? = nil

    @Environment(\.colorScheme) private var colorScheme
    @State private var editing = false

    private var themed: Bool {
        ChromePalette.shared.isThemed(colorScheme == .dark ? .dark : .light)
    }

    var body: some View {
        SearchFieldBox(prompt: prompt, text: $text, submit: submit,
                       focusesOnAppear: focusesOnAppear, command: command,
                       ringsItself: themed, editing: $editing)
            .overlay {
                if themed && editing {
                    Capsule().strokeBorder(Color(nsColor: IslandPalette.accent), lineWidth: 2)
                }
            }
    }

    /// Hand the keyboard back to the window while a search field holds it.
    /// A surface swapped out from under a focused field keeps the keys for
    /// as long as the crossfade takes — the field on its way out taking the
    /// strokes, and the focus ring, that belong to the one coming in — so
    /// the surface that swaps it says so (see `SidebarView`) rather than
    /// waiting for the field to be taken out of the window.
    @MainActor
    static func releaseKeyboard(from window: NSWindow?) {
        guard let window, let responder = window.firstResponder else { return }
        let editing = responder as? NSSearchField
            ?? ((responder as? NSTextView)?.delegate as? NSSearchField)
        guard editing != nil else { return }
        window.makeFirstResponder(nil)
    }

    @MainActor
    static func releaseKeyboard() {
        releaseKeyboard(from: NSApp.keyWindow ?? NSApp.mainWindow)
    }
}

private struct SearchFieldBox: NSViewRepresentable {
    let prompt: String
    @Binding var text: String
    var submit: (() -> Void)? = nil
    var focusesOnAppear = false
    var command: ((Selector) -> Bool)? = nil
    var ringsItself = false
    @Binding var editing: Bool

    func makeNSView(context: Context) -> ReleasingSearchField {
        let field = ReleasingSearchField()
        field.placeholderString = prompt
        field.controlSize = .regular
        field.sendsSearchStringImmediately = true
        field.delegate = context.coordinator
        field.onFocus = { [holder = $editing] holds in holder.wrappedValue = holds }
        if focusesOnAppear {
            Task { @MainActor in field.window?.makeFirstResponder(field) }
        }
        return field
    }

    static func dismantleNSView(_ field: ReleasingSearchField, coordinator: Coordinator) {
        MainActor.assumeIsolated { PaneSearchField.releaseKeyboard(from: field.window) }
    }

    func updateNSView(_ field: ReleasingSearchField, context: Context) {
        context.coordinator.text = $text
        context.coordinator.submit = submit
        context.coordinator.command = command
        field.onFocus = { [holder = $editing] holds in holder.wrappedValue = holds }
        field.focusRingType = ringsItself ? .none : .default
        if field.stringValue != text { field.stringValue = text }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text, submit: submit, command: command)
    }

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

/// A search field that lets the keyboard go as it leaves the window, so a
/// field removed while focused — the sidebar's surface changing under it —
/// never leaves the window pointing at a view that is gone; and that says
/// when it has the keys and when they go, for the ring the field wears
/// while it holds them (see `PaneSearchField`).
///
/// Taking the keys is the field becoming first responder, and it is asked
/// here rather than of the delegate: `controlTextDidBeginEditing` is not
/// the keys arriving but the first change made with them, so a ring on it
/// stayed off until the first letter was typed. Letting them go is the
/// field editor's editing ending, which is what happens when the keys move
/// on, whether or not a letter was ever typed.
final class ReleasingSearchField: NSSearchField {
    var onFocus: ((Bool) -> Void)?

    override func viewWillMove(toWindow newWindow: NSWindow?) {
        if newWindow == nil { PaneSearchField.releaseKeyboard(from: window) }
        super.viewWillMove(toWindow: newWindow)
    }

    override func becomeFirstResponder() -> Bool {
        let taken = super.becomeFirstResponder()
        if taken { onFocus?(true) }
        return taken
    }

    override func textDidEndEditing(_ notification: Notification) {
        super.textDidEndEditing(notification)
        onFocus?(false)
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

/// The theme over a system list's rows — the rules between them, and the
/// wash on the one that is picked. Worn by a `Table` and by a selecting
/// `List` alike: both are an `NSTableView` underneath, and both draw those
/// two things in the system's colours rather than the theme's.
///
/// The rules go in the island's own hairline, so the pane is ruled alike
/// throughout (see `ThemedDivider`). A SwiftUI table draws no AppKit grid
/// — its grid mask is empty — and ignores a row separator tint: the line
/// is the row view's own, drawn in the system's separator, a good deal
/// darker than the hairline a theme rules the rest of the pane in. So the
/// colour is set on the row views themselves. That is not a documented
/// property of them, so it is asked for by selector and left alone where
/// it is not answered — a table on an OS that has moved on keeps the
/// system's line rather than losing one.
///
/// The pick goes in the theme's own colour (see `IslandPalette.pick`).
/// The system draws that row in `selectedContentBackgroundColor` — the
/// accent blue — and no tint reaches it: `.tint` colours a table's
/// controls and never its selection. So under a theme the row view is
/// told to draw no selection of its own and the wash is laid on its layer
/// instead, under the row's content; it is a wash rather than a solid
/// accent, quiet enough that the theme's type reads on it without having
/// to be turned white (see `SelectionInk`). On the app's own palette
/// nothing is taken from the row: the selection is the system's blue, as
/// it has always been.
///
/// Row views are made and recycled as the table scrolls and reloads, so
/// both are laid on again after every pass of the table's layout, after
/// every change SwiftUI makes to it, on every scroll, and on every pass
/// of the window's own update.
struct ThemedRows: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView { ThemedRowProbe() }

    func updateNSView(_ view: NSView, context: Context) {
        guard let probe = view as? ThemedRowProbe else { return }
        Task { @MainActor in probe.paint() }
    }
}

extension View {
    func themedRows() -> some View { background { ThemedRows() } }
}

private final class ThemedRowProbe: NSView {
    private static let setSeparatorColor = NSSelectorFromString("setSeparatorColor:")
    /// How far up the probe looks for the table it stands behind. The
    /// table's own container is a step or two above; beyond that lies the
    /// rest of the pane, and another surface's table with it.
    private static let climbLimit = 6
    private weak var table: NSTableView?

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        // A pane put away and opened again moves its probe out of the
        // window and back into one, so what was watched for the last
        // window is let go and the table taken again for this one.
        NotificationCenter.default.removeObserver(self)
        table = nil
        guard let window else { return }
        NotificationCenter.default.addObserver(self, selector: #selector(paint),
                                               name: ChromePalette.didChange, object: nil)
        // The list's own pick is SwiftUI's, not the table's: the table
        // reports no selected row and posts nothing when one is picked, so
        // there is no change to listen for. The window's update pass is
        // the next best thing — it comes round after every event that
        // could have moved the pick or made a row, and costs a walk of the
        // rows on screen, which write nothing unless what they wear has
        // changed.
        NotificationCenter.default.addObserver(self, selector: #selector(paint),
                                               name: NSWindow.didUpdateNotification, object: window)
        paint()
    }

    override func layout() {
        super.layout()
        paint()
    }

    override func hitTest(_ point: NSPoint) -> NSView? { nil }

    @objc func paint() {
        guard let table = table ?? adopt() else { return }
        let themed = ChromePalette.shared.isThemed(effectiveAppearance.isDark ? .dark : .light)
        let hairline = IslandPalette.hairline
        var wash = NSColor.clear.cgColor
        effectiveAppearance.performAsCurrentDrawingAppearance { wash = IslandPalette.pick.cgColor }
        let clear = NSColor.clear.cgColor
        table.enumerateAvailableRowViews { row, _ in
            if row.responds(to: Self.setSeparatorColor) {
                _ = row.perform(Self.setSeparatorColor, with: hairline)
            }
            let style: NSTableView.SelectionHighlightStyle = themed ? .none : .regular
            if row.selectionHighlightStyle != style { row.selectionHighlightStyle = style }
            let fill = themed && row.isSelected ? wash : clear
            guard row.wantsLayer || fill !== clear else { return }
            row.wantsLayer = true
            if row.layer?.backgroundColor != fill { row.layer?.backgroundColor = fill }
        }
    }

    /// The table this probe stands behind, taken once and watched for
    /// scrolling from then on.
    private func adopt() -> NSTableView? {
        guard let found = enclosingTableView() else { return nil }
        table = found
        if let clip = found.enclosingScrollView?.contentView {
            clip.postsBoundsChangedNotifications = true
            NotificationCenter.default.addObserver(self, selector: #selector(paint),
                                                   name: NSView.boundsDidChangeNotification, object: clip)
        }
        return found
    }

    /// SwiftUI hangs a background's view well above the list it is the
    /// background of, and a walk up from here reaches the window's split
    /// view soon after — the sidebar's own outline in it, which is a table
    /// too and would be adopted in the pane list's place. So the walk stops
    /// at the first hosting view it passes: the pane's list is inside that
    /// one with the probe, and every other table in the window is outside
    /// it. Before the pane's list is built the walk finds nothing and
    /// adopts nothing; it is asked again at the next pass of layout, by
    /// which time the list is there.
    private func enclosingTableView() -> NSTableView? {
        var ancestor = superview
        var climbs = 0
        while let view = ancestor, climbs < Self.climbLimit {
            if let table = Self.tableView(in: view) { return table }
            if Self.isHostingView(view) { return nil }
            ancestor = view.superview
            climbs += 1
        }
        return nil
    }

    /// `NSHostingView` is generic, so its class is named rather than tested
    /// for — an ancestor that stops being one keeps the walk going as far
    /// as it ever did rather than stopping it short.
    private static func isHostingView(_ view: NSView) -> Bool {
        String(describing: type(of: view)).hasPrefix("NSHostingView")
    }

    private static func tableView(in view: NSView) -> NSTableView? {
        for child in view.subviews {
            if let table = child as? NSTableView { return table }
            if let found = tableView(in: child) { return found }
        }
        return nil
    }
}



