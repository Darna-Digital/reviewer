// The chat composer — the prompt box over a row of selectors: the model,
// the effort, the access level, the attach button, and send or
// stop at the trailing end. The web `ChatComposer`, drawn natively. The
// row is not fixed: effort and access are what the chosen agent can be
// asked for while running the chosen model (see `ChatCapability`), so an
// agent with no reasoning flag shows no effort menu at all, and picking a
// model moves the settings onto what that model offers in the same patch.
//
// The composer owns only the draft — text and pending images, kept under
// its key in `Chats` so leaving and coming back finds it as it was left;
// the settings are the caller's. Return sends, ⇧Return breaks
// the line — continuing a list when the caret sits in one, as Tab and ⇧Tab
// re-nest it (see `ListEditing`); images are picked, pasted, or dropped
// anywhere on the pane (see `imageDropZone`). The box rests at a few lines
// and is dragged taller by its top edge — a height that is the app's, not
// this thread's.
import AppKit
import SwiftUI
import UniformTypeIdentifiers

struct ChatComposer: View {
    let draftKey: String
    let settings: ChatSettings
    let onSettingsChange: (ChatSettings) -> Void
    let running: Bool
    var onStop: (() -> Void)?
    let placeholder: String
    /// Resolves once the send is accepted; the draft clears only then.
    let onSend: (String, [ComposerAttachment]) async throws -> Void

    @Environment(AppModel.self) private var model
    @State private var sending = false
    @State private var dropTargeted = false
    @FocusState private var focused: Bool

    private static let heights: ClosedRange<CGFloat> = 56...480
    private static let backtab = KeyEquivalent("\u{19}")

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
                    .strokeBorder(highlighted ? Color.accentColor.opacity(0.5) : Color(nsColor: .separatorColor), lineWidth: 1)
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
                    guard !press.modifiers.contains(.shift) else {
                        return editList(ListEditing.continueList) ? .handled : .ignored
                    }
                    submit()
                    return .handled
                }
                // ⇧Tab reaches AppKit as the backtab character, not as Tab
                // with a modifier, so both spellings are listened for.
                .onKeyPress(keys: [.tab, Self.backtab], phases: .down) { press in
                    let levels = press.modifiers.contains(.shift) ? -1 : 1
                    return editList { ListEditing.shiftIndent($0, by: levels) } ? .handled : .ignored
                }
                .onKeyPress(KeyEquivalent("v"), phases: .down) { press in
                    guard press.modifiers == .command else { return .ignored }
                    let pasted = ComposerAttachment.read(pasteboard: .general)
                    guard !pasted.isEmpty else { return .ignored }
                    chats.attach(pasted, to: draftKey)
                    return .handled
                }
        }
        .overlay { PromptDropCatcher(draftKey: draftKey, targeted: $dropTargeted) }
    }

    /// The box answers a drag held over it as it answers the caret, since
    /// the pane's dashed frame steps back while the box owns the drop.
    private var highlighted: Bool { focused || dropTargeted }

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

    /// A list edit on the box's own text view — the `NSTextView` under the
    /// `TextEditor`, which is the first responder while the key is its own.
    /// Rewriting only the span that changed, through the view's own
    /// insertion, keeps ⌘Z undoing the list edit rather than the whole
    /// draft, and leaves the binding to hear about it as it does any typing.
    /// False when the caret is not in a list, so the key does what it always
    /// did.
    private func editList(_ edit: (ComposerSelection) -> ComposerSelection?) -> Bool {
        guard let textView = NSApp.keyWindow?.firstResponder as? NSTextView else { return false }
        let selected = textView.selectedRange()
        let current = ComposerSelection(
            text: textView.string, selectionStart: selected.location, selectionEnd: selected.location + selected.length)
        guard let edited = edit(current) else { return false }
        let change = ListEditing.changedRange(from: current.text, to: edited.text)
        textView.insertText(change.replacement, replacementRange: change.range)
        textView.setSelectedRange(NSRange(location: edited.selectionStart, length: edited.selectionEnd - edited.selectionStart))
        textView.scrollRangeToVisible(textView.selectedRange())
        return true
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

/// The prompt box's own drop target, in front of the box rather than behind
/// it. AppKit offers a drag to the view under the pointer and then up its
/// ancestors, and the `NSTextView` a `TextEditor` is made of registers for
/// files and bitmaps so it can take them as inline attachments — the pane's
/// drop zone (see `ImageDropZone`) is a sibling of the box, not an ancestor,
/// so the obvious place to let a photo go is the one place the drop would
/// otherwise be swallowed. The view is hit only while a drag from outside
/// the app is over it (see `PromptDropCatcherView.hitTest`), so the box
/// below still types, selects and scrolls.
private struct PromptDropCatcher: NSViewRepresentable {
    let draftKey: String
    @Binding var targeted: Bool
    @Environment(AppModel.self) private var model

    func makeNSView(context: Context) -> PromptDropCatcherView {
        let view = PromptDropCatcherView()
        configure(view)
        return view
    }

    func updateNSView(_ nsView: PromptDropCatcherView, context: Context) {
        configure(nsView)
    }

    private func configure(_ view: PromptDropCatcherView) {
        let chats = model.chats
        let key = draftKey
        view.onAttach = { chats.attach($0, to: key) }
        view.onTarget = { targeted = $0 }
    }
}

final class PromptDropCatcherView: NSView {
    var onAttach: (([ComposerAttachment]) -> Void)?
    var onTarget: ((Bool) -> Void)?

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        registerForDraggedTypes([.fileURL, .png, .tiff])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("PromptDropCatcherView is not made from a nib") }

    /// Hit for a drag from another app and nothing else: the pointer's
    /// button is held, but the press was never this app's to see — a click
    /// on the box, or a drag of its own text, is answered while that press
    /// is the current event, and passes through to the box.
    override func hitTest(_ point: NSPoint) -> NSView? {
        guard Self.outsideDragInProgress, bounds.contains(convert(point, from: superview)) else { return nil }
        return self
    }

    private static var outsideDragInProgress: Bool {
        let buttonHeld = NSEvent.pressedMouseButtons & 1 != 0
        let pressedHere = [.leftMouseDown, .leftMouseDragged].contains(NSApp.currentEvent?.type)
        return buttonHeld && !pressedHere
    }

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        let operation = self.operation(for: sender)
        onTarget?(operation == .copy)
        return operation
    }

    override func draggingUpdated(_ sender: NSDraggingInfo) -> NSDragOperation {
        operation(for: sender)
    }

    override func draggingExited(_ sender: NSDraggingInfo?) {
        onTarget?(false)
    }

    override func draggingEnded(_ sender: NSDraggingInfo) {
        onTarget?(false)
    }

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        let attachments = ComposerAttachment.read(pasteboard: sender.draggingPasteboard)
        guard !attachments.isEmpty else { return false }
        onAttach?(attachments)
        return true
    }

    /// Answered from the types on the pasteboard alone — reading the images
    /// themselves is the drop's work, not the hover's.
    private func operation(for sender: NSDraggingInfo) -> NSDragOperation {
        let pasteboard = sender.draggingPasteboard
        let carriesFiles = pasteboard.canReadObject(forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true])
        let carriesBitmaps = pasteboard.availableType(from: [.png, .tiff]) != nil
        return carriesFiles || carriesBitmaps ? .copy : []
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

    /// A dropped file first, then the image the drag carries in its own
    /// right — a drag off a web page or out of the photo library offers
    /// bitmaps without a file behind them, and a dragged file that turns out
    /// not to be an image still leaves the bitmaps worth trying.
    private static func read(_ provider: NSItemProvider) async -> ComposerAttachment? {
        if let url = await provider.fileURL, let attachment = ComposerAttachment.read(url: url) {
            return attachment
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
    /// A drag's file, whichever of the two shapes the promise resolves to.
    @MainActor
    var fileURL: URL? {
        get async {
            guard hasItemConformingToTypeIdentifier(UTType.fileURL.identifier),
                let item = try? await loadItem(forTypeIdentifier: UTType.fileURL.identifier)
            else { return nil }
            if let url = item as? URL { return url }
            guard let data = item as? Data else { return nil }
            return URL(dataRepresentation: data, relativeTo: nil)
        }
    }

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
