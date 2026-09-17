// Highlighting for one open file. Owned by the file rather than the view so
// the JavaScriptCore context (highlight.js is ~1 MB of script) is set up once
// per file, not once per tab switch.
//
// Each buffer has its own serial queue and its own Highlighter: the context is
// not thread-safe and one theme lives on it, so nothing is shared. The queue
// keeps a big file's pass off the main thread; the editor drops a result that
// no longer matches its text.
import AppKit
import Highlighter

/// A finished pass. `NSAttributedString` is immutable once built, so handing
/// it across the queue boundary is safe even though it is not marked so.
struct HighlightedCode: @unchecked Sendable {
    let text: NSAttributedString
    let background: NSColor
}

final class CodeBuffer: Sendable {
    static let fontName = "Menlo"
    static let fontSize: CGFloat = 12

    static var font: NSFont {
        NSFont(name: fontName, size: fontSize) ?? .monospacedSystemFont(ofSize: fontSize, weight: .regular)
    }

    let language: String?
    private let queue = DispatchQueue(label: "reviewer.highlight", qos: .userInitiated)
    // Queue-confined: only ever touched from `queue`.
    nonisolated(unsafe) private var highlighter: Highlighter?
    nonisolated(unsafe) private var appliedTheme: String?

    init(language: String?) {
        self.language = language
    }

    /// The pair is highlight.js's own Xcode light theme and the dark theme
    /// that reads closest to it; `xcode-dusk`, the only dark Xcode port the
    /// library ships, greys its plain text too far down.
    static func themeName(dark: Bool) -> String {
        dark ? "atom-one-dark" : "xcode"
    }

    /// Base text colour before the first pass lands (and for a file with no
    /// grammar, which never gets one) — matched to the themes above so the
    /// swap from plain to highlighted does not flash.
    static func foreground(dark: Bool) -> NSColor {
        dark ? NSColor(srgbRed: 0.67, green: 0.70, blue: 0.75, alpha: 1) : .black
    }

    static func background(dark: Bool) -> NSColor {
        dark ? NSColor(srgbRed: 0.157, green: 0.173, blue: 0.204, alpha: 1) : .white
    }

    func highlight(_ code: String, dark: Bool) async -> HighlightedCode? {
        guard let language else { return nil }
        return await withCheckedContinuation { continuation in
            queue.async {
                continuation.resume(returning: self.run(code, language: language, dark: dark))
            }
        }
    }

    private func run(_ code: String, language: String, dark: Bool) -> HighlightedCode? {
        if highlighter == nil { highlighter = Highlighter() }
        guard let highlighter else { return nil }
        let theme = Self.themeName(dark: dark)
        if theme != appliedTheme {
            guard highlighter.setTheme(theme, withFont: Self.fontName, ofSize: Self.fontSize) else { return nil }
            appliedTheme = theme
        }
        guard let text = highlighter.highlight(code, as: language) else { return nil }
        return HighlightedCode(text: text, background: highlighter.theme.themeBackgroundColour ?? Self.background(dark: dark))
    }
}
