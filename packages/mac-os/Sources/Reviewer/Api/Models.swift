// The wire shapes of the embedded server's API, mirrored from the Effect
// schemas in `packages/core` (`workspace`, `repo`, `chats`). Only
// the fields this shell reads are declared — `Decodable` ignores the rest —
// and every `NullOr` schema is an optional here. Dates stay ISO strings: the
// UI never does date arithmetic, only displays them.
import Foundation

// MARK: workspace

/// A git repository the machine holds, as the repository index lists it:
/// where it is, the branch it is on, and when it was last opened here.
struct RepoEntry: Codable, Hashable, Identifiable, Sendable {
    let name: String
    let path: String
    let branch: String?
    let lastOpened: String?

    var id: String { path }
}

/// Every repository the index has found, and whether the walk behind it is
/// still under way.
struct RepoIndex: Codable, Sendable {
    let repos: [RepoEntry]
    let scanning: Bool
    let scannedAt: String?
}

struct WorkspaceInfo: Codable, Sendable {
    /// The open repository — the project — or nil while nothing is open.
    let project: String?
    let branch: String?
    let recents: [String]
    let home: String

    var projectName: String? {
        project.map { URL(fileURLWithPath: $0).lastPathComponent }
    }
}

struct SetWorkspace: Encodable {
    let path: String
}

struct FileContent: Decodable, Sendable {
    let name: String
    let contents: String
    let binary: Bool
    let sizeBytes: Int
}

struct WriteFile: Encodable {
    let path: String
    let contents: String
}

// MARK: repo / project

enum GitFileStatus: String, Codable, Sendable {
    case added, deleted, ignored, modified, renamed, untracked
}

struct GitStatusEntry: Codable, Hashable, Sendable {
    let path: String
    let status: GitFileStatus
}

/// A file listing with git status, named from the repository root.
struct FilesPayload: Decodable, Sendable {
    let paths: [String]
    let gitStatus: [GitStatusEntry]
}

/// One hit of a content search — `ContentMatch` in core: the file and the
/// position the pattern struck at, and the whole line it struck on. The
/// server says where the hit starts but not how long it is — under a regex
/// only the pattern knows — so the dialog runs the same match over the line
/// again to pick the hit out of it.
struct ContentMatch: Decodable, Hashable, Sendable {
    let path: String
    let line: Int
    let column: Int
    let text: String
}

struct ContentMatches: Decodable, Sendable {
    let matches: [ContentMatch]
    /// More matches existed than the request's limit allowed through.
    let truncated: Bool

    static let empty = ContentMatches(matches: [], truncated: false)
}

/// The match modifiers of a content search, mirroring the `git grep` flags
/// behind them.
struct GrepOptions: Hashable, Sendable {
    var caseSensitive = false
    var wholeWord = false
    var regex = false
}

struct RepoStatus: Decodable, Sendable {
    let branch: String
    let upstream: String?
    let ahead: Int
    let behind: Int
    let headSha: String
    let changed: Int
    let staged: Int
    let unstaged: Int
    let untracked: Int
    let conflicted: Int
}

struct Ok: Decodable, Sendable {
    let ok: Bool
}

/// The repository the current root is, as `/api/repo` describes it — read
/// here for the one thing the shell asks of it: whether it is on GitHub,
/// which is where its merge requests come from.
struct RepoInfo: Decodable, Sendable {
    let root: String
    let name: String
    let currentBranch: String
    let github: GitHubRemote?
}

struct GitHubRemote: Decodable, Hashable, Sendable {
    let owner: String
    let repo: String
}

/// Who git signs commits with in the project — `user.name` and `user.email`
/// as the repository resolves them; nil where git has nothing set.
struct GitIdentity: Decodable, Hashable, Sendable {
    let name: String?
    let email: String?
}

/// Who the server's GitHub requests go out as, and where the token came
/// from — the environment, or the `gh` CLI's login. Everything nil while
/// there is no token, and the requests go out unauthenticated.
struct GitHubAuth: Decodable, Hashable, Sendable {
    enum Source: String, Decodable, Sendable {
        case env
        case gh
    }

    let login: String?
    let name: String?
    let avatarUrl: String?
    let source: Source?
}

/// Where a GitHub sign-in stands — the `gh` CLI's device flow, run by the
/// server: `waiting` carries the one-time code to type on GitHub's device
/// page, `done` says the CLI has the token, `failed` says why not.
struct GitHubLoginState: Decodable, Hashable, Sendable {
    enum Phase: String, Decodable, Sendable {
        case idle
        case waiting
        case done
        case failed
    }

    let phase: Phase
    let code: String?
    let url: String?
    let reason: String?
}

// MARK: merge requests

/// How one CI check came back — `CheckState` in core's git-provider port:
/// every spelling GitHub has for it folded onto the four words the review
/// asks about.
enum CheckState: String, Decodable, Hashable, Sendable {
    case success, failure, pending, neutral
}

struct PullRequestCheck: Decodable, Hashable, Sendable {
    let name: String
    let state: CheckState
    /// Where the run is on GitHub, or "" when it published no page.
    let url: String
}

/// Whether the pull request can be merged as it stands. `unknown` is a
/// real answer: GitHub works mergeability out lazily.
enum MergeableState: String, Decodable, Hashable, Sendable {
    case mergeable, conflicting, unknown
}

struct PullRequestLabel: Decodable, Hashable, Sendable {
    let name: String
    /// Six hex digits, no leading "#" — GitHub's own spelling.
    let color: String
}

/// One open pull request, with everything the review reads off it —
/// `PullRequestInfo` in core.
struct PullRequestInfo: Decodable, Identifiable, Hashable, Sendable {
    let number: Int
    let title: String
    let author: String
    let baseRef: String
    let headRef: String
    let headSha: String
    let url: String
    let updatedAt: String
    let createdAt: String
    /// The description, as markdown. "" when it has none.
    let body: String
    let draft: Bool
    /// Opened from a fork, so its head branch is not one of ours to check out.
    let fromFork: Bool
    let mergeable: MergeableState
    /// Every check on the head commit. Empty when the repo runs no CI.
    let checks: [PullRequestCheck]
    let assignees: [String]
    let reviewers: [String]
    let labels: [PullRequestLabel]
    let additions: Int
    let deletions: Int
    let changedFiles: Int

    var id: Int { number }
}

/// How a pull request's commits land on its base — GitHub's three, under
/// its own names.
enum MergeMethod: String, Encodable, CaseIterable, Identifiable, Sendable {
    case merge, squash, rebase

    var id: Self { self }

    var label: String {
        switch self {
        case .merge: return "Merge commit"
        case .squash: return "Squash and merge"
        case .rebase: return "Rebase and merge"
        }
    }

    var detail: String {
        switch self {
        case .merge: return "Keeps every commit, under one merge"
        case .squash: return "One commit for all"
        case .rebase: return "Replay, no merge"
        }
    }
}

struct MergePullBody: Encodable, Sendable {
    let method: MergeMethod
}

struct MergeResult: Decodable, Sendable {
    let sha: String
    /// GitHub's own wording for what happened.
    let message: String
}

struct CloseResult: Decodable, Sendable {
    let message: String
}

struct CheckoutPullBody: Encodable, Sendable {
    let number: Int
    let branch: String
}

struct CheckedOutBranch: Decodable, Sendable {
    let branch: String
}

// MARK: chats

enum ChatProviderKind: String, Codable, Sendable, CaseIterable {
    case claude, codex, opencode, cursor
}

enum ChatAccess: String, Codable, Sendable, CaseIterable {
    case supervised, acceptEdits, fullAccess
}

enum ChatTurnState: String, Codable, Sendable {
    case running, completed, interrupted, error
}

enum ChatRole: String, Codable, Sendable {
    case user, assistant
}

struct ChatAttachment: Codable, Hashable, Sendable {
    let name: String
    let thumbnail: String
}

struct ChatMessage: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let role: ChatRole
    var text: String
    let turnId: String
    var streaming: Bool
    let createdAt: String
    let attachments: [ChatAttachment]?
    let pending: Bool?
}

struct ChatActivity: Codable, Identifiable, Hashable, Sendable {
    enum Tone: String, Codable, Sendable {
        case info, tool, error
    }

    let id: String
    let turnId: String
    let kind: String
    let tone: Tone
    let summary: String
    let detail: String?
    let createdAt: String
    let callId: String?
    let label: String?
}

struct ChatTurn: Codable, Hashable, Sendable {
    let id: String
    let state: ChatTurnState
    let startedAt: String
    let endedAt: String?
    let errorMessage: String?
    let totalCostUsd: Double?
}

struct ChatOrigin: Codable, Hashable, Sendable {
    let projectPath: String
    let projectName: String
    let repoPath: String
    let repoName: String
}

struct Chat: Codable, Identifiable, Sendable {
    let id: String
    let origin: ChatOrigin
    var title: String
    let provider: ChatProviderKind
    let model: String
    let effort: String
    let access: ChatAccess
    let branch: String
    let sessionId: String?
    let createdAt: String
    var updatedAt: String
    let seenAt: String?
    var messages: [ChatMessage]
    var activities: [ChatActivity]
    var latestTurn: ChatTurn?

    var isRunning: Bool { latestTurn?.state == .running }
}

struct ChatSummary: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let origin: ChatOrigin
    let title: String
    let provider: ChatProviderKind
    let model: String
    let branch: String
    let createdAt: String
    let updatedAt: String
    let seenAt: String?
    let messageCount: Int
    let lastMessage: String?
    let turnState: ChatTurnState?
}

struct ChatPage: Decodable, Sendable {
    let items: [ChatSummary]
    let nextCursor: String?
}

struct ChatModel: Decodable, Hashable, Sendable {
    let id: String
    let label: String
    let group: String?
    let efforts: [String]?
}

struct ChatModelProvider: Decodable, Hashable, Sendable {
    let id: ChatProviderKind
    let label: String
    let models: [ChatModel]
}

struct ChatModelCatalog: Decodable, Sendable {
    struct Defaults: Decodable, Sendable {
        let provider: ChatProviderKind
        let model: String
        let effort: String
        let access: ChatAccess
    }

    let providers: [ChatModelProvider]
    let defaults: Defaults
}

/// `optionalKey` fields: a missing key means "use the server default", so
/// they are encoded only when set (`encodeIfPresent`, the synthesized default
/// for optionals).
struct NewChat: Encodable {
    var title: String?
    var provider: ChatProviderKind?
    var model: String?
    var effort: String?
    var access: ChatAccess?
    var branch: String?
}

/// A patch to a chat's composer settings, or its title — `UpdateChat` in
/// core; only what is set is sent.
struct UpdateChat: Encodable {
    var title: String?
    var provider: ChatProviderKind?
    var model: String?
    var effort: String?
    var access: ChatAccess?
}

/// An image sent with a prompt: the full-resolution bytes for the agent,
/// base64 without the `data:` prefix, and the small data-URL thumbnail the
/// message keeps for its preview — `ChatImageUpload` in core.
struct ChatImageUpload: Encodable, Hashable, Sendable {
    let name: String
    let data: String
    let thumbnail: String
}

struct SendChatMessage: Encodable {
    let text: String
    var images: [ChatImageUpload]?
}

/// One frame of the chat stream socket. The server sends a `snapshot` on
/// connect, then `event`s while a turn runs, an application-level `ping`
/// beside the protocol one on its heartbeat, and an `error` before closing.
enum ChatWireFrame: Decodable, Sendable {
    case snapshot(Chat)
    case event(ChatWireEvent)
    case ping
    case error(String)

    private enum CodingKeys: String, CodingKey {
        case snapshot, event, ping, error
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let chat = try container.decodeIfPresent(Chat.self, forKey: .snapshot) {
            self = .snapshot(chat)
        } else if let event = try container.decodeIfPresent(ChatWireEvent.self, forKey: .event) {
            self = .event(event)
        } else if container.contains(.ping) {
            self = .ping
        } else if let message = try container.decodeIfPresent(String.self, forKey: .error) {
            self = .error(message)
        } else {
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "unknown chat frame"))
        }
    }
}

enum ChatWireEvent: Decodable, Sendable {
    case turnStarted(Chat)
    case messageAppended(ChatMessage)
    case delta(messageId: String, text: String)
    case activity(ChatActivity)
    case turnCompleted(turn: ChatTurn, messageId: String, text: String)

    private enum CodingKeys: String, CodingKey {
        case type, chat, message, messageId, text, activity, turn
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(String.self, forKey: .type) {
        case "turn-started":
            self = .turnStarted(try container.decode(Chat.self, forKey: .chat))
        case "message-appended":
            self = .messageAppended(try container.decode(ChatMessage.self, forKey: .message))
        case "delta":
            self = .delta(
                messageId: try container.decode(String.self, forKey: .messageId),
                text: try container.decode(String.self, forKey: .text))
        case "activity":
            self = .activity(try container.decode(ChatActivity.self, forKey: .activity))
        case "turn-completed":
            self = .turnCompleted(
                turn: try container.decode(ChatTurn.self, forKey: .turn),
                messageId: try container.decode(String.self, forKey: .messageId),
                text: try container.decode(String.self, forKey: .text))
        case let other:
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "unknown chat event \(other)"))
        }
    }
}

// MARK: threads (Terminal)

/// A terminal session as `/api/threads` lists it — `ThreadSummary` in core.
/// The server keeps the PTY behind it running between attachments, so a
/// thread is a place to come back to rather than a process to hold.
struct ThreadSummary: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let title: String
    let agent: String
    let branch: String
    let createdAt: String
    let updatedAt: String
    let entryCount: Int
    let lastCommand: String?
}

struct NewThread: Encodable, Sendable {
    let title: String?
    let agent: String
    let branch: String?
}

struct RenameThread: Encodable, Sendable {
    let title: String
}

// MARK: local dev (Run)

/// A dev command and whether its process is up — `DevCommandView` in core.
struct DevCommandView: Decodable, Identifiable, Hashable, Sendable {
    enum Status: String, Decodable, Sendable {
        case stopped, running, exited
    }

    let id: String
    let name: String
    let command: String
    /// The folder inside the repository it runs from, relative to the root
    /// and empty for the root itself.
    let cwd: String
    let status: Status
    let exitCode: Int?
}

struct DevCommand: Decodable, Sendable {
    let id: String
    let name: String
    let command: String
    let cwd: String
}

struct NewDevCommand: Encodable, Sendable {
    let name: String
    let command: String
    let cwd: String
}

// MARK: branches

/// A local branch as `/api/branches` lists it — `BranchInfo` in core.
struct BranchInfo: Decodable, Identifiable, Hashable, Sendable {
    let name: String
    let sha: String
    let isCurrent: Bool
    let upstream: String?
    let ahead: Int
    let behind: Int
    let committedAt: String
    let subject: String

    var id: String { name }
}

/// A remote-tracking branch — `RemoteBranchInfo` in core. `name` is the
/// full `origin/feature` ref; `shortName` is what is after the remote.
struct RemoteBranchInfo: Decodable, Identifiable, Hashable, Sendable {
    let name: String
    let remote: String
    let shortName: String
    let sha: String
    let committedAt: String
    let subject: String

    var id: String { name }
}

struct CommandOutput: Decodable, Sendable {
    let output: String
}

struct CheckoutBody: Encodable, Sendable {
    let branch: String
}

struct CommitBody: Encodable, Sendable {
    let message: String
    let paths: [String]
}

struct CommitResult: Decodable, Sendable {
    let sha: String
}

struct DiscardBody: Encodable, Sendable {
    let paths: [String]
}

struct MergeBody: Encodable, Sendable {
    let branch: String
}

struct RebaseBody: Encodable, Sendable {
    let onto: String
}

struct CreateBranchBody: Encodable, Sendable {
    let name: String
    let startPoint: String?
}

struct RenameBranchBody: Encodable, Sendable {
    let from: String
    let to: String
}

struct DeleteBranchBody: Encodable, Sendable {
    let name: String
    let force: Bool?
}

struct SetBranchTargetBody: Encodable, Sendable {
    let branch: String
    let target: String
}

// MARK: history

/// The `ref` that asks the log for every ref instead of one branch's
/// ancestry — `ALL_REFS` in core, which the server maps to `git log --all`.
let allRefs = "@all"

/// The filters over a log — the web app's `LogQuery`, with the same wire
/// names: a text or hash, an author, a date range, and one file's own past,
/// followed back through its renames.
struct LogQuery: Hashable, Sendable {
    var author: String? = nil
    var grep: String? = nil
    var regex = false
    var caseSensitive = false
    var after: String? = nil
    var before: String? = nil
    var path: String? = nil
    var follow = false

    static let empty = LogQuery()

    /// The query behind "show the history of this file".
    static func history(of path: String) -> LogQuery {
        LogQuery(path: path, follow: true)
    }

    /// Whether anything narrows the log — the toggles alone do not.
    var hasFilters: Bool {
        author != nil || grep != nil || path != nil || after != nil || before != nil
    }

    /// The query with its filters cleared and its toggles kept, the way the
    /// web bar's Clear leaves them.
    var cleared: LogQuery {
        LogQuery(regex: regex, caseSensitive: caseSensitive)
    }

    var queryItems: [String: String] {
        var items: [String: String] = [:]
        if let author { items["author"] = author }
        if let grep { items["grep"] = grep }
        if regex { items["regex"] = "1" }
        if caseSensitive { items["case"] = "1" }
        if let after { items["after"] = after }
        if let before { items["before"] = before }
        if let path { items["path"] = path }
        if follow { items["follow"] = "1" }
        return items
    }
}

/// One commit as `/api/log` lists it — `CommitInfo` in core.
struct CommitInfo: Decodable, Identifiable, Hashable, Sendable {
    let sha: String
    let shortSha: String
    let author: String
    let authoredAt: String
    let subject: String
    let refs: [String]
    let parents: [String]

    var id: String { sha }
}

/// A file a commit touched — `CommitFile` in core; `oldPath` when renamed.
struct CommitFile: Decodable, Hashable, Sendable {
    let path: String
    let status: GitFileStatus
    let oldPath: String?
}

/// A commit in full, as `/api/commit/{sha}` describes it — `CommitDetail`
/// in core.
struct CommitDetail: Decodable, Sendable {
    let sha: String
    let shortSha: String
    let author: String
    let authorEmail: String
    let authoredAt: String
    let subject: String
    let body: String
    let refs: [String]
    let parents: [String]
    let files: [CommitFile]
}

/// One theme as the catalog lists it — `ThemeDescriptor` in core: enough to
/// name it in a picker without loading it.
struct ThemeDescriptor: Decodable, Hashable, Identifiable, Sendable {
    enum ColorScheme: String, Decodable, Hashable, Sendable {
        case light
        case dark
    }

    let name: String
    let displayName: String
    let colorScheme: ColorScheme
    /// Where the theme is from — `reviewer`, `pierre` or `shiki`.
    let collection: String

    var id: String { name }
}

/// The window's palette as one theme colours it — `ChromeTokens` in core,
/// every value a `#rrggbb` or `#rrggbbaa` string. The server derives it
/// from the theme (see `deriveChromeTokens`); the shell only paints with it.
struct ChromeTokens: Decodable, Hashable, Sendable {
    let colorScheme: ThemeDescriptor.ColorScheme
    let frame: String
    let island: String
    let control: String
    let popover: String
    let text: String
    let textSecondary: String
    let textTertiary: String
    let separator: String
    let hairline: String
    let accent: String
    let link: String
    let selection: String
    let hover: String
    let added: String
    let modified: String
    let deleted: String
}

/// A theme resolved for the shell: what it is, and what to paint with.
struct ThemeChrome: Decodable, Sendable {
    let theme: ThemeDescriptor
    let chrome: ChromeTokens
}

/// A snippet sent to be coloured — `HighlightRequest` in core.
struct HighlightRequest: Encodable, Sendable {
    let code: String
    /// The fence's info string, as it was written: `ts`, `Swift`, ``.
    let lang: String
}

/// One run of code that is all the same colour — `CodeToken` in core.
struct CodeToken: Decodable, Sendable {
    let text: String
    /// `#rrggbb`; nil where the token takes the code's own foreground.
    let color: String?
    let italic: Bool?
    let bold: Bool?
}

/// A snippet coloured in a theme — `HighlightedCode` in core: the tokens of
/// each line, in order, with every character of the snippet still in them.
struct HighlightedCode: Decodable, Sendable {
    /// The grammar it was read with — `text` where the fence named none.
    let lang: String
    /// What a token with no colour of its own is set in; nil where the theme
    /// names no foreground and the shell should use its own.
    let foreground: String?
    let lines: [[CodeToken]]
}
