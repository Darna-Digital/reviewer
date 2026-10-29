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
// and is dragged taller by its top edge, up to most of the window — a height
// that is the app's, not this thread's.
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
    @State private var selection: TextSelection?
    /// The length of the last paste turned away for not fitting, shown
    /// for a moment in place of the count.
    @State private var refusedPaste: Int?
    @FocusState private var focused: Bool

    private static let minHeight: CGFloat = 56
    /// The share of the window the prompt may be pulled up to — the web
    /// composer's ceiling, so a long draft can take most of the pane.
    private static let maxWindowShare: CGFloat = 0.6
    private static let backtab = KeyEquivalent("\u{19}")
    private static let maxLength = ComposerDraft.maxTextLength
    /// How full the draft gets before the count shows beside send.
    private static let countShownFrom = maxLength * 4 / 5

    private var chats: Chats { model.chats }
    private var draft: ComposerDraft { chats.draft(for: draftKey) }

    private var text: Binding<String> {
        Binding(
            get: { chats.draft(for: draftKey).text },
            set: { value in
                var draft = chats.draft(for: draftKey)
                draft.text = value.count > Self.maxLength ? String(value.prefix(Self.maxLength)) : value
                chats.setDraft(draft, for: draftKey)
            })
    }

    var body: some View {
        let capabilities = ChatCapability.capabilities(in: chats.catalog, provider: settings.provider, model: settings.model)
        let efforts = EffortCopy.options(capabilities.efforts)
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
                if let notice = lengthNotice {
                    Text(notice.text)
                        .font(.system(size: 11))
                        .monospacedDigit()
                        .lineLimit(1)
                        .foregroundStyle(notice.atLimit ? Color.red : Color.secondary)
                        .padding(.trailing, 4)
                }
                if running, let onStop {
                    Button(action: onStop) {
                        Image(systemName: "stop.fill")
                            .font(.system(size: 10, weight: .bold))
                            .frame(width: 26, height: 26)
                            .background(.quaternaryWash(), in: Circle())
                    }
                    .buttonStyle(.plain)
                    .help("Stop generation")
                }
                Button(action: submit) {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 26, height: 26)
                        .background(canSend ? Color(nsColor: IslandPalette.accent) : Color.secondary.opacity(0.4), in: Circle())
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
                .strokeBorder(focused ? Color(nsColor: IslandPalette.accent).opacity(0.5) : Color(nsColor: IslandPalette.separator), lineWidth: 1)
        )
        .overlay(alignment: .top) {
            ComposerResizeHandle(
                height: Binding(get: { chats.composerHeight }, set: { chats.composerHeight = $0 }),
                minHeight: Self.minHeight, maxWindowShare: Self.maxWindowShare)
        }
        .shadow(color: .black.opacity(0.06), radius: 4, y: 1)
        .onAppear { focused = true }
        .task(id: refusedPaste) {
            guard refusedPaste != nil else { return }
            try? await Task.sleep(for: .seconds(4))
            refusedPaste = nil
        }
    }

    private var prompt: some View {
        ZStack(alignment: .topLeading) {
            if text.wrappedValue.isEmpty {
                Text(placeholder)
                    .font(.system(size: ChatLayout.bodySize))
                    .foregroundStyle(.tertiary)
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .allowsHitTesting(false)
            }
            TextEditor(text: text, selection: $selection)
                .font(.system(size: ChatLayout.bodySize))
                .lineSpacing(ChatLayout.bodyMetrics.leading)
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
                    if !pasted.isEmpty {
                        chats.attach(pasted, to: draftKey)
                        return .handled
                    }
                    return refuseOversizedPaste() ? .handled : .ignored
                }
        }
    }

    /// A send while a turn is running is accepted, not blocked: the server
    /// queues the message for when the turn settles.
    private var canSend: Bool {
        !sending && !draft.isEmpty
    }

    /// The count once the draft nears the cap, or why the last paste was
    /// turned away.
    private var lengthNotice: (text: String, atLimit: Bool)? {
        if let refusedPaste {
            return ("Paste of \(refusedPaste.formatted()) characters is over the \(Self.maxLength.formatted()) limit", true)
        }
        let count = draft.text.count
        guard count >= Self.countShownFrom else { return nil }
        return ("\(count.formatted()) / \(Self.maxLength.formatted())", count >= Self.maxLength)
    }

    /// A paste that would push the draft past the cap is turned away whole
    /// rather than cut short — half an SVG is no use to anyone. The clamp
    /// in the text binding still catches text that arrives any other way.
    private func refuseOversizedPaste() -> Bool {
        guard let pasted = NSPasteboard.general.string(forType: .string) else { return false }
        let current = text.wrappedValue
        let replaced = current[selectedRange(in: current)].count
        guard current.count - replaced + pasted.count > Self.maxLength else { return false }
        NSSound.beep()
        refusedPaste = pasted.count
        return true
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

    /// A list edit on the draft, through the editor's own text and
    /// selection bindings — the `NSTextView` under a `TextEditor` drops a
    /// programmatic insertion on the next render, so the rewrite goes in the
    /// way SwiftUI expects. False when the caret is not in a list, so the key
    /// does what it always did.
    private func editList(_ edit: (ComposerSelection) -> ComposerSelection?) -> Bool {
        let current = text.wrappedValue
        let range = selectedRange(in: current)
        guard
            let edited = edit(
                ComposerSelection(
                    text: current, selectionStart: range.lowerBound.utf16Offset(in: current),
                    selectionEnd: range.upperBound.utf16Offset(in: current)))
        else { return false }
        let editor = NSApp.keyWindow?.firstResponder as? NSTextView
        text.wrappedValue = edited.text
        selection = TextSelection(
            range: String.Index(utf16Offset: edited.selectionStart, in: edited.text)..<String.Index(utf16Offset: edited.selectionEnd, in: edited.text))
        if let editor {
            reveal(NSRange(location: edited.selectionStart, length: edited.selectionEnd - edited.selectionStart), of: edited.text, in: editor)
        }
        return true
    }

    /// The caret scrolled into view once the editor holds the edit. Typing
    /// keeps the caret in sight on its own, but a rewrite through the binding
    /// does not — a list item opened past the box's last visible line would
    /// sit out of sight below it. The rewrite reaches the `NSTextView` on
    /// SwiftUI's next render rather than now, so this waits until the view's
    /// text is the edited text, giving up after a few turns of the run loop
    /// if the draft moved on in the meantime.
    private func reveal(_ range: NSRange, of expected: String, in editor: NSTextView, attempts: Int = 4) {
        DispatchQueue.main.async {
            guard editor.string == expected else {
                if attempts > 1 { reveal(range, of: expected, in: editor, attempts: attempts - 1) }
                return
            }
            editor.scrollRangeToVisible(range)
        }
    }

    /// The caret or selection as a range of the draft, at the end when the
    /// editor has not reported one; a multi-caret selection is taken as the
    /// span from its first caret to its last.
    private func selectedRange(in current: String) -> Range<String.Index> {
        switch selection?.indices {
        case .selection(let range):
            return range
        case .multiSelection(let ranges):
            return ranges.ranges.first.map { $0.lowerBound..<(ranges.ranges.last?.upperBound ?? $0.upperBound) } ?? current.endIndex..<current.endIndex
        default:
            return current.endIndex..<current.endIndex
        }
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
            .fill(Color(nsColor: IslandPalette.separator))
            .frame(width: 1, height: 14)
            .padding(.horizontal, 2)
    }
}

/// The top edge of the prompt box, pulled to make the box taller — the web
/// composer's handle: a strip straddling the sheet's border, so the edge the
/// eye finds is the one that moves, with the resize cursor the only sign it
/// can be pulled. The ceiling is read from the window when the drag starts,
/// so a box on a large screen can take more of it than one on a small one.
private struct ComposerResizeHandle: View {
    @Binding var height: CGFloat
    let minHeight: CGFloat
    let maxWindowShare: CGFloat
    @State private var drag: (start: CGFloat, ceiling: CGFloat)?

    private static let thickness: CGFloat = 8

    var body: some View {
        Color.clear
            .frame(height: Self.thickness)
            .contentShape(Rectangle())
            .offset(y: -Self.thickness / 2)
            .pointerStyle(.rowResize)
            .gesture(
                DragGesture(minimumDistance: 1, coordinateSpace: .global)
                    .onChanged { change in
                        let current = drag ?? (height, ceiling)
                        drag = current
                        var transaction = Transaction()
                        transaction.disablesAnimations = true
                        withTransaction(transaction) {
                            height = min(current.ceiling, max(minHeight, current.start - change.translation.height))
                        }
                    }
                    .onEnded { _ in drag = nil }
            )
            .accessibilityLabel("Resize the message box")
    }

    private var ceiling: CGFloat {
        let window = NSApp.keyWindow?.contentLayoutRect.height ?? 800
        return max(minHeight, window * maxWindowShare)
    }
}

/// The whole pane as a drop target for images, so a file can be let go
/// anywhere in the conversation — the prompt box included — and still
/// arrive as a chip on the box.
///
/// The target is a view of our own laid over the pane, not SwiftUI's
/// `onDrop`. AppKit hands a drag to the deepest view under the pointer that
/// is registered for its types, and does not climb back up to that view's
/// ancestors when the deepest one takes nothing. Where `onDrop` puts its
/// view depends on what it modifies: over a stack it lands as a leaf in
/// front of the content and works; over a scroll view — the new session's
/// page — it wraps the content instead, the scroll view becomes the deepest
/// view under the pointer, and every drop is refused. An overlay is always
/// a leaf in front of everything the pane draws.
private struct ImageDropZone: ViewModifier {
    let draftKey: String
    @State private var targeted = false

    func body(content: Content) -> some View {
        content
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
            .overlay { ImageDropCatcher(draftKey: draftKey, targeted: $targeted) }
            .task { try? await Task.sleep(for: .seconds(2)); ZZDropProbe.dump() }
    }
}

private struct ImageDropCatcher: NSViewRepresentable {
    let draftKey: String
    @Binding var targeted: Bool
    @Environment(AppModel.self) private var model

    func makeNSView(context: Context) -> ImageDropCatcherView {
        let view = ImageDropCatcherView()
        configure(view)
        return view
    }

    func updateNSView(_ nsView: ImageDropCatcherView, context: Context) {
        configure(nsView)
    }

    private func configure(_ view: ImageDropCatcherView) {
        let chats = model.chats
        let key = draftKey
        view.onAttach = { chats.attach($0, to: key) }
        view.onTarget = { targeted = $0 }
    }
}

final class ImageDropCatcherView: NSView {
    var onAttach: (([ComposerAttachment]) -> Void)?
    var onTarget: ((Bool) -> Void)?

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        ZZDropProbe.log.notice("\(String(describing: type(of: self)), privacy: .public) moved window=\(self.window != nil)")
        guard window != nil else { return }
        registerForDraggedTypes([.fileURL, .png, .tiff])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("ImageDropCatcherView is not made from a nib") }

    /// Never the mouse's: the pane below clicks, types, selects and scrolls
    /// as if the catcher were not there. A drag's destination is found from
    /// the views registered for its types, not from this hit test, so the
    /// drop gives up nothing for it.
    override func hitTest(_ point: NSPoint) -> NSView? { nil }

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

extension View {
    func imageDropZone(draftKey: String) -> some View {
        modifier(ImageDropZone(draftKey: draftKey))
    }
}
