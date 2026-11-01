// The name in the mark's own blocks, centred over a fresh session's
// composer. It rests faint — a watermark, not a headline — and a highlight
// crosses it once, left to right, when the page comes up, so the page
// arrives rather than just appears. The artwork is the brand package's SVG
// (see `BlockWordmark.generated.swift`) painted as a template, so it takes
// the label colour of either appearance and stays vector at any size.
import SwiftUI

struct BlockWordmark: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    /// The highlight's centre, in widths of the wordmark from its leading
    /// edge. It starts and ends just clear of the letters, so the band is
    /// never seen arriving or leaving.
    @State private var sweep = Self.sweepStart

    /// Blocks are whole points, so every edge lands on the pixel grid; a
    /// column too narrow for the full size shrinks it to fit.
    private static let cell: CGFloat = 14
    /// Dark ink on a light page reads fainter than light ink on a dark one
    /// at the same alpha, so the light appearance rests twice as strong.
    private static let restOpacity = (light: 0.18, dark: 0.09)
    private static let highlightOpacity = 0.45
    private static let bandWidth: CGFloat = 0.35
    private static let sweepStart = -bandWidth / 2
    private static let sweepEnd = 1 + bandWidth / 2

    var body: some View {
        artwork
            .foregroundStyle(.primary.opacity(restOpacity))
            .overlay {
                artwork
                    .foregroundStyle(.primary.opacity(Self.highlightOpacity))
                    .mask { highlight }
            }
            .aspectRatio(BlockWordmarkArtwork.aspectRatio, contentMode: .fit)
            .frame(maxWidth: Self.cell * BlockWordmarkArtwork.columns)
            .accessibilityElement()
            .accessibilityLabel("Reviewer")
            .onAppear(perform: shimmer)
    }

    private var restOpacity: Double {
        colorScheme == .dark ? Self.restOpacity.dark : Self.restOpacity.light
    }

    private var artwork: some View {
        Image(nsImage: Self.image).renderingMode(.template).resizable()
    }

    private var highlight: some View {
        GeometryReader { proxy in
            LinearGradient(colors: [.clear, .black, .clear], startPoint: .leading, endPoint: .trailing)
                .frame(width: proxy.size.width * Self.bandWidth)
                .offset(x: proxy.size.width * (sweep - Self.bandWidth / 2))
        }
    }

    private func shimmer() {
        guard !reduceMotion else { return }
        withAnimation(.easeInOut(duration: 1.2).delay(0.15)) { sweep = Self.sweepEnd }
    }

    private static let image: NSImage = {
        let image = NSImage(data: Data(BlockWordmarkArtwork.svg.utf8)) ?? NSImage()
        image.isTemplate = true
        return image
    }()
}
