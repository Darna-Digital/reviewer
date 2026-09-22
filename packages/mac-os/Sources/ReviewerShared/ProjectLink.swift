// The URL a widget opens a project through: `reviewer://open?path=…`, the
// scheme the app's Info.plist registers. Launch Services brings the app
// up — or forward — and hands it the URL; the app opens the path as its
// project (see `ProjectLinks`). Without a path it only brings the app up,
// which is what an empty widget offers.
import Foundation

public enum ProjectLink {
    public static let scheme = "reviewer"
    private static let openHost = "open"

    public static let launch = URL(string: "\(scheme)://\(openHost)")!

    public static func open(_ path: String) -> URL {
        var components = URLComponents()
        components.scheme = scheme
        components.host = openHost
        components.queryItems = [URLQueryItem(name: "path", value: path)]
        return components.url ?? launch
    }

    /// Whether `url` is one of ours at all — anything else Launch Services
    /// hands the app is not a project to open.
    public static func isOpen(_ url: URL) -> Bool {
        url.scheme == scheme && url.host == openHost
    }

    /// The path an open link names, or nil for a bare launch.
    public static func path(in url: URL) -> String? {
        guard isOpen(url) else { return nil }
        return URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?
            .first { $0.name == "path" }?
            .value
    }
}
