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
        // prefer the reason, then the tag, then whatever text came back. A
        // git error carries git's own stderr — the rejected push's reason,
        // the merge's conflict — which is what the notice should say.
        if let data = body.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let reason = json["reason"] as? String { return reason }
            if let message = json["message"] as? String { return message }
            if let stderr = (json["stderr"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
               !stderr.isEmpty { return stderr }
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

    /// Every repository the machine holds, as far as the server's walk has
    /// got; `scanning` says whether more may still come.
    func repos() async throws -> RepoIndex {
        try await get("/api/repos")
    }

    /// Walk the machine for repositories again; answers with the index as it
    /// stands, the walk filling it in behind.
    func rescanRepos() async throws -> RepoIndex {
        try await send("POST", "/api/repos/scan", body: EmptyBody())
    }

    func files() async throws -> FilesPayload {
        try await get("/api/files")
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

    func repoInfo() async throws -> RepoInfo {
        try await get("/api/repo")
    }

    func gitIdentity() async throws -> GitIdentity {
        try await get("/api/identity")
    }

    // MARK: github

    /// Who the server is signed in to GitHub as. Needs no project: the
    /// login is the user's, not the repository's.
    func githubAuth() async throws -> GitHubAuth {
        try await get("/api/github/auth")
    }

    /// Start a sign-in through the `gh` CLI; answers once the one-time code
    /// is known, or with the reason the CLI could not begin.
    func startGitHubLogin() async throws -> GitHubLoginState {
        try await send("POST", "/api/github/login", body: EmptyBody())
    }

    func githubLoginStatus() async throws -> GitHubLoginState {
        try await get("/api/github/login")
    }

    func cancelGitHubLogin() async throws {
        let _: GitHubLoginState = try await send("DELETE", "/api/github/login", body: EmptyBody())
    }

    // MARK: merge requests

    /// Every open pull request on the repository's GitHub remote, with CI
    /// and mergeability on each. Refused where the root has no such remote.
    func pulls() async throws -> [PullRequestInfo] {
        try await get("/api/github/pulls")
    }

    func mergePull(number: Int, method: MergeMethod) async throws -> MergeResult {
        try await send("POST", "/api/github/pulls/\(number)/merge", body: MergePullBody(method: method))
    }

    func closePull(number: Int) async throws -> CloseResult {
        try await send("POST", "/api/github/pulls/\(number)/close", body: EmptyBody())
    }

    /// Fetch a pull request's head and check it out as `branch`: an existing
    /// local branch is fast-forwarded, never reset.
    func checkoutPull(number: Int, branch: String) async throws -> String {
        let result: CheckedOutBranch = try await send(
            "POST", "/api/checkout-pull", body: CheckoutPullBody(number: number, branch: branch))
        return result.branch
    }

    // MARK: search

    /// A content search over the working tree, its hits named from the
    /// repository root — the names the file endpoints resolve.
    func search(_ query: String, options: GrepOptions, limit: Int) async throws -> ContentMatches {
        try await get("/api/search", query: [
            "q": query,
            "case": options.caseSensitive ? "1" : "0",
            "word": options.wholeWord ? "1" : "0",
            "regex": options.regex ? "1" : "0",
            "limit": String(limit),
        ])
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

    func sendMessage(chatId: String, text: String, images: [ChatImageUpload] = []) async throws -> Chat {
        try await send(
            "POST", "/api/chats/\(chatId)/messages",
            body: SendChatMessage(text: text, images: images.isEmpty ? nil : images))
    }

    func updateChat(id: String, _ patch: UpdateChat) async throws -> Chat {
        try await send("PATCH", "/api/chats/\(id)", body: patch)
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

    // MARK: branches

    func branches() async throws -> [BranchInfo] {
        try await get("/api/branches")
    }

    func remoteBranches() async throws -> [RemoteBranchInfo] {
        try await get("/api/remote-branches")
    }

    // MARK: history

    /// One page of the log, `skip` commits in: `ref`'s ancestry, or every
    /// ref's for `allRefs`, narrowed by `query`.
    func log(ref: String, query: LogQuery, skip: Int, limit: Int) async throws -> [CommitInfo] {
        try await get("/api/log", query: logParameters(ref: ref, query: query, skip: skip, limit: limit))
    }

    func commitDetail(sha: String) async throws -> CommitDetail {
        try await get("/api/commit/\(sha)")
    }

    private func logParameters(ref: String, query: LogQuery, skip: Int, limit: Int) -> [String: String] {
        var parameters = query.queryItems
        parameters["ref"] = ref
        parameters["limit"] = String(limit)
        if skip > 0 { parameters["skip"] = String(skip) }
        return parameters
    }

    func checkout(branch: String) async throws {
        let _: Ok = try await send("POST", "/api/checkout", body: CheckoutBody(branch: branch))
    }

    /// Commit `paths` — every change when empty — under `message`; answers
    /// the new commit's sha.
    func commit(message: String, paths: [String]) async throws -> String {
        let result: CommitResult = try await send("POST", "/api/commit", body: CommitBody(message: message, paths: paths))
        return result.sha
    }

    /// Revert the working-tree changes under `paths` to HEAD — modifications
    /// and deletions restored, new files removed. Not undoable, so the
    /// caller asks first.
    func discard(paths: [String]) async throws {
        let _: Ok = try await send("POST", "/api/discard", body: DiscardBody(paths: paths))
    }

    func pull() async throws -> String {
        let result: CommandOutput = try await send("POST", "/api/pull", body: EmptyBody())
        return result.output
    }

    func fetch() async throws -> String {
        let result: CommandOutput = try await send("POST", "/api/fetch", body: EmptyBody())
        return result.output
    }

    func push() async throws -> String {
        let result: CommandOutput = try await send("POST", "/api/push", body: EmptyBody())
        return result.output
    }

    func merge(branch: String) async throws -> String {
        let result: CommandOutput = try await send("POST", "/api/merge", body: MergeBody(branch: branch))
        return result.output
    }

    func rebase(onto: String) async throws -> String {
        let result: CommandOutput = try await send("POST", "/api/rebase", body: RebaseBody(onto: onto))
        return result.output
    }

    func createBranch(name: String, startPoint: String?) async throws {
        let _: Ok = try await send("POST", "/api/branch", body: CreateBranchBody(name: name, startPoint: startPoint))
    }

    func renameBranch(from: String, to: String) async throws {
        let _: Ok = try await send("POST", "/api/branch/rename", body: RenameBranchBody(from: from, to: to))
    }

    func deleteBranch(name: String, force: Bool = false) async throws {
        let _: Ok = try await send("POST", "/api/branch/delete", body: DeleteBranchBody(name: name, force: force ? true : nil))
    }

    func setBranchTarget(branch: String, target: String) async throws {
        struct Target: Decodable {}
        let _: Target = try await send("POST", "/api/branch-targets", body: SetBranchTargetBody(branch: branch, target: target))
    }

    // MARK: threads

    func threads() async throws -> [ThreadSummary] {
        try await get("/api/threads")
    }

    func createThread(_ thread: NewThread) async throws -> ThreadSummary {
        struct Created: Decodable {
            let id: String
            let title: String
            let agent: String
            let branch: String
            let createdAt: String
            let updatedAt: String
        }
        let created: Created = try await send("POST", "/api/threads", body: thread)
        return ThreadSummary(
            id: created.id, title: created.title, agent: created.agent, branch: created.branch,
            createdAt: created.createdAt, updatedAt: created.updatedAt, entryCount: 0, lastCommand: nil)
    }

    func renameThread(id: String, title: String) async throws {
        struct Renamed: Decodable {}
        let _: Renamed = try await send("PATCH", "/api/threads/\(id)", body: RenameThread(title: title))
    }

    func removeThread(id: String) async throws {
        let _: Ok = try await send("DELETE", "/api/threads/\(id)", body: nil as EmptyBody?)
    }

    /// The live terminal of a thread — `ws://` on the same host. The server
    /// starts the shell on first attach and keeps it between attachments,
    /// replaying what was on screen.
    func threadPtyURL(id: String, cols: Int, rows: Int, theme: String) -> URL {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        components.scheme = "ws"
        components.path = "/api/threads/pty"
        components.queryItems = [
            URLQueryItem(name: "id", value: id),
            URLQueryItem(name: "agent", value: "terminal"),
            URLQueryItem(name: "cols", value: String(cols)),
            URLQueryItem(name: "rows", value: String(rows)),
            URLQueryItem(name: "theme", value: theme),
        ]
        return components.url!
    }

    // MARK: local dev

    func devCommands() async throws -> [DevCommandView] {
        try await get("/api/local-dev/commands")
    }

    func createDevCommand(_ command: NewDevCommand) async throws {
        let _: DevCommand = try await send("POST", "/api/local-dev/commands", body: command)
    }

    func removeDevCommand(id: String) async throws {
        let _: Ok = try await send("DELETE", "/api/local-dev/commands/\(id)", body: nil as EmptyBody?)
    }

    func startDevCommand(id: String) async throws -> DevCommandView {
        try await send("POST", "/api/local-dev/commands/\(id)/start", body: EmptyBody())
    }

    func stopDevCommand(id: String) async throws {
        let _: Ok = try await send("POST", "/api/local-dev/commands/\(id)/stop", body: EmptyBody())
    }

    func startAllDevCommands() async throws {
        let _: [DevCommandView] = try await send("POST", "/api/local-dev/start-all", body: EmptyBody())
    }

    func stopAllDevCommands() async throws {
        let _: Ok = try await send("POST", "/api/local-dev/stop-all", body: EmptyBody())
    }

    /// The output socket of a running dev command — `ws://` on the same host.
    func devProcessURL(command: String, cols: Int, rows: Int) -> URL {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        components.scheme = "ws"
        components.path = "/api/local-dev/pty"
        components.queryItems = [
            URLQueryItem(name: "command", value: command),
            URLQueryItem(name: "cols", value: String(cols)),
            URLQueryItem(name: "rows", value: String(rows)),
        ]
        return components.url!
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
