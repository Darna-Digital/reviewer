// The settings window's model — what ⌘, shows: the appearance the window
// is drawn in and the theme it is drawn with, and who the app works as, in
// git and on GitHub.
//
// The appearance is the app's own preference rather than the SPA's, since
// the window around the islands is native and the system asks the app, not
// the page, which appearance to draw it in. Setting `NSApp.appearance`
// covers everything at once: the toolbar, the sidebar, the sheets, and the
// web views inside, whose `prefers-color-scheme` follows the view they are
// in — `NativePalette` then tells each island to follow that, rather than
// a theme of its own kept in the island's storage.
//
// The theme is the app's own for the same reason, chosen once per scheme —
// a theme is written for a light or a dark editor, and "system" walks
// between the two as the day does. The names are kept here; what they
// paint is asked of the server, which reads the theme and answers with the
// window's palette (see `ChromePalette`), and the catalog to choose from is
// the server's too. Until it answers, the window paints in the app's own
// pair, which is what the names default to.
//
// The identities are read, not written: git's are set with `git config`
// and GitHub's token is found in the environment or the `gh` CLI (see the
// server's `GitHubClient`), so the window says what is in use and what to
// run to change it, and re-reads on request. The one thing it can do is
// sign in to GitHub — the server runs the CLI's device flow (see its
// `GitHubLogin`), and the window shows the one-time code, puts it on the
// pasteboard, opens the page it goes on, and watches for the CLI to come
// back with the token.
import AppKit
import Foundation
import Observation

/// How the window is drawn: with the system, or held to one appearance.
enum ThemePreference: String, CaseIterable, Identifiable, Sendable {
    case system
    case light
    case dark

    var id: Self { self }

    var title: String {
        switch self {
        case .system: "System"
        case .light: "Light"
        case .dark: "Dark"
        }
    }

    var symbol: String {
        switch self {
        case .system: "circle.lefthalf.filled"
        case .light: "sun.max"
        case .dark: "moon"
        }
    }

    /// The appearance to hold the app to; nil lets the system decide.
    var appearance: NSAppearance? {
        switch self {
        case .system: nil
        case .light: NSAppearance(named: .aqua)
        case .dark: NSAppearance(named: .darkAqua)
        }
    }
}

/// One identity read from the server: still on its way, answered, or
/// refused — with the reason, so the row can say why it has nothing.
enum SettingsRead<Value: Sendable>: Sendable {
    case loading
    case loaded(Value)
    case failed(String)

    var value: Value? {
        if case .loaded(let value) = self { return value }
        return nil
    }
}

/// A GitHub sign-in as the window shows it.
enum GitHubSignIn: Equatable {
    case idle
    /// The CLI has been asked for a code and has not printed it yet.
    case starting
    /// The code is out; the CLI is polling GitHub for it to be entered.
    case waiting(code: String, url: URL)
    case failed(String)

    var isUnderWay: Bool {
        switch self {
        case .starting, .waiting: true
        case .idle, .failed: false
        }
    }
}

@MainActor
@Observable
final class AppSettings {
    static let defaultLightTheme = "reviewer-light"
    static let defaultDarkTheme = "reviewer-dark"

    var theme: ThemePreference {
        didSet {
            defaults.set(theme.rawValue, forKey: Keys.theme)
            apply()
        }
    }

    /// The theme for each scheme, by catalog name.
    var lightTheme: String {
        didSet {
            defaults.set(lightTheme, forKey: Keys.lightTheme)
            ChromePalette.shared.choose(lightTheme, for: .light)
            paint(lightTheme, for: .light)
        }
    }

    var darkTheme: String {
        didSet {
            defaults.set(darkTheme, forKey: Keys.darkTheme)
            ChromePalette.shared.choose(darkTheme, for: .dark)
            paint(darkTheme, for: .dark)
        }
    }

    /// The catalog, once the server has been asked for it.
    private(set) var themes: SettingsRead<[ThemeDescriptor]> = .loading

    private(set) var identity: SettingsRead<GitIdentity> = .loading
    private(set) var githubAuth: SettingsRead<GitHubAuth> = .loading
    private(set) var signIn: GitHubSignIn = .idle

    @ObservationIgnored private let client: ReviewerClient
    @ObservationIgnored private let defaults = UserDefaults.standard
    /// The watch over a sign-in under way, so a cancel can call it off.
    @ObservationIgnored private var signInWatch: Task<Void, Never>?

    /// How often the CLI is asked whether the code has been entered.
    private static let signInPoll: Duration = .seconds(2)

    private enum Keys {
        static let theme = "appearance.theme"
        static let lightTheme = "appearance.lightTheme"
        static let darkTheme = "appearance.darkTheme"
    }

    init(client: ReviewerClient) {
        self.client = client
        theme = defaults.string(forKey: Keys.theme).flatMap(ThemePreference.init(rawValue:)) ?? .system
        lightTheme = defaults.string(forKey: Keys.lightTheme) ?? Self.defaultLightTheme
        darkTheme = defaults.string(forKey: Keys.darkTheme) ?? Self.defaultDarkTheme
        ChromePalette.shared.choose(lightTheme, for: .light)
        ChromePalette.shared.choose(darkTheme, for: .dark)
        apply()
    }

    /// The app held to the chosen appearance — `NSApp` rather than each
    /// window, so windows opened later, the settings included, come up in
    /// it too.
    private func apply() {
        NSApplication.shared.appearance = theme.appearance
    }

    // MARK: the theme

    /// The window painted in the chosen themes — once the server is up, and
    /// again whenever it has been restarted with a different catalog.
    func paintThemes() {
        paint(lightTheme, for: .light)
        paint(darkTheme, for: .dark)
    }

    /// The catalog read for the picker, if it has not been already.
    func loadThemes() async {
        if case .loaded = themes { return }
        themes = await read { try await client.themes() }
    }

    /// One scheme's palette asked of the server and, if the name is still
    /// the chosen one when it answers, painted. The app's own pair asks
    /// nothing: on it the window is drawn as it always was (see
    /// `ChromePalette`). A name the server does not know — a theme this
    /// build no longer ships — is put back to the scheme's default rather
    /// than left on a palette it cannot fetch.
    private func paint(_ name: String, for scheme: ThemeDescriptor.ColorScheme) {
        if name == Self.defaultLightTheme || name == Self.defaultDarkTheme {
            ChromePalette.shared.useOwn(named: name, for: scheme)
            return
        }
        Task { [weak self] in
            guard let self else { return }
            do {
                let resolved = try await client.themeChrome(name: name)
                guard chosenTheme(for: scheme) == name, resolved.chrome.colorScheme == scheme else { return }
                ChromePalette.shared.set(resolved.chrome, named: name)
            } catch let error as ReviewerAPIError where error.status == 404 {
                switch scheme {
                case .light: if lightTheme == name { lightTheme = Self.defaultLightTheme }
                case .dark: if darkTheme == name { darkTheme = Self.defaultDarkTheme }
                }
            } catch {
                // The server is not up yet; `paintThemes` asks again once it is.
            }
        }
    }

    private func chosenTheme(for scheme: ThemeDescriptor.ColorScheme) -> String {
        scheme == .dark ? darkTheme : lightTheme
    }

    /// Both identities, read afresh — on the window opening, on Check
    /// Again, and when the project changes, since git's is the project's.
    func reload() async {
        async let identity = read { try await client.gitIdentity() }
        async let auth = read { try await client.githubAuth() }
        self.identity = await identity
        self.githubAuth = await auth
    }

    private func read<Value: Sendable>(_ fetch: () async throws -> Value) async -> SettingsRead<Value> {
        do {
            return .loaded(try await fetch())
        } catch {
            return .failed(error.localizedDescription)
        }
    }

    // MARK: signing in to GitHub

    /// Ask the server for a code; with one in hand, put it on the pasteboard
    /// and open the page it goes on, so the person has only to paste — then
    /// watch for the CLI to finish.
    func signInToGitHub() {
        guard !signIn.isUnderWay else { return }
        signIn = .starting
        signInWatch?.cancel()
        signInWatch = Task { [weak self] in
            guard let self else { return }
            do {
                let state = try await client.startGitHubLogin()
                guard let code = state.code, let url = state.url.flatMap(URL.init(string:)) else {
                    signIn = .failed(state.reason ?? "The GitHub CLI came back without a code.")
                    return
                }
                signIn = .waiting(code: code, url: url)
                copyToPasteboard(code)
                NSWorkspace.shared.open(url)
                await watchSignIn()
            } catch is CancellationError {
            } catch {
                signIn = .failed(error.localizedDescription)
            }
        }
    }

    /// The code again, for a page that lost it — the pasteboard has been
    /// used for something else since, the tab was closed.
    func copySignInCode() {
        if case .waiting(let code, _) = signIn { copyToPasteboard(code) }
    }

    func openSignInPage() {
        if case .waiting(_, let url) = signIn { NSWorkspace.shared.open(url) }
    }

    func cancelSignIn() {
        signInWatch?.cancel()
        signInWatch = nil
        signIn = .idle
        Task { try? await client.cancelGitHubLogin() }
    }

    /// Back to the offer, after a failure has been read.
    func dismissSignInFailure() {
        if case .failed = signIn { signIn = .idle }
    }

    private func watchSignIn() async {
        while !Task.isCancelled {
            try? await Task.sleep(for: Self.signInPoll)
            guard !Task.isCancelled, let state = try? await client.githubLoginStatus() else { continue }
            switch state.phase {
            case .waiting:
                continue
            case .done, .idle:
                signIn = .idle
                await reload()
                return
            case .failed:
                signIn = .failed(state.reason ?? "The sign-in stopped without saying why.")
                return
            }
        }
    }

    private func copyToPasteboard(_ text: String) {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(text, forType: .string)
    }
}
