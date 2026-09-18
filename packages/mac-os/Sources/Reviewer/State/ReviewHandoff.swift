// The review the code island is holding for a hand-off — see `ShellReview`
// in the SPA's `lib/shell` — for the shell to float its assign bar over the
// page natively in the web bar's place: the comments left on the diff and
// on the running app, the branch they are about, and whether the page is
// in the middle of handing them off. The comments, the hand-off and the
// jump to a comment's line are the page's; what the bar holds of its own is
// what the web bar holds — which target was picked, whether it is folded
// to its chip — and the sessions the picker lists, read from the server by
// the shell itself, as its composer reads the model catalog.
import Foundation
import Observation

struct ShellReview: Decodable, Equatable, Sendable {
    let comments: [ShellReviewComment]
    let branch: String
    let assigning: Bool

    static func decode(_ body: Any?) -> ShellReview? { Wire.decode(body) }

    /// The comments as a review reads: each file named once, its notes
    /// under it in the order they were left.
    var byFile: [(file: String, comments: [ShellReviewComment])] {
        var order: [String] = []
        var grouped: [String: [ShellReviewComment]] = [:]
        for comment in comments {
            if grouped[comment.file] == nil { order.append(comment.file) }
            grouped[comment.file, default: []].append(comment)
        }
        return order.map { ($0, grouped[$0] ?? []) }
    }
}

struct ShellReviewComment: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let file: String
    /// Nil for a note on the running UI, which sits on no line — and so has
    /// nowhere in the code to jump to.
    let line: Int?
    let body: String

    /// The leaf alone, the way the tab strip names a file: the folders above
    /// it are the same for most of a review and only push the name out.
    var fileName: String {
        file.split(separator: "/").last.map(String.init) ?? file
    }
}

/// Where the bar hands the review — the web bar's `AssignTarget`: a fresh
/// chat carries the agent and the model, since which agent runs the work and
/// which model it runs on are two answers; a running session already has
/// both.
enum ReviewTarget: Hashable, Sendable {
    case new(agent: ChatProviderKind, model: String)
    case existing(chatId: String)

    var payload: [String: Any] {
        switch self {
        case .new(let agent, let model):
            return ["kind": "new", "agent": agent.rawValue, "model": model]
        case .existing(let chatId):
            return ["kind": "existing", "chatId": chatId]
        }
    }
}

/// The bar's actions, in the shape the island's `ShellReviewAction` takes.
enum ReviewAction {
    case assign(ReviewTarget)
    case open(String)
    case delete(String)

    var payload: [String: Any] {
        switch self {
        case .assign(let target): return ["kind": "assign", "target": target.payload]
        case .open(let id): return ["kind": "open", "id": id]
        case .delete(let id): return ["kind": "delete", "id": id]
        }
    }
}

@MainActor
@Observable
final class ReviewHandoff {
    private(set) var review: ShellReview?
    /// Nil until you pick: before that the bar answers for you (see `target`).
    private(set) var picked: ReviewTarget?
    /// Folded to the count chip at the page's trailing edge. Unfolds on its
    /// own when a comment is added, as the web bar does.
    var collapsed = false
    /// The sessions the picker lists, newest first — the same recent page
    /// the web bar reads.
    private(set) var sessions: [ChatSummary] = []

    @ObservationIgnored private let client: ReviewerClient
    @ObservationIgnored private let chats: Chats

    init(client: ReviewerClient, chats: Chats) {
        self.client = client
        self.chats = chats
    }

    var isShown: Bool { review != nil }

    /// The island reported the review as it stands. A bar coming up fresh
    /// starts as the web one mounts: unfolded, aimed at nobody in
    /// particular; one that gained a comment while folded comes back out.
    func take(_ next: ShellReview?) {
        let before = review
        review = next
        guard let next else {
            picked = nil
            collapsed = false
            return
        }
        if before == nil {
            picked = nil
            collapsed = false
            Task { await reloadSessions() }
        } else if let before, next.comments.count > before.comments.count {
            collapsed = false
        }
    }

    /// What the bar is aimed at: what you picked, else a fresh chat with
    /// whoever you last worked with, on the model that agent last ran — the
    /// two answers a hand-off needs, both on the bar where a click changes
    /// them. Aiming at a running session instead would hide the model
    /// behind a pick nobody asked to make.
    var target: ReviewTarget {
        if let picked { return picked }
        let last = chats.lastSession
        let agent = last.provider ?? .claude
        return .new(agent: agent, model: Self.assignmentModel(agent, in: chats.catalog, wanted: last.model))
    }

    /// The session the bar is aimed at, once the list has it.
    var targetSession: ChatSummary? {
        guard case .existing(let chatId) = target else { return nil }
        return sessions.first { $0.id == chatId }
    }

    /// A pick is held: the list reloads as sessions come and go, and must
    /// not quietly undo one. A fresh chat picked is also the answer to the
    /// next hand-off's question of who to work with.
    func pick(_ target: ReviewTarget) {
        picked = target
        if case .new(let agent, let model) = target {
            chats.lastSession.provider = agent
            chats.lastSession.model = model
        }
    }

    /// The agent swapped under a fresh chat: the model you were on stays
    /// when the new agent can run it, else the agent's own first answer.
    func pick(agent: ChatProviderKind) {
        let wanted: String? = if case .new(_, let model) = target { model } else { chats.lastSession.model }
        pick(.new(agent: agent, model: Self.assignmentModel(agent, in: chats.catalog, wanted: wanted)))
    }

    func reloadSessions() async {
        guard let page = try? await client.chats(limit: 50) else { return }
        sessions = page.items
    }

    /// Sessions working where the comments are, newest first — the ones
    /// that lead the picker under a heading naming the branch.
    func sessions(onBranch branch: String) -> [ChatSummary] {
        guard !branch.isEmpty else { return [] }
        return sessions.filter { $0.branch == branch }.sorted { $0.updatedAt > $1.updatedAt }
    }

    /// Which model a new chat with `provider` runs — the web bar's
    /// `assignmentModel`: what was asked for, while this provider reported
    /// it (a model remembered from the last session belongs to whichever
    /// agent was chosen then); else the catalog's default, while it is this
    /// provider's; else the provider's own first choice; else nothing, and
    /// the CLI runs whatever it defaults to.
    static func assignmentModel(_ provider: ChatProviderKind, in catalog: ChatModelCatalog?, wanted: String?) -> String {
        let models = catalog?.providers.first { $0.id == provider }?.models ?? []
        let asked = models.first { $0.id == wanted }?.id
        let providerDefault = models.first { $0.id == catalog?.defaults.model }?.id
        return asked ?? providerDefault ?? models.first?.id ?? ""
    }
}
