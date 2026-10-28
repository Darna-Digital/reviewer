// A branch row's submenu in the switcher, and the menu a right click
// opens on a branch in the Branches pane — everything that can be done to
// the branch besides picking it — drawn by the shell rather than as a
// system menu, the way the web switcher's `DropdownMenuSubContent` was: a
// column the width of the web one's `w-72`, opening off the row's
// trailing edge, its items cut in the middle when a branch name makes
// them too long, and each cut item said in full in the same `RowTooltip`
// the branch rows use. A system menu can't: it either grows as wide as
// its longest "Review ‘…’ against ‘…’" or cuts it with no way to read the
// rest. Building it only when it opens also spares the list a menu's
// worth of items per row on every redraw.
import AppKit
import SwiftUI

struct BranchActionMenu: View {
    let actions: [BranchAction]
    /// Opened from the keys, so its first item is lit for them to start on.
    let litFirst: Bool
    /// Puts the submenu away and nothing else — ←, back to the list.
    let close: () -> Void
    /// Called once an item has run, for the popovers to put themselves away.
    let ran: () -> Void
    /// The item lit, by the pointer or the keys alike, as a menu's is.
    @State private var lit: Int?

    private static var width: CGFloat { 288 }

    /// The items the keys walk, the rules between them stepped over.
    private var items: [BranchAction] { actions.filter(\.isItem) }

    var body: some View {
        let items = items
        VStack(alignment: .leading, spacing: 1) {
            ForEach(actions) { action in
                switch action.kind {
                case .item(let title, let destructive, _):
                    ActionRow(title: title, destructive: destructive, lit: lit == action.id) { inside in
                        if inside { lit = action.id } else if lit == action.id { lit = nil }
                    } run: {
                        run(action)
                    }
                case .divider:
                    MenuRule()
                        .padding(.horizontal, 4)
                        .padding(.vertical, 3)
                }
            }
        }
        .padding(4)
        .frame(width: Self.width)
        .popoverListKeys(active: litPosition(in: items), count: items.count, pick: { run(items[$0]) }) { press in
            guard press.key == .left else { return false }
            close()
            return true
        }
        .onAppear { if litFirst { lit = items.first?.id } }
    }

    /// The lit item as a place among the items alone, which is what the
    /// keys step through.
    private func litPosition(in items: [BranchAction]) -> Binding<Int?> {
        Binding(
            get: { items.firstIndex { $0.id == lit } },
            set: { position in lit = position.map { items[$0].id } })
    }

    private func run(_ action: BranchAction) {
        guard case .item(_, _, let run) = action.kind else { return }
        run()
        ran()
    }
}

/// The rule between runs of items, a single pixel thick as a system
/// menu's separator is: the point-thick `ThemedDivider` reads as a bar
/// between lines of 12pt type.
private struct MenuRule: View {
    @Environment(\.displayScale) private var displayScale
    @Environment(\.colorScheme) private var colorScheme

    private var ink: Color {
        ChromePalette.shared.isThemed(colorScheme == .dark ? .dark : .light)
            ? Color(nsColor: IslandPalette.hairline)
            : Color(nsColor: .separatorColor)
    }

    var body: some View {
        Rectangle()
            .fill(ink)
            .frame(height: 1 / displayScale)
    }
}

/// The items' type, named once so the clip is measured in the font the
/// item sets its title in.
private var itemFont: NSFont { .systemFont(ofSize: 12) }

private struct ActionRow: View {
    let title: String
    let destructive: Bool
    let lit: Bool
    let hover: (Bool) -> Void
    let run: () -> Void
    @State private var clipped = false

    var body: some View {
        Text(title)
            .lineLimit(1)
            .truncationMode(.middle)
            .measuringClip(title, font: itemFont, into: $clipped)
            .font(Font(itemFont))
            .foregroundStyle(destructive ? AnyShapeStyle(Color.red) : AnyShapeStyle(.primary))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.primary.opacity(lit ? 0.08 : 0), in: RoundedRectangle(cornerRadius: 5))
            .rowTooltip(clipped ? title : nil, active: lit)
            .contentShape(Rectangle())
            .onTapGesture(perform: run)
            .onHover(perform: hover)
    }
}

/// A secondary click on the view it overlays — a right click, or a click
/// with Control held — and nothing else: every other click falls through
/// to the view underneath, so a row can open its submenu on a right click
/// without a system context menu of its own. It says where in the view the
/// click landed, for a menu that opens at the pointer.
struct SecondaryClick: NSViewRepresentable {
    let action: (_ at: UnitPoint) -> Void

    init(action: @escaping (_ at: UnitPoint) -> Void) {
        self.action = action
    }

    init(action: @escaping () -> Void) {
        self.action = { _ in action() }
    }

    func makeNSView(context: Context) -> SecondaryClickView {
        SecondaryClickView()
    }

    func updateNSView(_ view: SecondaryClickView, context: Context) {
        view.action = action
    }
}

final class SecondaryClickView: NSView {
    var action: (UnitPoint) -> Void = { _ in }

    private static func isSecondary(_ event: NSEvent?) -> Bool {
        switch event?.type {
        case .rightMouseDown, .rightMouseUp: true
        case .leftMouseDown, .leftMouseUp: event?.modifierFlags.contains(.control) == true
        default: false
        }
    }

    /// Hit only by the click it answers, judged from the event being
    /// dispatched — the only way a view can let the other clicks through.
    override func hitTest(_ point: NSPoint) -> NSView? {
        Self.isSecondary(NSApp.currentEvent) ? super.hitTest(point) : nil
    }

    override func rightMouseDown(with event: NSEvent) { action(spot(of: event)) }
    override func mouseDown(with event: NSEvent) { action(spot(of: event)) }
    override func menu(for event: NSEvent) -> NSMenu? { nil }

    /// Where the click landed, as a share of the view's width and of its
    /// height down from the top.
    private func spot(of event: NSEvent) -> UnitPoint {
        guard bounds.width > 0, bounds.height > 0 else { return .center }
        let point = convert(event.locationInWindow, from: nil)
        let down = isFlipped ? point.y : bounds.height - point.y
        return UnitPoint(x: point.x / bounds.width, y: down / bounds.height)
    }
}
