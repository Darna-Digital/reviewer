// The sessions surface, as the shell draws it in the page island's place:
// which of its pages the island's address is on — the composer for a
// session that does not exist yet, one conversation, or the landing the
// page passes through on its way to the newest — and what every one of
// them shares: the model catalog the server discovered, the favourites and
// the settings the last session was composed with, and the draft each
// composer is holding. The conversation itself is
// a `ChatSession`, one at a time, following the address; the snapshot a
// conversation was left at is kept so coming back to it shows it at once,
// as the web view's query cache does, and a conversation the pointer rests
// on in the list is read ahead into the same cache, so the click that
// tends to follow opens on its messages rather than on the loading orb.
//
// The list beside it stays the island's (see `SessionsList`), so what the
// shell does to a session that the list should show — starting one, a
// turn ending under it, opening it — is reported back for the list to
// re-read (`onListChanged`).
import Foundation
import Observation

/// Where inside Sessions the island is, as its address says — or nil on a
/// page the island keeps for itself.
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
    /// The most text one message may carry. Past this a paste of generated
    /// markup — an SVG, a minified bundle — stalls the editor and the
    /// conversation that has to lay it out once it is sent.
    static let maxTextLength = 20_000

    var text = ""
    var attachments: [ComposerAttachment] = []

    var isEmpty: Bool { text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && attachments.isEmpty }
}

@MainActor
@Observable
final class Chats {
    /// The composer of a session tab whose first message is still to be
    /// sent: each tab its own, as each is its own session to be.
    static func newSessionKey(forTab tabId: String) -> String { "new/\(tabId)" }

    private(set) var page: SessionsPage?
    private(set) var session: ChatSession?
    private(set) var catalog: ChatModelCatalog?
    private(set) var drafts: [String: ComposerDraft] = [:]
    /// Which agent each conversation the window's tabs hold runs on, read
    /// once for each and kept up with the conversation as it is left. Kept
    /// across launches too, so the tabs drawn before the island reports
    /// (see `WindowTabStrip.lastReported`) wear their agents from the start.
    private(set) var agents: [String: ChatProviderKind] {
        didSet { defaults.set(agents.mapValues(\.rawValue), forKey: Keys.agents) }
    }
    /// The settings each unsent session tab's composer holds, by tab: taken
    /// from the last session's when the tab opens, and the tab's own from
    /// then on — a later session's switch is the next tab's to start from,
    /// not one already open.
    private(set) var unsent: [String: ChatSettings] = [:]

    var favorites: [String] {
        didSet { defaults.set(favorites, forKey: Keys.favorites) }
    }
    var lastSession: LastSession {
        didSet { defaults.set(try? JSONEncoder().encode(lastSession), forKey: Keys.lastSession) }
    }
    var composerHeight: CGFloat {
        didSet { defaults.set(Double(composerHeight), forKey: Keys.composerHeight) }
    }

    /// Counts the times the composer on the page in front is to take the
    /// keyboard: the surface coming up, moving to another of its pages or
    /// tabs, ⌘T. A composer built for the move takes it as it appears; one
    /// already standing — kept behind Code, or the same new-session page
    /// on another tab — takes it on the count (see `ChatComposer`).
    private(set) var composerFocusRequests = 0

    @ObservationIgnored var onListChanged: (() -> Void)?

    /// The server, about the focused root — the repository a new session
    /// starts in. A session already started keeps the one it began in.
    @ObservationIgnored var client: ReviewerClient
    @ObservationIgnored private let defaults = UserDefaults.standard
    /// The conversations left lately or read ahead, newest last: what a
    /// `ChatSession` opens on while its first snapshot is on its way.
    @ObservationIgnored private var recent: [(id: String, chat: Chat)] = []
    @ObservationIgnored private var prefetches: [String: Task<Void, Never>] = [:]
    @ObservationIgnored private var agentReads: Set<String> = []
    /// The address last followed: the shell reports each move twice, once
    /// as it asks for it and once as the island confirms it.
    @ObservationIgnored private var followedHref: String?

    private static let recentLimit = 24

    private enum Keys {
        static let favorites = "chats.favorites"
        static let lastSession = "chats.lastSession"
        static let composerHeight = "chats.composerHeight"
        static let agents = "chats.agents"
    }

    init(client: ReviewerClient) {
        self.client = client
        let defaults = UserDefaults.standard
        let last = defaults.data(forKey: Keys.lastSession).flatMap { try? JSONDecoder().decode(LastSession.self, from: $0) } ?? LastSession()
        let height = defaults.double(forKey: Keys.composerHeight)
        favorites = defaults.stringArray(forKey: Keys.favorites) ?? []
        agents = (defaults.dictionary(forKey: Keys.agents) as? [String: String] ?? [:])
            .compactMapValues(ChatProviderKind.init(rawValue:))
        lastSession = last
        composerHeight = height > 0 ? height : 92
    }

    // MARK: following the island

    /// The island moved: the shell's page follows, and the conversation
    /// with it — put down when the address goes to another page of the
    /// sessions surface, picked up again from where it was left when the
    /// address comes back to it.
    ///
    /// Gone off the surface altogether — over to Code — the conversation
    /// open is kept as it stands, behind the page (see `ChatPageView`), so
    /// the way back is a page already built rather than a conversation
    /// read and laid out again, message by message, in the frame the
    /// switch is meant to be moving in. Kept behind, it does not take its
    /// thread as read (see `ChatSession.isShown`).
    func follow(href: String) {
        let next = SessionsPage.page(for: href)
        let moved = href != followedHref
        followedHref = href
        page = next
        if moved, next != nil { focusComposer() }
        session?.isShown = next != nil
        guard let next else { return }
        guard case .conversation(let id) = next else {
            putDownSession()
            return
        }
        guard session?.id != id else { return }
        putDownSession()
        let session = ChatSession(id: id, client: client, seed: recent.first { $0.id == id }?.chat)
        session.onListChanged = { [weak self] in self?.onListChanged?() }
        self.session = session
    }

    func focusComposer() {
        composerFocusRequests += 1
    }

    /// Sessions about to be deleted: the open one among them stops
    /// listening first, so the socket the server drops with it does not
    /// read as a lost connection for the moment before the page moves on.
    func letGo(of ids: [String]) {
        guard let session, ids.contains(session.id) else { return }
        session.close()
    }

    private func putDownSession() {
        guard let session else { return }
        if let chat = session.chat { keep(chat, for: session.id) }
        if let provider = session.settings?.provider { agents[session.id] = provider }
        session.close()
        self.session = nil
    }

    /// A row the pointer rests on, read ahead of the click that may follow.
    /// Read again each time rather than only while unknown, since a session
    /// left a while ago may have run since; a read already in flight, or
    /// the conversation already open, is left alone.
    func prefetch(_ id: String) {
        guard session?.id != id, prefetches[id] == nil else { return }
        prefetches[id] = Task { [weak self] in
            if let chat = try? await self?.client.chat(id: id) { self?.keep(chat, for: id) }
            self?.prefetches[id] = nil
        }
    }

    private func keep(_ chat: Chat, for id: String) {
        if agents[id] != chat.provider { agents[id] = chat.provider }
        recent.removeAll { $0.id == id }
        recent.append((id, chat))
        if recent.count > Self.recentLimit { recent.removeFirst() }
    }

    // MARK: agents

    /// The agent a session tab runs on: its conversation's — the open one's
    /// as it stands, switches included the moment they are made, any
    /// other's as last read — or, before its first message, its composer's.
    func agent(of tab: WindowTab) -> ChatProviderKind? {
        guard let chatId = tab.chatId else { return newSessionSettings(forTab: tab.id).provider }
        if session?.id == chatId, let settings = session?.settings { return settings.provider }
        return agents[chatId]
    }

    /// The window's tabs changed: an unsent tab that opened takes the last
    /// session's settings as its own, one that closed or has sent its first
    /// message lets its composer go, and conversations whose agents are not
    /// known yet are read.
    func follow(tabs strip: WindowTabStrip) {
        let unsentIds = Set(strip.sessions.filter { $0.chatId == nil }.map(\.id))
        for id in unsentIds where unsent[id] == nil { unsent[id] = newSessionSettings }
        for id in unsent.keys where !unsentIds.contains(id) {
            unsent.removeValue(forKey: id)
            drafts.removeValue(forKey: Self.newSessionKey(forTab: id))
        }
        learnAgents(of: strip.sessions.compactMap(\.chatId))
    }

    /// Reads the agents of conversations not yet known: the newest page of
    /// the list first, which holds most tabs' sessions, and any it does not
    /// one at a time.
    private func learnAgents(of ids: [String]) {
        let unknown = Set(ids).subtracting(agents.keys).subtracting(agentReads)
        guard !unknown.isEmpty else { return }
        agentReads.formUnion(unknown)
        Task { [weak self, client] in
            let page = try? await client.chats()
            for chat in page?.items ?? [] where unknown.contains(chat.id) {
                self?.agents[chat.id] = chat.provider
            }
            for id in unknown where self?.agents[id] == nil {
                if let chat = try? await client.chat(id: id) { self?.agents[id] = chat.provider }
            }
            self?.agentReads.subtract(unknown)
        }
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

    /// What an unsent tab's composer holds — the last session's settings
    /// for a page the strip has not named a tab for yet.
    func newSessionSettings(forTab tabId: String) -> ChatSettings {
        unsent[tabId] ?? newSessionSettings
    }

    /// An unsent tab's composer changed: the tab's own from now on, and the
    /// next tab's to open on.
    func change(_ settings: ChatSettings, forUnsentTab tabId: String) {
        unsent[tabId] = settings
        remember(settings)
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
        keep(started, for: started.id)
        onListChanged?()
        return started
    }
}
