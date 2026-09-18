// The chat composer — the prompt box over a row of selectors: the model,
// the effort, the mode, the access level, the attach button, and send or
// stop at the trailing end. The web `ChatComposer`, drawn natively. The
// row is not fixed: effort and access are what the chosen agent can be
// asked for while running the chosen model (see `ChatCapability`), so an
// agent with no reasoning flag shows no effort menu at all, and picking a
// model moves the settings onto what that model offers in the same patch.
//
// The composer owns only the draft — text and pending images, kept under
// its key in `Chats` so leaving and coming back finds it as it was left;
// the settings and the mode are the caller's. Return sends, ⇧Return breaks
// the line; images are picked, pasted, or dropped anywhere on the pane
// (see `imageDropZone`). The box rests at a few lines and is dragged taller
// by its top edge — a height that is the app's, not this thread's.
import AppKit
import SwiftUI
import UniformTypeIdentifiers

struct ChatComposer: View {
    let draftKey: String
    let settings: ChatSettings
    let onSettingsChange: (ChatSettings) -> Void
    let mode: ChatMode
    let onModeChange: (ChatMode) -> Void
    let running: Bool
    var onStop: (() -> Void)?
    let placeholder: String
    /// Resolves once the send is accepted; the draft clears only then.
    let onSend: (String, [ComposerAttachment]) async throws -> Void

    @Environment(AppModel.self) private var model
    @State private var sending = false
    @FocusState private var focused: Bool

    private static let heights: ClosedRange<CGFloat> = 56...480

    private var chats: Chats { model.chats }
    private var draft: ComposerDraft { chats.draft(for: draftKey) }

    private var text: Binding<String> {
        Binding(
            get: { chats.draft(for: draftKey).text },
            set: { value in
                var draft = chats.draft(for: draftKey)
                draft.text = value
                chats.setDraft(draft, for: draftKey)
            })
    }

    var body: some View {
        let capabilities = ChatCapability.capabilities(in: chats.catalog, provider: settings.provider, model: settings.model)
        let efforts = EffortCopy.options(capabilities.efforts)
        VStack(spacing: 0) {
            ComposerResizeHandle(height: Binding(get: { chats.composerHeight }, set: { chats.composerHeight = $0 }), range: Self.heights)
            VStack(alignment: .leading, spacing: 0) {
                if !draft.attachments.isEmpty {
                    AttachmentGrid {
                        ForEach(draft.attachments) { attachment in
                            AttachmentChip(attachment: attachment) { remove(attachment) }
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.top, 12)
                }
                prompt
                    .frame(height: chats.composerHeight)
                HStack(spacing: 2) {
                    ModelPicker(catalog: chats.catalog, model: settings.model, provider: settings.provider) { choose(model: $0) }
                    ComposerDivider()
                    if !efforts.isEmpty {
                        SelectorPopover(options: efforts, value: settings.effort, help: "Reasoning effort") { effort in
                            var next = settings
                            next.effort = effort
                            onSettingsChange(next)
                        }
                        ComposerDivider()
                    }
                    SelectorPopover(options: ChatMode.options, value: mode, help: "Session mode", onSelect: onModeChange)
                    ComposerDivider()
                    SelectorPopover(options: AccessCopy.options(capabilities.access), value: settings.access, help: "Access level") { access in
                        var next = settings
                        next.access = access
                        onSettingsChange(next)
                    }
                    ComposerDivider()
                    Button(action: pickImages) {
                        Image(systemName: "photo.badge.plus")
                            .font(.system(size: 12))
                            .foregroundStyle(.secondary)
                            .frame(width: 22)
                    }
                    .buttonStyle(ComposerChipStyle())
                    .help("Attach images")
                    Spacer(minLength: 4)
                    if running, let onStop {
                        Button(action: onStop) {
                            Image(systemName: "stop.fill")
                                .font(.system(size: 10, weight: .bold))
                                .frame(width: 26, height: 26)
                                .background(.quaternary, in: Circle())
                        }
                        .buttonStyle(.plain)
                        .help("Stop generation")
                    }
                    Button(action: submit) {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 26, height: 26)
                            .background(canSend ? Color.accentColor : Color.secondary.opacity(0.4), in: Circle())
                    }
                    .buttonStyle(.plain)
                    .disabled(!canSend)
                    .help("Send message (↩)")
                }
                .padding(.horizontal, 8)
                .padding(.bottom, 8)
            }
            .background(Color(nsColor: IslandPalette.island), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(focused ? Color.accentColor.opacity(0.5) : Color(nsColor: .separatorColor), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.06), radius: 4, y: 1)
        }
        .onAppear { focused = true }
    }

    private var prompt: some View {
        ZStack(alignment: .topLeading) {
            if text.wrappedValue.isEmpty {
                Text(placeholder)
                    .font(.system(size: 13))
                    .foregroundStyle(.tertiary)
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .allowsHitTesting(false)
            }
            TextEditor(text: text)
                .font(.system(size: 13))
                .scrollContentBackground(.hidden)
                .scrollIndicators(.never)
                .padding(.horizontal, 11)
                .padding(.top, 12)
                .focused($focused)
                .onKeyPress(.return, phases: .down) { press in
                    guard !press.modifiers.contains(.shift) else { return .ignored }
                    submit()
                    return .handled
                }
                .onKeyPress(KeyEquivalent("v"), phases: .down) { press in
                    guard press.modifiers == .command else { return .ignored }
                    let pasted = ComposerAttachment.read(pasteboard: .general)
                    guard !pasted.isEmpty else { return .ignored }
                    chats.attach(pasted, to: draftKey)
                    return .handled
                }
        }
    }

    /// A send while a turn is running is accepted, not blocked: the server
    /// queues the message for when the turn settles.
    private var canSend: Bool {
        !sending && !draft.isEmpty
    }

    /// One patch, not two: the model and the settings it drags with it go
    /// together, so a chat is never briefly on a model at an effort it
    /// does not take.
    private func choose(model chosen: CatalogModel) {
        var next = settings
        next.model = chosen.id
        next.provider = chosen.provider
        onSettingsChange(
            ChatCapability.within(
                ChatCapability.capabilities(in: chats.catalog, provider: chosen.provider, model: chosen.id), next))
    }

    private func remove(_ attachment: ComposerAttachment) {
        var draft = draft
        draft.attachments.removeAll { $0.id == attachment.id }
        chats.setDraft(draft, for: draftKey)
    }

    private func pickImages() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.image]
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = false
        panel.prompt = "Attach"
        guard panel.runModal() == .OK else { return }
        chats.attach(panel.urls.compactMap(ComposerAttachment.read(url:)), to: draftKey)
    }

    /// The draft delivered: cleared once the send is accepted, kept for a
    /// retry when it is not — the caller has already said why.
    private func submit() {
        guard canSend else { return }
        let sent = draft
        sending = true
        Task {
            defer {
                sending = false
                focused = true
            }
            do {
                try await onSend(sent.text, sent.attachments)
                var remaining = chats.draft(for: draftKey)
                if remaining.text == sent.text { remaining.text = "" }
                remaining.attachments.removeAll { attachment in sent.attachments.contains { $0.id == attachment.id } }
                chats.setDraft(remaining, for: draftKey)
            } catch {}
        }
    }
}

private struct ComposerDivider: View {
    var body: some View {
        Rectangle()
            .fill(Color(nsColor: .separatorColor))
            .frame(width: 1, height: 14)
            .padding(.horizontal, 2)
    }
}

/// The top edge of the prompt box, pulled to make the box taller: a thin
/// strip above the sheet with the resize cursor over it.
private struct ComposerResizeHandle: View {
    @Binding var height: CGFloat
    let range: ClosedRange<CGFloat>
    @State private var startHeight: CGFloat?

    var body: some View {
        Color.clear
            .frame(height: 8)
            .contentShape(Rectangle())
            .onHover { hovering in
                if hovering { NSCursor.resizeUpDown.push() } else { NSCursor.pop() }
            }
            .gesture(
                DragGesture(minimumDistance: 1, coordinateSpace: .global)
                    .onChanged { drag in
                        let start = startHeight ?? height
                        startHeight = start
                        height = min(range.upperBound, max(range.lowerBound, start - drag.translation.height))
                    }
                    .onEnded { _ in startHeight = nil }
            )
            .accessibilityLabel("Resize the message box")
    }
}

/// The whole pane as a drop target for images, so a file can be let go
/// anywhere in the conversation and still arrive as a chip on the box.
private struct ImageDropZone: ViewModifier {
    let draftKey: String
    @Environment(AppModel.self) private var model
    @State private var targeted = false

    func body(content: Content) -> some View {
        content
            .onDrop(of: [.fileURL, .image], isTargeted: $targeted) { providers in
                let key = draftKey
                let chats = model.chats
                Task {
                    var attachments: [ComposerAttachment] = []
                    for provider in providers {
                        if let attachment = await Self.read(provider) { attachments.append(attachment) }
                    }
                    chats.attach(attachments, to: key)
                }
                return true
            }
            .overlay {
                if targeted {
                    RoundedRectangle(cornerRadius: IslandMetrics.radius, style: .continuous)
                        .strokeBorder(Color.accentColor, style: StrokeStyle(lineWidth: 2, dash: [8, 6]))
                        .background(Color.accentColor.opacity(0.05), in: RoundedRectangle(cornerRadius: IslandMetrics.radius, style: .continuous))
                        .overlay {
                            Label("Drop images to attach", systemImage: "photo.badge.plus")
                                .font(.system(size: 13, weight: .medium))
                                .padding(.horizontal, 14)
                                .padding(.vertical, 8)
                                .background(.regularMaterial, in: Capsule())
                        }
                        .allowsHitTesting(false)
                }
            }
    }

    private static func read(_ provider: NSItemProvider) async -> ComposerAttachment? {
        if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
            let item = try? await provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier)
            guard let data = item as? Data, let url = URL(dataRepresentation: data, relativeTo: nil) else { return nil }
            return ComposerAttachment.read(url: url)
        }
        guard let type = provider.registeredTypeIdentifiers.compactMap(UTType.init).first(where: { $0.conforms(to: .image) }) else {
            return nil
        }
        guard let data = try? await provider.loadDataRepresentation(for: type) else { return nil }
        let name = "Dropped image.\(type.preferredFilenameExtension ?? "png")"
        return ComposerAttachment.read(bytes: data, name: name, type: type)
    }
}

extension View {
    func imageDropZone(draftKey: String) -> some View {
        modifier(ImageDropZone(draftKey: draftKey))
    }
}

private extension NSItemProvider {
    @MainActor
    func loadDataRepresentation(for type: UTType) async throws -> Data {
        try await withCheckedThrowingContinuation { continuation in
            _ = loadDataRepresentation(for: type) { data, error in
                if let data {
                    continuation.resume(returning: data)
                } else {
                    continuation.resume(throwing: error ?? CocoaError(.fileReadUnknown))
                }
            }
        }
    }
}
