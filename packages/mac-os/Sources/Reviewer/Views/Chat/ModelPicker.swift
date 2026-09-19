// The composer's model picker — the web `ModelPicker`: a popover with a
// rail of agents down its leading edge (favourites first), a search over
// the models, and the list of them, each row its label over the agent it
// runs on, with a star that keeps it among the favourites. The models are
// whatever each agent's own CLI reported, so a provider's rail is only ever
// that agent's; the favourites rail, empty, falls back to everything so
// the picker never opens onto a blank list.
import SwiftUI

struct ModelPicker: View {
    let catalog: ChatModelCatalog?
    let model: String
    let provider: ChatProviderKind
    let onSelect: (CatalogModel) -> Void
    @Environment(AppModel.self) private var appModel
    @Environment(\.chipSize) private var chipSize
    @State private var open = false
    @State private var rail: Rail = .favorites
    @State private var query = ""

    private enum Rail: Hashable {
        case favorites
        case provider(ChatProviderKind)
    }

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
            HStack(spacing: 0) {
                providerRail
                Divider()
                modelList(models)
            }
            .frame(width: 400, height: 340)
        }
    }

    private var providerRail: some View {
        VStack(spacing: 4) {
            RailButton(selected: rail == .favorites, help: "Favorites") { rail = .favorites } label: {
                Image(systemName: "star.fill")
                    .font(.system(size: 13))
            }
            ForEach(catalog?.providers ?? [], id: \.id) { entry in
                RailButton(selected: rail == .provider(entry.id), help: entry.label) { rail = .provider(entry.id) } label: {
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
            }
            .padding(.horizontal, 10)
            .frame(height: 32)
            Divider()
            if visible.isEmpty {
                Spacer()
                Text(emptyMessage(searching: !needle.isEmpty))
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16)
                Spacer()
            } else {
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
                                starred: favorites.contains(entry.id),
                                onStar: { appModel.chats.toggleFavorite(entry.id) }
                            ) {
                                onSelect(entry)
                                open = false
                            }
                        }
                    }
                    .padding(4)
                }
            }
        }
    }

    private func emptyMessage(searching: Bool) -> String {
        if searching { return "No models match." }
        switch rail {
        case .favorites: return "No models available."
        case .provider(let kind): return "No models reported by \(kind.label) — is its CLI installed?"
        }
    }
}

private struct RailButton<Label: View>: View {
    let selected: Bool
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
            Color.primary.opacity(chosen ? 0.06 : isHovering ? 0.08 : 0),
            in: RoundedRectangle(cornerRadius: 6))
        .onHover { isHovering = $0 }
    }
}
