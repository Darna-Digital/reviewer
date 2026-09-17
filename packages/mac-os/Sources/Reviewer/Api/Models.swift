// The wire shapes of the embedded server's API, mirrored from the Effect
// schemas in `packages/core` (`workspace`, `repo`, `project`, `chats`). Only
// the fields this shell reads are declared — `Decodable` ignores the rest —
// and every `NullOr` schema is an optional here. Dates stay ISO strings: the
// UI never does date arithmetic, only displays them.
import Foundation

// MARK: workspace

struct RepoEntry: Codable, Hashable, Sendable {
    let name: String
    let path: String
    let branch: String?
}

struct WorkspaceInfo: Codable, Sendable {
    let project: String?
    let repos: [RepoEntry]
    let current: String?
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

/// A file listing with git status. `/api/files` names them from the selected
/// root, `/api/project/files` from the project folder with each root's name
/// in front — and the file endpoints resolve against the project folder, so
/// only one of the two matches for a given project. See `AppModel.loadFiles`.
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

struct SendChatMessage: Encodable {
    let text: String
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
    let repo: String
    let repoPath: String
    let status: Status
    let exitCode: Int?
}

struct DevCommand: Decodable, Sendable {
    let id: String
    let name: String
    let command: String
    let repo: String
    let repoPath: String
}

struct NewDevCommand: Encodable, Sendable {
    let name: String
    let command: String
    let repoPath: String
}

struct DevRepoScope: Encodable, Sendable {
    let repoPath: String?
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

/// One root's branches, as `/api/project/branches` lists them for a
/// project of several — `RepoBranches` in core.
struct RepoBranches: Decodable, Identifiable, Sendable {
    let repo: RepoEntry
    let branches: [BranchInfo]
    let remoteBranches: [RemoteBranchInfo]

    var id: String { repo.path }
}

struct ProjectBranches: Decodable, Sendable {
    let repos: [RepoBranches]
}

struct CommandOutput: Decodable, Sendable {
    let output: String
}

struct CheckoutBody: Encodable, Sendable {
    let branch: String
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

/// One commit of a project's merged history, with the root it came from.
struct ProjectLogEntry: Decodable, Sendable {
    let repo: RepoEntry
    let commit: CommitInfo
}

struct ProjectLog: Decodable, Sendable {
    let commits: [ProjectLogEntry]
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
