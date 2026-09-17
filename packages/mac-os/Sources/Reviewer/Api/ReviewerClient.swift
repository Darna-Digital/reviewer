// A thin async client for the embedded server's HTTP API. Every call is one
// request against `/api/...` and decodes the JSON the Effect HttpApi answers
// with; failures carry the status and the server's own error body (a tagged
// error such as `{"_tag":"NoRepoSelected"}`) so the UI can show the reason
// rather than a bare status code.
import Foundation

struct ReviewerAPIError: LocalizedError, Sendable {
    let status: Int
    let body: String

    var errorDescription: String? {
        // Effect's tagged errors serialise as `{"_tag": ..., "reason"?: ...}`;
        // prefer the reason, then the tag, then whatever text came back.
        if let data = body.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let reason = json["reason"] as? String { return reason }
            if let message = json["message"] as? String { return message }
            if let tag = json["_tag"] as? String { return tag }
        }
        return body.isEmpty ? "request failed (\(status))" : body
    }
}

struct ReviewerClient: Sendable {
    let baseURL: URL
    private let session = URLSession(configuration: .ephemeral)

    /// The chat stream socket for one session — `ws://` on the same host.
    func chatStreamURL(chatId: String) -> URL {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        components.scheme = "ws"
        components.path = "/api/chats/stream"
        components.queryItems = [URLQueryItem(name: "chat", value: chatId)]
        return components.url!
    }

    // MARK: workspace

    func workspace() async throws -> WorkspaceInfo {
        try await get("/api/workspace")
    }

    func openProject(path: String) async throws -> WorkspaceInfo {
        try await send("POST", "/api/workspace", body: SetWorkspace(path: path))
    }

    func files() async throws -> FilesPayload {
        try await get("/api/files")
    }

    func projectFiles() async throws -> FilesPayload {
        try await get("/api/project/files")
    }

    func readFile(path: String) async throws -> FileContent {
        try await get("/api/file", query: ["path": path])
    }

    func writeFile(path: String, contents: String) async throws {
        let _: Ok = try await send("PUT", "/api/file", body: WriteFile(path: path, contents: contents))
    }

    func repoStatus() async throws -> RepoStatus {
        try await get("/api/status")
    }

    // MARK: chats

    func chats(limit: Int = 50) async throws -> ChatPage {
        try await get("/api/chats", query: ["limit": String(limit)])
    }

    func chat(id: String) async throws -> Chat {
        try await get("/api/chats/\(id)")
    }

    func modelCatalog() async throws -> ChatModelCatalog {
        try await get("/api/chats/models")
    }

    func createChat(_ chat: NewChat) async throws -> Chat {
        try await send("POST", "/api/chats", body: chat)
    }

    func sendMessage(chatId: String, text: String) async throws -> Chat {
        try await send("POST", "/api/chats/\(chatId)/messages", body: SendChatMessage(text: text))
    }

    func stopChat(id: String) async throws {
        let _: Ok = try await send("POST", "/api/chats/\(id)/stop", body: EmptyBody())
    }

    func markSeen(chatId: String) async throws {
        let _: Ok = try await send("POST", "/api/chats/\(chatId)/seen", body: EmptyBody())
    }

    func deleteChat(id: String) async throws {
        let _: Ok = try await send("DELETE", "/api/chats/\(id)", body: nil as EmptyBody?)
    }

    // MARK: plumbing

    private struct EmptyBody: Encodable {}

    private func get<T: Decodable>(_ path: String, query: [String: String] = [:]) async throws -> T {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        components.path = path
        if !query.isEmpty {
            components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        return try await perform(URLRequest(url: components.url!))
    }

    private func send<T: Decodable, B: Encodable>(_ method: String, _ path: String, body: B?) async throws -> T {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = method
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        }
        return try await perform(request)
    }

    private func perform<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            throw ReviewerAPIError(status: status, body: String(decoding: data, as: UTF8.self))
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
