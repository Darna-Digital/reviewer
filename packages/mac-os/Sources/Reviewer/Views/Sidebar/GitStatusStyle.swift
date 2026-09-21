// How a row wears its git status, the way the web app's tree does: the
// letter it is badged with, and the hue — @pierre/trees' own, in either
// palette — that the name, the icon and the badge take on.
import AppKit
import SwiftUI

extension GitFileStatus {
    var badge: String? {
        switch self {
        case .added: return "A"
        case .deleted: return "D"
        case .modified: return "M"
        case .renamed: return "R"
        case .untracked: return "U"
        case .ignored: return nil
        }
    }

    var title: String {
        switch self {
        case .added: return "Added"
        case .deleted: return "Deleted"
        case .modified: return "Modified"
        case .renamed: return "Renamed"
        case .untracked: return "Untracked"
        case .ignored: return "Ignored"
        }
    }

    func hex(dark: Bool) -> String {
        switch self {
        case .added, .untracked: return dark ? "#00cab1" : "#16a994"
        case .deleted: return dark ? "#ff6762" : "#ff2e3f"
        case .modified: return dark ? "#08c0ef" : "#1ca1c7"
        case .renamed: return dark ? "#ffd452" : "#d5a910"
        case .ignored: return dark ? "#4a4a4e" : "#adadb1"
        }
    }

    func color(dark: Bool) -> Color {
        Color(hex: hex(dark: dark))
    }

    func nsColor(dark: Bool) -> NSColor {
        NSColor(hex: hex(dark: dark))
    }
}

extension NSColor {
    /// `#rrggbb`, the way the palettes are written — or `#rrggbbaa`, the way
    /// a theme's chrome writes a wash of one colour over another.
    convenience init(hex: String) {
        let digits = String(hex.dropFirst())
        var value: UInt64 = 0
        Scanner(string: digits).scanHexInt64(&value)
        let alpha: CGFloat = digits.count == 8 ? CGFloat(value & 0xff) / 255 : 1
        if digits.count == 8 { value >>= 8 }
        self.init(
            srgbRed: CGFloat((value >> 16) & 0xff) / 255,
            green: CGFloat((value >> 8) & 0xff) / 255,
            blue: CGFloat(value & 0xff) / 255,
            alpha: alpha)
    }
}

extension Color {
    /// `#rrggbb`, the way the palettes are written.
    init(hex: String) {
        var value: UInt64 = 0
        Scanner(string: String(hex.dropFirst())).scanHexInt64(&value)
        self.init(
            .sRGB,
            red: Double((value >> 16) & 0xff) / 255,
            green: Double((value >> 8) & 0xff) / 255,
            blue: Double(value & 0xff) / 255)
    }
}
