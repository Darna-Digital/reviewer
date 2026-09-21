// The settings window's model — what ⌘, shows: the theme the window is
// drawn in, and who the app works as, in git and on GitHub.
//
// The theme is the app's own preference rather than the SPA's, since the
// window around the islands is native and the system asks the app, not
// the page, which appearance to draw it in. Setting `NSApp.appearance`
// covers everything at once: the toolbar, the sidebar, the sheets, and the
// web views inside, whose `prefers-color-scheme` follows the view they are
// in — `NativePalette` then tells each island to follow that, rather than
// a theme of its own kept in the island's storage.
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
    var theme: ThemePreference {
        didSet {
            defaults.set(theme.rawValue, forKey: Keys.theme)
            apply()
        }
    }

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
    }

    init(client: ReviewerClient) {
        self.client = client
        theme = defaults.string(forKey: Keys.theme).flatMap(ThemePreference.init(rawValue:)) ?? .system
        apply()
    }

    /// The app held to the chosen appearance — `NSApp` rather than each
    /// window, so windows opened later, the settings included, come up in
    /// it too.
    private func apply() {
        NSApplication.shared.appearance = theme.appearance
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
