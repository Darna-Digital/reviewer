// Where the islands' documents come from. One build of the SPA serves every
// island; what differs is whether it is a live dev server or files on disk.
//
// Resolution, first match wins:
//   1. REVIEWER_SPA_URL — an http(s) origin for a Vite server on another port
//      or a preview build, or a file:// directory holding a build.
//   2. In a debug build, the Vite dev server on its usual port: HMR inside the
//      native window, which is the everyday loop while the islands are being
//      built. A debug binary is one run from the working tree, where a
//      built copy of the SPA is more likely stale than wanted.
//   3. A build inside the app bundle (Contents/Resources/spa), put there by
//      scripts/bundle.sh when packages/spa has been built.
//   4. That same build in the working tree (packages/spa/dist/client).
//   5. The Vite dev server, for a release binary with no build to show.
//
// Files on disk are served over the `reviewer://app` scheme, the same one the
// Electron shell uses, so the SPA's absolute asset paths and its router both
// behave as they do there.
import Foundation

enum SpaSource {
    case remote(URL)
    case bundled(directory: URL)

    static let scheme = "reviewer"
    static let viteDevURL = URL(string: "http://localhost:41812")!

    var origin: URL {
        switch self {
        case .remote(let url): return url
        case .bundled: return URL(string: "\(Self.scheme)://app")!
        }
    }

    func url(for href: String) -> URL {
        URL(string: href, relativeTo: origin)?.absoluteURL ?? origin
    }

    static func resolve() -> SpaSource {
        if let explicit = ProcessInfo.processInfo.environment["REVIEWER_SPA_URL"], let url = URL(string: explicit) {
            return url.isFileURL ? .bundled(directory: url) : .remote(url)
        }
        #if DEBUG
            return .remote(viteDevURL)
        #else
            if let bundled = Bundle.main.resourceURL?.appending(path: "spa"), isBuild(bundled) {
                return .bundled(directory: bundled)
            }
            if let built = ServerLauncher.repositoryRoot()?.appending(path: "packages/spa/dist/client"), isBuild(built) {
                return .bundled(directory: built)
            }
            return .remote(viteDevURL)
        #endif
    }

    private static func isBuild(_ directory: URL) -> Bool {
        FileManager.default.fileExists(atPath: directory.appending(path: "_shell.html").path)
    }
}
