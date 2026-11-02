// The notices on the window (see `Notices`), stacked at the bottom
// trailing corner of the window, over the islands. Each is a card — the
// glyph on the first line, the text
// beside it, the close under the pointer — on the islands' own sheet, so
// it reads as one more panel standing on the frame rather than as a system
// alert. A loading notice wears the orb, which is how the app says
// "working" everywhere else. Newest at the foot, rising as they come and dropping as they go,
// and the whole stack holding still under the pointer.
import SwiftUI

struct NoticeStack: View {
    @Environment(AppModel.self) private var model

    /// Wide enough for a path or a line of git's on two lines rather than
    /// four, narrow enough to leave the page its corner.
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

/// The card's type, on the web app's scale — `type-ui` for the headline,
/// `type-body` for the prose under it: one size, told apart by
/// weight and colour rather than by a step down, both set on the web's
/// 20pt line. A semibold headline shouted a path or a sentence of git's at
/// the reader; medium names the outcome without raising its voice, and
/// the same weight before and after a notice settles keeps the card from
/// jumping as "Pushing…" becomes "Pushed".
enum NoticeType {
    static let size: CGFloat = 13
    static let title = Font.system(size: size, weight: .medium)
    static let body = Font.system(size: size)
    /// What `lineSpacing` adds to SF's own line at `size` to reach 20pt.
    static let leading: CGFloat = {
        let font = NSFont.systemFont(ofSize: size)
        let natural = (font.ascender - font.descender + font.leading).rounded(.up)
        return max(0, 20 - natural)
    }()
    /// Between the headline and what is under it: less than a line's
    /// leading would read as a paragraph break.
    static let gap: CGFloat = 2

    /// A view with no baseline of its own — the glyph, the close — centred
    /// on the headline's first line: its baseline put half SF's x-height
    /// below its middle, so its middle sits where a lowercase letter's does.
    static func onFirstLine(_ dimensions: ViewDimensions) -> CGFloat {
        dimensions[VerticalAlignment.center] + NSFont.systemFont(ofSize: size).xHeight / 2
    }
}

private struct NoticeCard: View {
    let notice: Notice
    let dismiss: () -> Void
    @Environment(AppModel.self) private var model
    @State private var isHovering = false
    @State private var showsDetails = false

    private static let shape = RoundedRectangle(cornerRadius: 8, style: .continuous)

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            glyph
                .frame(width: 16)
                .alignmentGuide(.firstTextBaseline, computeValue: NoticeType.onFirstLine)
            VStack(alignment: .leading, spacing: NoticeType.gap) {
                Text(notice.title)
                    .font(NoticeType.title)
                    .lineSpacing(NoticeType.leading)
                    .lineLimit(3)
                if let detail = notice.detail {
                    Text(detail)
                        .font(NoticeType.body)
                        .lineSpacing(NoticeType.leading)
                        .foregroundStyle(.secondary)
                        .lineLimit(6)
                }
                if notice.output != nil {
                    Button("Details") { showsDetails = true }
                        .buttonStyle(.plain)
                        .font(NoticeType.title)
                        .foregroundStyle(.tint)
                        .padding(.top, 2)
                        .popover(isPresented: $showsDetails, arrowEdge: .leading) {
                            NoticeDetails(notice: notice)
                        }
                        .onChange(of: showsDetails) { _, shown in model.notices.pin(notice.id, shown) }
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
            .alignmentGuide(.firstTextBaseline, computeValue: NoticeType.onFirstLine)
            .opacity(isHovering ? 1 : 0)
            .help("Dismiss")
        }
        .padding(12)
        .background(Color(nsColor: IslandPalette.island), in: Self.shape)
        .overlay(Self.shape.strokeBorder(Color(nsColor: IslandPalette.separator), lineWidth: 1))
        .shadow(color: .black.opacity(0.18), radius: 16, y: 6)
        .onHover { isHovering = $0 }
        .accessibilityElement(children: .contain)
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

/// The command's own words behind a notice's Details: git's account in
/// monospace, selectable and copied whole by the button in the header,
/// since a rejection is what gets pasted into a search or a message.
private struct NoticeDetails: View {
    let notice: Notice
    @State private var copied = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(notice.title)
                    .font(.system(size: 13, weight: .semibold))
                Spacer()
                // Sized by the wider word, so the button holds still while
                // it says the copy went through.
                Button(action: copy) {
                    ZStack {
                        Label("Copied", systemImage: "checkmark").hidden()
                        Label(copied ? "Copied" : "Copy", systemImage: copied ? "checkmark" : "doc.on.doc")
                    }
                }
                .labelStyle(.titleAndIcon)
                .controlSize(.small)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            ThemedDivider()
            ScrollView([.vertical, .horizontal]) {
                Text(notice.output ?? "")
                    .font(.system(size: 11, design: .monospaced))
                    .textSelection(.enabled)
                    .fixedSize(horizontal: true, vertical: false)
                    .padding(14)
                    // Short output sits under the header rather than floating
                    // in the middle of a taller-than-needed sheet.
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
        // No ideal height: the sheet hugs the output it has, up to the cap.
        .frame(minWidth: 420, idealWidth: 560, maxWidth: 720, maxHeight: 400)
    }

    private func copy() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(notice.output ?? "", forType: .string)
        copied = true
        Task {
            try? await Task.sleep(for: .seconds(2))
            copied = false
        }
    }
}
