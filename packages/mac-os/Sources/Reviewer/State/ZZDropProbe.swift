import AppKit
import os

enum ZZDropProbe {
    static let log = Logger(subsystem: "com.byconvo.reviewer", category: "drop")

    @MainActor
    static func dump() {
        guard let window = NSApp.windows.first(where: { $0.frame.width > 1200 }),
            let frame = window.contentView?.superview
        else { return }
        let sel = NSSelectorFromString("_hitTest:dragTypes:")
        typealias F = @convention(c) (AnyObject, Selector, UnsafeMutablePointer<NSPoint>, NSSet) -> NSView?
        guard frame.responds(to: sel) else { log.notice("PROBE no selector"); return }
        let f = unsafeBitCast(frame.method(for: sel), to: F.self)
        let types = NSSet(array: [NSPasteboard.PasteboardType.fileURL, .png, .tiff, NSPasteboard.PasteboardType("NSFilenamesPboardType")])
        for point in [NSPoint(x: 1003, y: 233), NSPoint(x: 900, y: 450), NSPoint(x: 700, y: 600)] {
            var p = point
            let hit = f(frame, sel, &p, types)
            var chain: [String] = []
            var v = hit
            while let c = v { chain.append("\(type(of: c))[\(c.registeredDraggedTypes.count)]\(c.isHidden ? "H" : "")"); v = c.superview }
            log.notice("PROBE \(point.debugDescription, privacy: .public) dragHit=\(chain.joined(separator: " < "), privacy: .public)")
        }
    }
}
