// The dock tile, kept in step with the system appearance. macOS 26 renders
// the dark variant of an Icon Composer icon only under the "Dark" icon style
// in Appearance settings, so a Mac in dark mode with the default style keeps
// showing the light tile. The app instead sets its own icon from the two flat
// renderings scripts/bundle.sh compiles (Reviewer.icns, Reviewer-dark.icns)
// and follows NSApp's effective appearance. Run as a bare binary there is no
// bundle and no icon files, and the dock is left alone.
import AppKit

enum DockIcon {
    @MainActor
    static func follow(_ appearance: NSAppearance) {
        let isDark = appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
        let resource = isDark ? "Reviewer-dark" : "Reviewer"
        guard let url = Bundle.main.url(forResource: resource, withExtension: "icns"),
              let image = NSImage(contentsOf: url) else { return }
        NSApp.applicationIconImage = image
    }
}
