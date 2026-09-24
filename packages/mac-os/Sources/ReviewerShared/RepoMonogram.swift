// A repository's avatar, as the branches pane, the opener and the widget
// draw it: two letters on a tile whose colour is the name's own, so the
// same repository wears the same tile wherever it is listed.
import Foundation

public enum RepoMonogram {
    /// `#rrggbb`, the tile colours, picked by the name's hash.
    public static let palette = [
        "#4c79ff", "#16a34a", "#d4861a", "#9333ea", "#dc2626", "#0891b2", "#db2777", "#65a30d",
    ]

    public static func initials(of name: String) -> String {
        let words = name.split { " -_./".contains($0) }.filter { !$0.isEmpty }
        if words.isEmpty { return String(name.prefix(2)).uppercased() }
        if words.count == 1 { return String(words[0].prefix(2)).uppercased() }
        return String([words[0].first, words[1].first].compactMap { $0 }).uppercased()
    }

    public static func hue(of name: String) -> String {
        var hash: Int32 = 0
        for scalar in name.utf16 {
            hash = hash &* 31 &+ Int32(scalar)
        }
        return palette[Int(hash.magnitude) % palette.count]
    }
}
