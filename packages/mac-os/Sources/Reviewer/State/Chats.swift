// The sessions surface, as the shell draws it in the page island's place:
// which of its pages the island's address is on — the composer for a
// session that does not exist yet, one conversation, or the landing the
// page passes through on its way to the newest — and what every one of
// them shares: the model catalog the server discovered, the favourites and
// the settings the last session was composed with, and the draft each
// composer is holding. The conversation itself is
// a `ChatSession`, one at a time, following the address; the snapshot a
// conversation was left at is kept so coming back to it shows it at once,
// as the web view's query cache does.
//
// The list beside it stays the island's (see `SessionsList`), so what the
// shell does to a session that the list should show — starting one, a
// turn ending under it, opening it — is reported back for the list to
// re-read (`onListChanged`).
import AppKit
import Foundation
import Observation

/// Where inside Sessions the island is, as its address says — or nil on a
/// page the island keeps for itself: a cloud run, or anywhere else.
enum SessionsPage: Equatable {
    case newSession
    case landing
    case conversation(String)

    static let sessionsPath = "/modes/agent-session"
    static let newSessionHref = "\(sessionsPath)?new=true"

    static func href(of chatId: String) -> String { "\(sessionsPath)/\(chatId)" }

    static func page(for href: String) -> SessionsPage? {
        guard let components = URLComponents(string: href) else { return nil }
        let path = components.path
        guard path == sessionsPath || path.hasPrefix("\(sessionsPath)/") else { return nil }
        let rest = path.dropFirst(sessionsPath.count).split(separator: "/").map(String.init)
        switch rest.first {
        case nil:
            let new = components.queryItems?.first { $0.name == "new" }?.value
            return new == "true" ? .newSession : .landing
        case "cloud":
            return nil
        case let id?:
            return rest.count == 1 ? .conversation(id) : nil
        }
    }
}

/// The settings the last session was composed with, kept across launches —
/// the web app's `lastSession` pref: a choice about how you work, not only
/// about one thread.
struct LastSession: Codable, Equatable {
    var provider: ChatProviderKind?
    var model: String?
    var effort: String?
    var access: ChatAccess?
}

/// What a composer is holding for one key — a chat's id, or the composer
/// for a session not yet started — so leaving and coming back finds it as
/// it was left.
struct ComposerDraft: Equatable {
    var text = ""
    var attachments: [ComposerAttachment] = []

    var isEmpty: Bool { text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && attachments.isEmpty }
}

@MainActor
@Observable
final class Chats {
    static let newSessionKey = "new"

    private(set) var page: SessionsPage?
    private(set) var session: ChatSession?
    private(set) var catalog: ChatModelCatalog?
    private(set) var drafts: [String: ComposerDraft] = [:]
    /// The native view standing in for the page, for the launchpad to
    /// photograph in the web view's place.
    @ObservationIgnored weak var pageView: NSView?

    var favorites: [String] {
        didSet { defaults.set(favorites, forKey: Keys.favorites) }
    }
    var lastSession: LastSession {
        didSet { defaults.set(try? JSONEncoder().encode(lastSession), forKey: Keys.lastSession) }
    }
    var composerHeight: CGFloat {
        didSet { defaults.set(Double(composerHeight), forKey: Keys.composerHeight) }
    }

    @ObservationIgnored var onListChanged: (() -> Void)?

    @ObservationIgnored private let client: ReviewerClient
    @ObservationIgnored private let defaults = UserDefaults.standard
    /// The conversations left lately, newest last, for coming back to.
    @ObservationIgnored private var snapshots: [(id: String, chat: Chat)] = []

    private enum Keys {
        static let favorites = "chats.favorites"
        static let lastSession = "chats.lastSession"
        static let composerHeight = "chats.composerHeight"
    }

    init(client: ReviewerClient) {
        self.client = client
        let defaults = UserDefaults.standard
        let last = defaults.data(forKey: Keys.lastSession).flatMap { try? JSONDecoder().decode(LastSession.self, from: $0) } ?? LastSession()
        let height = defaults.double(forKey: Keys.composerHeight)
        favorites = defaults.stringArray(forKey: Keys.favorites) ?? []
        lastSession = last
        composerHeight = height > 0 ? height : 92
    }

    // MARK: following the island

    /// The island moved: the shell's page follows, and the conversation
    /// with it — put down when the address leaves it, and picked up again,
    /// from where it was left, when the address comes back.
    func follow(href: String) {
        let next = SessionsPage.page(for: href)
        page = next
        guard case .conversation(let id)? = next else {
            putDownSession()
            return
        }
        guard session?.id != id else { return }
        putDownSession()
        let session = ChatSession(id: id, client: client, seed: snapshots.first { $0.id == id }?.chat)
        session.onListChanged = { [weak self] in self?.onListChanged?() }
        self.session = session
    }

    private func putDownSession() {
        guard let session else { return }
        if let chat = session.chat {
            snapshots.removeAll { $0.id == session.id }
            snapshots.append((session.id, chat))
            if snapshots.count > 8 { snapshots.removeFirst() }
        }
        session.close()
        self.session = nil
    }

    /// The project changed, or the server did: the catalog is re-read, since
    /// the models are whatever each agent's CLI reports.
    func refresh() async {
        catalog = try? await client.modelCatalog()
    }

    // MARK: composing

    func draft(for key: String) -> ComposerDraft {
        drafts[key] ?? ComposerDraft()
    }

    func setDraft(_ draft: ComposerDraft, for key: String) {
        if draft == ComposerDraft() {
            drafts.removeValue(forKey: key)
        } else {
            drafts[key] = draft
        }
    }

    func attach(_ attachments: [ComposerAttachment], to key: String) {
        guard !attachments.isEmpty else { return }
        var draft = draft(for: key)
        draft.attachments.append(contentsOf: attachments)
        setDraft(draft, for: key)
    }

    func remember(_ settings: ChatSettings) {
        lastSession.provider = settings.provider
        lastSession.model = settings.model
        lastSession.effort = settings.effort
        lastSession.access = settings.access
    }

    func toggleFavorite(_ modelId: String) {
        if let index = favorites.firstIndex(of: modelId) {
            favorites.remove(at: index)
        } else {
            favorites.append(modelId)
        }
    }

    /// What a fresh composer opens on: the model the last session ran, while
    /// its agent still reports it, else the first favourite, else the first
    /// model; and the last session's effort and access, put through what
    /// that model can actually be run with.
    var newSessionSettings: ChatSettings {
        let last = lastSession
        let remembered = catalog?.models.first { $0.id == last.model && $0.provider == last.provider }
        let preferred = catalog?.preferredModel(favorites: favorites)
        let provider = remembered?.provider ?? preferred?.provider ?? .claude
        let model = remembered?.id ?? preferred?.id ?? ""
        let settings = ChatSettings(
            provider: provider, model: model,
            effort: last.effort ?? catalog?.defaults.effort ?? "high",
            access: last.access ?? catalog?.defaults.access ?? .fullAccess)
        return ChatCapability.within(ChatCapability.capabilities(in: catalog, provider: provider, model: model), settings)
    }

    /// The new-thread flow: the chat made with `settings`, its first prompt
    /// sent at once.
    func start(settings: ChatSettings, text: String, images: [ComposerAttachment], branch: String?) async throws -> Chat {
        var request = NewChat()
        request.provider = settings.provider
        request.model = settings.model
        request.effort = settings.effort
        request.access = settings.access
        request.branch = branch
        let created = try await client.createChat(request)
        let started = try await client.sendMessage(chatId: created.id, text: text, images: images.map(\.upload))
        snapshots.append((started.id, started))
        onListChanged?()
        return started
    }
}
