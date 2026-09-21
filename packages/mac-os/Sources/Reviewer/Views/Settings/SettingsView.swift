// The settings window — ⌘, and the app menu's Settings…: the system's
// grouped form, one section for each of the three things it holds. Theme
// is the one control; git is read from the server and said as it stands,
// with what to run to change it underneath, since it is not the window's
// to edit; GitHub is the account the server works as, with a sign-in when
// there is none — the CLI's device flow, the code shown here and the page
// it goes on opened (see `AppSettings`).
import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var settings = model.settings
        Form {
            Section("Appearance") {
                Picker("Theme", selection: $settings.theme) {
                    ForEach(ThemePreference.allCases) { theme in
                        Label(theme.title, systemImage: theme.symbol).tag(theme)
                    }
                }
                .pickerStyle(.segmented)
            }
            Section {
                GitIdentityRows(read: model.settings.identity, hasProject: model.hasProject)
            } header: {
                Text("Git")
            } footer: {
                Text("The name commits are signed with here — git's `user.name` and `user.email`, this project's over the global ones. Change them with `git config --global user.name` and `user.email`.")
            }
            Section {
                GitHubAccountRows(settings: model.settings)
            } header: {
                HStack {
                    Text("GitHub")
                    Spacer()
                    Button("Check Again") { Task { await model.settings.reload() } }
                        .controlSize(.small)
                        .disabled(model.settings.signIn.isUnderWay)
                }
            } footer: {
                Text("Requests to GitHub carry the token in `GITHUB_TOKEN` or `GH_TOKEN`, else the one the `gh` CLI is signed in with. Signing in here runs `gh auth login`.")
            }
        }
        .formStyle(.grouped)
        // A grouped form is a list, and a list reports no ideal height: the
        // window is sized here, tall enough for every section with its
        // rows in, and scrolls should a reason or a name run long.
        .frame(width: 480, height: 470)
        .task { await model.settings.reload() }
        .onChange(of: model.workspace?.project) { Task { await model.settings.reload() } }
    }
}

/// Name and email, or why there are none: no project open, git without
/// either set, or a read that failed.
private struct GitIdentityRows: View {
    let read: SettingsRead<GitIdentity>
    let hasProject: Bool

    var body: some View {
        if !hasProject {
            SettingsNote("Open a project to see the identity git uses in it.")
        } else {
            switch read {
            case .loading:
                SettingsNote("Reading…")
            case .failed(let reason):
                SettingsNote(reason, tone: .warning)
            case .loaded(let identity):
                IdentityRow(label: "Name", value: identity.name)
                IdentityRow(label: "Email", value: identity.email)
            }
        }
    }
}

private struct IdentityRow: View {
    let label: String
    let value: String?

    var body: some View {
        LabeledContent(label) {
            if let value {
                Text(value).textSelection(.enabled)
            } else {
                Text("Not set").foregroundStyle(.secondary)
            }
        }
    }
}

/// The account: who the server works as, with the avatar GitHub shows for
/// them; or the offer to sign in; or the sign-in under way — the code,
/// large enough to read across the room, and the ways back to the page and
/// the pasteboard should either have been lost.
private struct GitHubAccountRows: View {
    let settings: AppSettings

    var body: some View {
        switch settings.signIn {
        case .starting:
            HStack(spacing: 8) {
                ProgressView().controlSize(.small)
                Text("Asking GitHub for a code…").foregroundStyle(.secondary)
            }
        case .waiting(let code, _):
            SignInCodeRow(code: code, settings: settings)
        case .failed(let reason):
            SignInFailedRow(reason: reason, settings: settings)
        case .idle:
            switch settings.githubAuth {
            case .loading:
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small)
                    Text("Checking…").foregroundStyle(.secondary)
                }
            case .failed(let reason):
                SettingsNote(reason, tone: .warning)
            case .loaded(let auth):
                if let login = auth.login {
                    AccountRow(login: login, auth: auth)
                } else {
                    SignInOfferRow(settings: settings)
                }
            }
        }
    }
}

private struct AccountRow: View {
    let login: String
    let auth: GitHubAuth

    var body: some View {
        HStack(spacing: 12) {
            Avatar(url: auth.avatarUrl.flatMap(URL.init(string:)))
            VStack(alignment: .leading, spacing: 2) {
                Text(auth.name ?? login).fontWeight(.medium)
                Text("@\(login)").foregroundStyle(.secondary).textSelection(.enabled)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Label("Signed in", systemImage: "checkmark.circle.fill")
                    .foregroundStyle(.green)
                    .font(.callout)
                if let source = auth.source {
                    Text(source.description).font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 2)
    }
}

/// GitHub's picture of the account, in the circle the site draws it in,
/// with a placeholder until it arrives.
private struct Avatar: View {
    let url: URL?

    private static let size: CGFloat = 36

    var body: some View {
        AsyncImage(url: url) { phase in
            if let image = phase.image {
                image.resizable().scaledToFill()
            } else {
                Image(systemName: "person.crop.circle.fill")
                    .resizable()
                    .foregroundStyle(.tertiary)
            }
        }
        .frame(width: Self.size, height: Self.size)
        .clipShape(Circle())
    }
}

private struct SignInOfferRow: View {
    let settings: AppSettings

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "person.crop.circle.badge.questionmark")
                .font(.system(size: 28))
                .foregroundStyle(.tertiary)
            VStack(alignment: .leading, spacing: 2) {
                Text("Not signed in").fontWeight(.medium)
                Text("Pull requests, checks and merges need an account.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Sign In…") { settings.signInToGitHub() }
                .buttonStyle(.borderedProminent)
        }
        .padding(.vertical, 2)
    }
}

/// The device flow's one step: the code goes on GitHub's page. The page
/// has been opened and the code put on the pasteboard already; the buttons
/// do either again.
private struct SignInCodeRow: View {
    let code: String
    let settings: AppSettings

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Enter this code on GitHub to sign in")
                .fontWeight(.medium)
            HStack(spacing: 12) {
                Text(code)
                    .font(.system(size: 26, weight: .semibold, design: .monospaced))
                    .tracking(2)
                    .textSelection(.enabled)
                Spacer()
                Button("Copy Code") { settings.copySignInCode() }
                Button("Open GitHub") { settings.openSignInPage() }
            }
            HStack(spacing: 8) {
                ProgressView().controlSize(.small)
                Text("Waiting for GitHub — the code is on your pasteboard and the page is open in your browser.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                Spacer()
                Button("Cancel") { settings.cancelSignIn() }
                    .controlSize(.small)
            }
        }
        .padding(.vertical, 4)
    }
}

private struct SignInFailedRow: View {
    let reason: String
    let settings: AppSettings

    /// The one failure with a fix to point at: the CLI the flow runs on is
    /// not there to run.
    private var needsCLI: Bool { reason.localizedCaseInsensitiveContains("not installed") }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Could not sign in").fontWeight(.medium)
                    Text(reason).font(.callout).foregroundStyle(.secondary)
                    if needsCLI {
                        Text("Install it with `brew install gh`, or from [cli.github.com](https://cli.github.com), then try again.")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
            }
            HStack {
                Spacer()
                Button("Dismiss") { settings.dismissSignInFailure() }
                Button("Try Again") { settings.signInToGitHub() }
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding(.vertical, 4)
    }
}

private extension GitHubAuth.Source {
    var description: String {
        switch self {
        case .env: "Token from the environment"
        case .gh: "Via the gh CLI"
        }
    }
}

/// A sentence standing in for a section's rows.
private struct SettingsNote: View {
    enum Tone {
        case plain
        case warning
    }

    let text: String
    let tone: Tone

    init(_ text: String, tone: Tone = .plain) {
        self.text = text
        self.tone = tone
    }

    var body: some View {
        HStack(spacing: 6) {
            if tone == .warning {
                Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange)
            }
            Text(text).foregroundStyle(.secondary)
        }
    }
}
