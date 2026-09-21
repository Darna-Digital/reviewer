// The face code is set in — the diff above all, which is pierre's inside
// the code island, and reads its font from one CSS custom property
// (`--diffs-font-family`, see https://diffs.com/docs) that inherits through
// its shadow root. The shell writes the choice to each island's document as
// `--font-code`, the token the SPA's diff, comment code and mono utilities
// all read (see `NativePalette.applyScript` and the SPA's `styles.css`).
//
// The faces are the ones the SPA bundles as web fonts, so a choice here is
// a choice of family name and nothing more: the files ship with the client
// and a browser fetches a face on first use, so the ones not chosen cost
// nothing. `SF Mono` is the exception — the system's own, on every Mac,
// and not bundled. The catalog is kept here rather than asked of the server
// because a font, unlike a theme, is not a thing the server reads or
// derives anything from.
import Foundation

enum CodeFont: String, CaseIterable, Identifiable, Sendable {
    case jetbrainsMono = "jetbrains-mono"
    case firaCode = "fira-code"
    case cascadiaCode = "cascadia-code"
    case geistMono = "geist-mono"
    case ibmPlexMono = "ibm-plex-mono"
    case sourceCodePro = "source-code-pro"
    case robotoMono = "roboto-mono"
    case sfMono = "sf-mono"

    static let `default`: CodeFont = .jetbrainsMono

    var id: Self { self }

    var title: String {
        switch self {
        case .jetbrainsMono: "JetBrains Mono"
        case .firaCode: "Fira Code"
        case .cascadiaCode: "Cascadia Code"
        case .geistMono: "Geist Mono"
        case .ibmPlexMono: "IBM Plex Mono"
        case .sourceCodePro: "Source Code Pro"
        case .robotoMono: "Roboto Mono"
        case .sfMono: "SF Mono"
        }
    }

    /// The family as `@font-face` declares it in the SPA — fontsource names
    /// a variable font "… Variable" — or, for the system's face, its
    /// `ui-monospace` alias with the name behind it for a browser without
    /// one.
    private var family: String {
        switch self {
        case .jetbrainsMono: "\"JetBrains Mono Variable\""
        case .firaCode: "\"Fira Code Variable\""
        case .cascadiaCode: "\"Cascadia Code Variable\""
        case .geistMono: "\"Geist Mono Variable\""
        case .ibmPlexMono: "\"IBM Plex Mono\""
        case .sourceCodePro: "\"Source Code Pro Variable\""
        case .robotoMono: "\"Roboto Mono Variable\""
        case .sfMono: "ui-monospace, \"SF Mono\""
        }
    }

    /// The platform's mono behind the chosen family, for any glyph the web
    /// font lacks — the same stack the SPA's default ends in.
    private static let fallback = "ui-monospace, SFMono-Regular, \"SF Mono\", Menlo, Consolas, \"Liberation Mono\", monospace"

    /// The `font-family` value, family first and the fallback behind it.
    var cssFamily: String {
        "\(family), \(Self.fallback)"
    }
}
