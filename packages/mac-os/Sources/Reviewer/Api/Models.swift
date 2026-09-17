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
