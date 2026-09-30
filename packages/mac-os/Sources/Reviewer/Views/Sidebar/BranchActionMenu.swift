// A branch row's submenu in the switcher — everything that can be done to
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
    /// Called once an item has run, for the popovers to put themselves away.
    let ran: () -> Void
    @State private var hovered: Int?

    private static var width: CGFloat { 288 }

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            ForEach(actions) { action in
                switch action.kind {
                case .item(let title, let destructive, let run):
                    ActionRow(title: title, destructive: destructive, hovered: hovered == action.id) { inside in
                        if inside { hovered = action.id } else if hovered == action.id { hovered = nil }
                    } run: {
                        run()
                        ran()
                    }
                case .divider:
                    ThemedDivider()
                        .padding(.horizontal, 4)
                        .padding(.vertical, 3)
                }
            }
        }
        .padding(4)
        .frame(width: Self.width)
    }
}

/// The items' type, named once so the clip is measured in the font the
/// item sets its title in.
private var itemFont: NSFont { .systemFont(ofSize: 12) }

private struct ActionRow: View {
    let title: String
    let destructive: Bool
    let hovered: Bool
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
            .background(Color.primary.opacity(hovered ? 0.08 : 0), in: RoundedRectangle(cornerRadius: 5))
            .rowTooltip(clipped ? title : nil, active: hovered)
            .contentShape(Rectangle())
            .onTapGesture(perform: run)
            .onHover(perform: hover)
    }
}

/// A secondary click on the view it overlays — a right click, or a click
/// with Control held — and nothing else: every other click falls through
/// to the view underneath, so a row can open its submenu on a right click
/// without a system context menu of its own.
struct SecondaryClick: NSViewRepresentable {
    let action: () -> Void

    func makeNSView(context: Context) -> SecondaryClickView {
        SecondaryClickView()
    }

    func updateNSView(_ view: SecondaryClickView, context: Context) {
        view.action = action
    }
}

final class SecondaryClickView: NSView {
    var action: () -> Void = {}

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

    override func rightMouseDown(with event: NSEvent) { action() }
    override func mouseDown(with event: NSEvent) { action() }
    override func menu(for event: NSEvent) -> NSMenu? { nil }
}
