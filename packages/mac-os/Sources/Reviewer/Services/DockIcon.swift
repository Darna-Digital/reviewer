// The dock tile, kept in step with the system appearance. macOS 26 renders
// the dark variant of an Icon Composer icon only under the "Dark" icon style
// in Appearance settings, so a Mac in dark mode with the default style keeps
// showing the light tile. The app instead sets its own icon from the two flat
// renderings scripts/bundle.sh compiles (Reviewer.icns, Reviewer-dark.icns)
// and follows NSApp's effective appearance. Run as a bare binary there is no
// bundle and no icon files, and the dock is left alone.
//
// NSApp.applicationIconImage only lasts while the app runs; once it quits the
// dock draws the bundle's icon again. So the dark rendering is also written
// onto the bundle as a custom Finder icon, and cleared in light mode to hand
// the dock back the compiled icon (with its clear and tinted variants). An
// appearance change while the app is closed shows up on its next launch.
import AppKit

enum DockIcon {
    @MainActor
    static func follow(_ appearance: NSAppearance) {
        let isDark = appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
        let resource = isDark ? "Reviewer-dark" : "Reviewer"
        guard let url = Bundle.main.url(forResource: resource, withExtension: "icns"),
              let image = NSImage(contentsOf: url) else { return }
        NSApp.applicationIconImage = image
        persist(isDark ? image : nil)
    }

    /// Writes (or with nil, removes) the bundle's custom icon, which the dock
    /// shows for the app while it isn't running. Fails quietly where the
    /// bundle isn't writable, e.g. launched straight from a mounted DMG.
    @MainActor
    private static func persist(_ image: NSImage?) {
        let bundlePath = Bundle.main.bundlePath
        guard NSWorkspace.shared.setIcon(image, forFile: bundlePath) else { return }
        NSWorkspace.shared.noteFileSystemChanged(bundlePath)
    }
}
