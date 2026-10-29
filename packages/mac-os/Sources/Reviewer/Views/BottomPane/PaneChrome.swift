// The pieces the bottom pane's surfaces are built from, so they read as
// one instrument: the bar each surface wears under the tab strip, as
// Xcode's debug area and navigators wear theirs — the system's small
// controls, borderless, lit only under the pointer, groups parted by a
// hairline, and the small search field at the trailing edge; no glass,
// since the glass is the tab strip's above (see `BottomPane`) and a
// surface's controls belong to the surface. A table surface's detail wears
// the same bar, so the rule under the one runs on into the rule under the
// other. Then the flat bar button the bars carry, and the dot that says
// whether a process is up.
import AppKit
import SwiftUI

enum PaneMetrics {
    /// The bar under the tab strip: its glass controls with four points
    /// of air above and below.
    static let barHeight: CGFloat = 34
    static let glassHeight: CGFloat = 26
    static let barInset: CGFloat = 8
    static let rowHeight: CGFloat = 22
    /// One level of an outline, the sidebar's own `indentationPerLevel`.
    static let indentUnit: CGFloat = 16
    static let listMinWidth: CGFloat = 200
    static let listIdealWidth: CGFloat = 240
    static let listMaxWidth: CGFloat = 380
    /// The widest a bar's filter field stands.
    static let filterWidth: CGFloat = 280
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

/// The air above a pane list's first row and below its last, as much as
/// the bar above it keeps at its sides. A row rather than
/// `contentMargins`, which the list ignores, so it scrolls with the rows;
/// it cannot be picked, so the keys walk past it.
struct ListEdgeSpacer: View {
    var body: some View {
        Color.clear
            .frame(height: PaneMetrics.barInset)
            .listRowSeparator(.hidden)
            .listRowInsets(EdgeInsets())
            .selectionDisabled()
    }
}

extension EnvironmentValues {
    /// Whether a control stands inside a `PaneGlassGroup`, whose one
    /// capsule of glass it shares rather than wearing its own.
    @Entry var inGlassGroup = false
}

/// A lone glyph — a filter menu's — in a circle of glass the height of the
/// search beside it, or in the glass of the group it stands in. A menu
/// takes no glass style of its own, so it is drawn plain and the glass
/// laid round it here.
private struct GlassCircleControl: ViewModifier {
    @Environment(\.inGlassGroup) private var grouped

    func body(content: Content) -> some View {
        if grouped {
            content
                .frame(width: PaneMetrics.glassHeight, height: PaneMetrics.glassHeight - 4)
                .contentShape(Capsule())
        } else {
            content
                .frame(width: PaneMetrics.glassHeight, height: PaneMetrics.glassHeight)
                .contentShape(Circle())
                .glassEffect(.regular.interactive(), in: Circle())
        }
    }
}

extension View {
    func glassCircleControl() -> some View { modifier(GlassCircleControl()) }
}

/// Related controls in one capsule of glass, as Xcode's toolbar holds
/// them — pop-ups, menus and buttons side by side, groups of them parted
/// inside the capsule by a `PaneGlassDivider` rather than standing in
/// pills of their own with gaps between — each lit on its own under the
/// pointer. A lone action stands in one of its own.
struct PaneGlassGroup<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        HStack(spacing: 0) { content }
            .environment(\.inGlassGroup, true)
            .padding(.horizontal, 2)
            .frame(height: PaneMetrics.glassHeight)
            .glassEffect(.regular, in: Capsule())
            .fixedSize()
    }
}

/// The hairline between the groups of controls inside one capsule of
/// glass, in the island's own hairline, the colour of the rules round the
/// pane and between the repositories in Branches.
struct PaneGlassDivider: View {
    var body: some View {
        Rectangle()
            .fill(Color(nsColor: IslandPalette.hairline))
            .frame(width: 1, height: 16)
            .padding(.horizontal, 4)
    }
}

/// The filter field at a bar's trailing edge, taking what room the bar
/// has left up to its widest.
struct PaneFilterField: View {
    var prompt = "Filter"
    @Binding var text: String
    var submit: (() -> Void)? = nil

    var body: some View {
        MinimalSearchField(prompt: prompt, text: $text, submit: submit)
            .frame(minWidth: 100, maxWidth: PaneMetrics.filterWidth)
    }
}

/// The one search the app has — the bars', the sidebar's heads', the
/// pickers' — in the glass macOS 27 stands its search in: a capsule with
/// the magnifier, the text and the mark that clears it, ringed in the
/// accent while it has the keys. Drawn here rather than taken from the
/// system, whose field paints itself after what stands behind it — a pale
/// pill on the sidebar's translucent column, a dark one on the pane's
/// solid island — and sets its magnifier hard against the text, so the
/// same field read as two. The text follows
/// every keystroke; a surface that searches on demand passes `submit`,
/// which fires on Return, on the field letting the keys go and on
/// clearing. Escape clears what is typed, then lets the field go. Raising
/// `takesKeyboard` hands it the keys.
struct MinimalSearchField: View {
    let prompt: String
    @Binding var text: String
    var submit: (() -> Void)? = nil
    var takesKeyboard: Binding<Bool> = .constant(false)
    @State private var focused = false
    @State private var wantsFocus = false

    private static let shape = Capsule()

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
            SearchTextInput(prompt: prompt, text: $text, focused: $focused, wantsFocus: $wantsFocus,
                            submit: { submit?() }, clear: clear)
            if !text.isEmpty {
                Button(action: clear) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(.tertiary)
                }
                .buttonStyle(.plain)
                .help("Clear")
            }
        }
        .padding(.horizontal, 10)
        .frame(height: PaneMetrics.glassHeight)
        // Plain glass, not interactive: interactive glass answers a press
        // with a squash and spring, which carried the prompt with it as the
        // field was clicked into.
        .glassEffect(.regular, in: Self.shape)
        .overlay {
            if focused {
                Self.shape.strokeBorder(Color(nsColor: IslandPalette.accent).opacity(0.8), lineWidth: 1.5)
            }
        }
        .contentShape(Self.shape)
        .onTapGesture { wantsFocus = true }
        .onChange(of: focused) { if !focused { submit?() } }
        .onChange(of: takesKeyboard.wrappedValue) { _, wanted in
            guard wanted else { return }
            wantsFocus = true
            takesKeyboard.wrappedValue = false
        }
    }


    private func clear() {
        text = ""
        submit?()
    }

    /// Hand the keyboard back to the window while a search field holds it.
    /// A surface swapped out from under a focused field keeps the keys for
    /// as long as the crossfade takes — the field on its way out taking the
    /// strokes that belong to the one coming in — so the surface that swaps
    /// it says so (see `SidebarView`) rather than waiting for the field to
    /// be taken out of the window.
    @MainActor
    static func releaseKeyboard(from window: NSWindow?) {
        guard let window, let responder = window.firstResponder else { return }
        let editing = responder as? FocusReportingTextField
            ?? ((responder as? NSTextView)?.delegate as? FocusReportingTextField)
        guard editing != nil else { return }
        window.makeFirstResponder(nil)
    }

    @MainActor
    static func releaseKeyboard() {
        releaseKeyboard(from: NSApp.keyWindow ?? NSApp.mainWindow)
    }
}

/// The text of `MinimalSearchField`: a borderless AppKit field whose cell
/// draws its text, and hands the editor the rect to edit in, centred the
/// same way (see `CentredTextCell`). SwiftUI's own field drew its resting
/// text — the prompt, or what was typed — a point lower than the editor
/// that takes over on focus, so the words hopped up as the field took the
/// keys.
private struct SearchTextInput: NSViewRepresentable {
    let prompt: String
    @Binding var text: String
    @Binding var focused: Bool
    @Binding var wantsFocus: Bool
    let submit: () -> Void
    let clear: () -> Void

    private static let font = NSFont.systemFont(ofSize: 12)

    func makeNSView(context: Context) -> FocusReportingTextField {
        let field = FocusReportingTextField()
        field.cell = CentredTextCell(textCell: "")
        field.isEditable = true
        field.isSelectable = true
        field.isBordered = false
        field.isBezeled = false
        field.drawsBackground = false
        field.focusRingType = .none
        field.usesSingleLineMode = true
        field.cell?.isScrollable = true
        field.cell?.wraps = false
        field.lineBreakMode = .byTruncatingTail
        field.font = Self.font
        field.placeholderAttributedString = NSAttributedString(
            string: prompt, attributes: [.font: Self.font, .foregroundColor: NSColor.placeholderTextColor])
        field.setContentHuggingPriority(.defaultLow, for: .horizontal)
        field.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        field.delegate = context.coordinator
        return field
    }

    func updateNSView(_ field: FocusReportingTextField, context: Context) {
        context.coordinator.parent = self
        field.onFocus = { [binding = $focused] holds in
            if binding.wrappedValue != holds { binding.wrappedValue = holds }
        }
        if field.stringValue != text { field.stringValue = text }
        if wantsFocus {
            field.takeKeyboard()
            // Lowered after this update rather than during it, which SwiftUI
            // does not allow a view's state to be changed in.
            Task { @MainActor [flag = $wantsFocus] in flag.wrappedValue = false }
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    @MainActor
    final class Coordinator: NSObject, NSTextFieldDelegate {
        var parent: SearchTextInput

        init(parent: SearchTextInput) {
            self.parent = parent
        }

        func controlTextDidChange(_ notification: Notification) {
            guard let field = notification.object as? NSTextField else { return }
            parent.text = field.stringValue
        }

        func control(_ control: NSControl, textView: NSTextView, doCommandBy selector: Selector) -> Bool {
            switch selector {
            case #selector(NSResponder.insertNewline(_:)):
                parent.submit()
                return true
            case #selector(NSResponder.cancelOperation(_:)):
                if parent.text.isEmpty {
                    control.window?.makeFirstResponder(nil)
                } else {
                    parent.clear()
                }
                return true
            default:
                return false
            }
        }
    }
}

/// A text field that says when it has the keys and when they go — on
/// becoming first responder, not on the first keystroke, and on its
/// editing ending, whether or not a letter was typed — and that lets the
/// keyboard go as it leaves the window, so a field removed while focused
/// never leaves the window pointing at a view that is gone.
final class FocusReportingTextField: NSTextField {
    var onFocus: ((Bool) -> Void)?
    /// Asked for the keyboard before it was in a window to take it from —
    /// a popover's search, asked for as the popover comes up.
    private var takesKeyboardOnArrival = false

    override func viewWillMove(toWindow newWindow: NSWindow?) {
        if newWindow == nil { MinimalSearchField.releaseKeyboard(from: window) }
        super.viewWillMove(toWindow: newWindow)
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if takesKeyboardOnArrival, window != nil {
            takesKeyboardOnArrival = false
            selectText(nil)
        }
    }

    /// The keys, with the text selected — `selectText` makes the field
    /// first responder as it selects — now, or once the field is in a window.
    func takeKeyboard() {
        if window == nil {
            takesKeyboardOnArrival = true
        } else {
            selectText(nil)
        }
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

/// A cell that sets its one line in the middle of its height. The rect is
/// the one AppKit both draws the text in and hands the editor, so the
/// prompt, the typed text and the editor that takes over on focus all
/// stand on one line. (Centring the title rect and drawing the interior
/// in it instead inset the resting text twice, and it hopped as the field
/// took the keys.)
private final class CentredTextCell: NSTextFieldCell {
    override func drawingRect(forBounds rect: NSRect) -> NSRect {
        var drawing = super.drawingRect(forBounds: rect)
        let lineHeight = cellSize(forBounds: rect).height
        let spare = drawing.height - lineHeight
        guard spare > 0 else { return drawing }
        drawing.origin.y += (spare / 2).rounded()
        drawing.size.height = lineHeight
        return drawing
    }
}

/// A pop-up on a bar: what it shows, then the up-and-down chevron a
/// pop-up ends in — in the glass of the group it stands in, or in a
/// capsule of its own.
struct PaneBarPopUp<Leading: View>: View {
    let title: String
    let help: String
    var maxWidth: CGFloat = 160
    @ViewBuilder let leading: Leading
    let action: () -> Void
    @Environment(\.inGlassGroup) private var grouped

    var body: some View {
        if grouped {
            button
        } else {
            button
                .padding(.horizontal, 2)
                .frame(height: PaneMetrics.glassHeight)
                .glassEffect(.regular.interactive(), in: Capsule())
                .fixedSize()
        }
    }

    private var button: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                leading
                Text(title)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .clipHelp(title, font: .systemFont(ofSize: 11))
                    .frame(maxWidth: maxWidth)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 8, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
            .font(.system(size: 11))
            .padding(.horizontal, 6)
            .fixedSize()
        }
        .buttonStyle(PaneBarButtonStyle())
        .controlTooltip(help)
    }
}

/// The look every button on a bar shares inside its glass: nothing at
/// rest, a capsule of wash under the pointer and a deeper one while
/// pressed — interactive glass on the Mac answers a press but not a
/// hover, so the hover is drawn here. Not `.accessoryBar`, which left a
/// bezel standing on whichever of a bar's buttons the keyboard happened to
/// rest on, so the row read as lit at random.
struct PaneBarButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        PaneBarButtonBody(configuration: configuration)
    }
}

private struct PaneBarButtonBody: View {
    let configuration: ButtonStyleConfiguration
    @Environment(\.isEnabled) private var isEnabled
    @State private var hovering = false

    private static let shape = Capsule()

    var body: some View {
        configuration.label
            .padding(.horizontal, 5)
            .frame(minHeight: PaneMetrics.glassHeight - 4)
            .background(Self.shape.fill(Color.primary.opacity(wash)))
            .contentShape(Self.shape)
            .opacity(isEnabled ? 1 : 0.4)
            .onHover { hovering = $0 }
    }

    private var wash: Double {
        guard isEnabled else { return 0 }
        if configuration.isPressed { return BarChipMetrics.onTint }
        return hovering ? BarChipMetrics.hoverTint : 0
    }
}

/// The bar under the tab strip, along the top of a surface or of one of
/// its columns: what it is narrowed and acted on by, on one line of small
/// controls, parted from the content by a rule.
struct PaneBar<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        HStack(spacing: 8) { content }
            .controlSize(.small)
            .padding(.horizontal, 8)
            .frame(height: PaneMetrics.barHeight)
            .frame(maxWidth: .infinity)
            .overlay(alignment: .bottom) { ThemedDivider() }
    }
}

/// A flat symbol button for the bars, lit only under the pointer.
struct PaneBarButton: View {
    let symbol: String
    let help: String
    var role: ButtonRole? = nil
    let action: () -> Void

    var body: some View {
        Button(role: role, action: action) {
            Image(systemName: symbol)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
                .frame(width: 16, height: 16)
        }
        .buttonStyle(PaneBarButtonStyle())
        .controlTooltip(help)
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
    /// The folder as a row shows it: the root as a single dot, as a shell
    /// would name it.
    var folderLabel: String { cwd.isEmpty ? "." : cwd }
    var folderHelp: String {
        cwd.isEmpty ? "Runs at the repository root" : "Runs in \(cwd)"
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



