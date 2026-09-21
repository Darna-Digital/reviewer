// The window's palette: the colours the frame, the islands, the panes and
// the type on them are painted in, as the chosen theme colours them.
//
// The window is native and the code inside it is the web app's, and both
// have to be the same paper — so neither derives the palette itself. The
// server reads the theme (see `deriveChromeTokens` in core) and answers
// with a handful of tokens; the shell keeps one set per scheme here, paints
// its own views from them, and hands the same set to each island as CSS
// custom properties (see `NativePalette`). Two sets rather than one — the
// light theme's and the dark theme's — so a window following the system
// from day to night flips between them without a round trip to the server,
// and so the dynamic `NSColor`s below can answer for whichever appearance
// is drawing.
//
// The app's own pair — Reviewer Light and Reviewer Dark, the defaults — is
// not a set of tokens at all but the absence of one: on them the window
// is painted as it always was, in its two tones and the system's own
// label, separator, accent and selection colours, and the islands are
// handed those. A theme is a departure from that, never a re-derivation
// of it.
import AppKit
import Observation
import SwiftUI

@MainActor
@Observable
final class ChromePalette {
    static let shared = ChromePalette()

    /// Posted after any change, for the islands — which are not SwiftUI
    /// views and cannot observe the store — to rewrite their properties.
    static let didChange = Notification.Name("ChromePaletteDidChange")

    /// The theme chosen for each scheme, by name, as the islands are told it.
    private(set) var names = ThemeNames(light: AppSettings.defaultLightTheme, dark: AppSettings.defaultDarkTheme)
    /// A theme's palette for each scheme; nil while the scheme is on the
    /// app's own.
    private(set) var light: ChromeTokens?
    private(set) var dark: ChromeTokens?

    func tokens(for scheme: ThemeDescriptor.ColorScheme) -> ChromeTokens? {
        scheme == .dark ? dark : light
    }

    /// Whether a theme, rather than the app's own palette, paints the scheme.
    func isThemed(_ scheme: ThemeDescriptor.ColorScheme) -> Bool {
        tokens(for: scheme) != nil
    }

    /// The name chosen for a scheme, ahead of its palette: an island told
    /// the name highlights its code in the theme at once, while the window
    /// around it waits on the server for the colours.
    func choose(_ name: String, for scheme: ThemeDescriptor.ColorScheme) {
        switch scheme {
        case .light: names.light = name
        case .dark: names.dark = name
        }
        NotificationCenter.default.post(name: Self.didChange, object: self)
    }

    /// The palette as one theme paints it, for its scheme.
    func set(_ tokens: ChromeTokens, named name: String) {
        switch tokens.colorScheme {
        case .light:
            light = tokens
            names.light = name
        case .dark:
            dark = tokens
            names.dark = name
        }
        NotificationCenter.default.post(name: Self.didChange, object: self)
    }

    /// The scheme back on the app's own palette.
    func useOwn(named name: String, for scheme: ThemeDescriptor.ColorScheme) {
        switch scheme {
        case .light:
            light = nil
            names.light = name
        case .dark:
            dark = nil
            names.dark = name
        }
        NotificationCenter.default.post(name: Self.didChange, object: self)
    }
}

/// The two tones the window is made of and the rest of the palette beside
/// them, as dynamic colours: each answers for the appearance drawing it, so
/// one colour serves a view whichever way the window is held — the theme's
/// value where a theme is on, and the app's own otherwise. Read through
/// the palette store on every access, so a SwiftUI body that paints with one
/// is redrawn when the theme changes.
@MainActor
enum IslandPalette {
    /// The frame every island stands on — black in the app's own dark
    /// theme, where the system's window grey read as a lighter band around
    /// darker panels.
    static var frame: NSColor {
        dynamic(\.frame, own: NSColor(name: nil) { appearance in
            appearance.isDark ? NSColor(srgbRed: 0, green: 0, blue: 0, alpha: 1) : NSColor(srgbRed: 0.941, green: 0.941, blue: 0.953, alpha: 1)
        })
    }

    /// The sheet each island is.
    static var island: NSColor {
        dynamic(\.island, own: NSColor(name: nil) { appearance in
            appearance.isDark ? NSColor(srgbRed: 0.078, green: 0.078, blue: 0.09, alpha: 1) : .white
        })
    }

    /// One step off the sheet — a card, a field, a chip.
    static var control: NSColor { dynamic(\.control, own: .controlBackgroundColor) }
    /// What stands above the page. In the app's own dark theme the system's
    /// under-page colour is the step above the control background; in the
    /// light theme it is a translucent mid grey that painted every menu as
    /// smoked glass over the code, so the popover stays on the control white.
    static var popover: NSColor {
        dynamic(\.popover, own: NSColor(name: nil) { appearance in
            appearance.isDark ? .underPageBackgroundColor : .controlBackgroundColor
        })
    }
    static var text: NSColor { dynamic(\.text, own: .labelColor) }
    static var textSecondary: NSColor { dynamic(\.textSecondary, own: .secondaryLabelColor) }
    static var textTertiary: NSColor { dynamic(\.textTertiary, own: .tertiaryLabelColor) }
    static var separator: NSColor { dynamic(\.separator, own: .separatorColor) }
    static var hairline: NSColor { dynamic(\.hairline, own: .separatorColor) }
    static var accent: NSColor { dynamic(\.accent, own: .controlAccentColor) }
    static var link: NSColor { dynamic(\.link, own: .linkColor) }
    static var selection: NSColor { dynamic(\.selection, own: .selectedContentBackgroundColor) }
    static var hover: NSColor { dynamic(\.hover, own: .unemphasizedSelectedContentBackgroundColor) }

    /// The store is read here, eagerly, as well as in the provider: the
    /// provider runs when AppKit draws, outside any SwiftUI body, where a
    /// read goes untracked and a theme change unseen — so a SwiftUI view is
    /// redrawn by the read here, and an AppKit view that keeps the colour
    /// and draws it again later gets the theme of that later moment from
    /// the provider.
    private static func dynamic(_ token: KeyPath<ChromeTokens, String>, own: NSColor) -> NSColor {
        let palette = ChromePalette.shared
        _ = palette.light
        _ = palette.dark
        return NSColor(name: nil) { appearance in
            MainActor.assumeIsolated {
                guard let tokens = palette.tokens(for: appearance.isDark ? .dark : .light) else { return own }
                return NSColor(hex: tokens[keyPath: token])
            }
        }
    }
}

extension NSAppearance {
    var isDark: Bool {
        bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
    }
}

/// The theme's type and tint over a view — every `.primary` in it the
/// theme's text, every `.secondary` and `.tertiary` the theme's own muted
/// steps of it (named outright rather than left to the system, which
/// derives them by thinning the primary and lands a tinted text too faint
/// to read), and every control's tint the theme's accent — the same
/// colours the islands' pages are set in, so a native list beside a web
/// diff reads as one material. On the app's own palette the view is left
/// exactly as the system draws it. Worn by a column's content and never by
/// the window's bar: the toolbar's glass items are the system's, and take
/// on a hover of their own once given an ink that is not.
struct ThemeInk: ViewModifier {
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        if ChromePalette.shared.isThemed(colorScheme == .dark ? .dark : .light) {
            content
                .foregroundStyle(
                    Color(nsColor: IslandPalette.text),
                    Color(nsColor: IslandPalette.textSecondary),
                    Color(nsColor: IslandPalette.textTertiary)
                )
                .tint(Color(nsColor: IslandPalette.accent))
        } else {
            content
        }
    }
}

extension View {
    func themeInk() -> some View { modifier(ThemeInk()) }
}
