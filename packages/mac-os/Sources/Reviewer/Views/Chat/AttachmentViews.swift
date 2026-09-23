// Image attachments as a grid of thumbnails — the web's `image-attachments`:
// the composer's pending picks as small chips with a remove mark under the
// pointer, a sent message's previews larger, and either one opening to the
// image at full size in a sheet over the window.
import SwiftUI

/// A wrapping row of thumbnails.
struct AttachmentGrid<Content: View>: View {
    var alignment: HorizontalAlignment = .leading
    @ViewBuilder let content: Content

    var body: some View {
        FlowLayout(spacing: 8, alignment: alignment) { content }
    }
}

/// A pending pick: its thumbnail, the remove mark over its corner while
/// the pointer is on it, and the full image on a click.
struct AttachmentChip: View {
    let attachment: ComposerAttachment
    let onRemove: () -> Void
    @State private var isHovering = false
    @State private var enlarged = false

    var body: some View {
        Button { enlarged = true } label: {
            Image(nsImage: attachment.preview)
                .resizable()
                .scaledToFill()
                .frame(width: 64, height: 64)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Color(nsColor: IslandPalette.separator), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .overlay(alignment: .topTrailing) {
            if isHovering {
                Button(action: onRemove) {
                    Image(systemName: "xmark")
                        .font(.system(size: 9, weight: .bold))
                        .frame(width: 18, height: 18)
                        .background(.regularMaterial, in: Circle())
                }
                .buttonStyle(.plain)
                .padding(3)
                .help("Remove \(attachment.name)")
            }
        }
        .onHover { isHovering = $0 }
        .help(attachment.name)
        .lightbox(image: attachment.full, name: attachment.name, shown: $enlarged)
    }
}

/// A sent message's image: the thumbnail the message kept, opening to it
/// at the size it was kept at.
struct SentAttachmentPreview: View {
    let attachment: ChatAttachment
    @State private var enlarged = false

    var body: some View {
        let image = DataURL.image(attachment.thumbnail)
        Button { enlarged = true } label: {
            Group {
                if let image {
                    Image(nsImage: image)
                        .resizable()
                        .scaledToFill()
                } else {
                    Image(systemName: "photo")
                        .font(.system(size: 20))
                        .foregroundStyle(.tertiary)
                }
            }
            .frame(width: 128, height: 128)
            .background(.quaternaryWash(0.5))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Color(nsColor: IslandPalette.separator), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .disabled(image == nil)
        .help(attachment.name)
        .lightbox(image: image, name: attachment.name, shown: $enlarged)
    }
}

private struct Lightbox: ViewModifier {
    let image: NSImage?
    let name: String
    @Binding var shown: Bool

    func body(content: Content) -> some View {
        content.sheet(isPresented: $shown) {
            if let image {
                let size = Self.displaySize(of: image)
                Image(nsImage: image)
                    .resizable()
                    .interpolation(.high)
                    .scaledToFit()
                    .frame(width: size.width, height: size.height)
                    .padding(12)
                    .overlay(alignment: .topTrailing) {
                        Button { shown = false } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 18))
                                .symbolRenderingMode(.hierarchical)
                        }
                        .buttonStyle(.plain)
                        .padding(18)
                        .keyboardShortcut(.cancelAction)
                    }
                    .accessibilityLabel(name)
            }
        }
    }

    private static let windowMargin: CGFloat = 48

    /// As large as the window leaves room for, but never past the image's
    /// own pixels — a Retina screenshot's point size is half of what it holds.
    private static func displaySize(of image: NSImage) -> CGSize {
        let pixels = pixelSize(of: image)
        guard pixels.width > 0, pixels.height > 0 else { return image.size }
        let room = roomInWindow()
        let scale = min(room.width / pixels.width, room.height / pixels.height, 1)
        return CGSize(width: (pixels.width * scale).rounded(), height: (pixels.height * scale).rounded())
    }

    private static func pixelSize(of image: NSImage) -> CGSize {
        let widest = image.representations.max { $0.pixelsWide < $1.pixelsWide }
        guard let widest, widest.pixelsWide > 0, widest.pixelsHigh > 0 else { return image.size }
        return CGSize(width: widest.pixelsWide, height: widest.pixelsHigh)
    }

    /// The sheet's parent stays the main window while the sheet itself takes key.
    private static func roomInWindow() -> CGSize {
        let bounds = NSApp.mainWindow?.contentLayoutRect.size
            ?? NSScreen.main?.visibleFrame.size
            ?? CGSize(width: 1200, height: 800)
        return CGSize(
            width: max(bounds.width - windowMargin * 2, 200),
            height: max(bounds.height - windowMargin * 2, 200))
    }
}

private extension View {
    func lightbox(image: NSImage?, name: String, shown: Binding<Bool>) -> some View {
        modifier(Lightbox(image: image, name: name, shown: shown))
    }
}

/// Rows of as many items as fit, wrapping — what the web grid's
/// `flex-wrap` does.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    var alignment: HorizontalAlignment = .leading

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = rows(fitting: proposal.width ?? .infinity, subviews: subviews)
        let height = rows.map(\.height).reduce(0, +) + spacing * CGFloat(max(0, rows.count - 1))
        let width = rows.map(\.width).max() ?? 0
        return CGSize(width: proposal.width ?? width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in rows(fitting: bounds.width, subviews: subviews) {
            var x: CGFloat
            switch alignment {
            case .trailing: x = bounds.maxX - row.width
            case .center: x = bounds.midX - row.width / 2
            default: x = bounds.minX
            }
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row {
        var indices: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func rows(fitting width: CGFloat, subviews: Subviews) -> [Row] {
        var rows: [Row] = []
        var row = Row()
        for (index, subview) in subviews.enumerated() {
            let size = subview.sizeThatFits(.unspecified)
            let next = row.indices.isEmpty ? size.width : row.width + spacing + size.width
            if !row.indices.isEmpty && next > width {
                rows.append(row)
                row = Row()
            }
            row.indices.append(index)
            row.width = row.indices.count == 1 ? size.width : row.width + spacing + size.width
            row.height = max(row.height, size.height)
        }
        if !row.indices.isEmpty { rows.append(row) }
        return rows
    }
}
