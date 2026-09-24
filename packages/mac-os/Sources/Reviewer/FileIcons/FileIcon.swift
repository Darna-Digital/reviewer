// A file's type icon, the one the web app's tree wears, resolved and painted
// natively from the imported sprite — see `PierreIcons`. The rules are the
// tree's own: the whole name first (`.gitignore`, `Dockerfile`), then each
// extension candidate longest first (`mdx.tsx` before `tsx`), then the plain
// document. One image per symbol and palette is rasterised, and every row
// and tab draws from that cache.
import AppKit
import SwiftUI

enum FileIcon {
    /// The sprite token for a path — `typescript`, `react`, `default`.
    static func token(for path: String) -> String {
        let name = (path.split(separator: "/").last.map(String.init) ?? path).lowercased()
        if let byName = PierreIcons.byFileName[name] { return byName }
        let segments = name.split(separator: ".", omittingEmptySubsequences: false)
        for start in segments.indices.dropFirst() {
            let candidate = segments[start...].joined(separator: ".")
            if let override = PierreIcons.extensionOverrides[candidate] { return override }
            if let match = PierreIcons.byExtension[candidate] { return match }
        }
        return "default"
    }

    /// The icon in its own hue for the palette, or in `tint` — the git
    /// status colour the web tree paints a changed file's icon in.
    @MainActor
    static func image(for path: String, dark: Bool, tint: String? = nil) -> NSImage? {
        let token = token(for: path)
        let hue = PierreIcons.hues[token] ?? PierreIcons.hues["default"]
        let color = tint ?? (dark ? hue?.dark : hue?.light) ?? "#84848a"
        return Rasterised.image(token: token, color: color)
    }

    @MainActor
    private enum Rasterised {
        private static var cache: [String: NSImage] = [:]

        static func image(token: String, color: String) -> NSImage? {
            let key = "\(color):\(token)"
            if let cached = cache[key] { return cached }
            guard let symbol = PierreIcons.symbols[token] else { return nil }
            let svg = """
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="\(symbol.viewBox)">\
                \(symbol.body.replacingOccurrences(of: "currentColor", with: color, options: .caseInsensitive))\
                </svg>
                """
            guard let data = svg.data(using: .utf8), let image = NSImage(data: data) else { return nil }
            cache[key] = image
            return image
        }
    }
}

/// The icon at the tree's size, in the palette the view is drawn in.
struct FileIconView: View {
    let path: String
    var tint: String? = nil
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Group {
            if let image = FileIcon.image(for: path, dark: colorScheme == .dark, tint: tint) {
                Image(nsImage: image)
                    .resizable()
                    .interpolation(.high)
            } else {
                Image(systemName: "doc")
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: 16, height: 16)
    }
}
