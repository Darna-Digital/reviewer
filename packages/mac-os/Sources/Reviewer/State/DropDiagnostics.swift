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
}
