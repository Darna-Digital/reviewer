// The window's own colours, handed to the islands as CSS custom properties
// so the web app paints on the same material the native views around it
// do. Resolved under the app's effective appearance, so dark and light read
// the real system values rather than a guess at them, and re-read whenever
// that appearance changes.
import AppKit

enum NativePalette {
    /// Every `--native-*` property the SPA's `.island` styles read.
    static func cssVariables() -> [String: String] {
        let colors: [(String, NSColor)] = [
            ("--native-window", .windowBackgroundColor),
            ("--native-control", .controlBackgroundColor),
            ("--native-under-page", .underPageBackgroundColor),
            ("--native-text", .labelColor),
            ("--native-text-secondary", .secondaryLabelColor),
            ("--native-text-tertiary", .tertiaryLabelColor),
            ("--native-separator", .separatorColor),
            ("--native-grid", .gridColor),
            ("--native-accent", .controlAccentColor),
            ("--native-selection", .selectedContentBackgroundColor),
            ("--native-selection-unemphasized", .unemphasizedSelectedContentBackgroundColor),
        ]
        var variables: [String: String] = [:]
        NSApp.effectiveAppearance.performAsCurrentDrawingAppearance {
            for (name, color) in colors {
                variables[name] = css(color)
            }
        }
        return variables
    }

    /// The script that applies them to the document — run before the first
    /// paint, and again when the appearance changes.
    static func applyScript() -> String {
        let pairs = cssVariables().map { "[\(json($0.key)), \(json($0.value))]" }.joined(separator: ",")
        return """
        (() => {
          const style = document.documentElement.style;
          for (const [name, value] of [\(pairs)]) style.setProperty(name, value);
        })();
        """
    }

    private static func css(_ color: NSColor) -> String {
        guard let srgb = color.usingColorSpace(.sRGB) else { return "transparent" }
        let r = Int((srgb.redComponent * 255).rounded())
        let g = Int((srgb.greenComponent * 255).rounded())
        let b = Int((srgb.blueComponent * 255).rounded())
        let a = (srgb.alphaComponent * 100).rounded() / 100
        return a >= 1 ? "rgb(\(r) \(g) \(b))" : "rgb(\(r) \(g) \(b) / \(a))"
    }

    private static func json(_ text: String) -> String {
        let data = try? JSONSerialization.data(withJSONObject: [text])
        let array = data.flatMap { String(data: $0, encoding: .utf8) } ?? "[\"\"]"
        return String(array.dropFirst().dropLast())
    }
}
