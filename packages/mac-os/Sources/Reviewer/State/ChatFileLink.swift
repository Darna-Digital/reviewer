// A link in a reply that names a file — `[foo.ts](src/utils/foo.ts)`,
// `[Bar.tsx:42](app/components/Bar.tsx:42)`, an absolute path, a
// `file://` address — read as the file it points at, so a click opens it
// on the browse page rather than asking the system for a `src/utils/foo.ts`
// scheme it has never heard of. The agent writes paths from where it
// works — the session's repository — while the page opens files by their
// path from the project, so in a multi-root project the repository's own
// folder goes in front. A web or mail address is left for the system.
import Foundation

struct ChatFileLink: Equatable {
    let path: String
    let line: Int?

    /// The schemes a reply's link leads out of the app with.
    private static let externalSchemes: Set<String> = ["http", "https", "mailto"]

    /// Whether `url` leads out of the app — a web or mail address, or any
    /// other scheme's — rather than naming a file.
    static func leadsOut(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased(), scheme != "file" else { return false }
        return externalSchemes.contains(scheme) || url.absoluteString.hasPrefix("\(scheme)://")
    }

    /// The file `url` names, from `origin`'s project — or nil for an address
    /// the app cannot show: one that leads out, or a path outside the project.
    static func parse(_ url: URL, origin: ChatOrigin) -> ChatFileLink? {
        if leadsOut(url) { return nil }
        if url.scheme?.lowercased() == "file" { return parse(text: url.path, origin: origin) }
        // A relative address with no scheme reads back as the text the link
        // was written with; `foo.ts:42` alone comes through with `foo.ts` as
        // its scheme, which the same text reading undoes.
        return parse(text: url.absoluteString.removingPercentEncoding ?? url.absoluteString, origin: origin)
    }

    /// `text` as a path and the line it names, in the shapes agents write
    /// them: `path:LINE`, `path:LINE:COLUMN` and `path#LLINE`.
    static func parse(text: String, origin: ChatOrigin) -> ChatFileLink? {
        guard let match = text.wholeMatch(of: /(.+?)(?::(\d+)(?::\d+)?|#L(\d+))?/) else { return nil }
        let line = (match.2 ?? match.3).flatMap { Int($0) }
        var path = String(match.1)
        if path.hasPrefix("./") { path.removeFirst(2) }
        guard let projectPath = relativeToProject(path, origin: origin), !projectPath.isEmpty else { return nil }
        return ChatFileLink(path: projectPath, line: line)
    }

    /// `path` from the project's root: an absolute path stripped of it, a
    /// relative one put under the repository's folder inside the project.
    private static func relativeToProject(_ path: String, origin: ChatOrigin) -> String? {
        if path.hasPrefix("/") {
            return strip(prefix: origin.projectPath, from: path)
        }
        guard let repoFolder = strip(prefix: origin.projectPath, from: origin.repoPath) else { return path }
        return repoFolder.isEmpty ? path : "\(repoFolder)/\(path)"
    }

    private static func strip(prefix root: String, from path: String) -> String? {
        let root = root.hasSuffix("/") ? String(root.dropLast()) : root
        if path == root { return "" }
        guard path.hasPrefix("\(root)/") else { return nil }
        return String(path.dropFirst(root.count + 1))
    }
}
