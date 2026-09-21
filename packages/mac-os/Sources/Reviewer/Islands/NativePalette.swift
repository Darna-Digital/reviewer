// The window's palette, handed to the islands as CSS custom properties so
// the web app paints on the same material the native views around it do —
// the same `--chrome-*` the app sets for itself in a browser (see
// `lib/chrome-theme` in the SPA), here written by the shell from the
// colours it paints with (see `IslandPalette`): a theme's tokens where a
// theme is on, and otherwise the window's own two tones and the system's
// colours, resolved under the app's effective appearance so dark and light
// read the real values rather than a guess at them — and rewritten
// whenever that appearance or the theme changes.
import AppKit

@MainActor
enum NativePalette {
    /// Every `--chrome-*` property the SPA's `.themed` and `.island` styles
    /// read, for the appearance the app is drawing in. Brand ink — links,
    /// the connector ribbons' git colours — is only handed over where a
    /// theme names it; on the app's own palette it stays the app's own, as
    /// it does in any native app.
    static func cssVariables() -> [String: String] {
        let scheme: ThemeDescriptor.ColorScheme = NSApp.effectiveAppearance.isDark ? .dark : .light
        var colors: [(String, NSColor)] = [
            ("--chrome-frame", IslandPalette.frame),
            ("--chrome-island", IslandPalette.island),
            ("--chrome-control", IslandPalette.control),
            ("--chrome-popover", IslandPalette.popover),
            ("--chrome-text", IslandPalette.text),
            ("--chrome-text-secondary", IslandPalette.textSecondary),
            ("--chrome-text-tertiary", IslandPalette.textTertiary),
            ("--chrome-separator", IslandPalette.separator),
            ("--chrome-hairline", IslandPalette.hairline),
            ("--chrome-accent", IslandPalette.accent),
            ("--chrome-selection", IslandPalette.selection),
            ("--chrome-hover", IslandPalette.hover),
        ]
        if let tokens = ChromePalette.shared.tokens(for: scheme) {
            colors += [
                ("--chrome-link", NSColor(hex: tokens.link)),
                ("--chrome-added", NSColor(hex: tokens.added)),
                ("--chrome-modified", NSColor(hex: tokens.modified)),
                ("--chrome-deleted", NSColor(hex: tokens.deleted)),
            ]
        }
        var variables: [String: String] = [:]
        NSApp.effectiveAppearance.performAsCurrentDrawingAppearance {
            for (name, color) in colors {
                variables[name] = css(color)
            }
        }
        return variables
    }

    /// "dark" or "light", by the app's effective appearance.
    static func appearanceName() -> String {
        NSApp.effectiveAppearance.isDark ? "dark" : "light"
    }

    /// The script that applies them to the document — run before the first
    /// paint, and again when the appearance or the theme changes, when it
    /// also flips the scheme the way the SPA's own boot script would have on
    /// a system change.
    ///
    /// The scheme is the window's (see `AppSettings`), so the island is held
    /// to "system" — the web app's word for following the view it is in —
    /// whatever its own storage last said: a choice made on the SPA's
    /// settings page would otherwise hold the page to one scheme while the
    /// chrome around it followed another. The theme names are the window's
    /// too, written under the keys the SPA's prefs read them from, and the
    /// event tells a page already running to read them again — the code in
    /// it is highlighted by the page, and only the page can re-highlight it.
    static func applyScript() -> String {
        let pairs = cssVariables().map { "[\(json($0.key)), \(json($0.value))]" }.joined(separator: ",")
        let themes = ChromePalette.shared.names
        let dark = NSApp.effectiveAppearance.isDark
        return """
        (() => {
          const root = document.documentElement;
          for (const [name, value] of [\(pairs)]) root.style.setProperty(name, value);
          if (window.reviewer) window.reviewer.appearance = "\(appearanceName())";
          localStorage.setItem("reviewer-theme", "system");
          localStorage.setItem("reviewer-theme-light", \(json(themes.light)));
          localStorage.setItem("reviewer-theme-dark", \(json(themes.dark)));
          root.classList.toggle("dark", \(dark));
          root.dataset.theme = \(dark) ? "dark" : "light";
          window.dispatchEvent(new Event("reviewer:themes"));
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

/// The theme chosen for each scheme, by name.
struct ThemeNames: Hashable, Sendable {
    var light: String
    var dark: String
}
