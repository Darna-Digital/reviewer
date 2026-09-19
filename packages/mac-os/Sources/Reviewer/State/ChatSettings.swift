// What the composer may offer for a chat, and how each choice reads — the
// core's `chats.capabilities` and the SPA's `chat-capability.functions`,
// mirrored: the effort levels and the access tiers the chosen agent can be
// driven at while running the chosen model. The three selectors under the
// prompt box are not one fixed row but a question asked of the CLI about to
// be spawned — cursor has no reasoning flag, opencode names its levels per
// model, codex reports a slice of them for each — so the levels come from
// the catalog the server discovered, and this decides what to do with them.
// Access is the other way round: the three tiers are ours, and an agent
// that cannot tell two of them apart offers only the ones it can.
import Foundation

/// The composer's settings for a chat — what the picker and the menus edit.
struct ChatSettings: Hashable, Sendable {
    var provider: ChatProviderKind
    var model: String
    var effort: String
    var access: ChatAccess

    init(provider: ChatProviderKind, model: String, effort: String, access: ChatAccess) {
        self.provider = provider
        self.model = model
        self.effort = effort
        self.access = access
    }

    init(of chat: Chat) {
        self.init(provider: chat.provider, model: chat.model, effort: chat.effort, access: chat.access)
    }
}

/// The levels and tiers on offer for one provider running one model.
struct ChatCapabilities: Hashable, Sendable {
    /// Empty means the agent decides — no flag is sent and no menu is shown.
    let efforts: [String]
    let access: [ChatAccess]
}

enum ChatCapability {
    /// Effort levels in ascending order — every vocabulary reviewer has seen —
    /// so a chat moved onto a model can be snapped to the nearest level it
    /// does offer. A level from a CLI not in here ranks after the last.
    static let effortOrder = ["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"]

    private static let claudeEfforts = ["low", "medium", "high"]
    private static let codexEfforts = ["low", "medium", "high"]
    private static let accessOrder: [ChatAccess] = [.supervised, .acceptEdits, .fullAccess]

    static func effortRank(_ effort: String) -> Int {
        effortOrder.firstIndex(of: effort) ?? effortOrder.count
    }

    /// The tier `access` really runs at on `provider`: cursor's one switch
    /// makes "auto-accept edits" full access, opencode's makes it supervised.
    static func resolveAccess(_ provider: ChatProviderKind, _ access: ChatAccess) -> ChatAccess {
        switch (provider, access) {
        case (.cursor, .acceptEdits): return .fullAccess
        case (.opencode, .acceptEdits): return .supervised
        default: return access
        }
    }

    /// The tiers `provider` can tell apart, in order.
    static func accessTiers(_ provider: ChatProviderKind) -> [ChatAccess] {
        accessOrder.filter { resolveAccess(provider, $0) == $0 }
    }

    static func capabilities(provider: ChatProviderKind, model: ChatModel?) -> ChatCapabilities {
        let discovered = model?.efforts.flatMap { $0.isEmpty ? nil : $0 }
        let efforts: [String]
        switch provider {
        case .claude: efforts = claudeEfforts
        case .codex: efforts = discovered ?? codexEfforts
        case .opencode: efforts = discovered ?? []
        case .cursor: efforts = []
        }
        return ChatCapabilities(efforts: efforts, access: accessTiers(provider))
    }

    static func capabilities(in catalog: ChatModelCatalog?, provider: ChatProviderKind, model: String) -> ChatCapabilities {
        capabilities(provider: provider, model: catalog?.model(provider: provider, id: model))
    }

    /// The level to run at when `effort` is not on offer: the closest one that
    /// is, ties going to the deeper level. Nil when nothing is on offer.
    static func nearestEffort(in efforts: [String], to effort: String) -> String? {
        if efforts.contains(effort) { return effort }
        let wanted = effortRank(effort)
        return efforts.reduce(nil as String?) { best, candidate in
            guard let best else { return candidate }
            let gap = abs(effortRank(candidate) - wanted)
            let bestGap = abs(effortRank(best) - wanted)
            if gap != bestGap { return gap < bestGap ? candidate : best }
            return effortRank(candidate) > effortRank(best) ? candidate : best
        }
    }

    /// `settings` as the chosen agent can actually be run: an effort it
    /// offers (or none), and the tier it can tell apart.
    static func within(_ capabilities: ChatCapabilities, _ settings: ChatSettings) -> ChatSettings {
        var fitted = settings
        fitted.effort = nearestEffort(in: capabilities.efforts, to: settings.effort) ?? ""
        fitted.access = resolveAccess(settings.provider, settings.access)
        return fitted
    }
}

/// One model as the picker lists it, flattened out of its provider.
struct CatalogModel: Identifiable, Hashable, Sendable {
    let id: String
    let label: String
    let provider: ChatProviderKind
    let providerLabel: String
    let group: String?

    /// Two providers can list a model under the same id.
    var key: String { "\(provider.rawValue):\(id)" }
}

extension ChatModelCatalog {
    var models: [CatalogModel] {
        providers.flatMap { provider in
            provider.models.map {
                CatalogModel(id: $0.id, label: $0.label, provider: provider.id, providerLabel: provider.label, group: $0.group)
            }
        }
    }

    func model(provider: ChatProviderKind, id: String) -> ChatModel? {
        providers.first { $0.id == provider }?.models.first { $0.id == id }
    }

    /// The model a fresh composer starts on: the first favourite in catalog
    /// order, else the first model.
    func preferredModel(favorites: [String]) -> CatalogModel? {
        models.first { favorites.contains($0.id) } ?? models.first
    }
}

/// One choice in a selector — effort, mode, access — with the line that
/// says what choosing it does, since a single word does not.
struct SelectorOption<Value: Hashable>: Identifiable, Hashable {
    let value: Value
    let label: String
    let hint: String
    let symbol: String

    var id: Value { value }
}

enum EffortCopy {
    private static let copy: [String: (label: String, hint: String, symbol: String)] = [
        "none": ("None", "Answer without reasoning first", "minus.circle"),
        "minimal": ("Minimal", "Barely stops to think", "dial.low"),
        "low": ("Low", "Fast, light reasoning", "dial.low.fill"),
        "medium": ("Medium", "Balanced reasoning", "dial.medium.fill"),
        "high": ("High", "Deep reasoning", "dial.high.fill"),
        "xhigh": ("Extra high", "Deeper still, and slower", "gauge.with.dots.needle.100percent"),
        "max": ("Max", "As far as this model goes", "flame"),
        "ultra": ("Ultra", "The longest this model will think", "flame.fill"),
    ]

    static func label(_ effort: String) -> String {
        copy[effort]?.label ?? effort.prefix(1).uppercased() + effort.dropFirst()
    }

    static func symbol(_ effort: String) -> String {
        copy[effort]?.symbol ?? "dial.medium"
    }

    /// The effort menu for a set of levels, shallowest first.
    static func options(_ efforts: [String]) -> [SelectorOption<String>] {
        efforts.sorted { ChatCapability.effortRank($0) < ChatCapability.effortRank($1) }.map {
            SelectorOption(value: $0, label: label($0), hint: copy[$0]?.hint ?? "", symbol: symbol($0))
        }
    }
}

enum AccessCopy {
    static func option(_ access: ChatAccess) -> SelectorOption<ChatAccess> {
        switch access {
        case .supervised:
            return SelectorOption(value: access, label: "Supervised", hint: "Refuse gated commands and edits", symbol: "lock")
        case .acceptEdits:
            return SelectorOption(value: access, label: "Auto-accept edits", hint: "Edit files freely, gate commands", symbol: "square.and.pencil")
        case .fullAccess:
            return SelectorOption(value: access, label: "Full access", hint: "Commands and edits without prompts", symbol: "lock.open")
        }
    }

    static func options(_ tiers: [ChatAccess]) -> [SelectorOption<ChatAccess>] {
        tiers.map(option)
    }
}

extension ChatProviderKind {
    var label: String {
        switch self {
        case .claude: return "Claude"
        case .codex: return "Codex"
        case .opencode: return "opencode"
        case .cursor: return "Cursor"
        }
    }
}
