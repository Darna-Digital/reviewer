// A repository's avatar as an image, for the AppKit surfaces that draw
// rows by hand — the tree's repository headers, the palette — so a
// repository wears the same tile there as `RepoAvatar` draws in SwiftUI:
// two letters on the name's own colour, at the same proportions.
import AppKit
import ReviewerShared

@MainActor
enum RepoAvatarImage {
    private static var cache: [String: NSImage] = [:]

    static func image(for name: String, size: CGFloat) -> NSImage {
        let key = "\(name)@\(size)"
        if let cached = cache[key] { return cached }
        let initials = RepoMonogram.initials(of: name)
        let fill = NSColor(hex: RepoMonogram.hue(of: name))
        let image = NSImage(size: NSSize(width: size, height: size), flipped: false) { rect in
            fill.setFill()
            let radius = size * 3 / 16
            NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
            let text = NSAttributedString(
                string: initials,
                attributes: [
                    .font: NSFont.systemFont(ofSize: size / 2, weight: .semibold),
                    .foregroundColor: NSColor.white,
                ])
            let measured = text.size()
            text.draw(at: NSPoint(x: (rect.width - measured.width) / 2, y: (rect.height - measured.height) / 2))
            return true
        }
        cache[key] = image
        return image
    }
}
