// TEMPORARY: traces every drop destination the chat page has, to find where
// a Finder drag goes. Remove once the drop path is settled.
import AppKit
import os

enum DropDiagnostics {
    static let log = Logger(subsystem: "com.byconvo.reviewer", category: "drop")

    static func note(_ where_: String, _ pasteboard: NSPasteboard? = nil) {
        let types = (pasteboard?.types ?? []).map(\.rawValue).joined(separator: ", ")
        log.notice("\(where_, privacy: .public) types=[\(types, privacy: .public)]")
    }

    /// Every view that could take a drag let go at `point` (in the window's
    /// coordinates), depth-first from the content view, with how deep each
    /// sits and how many types it takes — the one reading that says which
    /// of the app's drop targets outranks the others, rather than which one
    /// we meant to.
    @MainActor
    static func destinations(in window: NSWindow?, at point: NSPoint) {
        guard let content = window?.contentView else { return }
        var found: [String] = []
        func walk(_ view: NSView, depth: Int) {
            if !view.registeredDraggedTypes.isEmpty, view.bounds.contains(view.convert(point, from: nil)) {
                found.append("\(type(of: view))@\(depth)×\(view.registeredDraggedTypes.count)")
            }
            for subview in view.subviews { walk(subview, depth: depth + 1) }
        }
        walk(content, depth: 0)
        log.notice("destinations=[\(found.joined(separator: ", "), privacy: .public)]")
    }
}
