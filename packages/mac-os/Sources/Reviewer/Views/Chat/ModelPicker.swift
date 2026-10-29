// The composer's model picker — the web `ModelPicker`: a popover with a
// rail of agents down its leading edge (favourites first), a search over
// the models, and the list of them, each row its label over the agent it
// runs on, with a star that keeps it among the favourites. The models are
// whatever each agent's own CLI reported, so a provider's rail is only ever
// that agent's; the favourites rail, empty, falls back to everything so
// the picker never opens onto a blank list. The keys walk it as two
// columns: ↑/↓ walk the models and Return picks; ← — once the caret is at
// the start of the search — crosses to the rail, where ↑/↓ walk the
// agents, the list following, and → or Return cross back.
import SwiftUI

struct ModelPicker: View {
    let catalog: ChatModelCatalog?
    let model: String
    let provider: ChatProviderKind
    let onSelect: (CatalogModel) -> Void
    @Environment(\.chipSize) private var chipSize
    @State private var open = false
    @State private var rail: ModelRail = .favorites
    @State private var query = ""

    var body: some View {
        let models = catalog?.models ?? []
        let current = models.first { $0.id == model && $0.provider == provider } ?? models.first { $0.id == model }
        Button { open.toggle() } label: {
            HStack(spacing: 5) {
                AgentGlyph(kind: current?.provider ?? provider, size: chipSize.glyph)
                Text(current?.label ?? (model.isEmpty ? "Model" : model))
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.system(size: chipSize.chevron, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
        }
        .buttonStyle(ComposerChipStyle())
        .help("Choose model")
        .popover(isPresented: $open, arrowEdge: .bottom) {
            ModelPopover(catalog: catalog, model: model, provider: provider, rail: $rail, query: $query) { chosen in
                onSelect(chosen)
                open = false
            }
        }
        .closesOnNavigation($open)
    }
}

private enum ModelRail: Hashable {
    case favorites
    case provider(ChatProviderKind)
}

/// The column the keys are in.
private enum ModelColumn {
    case rail
    case list
}

/// The popover's content, a view of its own so the focus it asks for is
/// asked from inside the popover: a `@FocusState` held by the chip, out in
/// the composer, cannot move the keyboard into the popover's window, and
/// the composer's prompt kept it — and the arrows with it. The rail and
/// the search are the chip's, so the picker opens where it was left.
private struct ModelPopover: View {
    let catalog: ChatModelCatalog?
    let model: String
    let provider: ChatProviderKind
    @Binding var rail: ModelRail
    @Binding var query: String
    let pick: (CatalogModel) -> Void
    @Environment(AppModel.self) private var appModel
    @State private var active: Int? = 0
    @State private var column: ModelColumn = .list
    @FocusState private var fieldFocused: Bool

    var body: some View {
        HStack(spacing: 0) {
            providerRail
            ThemedDivider()
            modelList(catalog?.models ?? [])
        }
        .frame(width: 400, height: 340)
        .onChange(of: query) {
            active = 0
            column = .list
        }
        .onChange(of: rail) { active = 0 }
        .onAppear { Task { @MainActor in fieldFocused = true } }
    }

    private var rails: [ModelRail] {
        [.favorites] + (catalog?.providers ?? []).map { .provider($0.id) }
    }

    /// The keys beyond the list's own: in the rail, ↑/↓ walk the agents and
    /// → or Return go back to the models; in the list, ← at the start of
    /// the search crosses to the rail.
    private func take(_ press: PopoverKeyPress) -> Bool {
        switch column {
        case .list:
            guard press.key == .left, press.caretAtStart else { return false }
            column = .rail
        case .rail:
            switch press.key {
            case .up: stepRail(by: -1)
            case .down: stepRail(by: 1)
            case .home: rail = .favorites
            case .end: rail = rails.last ?? .favorites
            case .right, .enter:
                column = .list
                active = 0
            case .left: break
            case .escape, .delete: return false
            }
        }
        return true
    }

    private func stepRail(by offset: Int) {
        let rails = rails
        guard let index = walkedRow(from: rails.firstIndex(of: rail), by: offset, in: rails.count) else { return }
        rail = rails[index]
    }

    private var providerRail: some View {
        VStack(spacing: 4) {
            RailButton(selected: rail == .favorites, keyed: column == .rail, help: "Favorites") { rail = .favorites } label: {
                Image(systemName: "star.fill")
                    .font(.system(size: 13))
            }
            ForEach(catalog?.providers ?? [], id: \.id) { entry in
                RailButton(selected: rail == .provider(entry.id), keyed: column == .rail, help: entry.label) {
                    rail = .provider(entry.id)
                } label: {
                    AgentGlyph(kind: entry.id, size: 16)
                }
            }
            Spacer()
        }
        .padding(8)
    }

    private func modelList(_ models: [CatalogModel]) -> some View {
        let favorites = appModel.chats.favorites
        let inRail: [CatalogModel]
        switch rail {
        case .favorites:
            let starred = models.filter { favorites.contains($0.id) }
            inRail = starred.isEmpty ? models : starred
        case .provider(let kind):
            inRail = models.filter { $0.provider == kind }
        }
        let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
        let visible = needle.isEmpty ? inRail : inRail.filter { $0.label.lowercased().contains(needle) }
        return VStack(spacing: 0) {
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.secondary)
                TextField("Search models…", text: $query)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12))
                    .focused($fieldFocused)
                    .autocorrectionDisabled()
            }
            .padding(.horizontal, 10)
            .frame(height: 32)
            ThemedDivider()
            if visible.isEmpty {
                Spacer()
                Text(emptyMessage(searching: !needle.isEmpty))
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16)
                Spacer()
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 1) {
                            ForEach(Array(visible.enumerated()), id: \.element.key) { index, entry in
                                if let group = entry.group, index == 0 || visible[index - 1].group != group {
                                    Text(group)
                                        .font(.system(size: 10, weight: .semibold))
                                        .foregroundStyle(.secondary)
                                        .padding(.horizontal, 8)
                                        .padding(.top, index == 0 ? 4 : 8)
                                        .padding(.bottom, 2)
                                }
                                ModelRow(
                                    entry: entry, chosen: entry.id == model && entry.provider == provider,
                                    lit: column == .list && active == index, starred: favorites.contains(entry.id),
                                    onStar: { appModel.chats.toggleFavorite(entry.id) }
                                ) {
                                    pick(at: index, in: visible)
                                }
                                .id(entry.key)
                            }
                        }
                        .padding(4)
                    }
                    .onChange(of: active) { _, index in
                        guard let index, visible.indices.contains(index) else { return }
                        proxy.scrollTo(visible[index].key)
                    }
                }
            }
        }
        .popoverListKeys(active: $active, count: visible.count, pick: { pick(at: $0, in: visible) }, also: take)
    }

    private func pick(at index: Int?, in visible: [CatalogModel]) {
        guard let index, visible.indices.contains(index) else { return }
        pick(visible[index])
    }

    private func emptyMessage(searching: Bool) -> String {
        if searching { return "No models match." }
        switch rail {
        case .favorites: return "No models available."
        case .provider(let kind): return "No models reported by \(kind.label) — is its CLI installed?"
        }
    }
}

/// One agent on the rail. While the keys are in the rail the selected one
/// wears the accent's ring, so it is plain which column ↑/↓ will walk.
private struct RailButton<Label: View>: View {
    let selected: Bool
    let keyed: Bool
    let help: String
    let action: () -> Void
    @ViewBuilder let label: Label
    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            label
                .foregroundStyle(selected ? Color.primary : Color.secondary)
                .frame(width: 34, height: 34)
                .background(
                    Color.primary.opacity(selected ? 0.1 : isHovering ? 0.06 : 0),
                    in: RoundedRectangle(cornerRadius: 8))
                .overlay {
                    if selected && keyed {
                        RoundedRectangle(cornerRadius: 8)
                            .strokeBorder(Color(nsColor: IslandPalette.accent), lineWidth: 1.5)
                    }
                }
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
        .help(help)
    }
}

private struct ModelRow: View {
    let entry: CatalogModel
    let chosen: Bool
    let lit: Bool
    let starred: Bool
    let onStar: () -> Void
    let action: () -> Void
    @State private var isHovering = false

    var body: some View {
        HStack(spacing: 8) {
            Button(action: action) {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 5) {
                        Text(entry.label)
                            .font(.system(size: 13, weight: .medium))
                            .lineLimit(1)
                        if chosen {
                            Image(systemName: "checkmark")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(Color.accentColor)
                        }
                    }
                    HStack(spacing: 4) {
                        AgentGlyph(kind: entry.provider, size: 10)
                        Text(entry.providerLabel)
                    }
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            Button(action: onStar) {
                Image(systemName: starred ? "star.fill" : "star")
                    .font(.system(size: 11))
                    .foregroundStyle(starred ? Color.yellow : Color.secondary)
            }
            .buttonStyle(.plain)
            .opacity(starred || isHovering ? 1 : 0)
            .help(starred ? "Unstar model" : "Star model")
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(
            Color.primary.opacity(lit ? 0.1 : isHovering ? 0.08 : chosen ? 0.06 : 0),
            in: RoundedRectangle(cornerRadius: 6))
        .onHover { isHovering = $0 }
    }
}
