// The notices on the window (see `Notices`): the web toaster's stack, drawn
// natively at the bottom trailing corner of the window, over the islands.
// Each is the web toast's card — the glyph on the first line, the text
// beside it, the close under the pointer — on the islands' own sheet, so
// it reads as one more panel standing on the frame rather than as a system
// alert. A loading notice wears the orb, which is how the app says
// "working" everywhere else. Newest at the foot, rising as they come and dropping as they go,
// and the whole stack holding still under the pointer.
import SwiftUI

struct NoticeStack: View {
    @Environment(AppModel.self) private var model

    /// The web toaster's `--width`: 23rem.
    static let width: CGFloat = 368
    /// Its offset from the viewport's edge.
    private static let inset: CGFloat = 16

    var body: some View {
        let notices = model.notices
        VStack(alignment: .trailing, spacing: 10) {
            ForEach(notices.items) { notice in
                NoticeCard(notice: notice) { notices.dismiss(notice.id) }
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .frame(width: Self.width)
        // The hold is the cards' own: the stack fills the window below, and
        // a pointer over the page is not a reader.
        .onHover { notices.hold($0) }
        .padding(Self.inset)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
        .animation(NoticeMotion.change, value: notices.items)
    }
}

enum NoticeMotion {
    static var change: Animation? {
        NSWorkspace.shared.accessibilityDisplayShouldReduceMotion ? nil : .spring(duration: 0.32, bounce: 0.18)
    }
}

private struct NoticeCard: View {
    let notice: Notice
    let dismiss: () -> Void
    @State private var isHovering = false

    private static let shape = RoundedRectangle(cornerRadius: 8, style: .continuous)

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            glyph
                // Centred on the title's first line rather than the block.
                .frame(width: 16, height: 18)
            VStack(alignment: .leading, spacing: 2) {
                Text(notice.title)
                    .font(.system(size: 13))
                    .lineLimit(6)
                if let detail = notice.detail {
                    Text(detail)
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                        .lineLimit(6)
                }
            }
            .multilineTextAlignment(.leading)
            .textSelection(.enabled)
            .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: dismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .frame(width: 20, height: 20)
                    .background(Color.primary.opacity(isHovering ? 0.06 : 0), in: RoundedRectangle(cornerRadius: 5))
            }
            .buttonStyle(.plain)
            .opacity(isHovering ? 1 : 0)
            .help("Dismiss")
        }
        .padding(12)
        .background(Color(nsColor: IslandPalette.island), in: Self.shape)
        .overlay(Self.shape.strokeBorder(Color(nsColor: .separatorColor), lineWidth: 1))
        .shadow(color: .black.opacity(0.18), radius: 16, y: 6)
        .onHover { isHovering = $0 }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isStaticText)
    }

    @ViewBuilder
    private var glyph: some View {
        switch notice.kind {
        case .loading:
            Orb(size: 16, label: "Working")
        case .success:
            Image(systemName: "checkmark.circle")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Color(nsColor: .systemGreen))
        case .error:
            Image(systemName: "exclamationmark.octagon")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Color(nsColor: .systemRed))
        case .info:
            Image(systemName: "info.circle")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.secondary)
        }
    }
}
