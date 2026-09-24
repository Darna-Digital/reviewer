// The URLs a widget acts through: `reviewer://open?path=…`, and the same
// with `run=1` for the opener's Open and run. The app's Info.plist
// registers the scheme; Launch Services brings the app up — or forward —
// and hands it the URL, which the app answers as the opener's own buttons
// do (see `ProjectLinks`). Without a path it only brings the app up,
// which is what an empty widget offers.
//
// A widget can do nothing else: it draws into an archive the system
// renders, so a click on one of its links is the whole of its reach —
// there is no menu to raise and no hover to answer.
import Foundation

public enum ProjectLink {
    public static let scheme = "reviewer"
    private static let openHost = "open"
    private static let runFlag = "run"

    public static let launch = URL(string: "\(scheme)://\(openHost)")!

    public static func open(_ path: String, run: Bool = false) -> URL {
        var components = URLComponents()
        components.scheme = scheme
        components.host = openHost
        components.queryItems = [URLQueryItem(name: "path", value: path)]
        if run { components.queryItems?.append(URLQueryItem(name: runFlag, value: "1")) }
        return components.url ?? launch
    }

    /// What an open link asks for: the project, and whether its dev
    /// commands are to be started with it.
    public struct Request: Equatable, Sendable {
        public let path: String?
        public let run: Bool
    }

    /// The request `url` carries, or nil where it is not one of ours —
    /// anything else Launch Services hands the app is not a project.
    public static func request(in url: URL) -> Request? {
        guard url.scheme == scheme, url.host == openHost else { return nil }
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        return Request(
            path: items.first { $0.name == "path" }?.value,
            run: items.first { $0.name == runFlag }?.value == "1")
    }
}
