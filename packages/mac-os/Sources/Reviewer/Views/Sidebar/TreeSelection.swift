// The fill a tree's picked row wears, in the sidebar's outline and in a
// commit's file list alike: the web tree's quiet neutral wash — black in
// light, white in dark — rather than the accent blue, which swallowed the
// blue file icons.
import AppKit
import SwiftUI

enum TreeSelection {
    static let fill = NSColor(name: nil) { appearance in
        appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
            ? NSColor.white.withAlphaComponent(0.2)
            : NSColor.black.withAlphaComponent(0.1)
    }

    static let color = Color(nsColor: fill)
}
