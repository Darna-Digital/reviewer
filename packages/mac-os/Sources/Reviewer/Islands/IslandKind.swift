// The parts of the web app the shell hosts, each in a web view of its own
// set in the window's native layout. The names are the contract with the
// SPA (`lib/shell` there): the bridge hands the document its island and the
// app's `_app` layout renders just that part.
import Foundation

enum IslandKind: String, Sendable {
    case code
}
