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
//
// The face the code is set in rides along here too: not a colour, but the
// one other thing the islands are told about how the window is drawn, and
// told the same way, by the same script, on the same notification.
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
    /// The face code is set in, as the islands are told it.
    private(set) var codeFont: CodeFont = .default

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

    func choose(_ font: CodeFont) {
        codeFont = font
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

    /// The wash a picked row wears in a list the system would otherwise
    /// paint in its selection blue (see `ThemedRows`). The theme's accent
    /// over its sheet, at the share the web's own picked row is washed in
    /// — the theme's colour rather than the theme's `selection`, which a
    /// theme is free to name a plain grey and many do, and the pick would
    /// read as no colour at all. Thin enough that the type over it is
    /// still the theme's, and never has to be turned white. On the app's
    /// own palette it is the system's selection, as it has always been.
    static var pick: NSColor {
        let palette = ChromePalette.shared
        _ = palette.light
        _ = palette.dark
        return NSColor(name: nil) { appearance in
            MainActor.assumeIsolated {
                guard let tokens = palette.tokens(for: appearance.isDark ? .dark : .light) else {
                    return .selectedContentBackgroundColor
                }
                let accent = NSColor(hex: tokens.accent)
                let sheet = NSColor(hex: tokens.island)
                return sheet.blended(withFraction: pickShare, of: accent) ?? accent
            }
        }
    }

    /// How much of the pick's wash is the accent — the share the web app
    /// mixes its own picked row at (see `deriveChromeTokens`), so the two
    /// pick a row the same colour.
    private static let pickShare: CGFloat = 0.28
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

/// The system's own type and tint back over a view that stands on the
/// system's material rather than on a theme's sheet — a sheet, which is
/// presented from the column and inherits its ink, and drawn on the
/// system's white whatever theme is on. There the theme's tertiary, inked
/// to read as type, drew a grouped form's rules as solid lines, and its
/// tint washed every plain button. The system's label alone is set, and
/// the lower levels left to the system to thin from it as it does by
/// default — named outright, the rules a form draws in the faintest of
/// them came out as dark as its type.
struct SystemInk: ViewModifier {
    func body(content: Content) -> some View {
        content
            .foregroundStyle(Color(nsColor: .labelColor))
            .tint(nil)
    }
}

extension View {
    func systemInk() -> some View { modifier(SystemInk()) }
}

/// The system's own label over a view whose rows the system picks out
/// itself — a `Table` or a selecting `List`, which wash the chosen row in
/// the selection blue and turn the label colours they know white against
/// it. A theme's ink is named outright, so on that blue the type stayed
/// the theme's own dark grey and all but vanished; the system's label and
/// secondary label, named back, turn with the wash. Only the type is the
/// system's: the sheet the rows stand on, their rules and their dots are
/// still the theme's.
///
/// Worn only where the system's blue is what the row is washed in — that
/// is, on the app's own palette. Where a theme paints the scheme the row
/// is washed in the theme's own selection tone instead, quietly enough to
/// be read over (see `ThemedRows`), and there nothing is handed back: the
/// theme's ink reads on that wash as it does anywhere else on the sheet,
/// and the system's label over a theme's sheet would be the one colour on
/// the pane that is not the theme's.
struct SelectionInk: ViewModifier {
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        if ChromePalette.shared.isThemed(colorScheme == .dark ? .dark : .light) {
            content
        } else {
            content.foregroundStyle(Color.primary, Color.secondary)
        }
    }
}

extension View {
    func selectionInk() -> some View { modifier(SelectionInk()) }
}

/// The system's quaternary label at a share of its strength — the faint
/// wash a bar's field, a chip, a code span is filled with. Under `ThemeInk`
/// SwiftUI derives the quaternary from the tertiary it names, and a theme's
/// tertiary is type, inked to read as type: a fill in it came out a solid
/// grey. So where a theme paints the scheme the wash is the theme's text at
/// the tenth the system's quaternary is of its label; on the app's own
/// palette it is left exactly the system's.
struct QuaternaryWash: ShapeStyle {
    var share: Double = 1

    private static let systemQuaternaryAlpha = 0.1

    func resolve(in environment: EnvironmentValues) -> some ShapeStyle {
        let scheme: ThemeDescriptor.ColorScheme = environment.colorScheme == .dark ? .dark : .light
        let ink: NSColor? = MainActor.assumeIsolated {
            ChromePalette.shared.isThemed(scheme) ? IslandPalette.text : nil
        }
        if let ink {
            return AnyShapeStyle(Color(nsColor: ink).opacity(Self.systemQuaternaryAlpha * share))
        }
        return AnyShapeStyle(HierarchicalShapeStyle.quaternary.opacity(share))
    }
}

extension ShapeStyle where Self == QuaternaryWash {
    static func quaternaryWash(_ share: Double = 1) -> QuaternaryWash { QuaternaryWash(share: share) }
}

/// A rule in the theme's hairline. SwiftUI draws a `Divider` in the
/// tertiary level of the foreground style it stands in, which `ThemeInk`
/// names outright — and a theme's tertiary is still type, inked to read as
/// type, far too loud for a rule between two things on one sheet. So under
/// a theme the divider's own line is hidden and the hairline the SPA's
/// inner rules are drawn in is laid in its place — hidden rather than
/// washed over, since the hairline is nearly clear and the system's line
/// showed straight through it; on the app's own palette it is left exactly
/// the system's. Keeps `Divider`'s own axis — across a VStack, down an
/// HStack — so it stands in wherever one did. Not for a menu's rows: those are the
/// system's, and take no overlay.
struct ThemedDivider: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        if ChromePalette.shared.isThemed(colorScheme == .dark ? .dark : .light) {
            Divider().hidden().overlay(Color(nsColor: IslandPalette.hairline))
        } else {
            Divider()
        }
    }
}
