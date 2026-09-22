// A fenced code block in markdown — a snippet in an agent's reply, a shell
// transcript in a pull request's description — set in the theme's own
// colours rather than flat in the body's ink.
//
// The shell has no grammar and no theme JSON, so it does not colour the
// snippet itself: it hands the code and the fence's language to the server,
// which reads it with the very same Shiki and the very same theme the web
// app's diffs are highlighted with (see `highlightCode` in core), and gets
// back the tokens with colours on them. One reading of a theme, shared by
// every surface that draws code, so a snippet in a reply and the file it
// was taken from are the same colours.
//
// The round trip is why a block paints plain first and colours a moment
// later, and why `CodeHighlights` keeps every answer: a conversation
// scrolled back through, or re-laid-out as the window resizes, asks for
// snippets it has already been given, and those cost nothing. A fence that
// is still open — the one at the end of a reply still being written — is
// left to settle for a beat first, so a snippet arriving a token at a time
// is read once at each pause rather than once per token.
import SwiftUI

/// What one block asks for. The whole of it is the key it is cached under:
/// the same code in another language, or in another theme, is another
/// answer.
struct CodeHighlightRequest: Hashable, Sendable {
    let code: String
    let lang: String
    let theme: String
}

/// Every snippet the window has had coloured, so it is coloured once.
actor CodeHighlights {
    static let shared = CodeHighlights()

    /// How many snippets are kept. A conversation's worth, several times
    /// over; past it the oldest go, which are the ones scrolled furthest
    /// away.
    private static let capacity = 512

    private var answers: [CodeHighlightRequest: HighlightedCode] = [:]
    /// The keys in the order they arrived, for what to drop when full.
    private var arrivals: [CodeHighlightRequest] = []
    /// One request in flight per snippet: a block re-laid-out while the
    /// server is answering joins that answer rather than asking again.
    private var pending: [CodeHighlightRequest: Task<HighlightedCode?, Never>] = [:]
    private var client: ReviewerClient?

    /// The answer already held, if any — the cheap look that lets a block
    /// paint coloured on its first frame rather than wait out a beat it
    /// does not need.
    func held(_ request: CodeHighlightRequest) -> HighlightedCode? {
        answers[request]
    }

    /// The snippet coloured; nil where the server could not, which leaves
    /// the block plain.
    func highlight(_ request: CodeHighlightRequest) async -> HighlightedCode? {
        if let held = answers[request] { return held }
        if let pending = pending[request] { return await pending.value }
        let reading = Task<HighlightedCode?, Never> { [client = await connected()] in
            try? await client.highlight(code: request.code, lang: request.lang, theme: request.theme)
        }
        pending[request] = reading
        let answer = await reading.value
        pending[request] = nil
        if let answer { keep(answer, for: request) }
        return answer
    }

    private func keep(_ answer: HighlightedCode, for request: CodeHighlightRequest) {
        if answers.updateValue(answer, forKey: request) == nil { arrivals.append(request) }
        while arrivals.count > Self.capacity {
            answers.removeValue(forKey: arrivals.removeFirst())
        }
    }

    private func connected() async -> ReviewerClient {
        if let client { return client }
        let made = ReviewerClient(baseURL: await ServerLauncher.shared.baseURL)
        client = made
        return made
    }
}

struct CodeBlock: View {
    let code: String
    /// The fence's info string, as it was written; empty where it named no
    /// language, which reads as plain text.
    let lang: String
    /// Whether the fence was closed. An open one is the tail of a reply
    /// still being written, and is left to settle before it is read.
    let closed: Bool
    let metrics: MarkdownMetrics

    @Environment(\.colorScheme) private var colorScheme
    @State private var painted: Painted?

    /// How long an unfinished snippet is left alone: long enough that a
    /// reply streaming in is read at its pauses, short enough that the
    /// colour lands while the eye is still on the block.
    private static let settle: Duration = .milliseconds(150)

    private struct Painted {
        let request: CodeHighlightRequest
        let text: AttributedString
    }

    var body: some View {
        let request = CodeHighlightRequest(
            code: code,
            lang: lang,
            theme: ChromePalette.shared.themeName(for: colorScheme == .dark ? .dark : .light))
        ScrollView(.horizontal, showsIndicators: false) {
            Text(colours(for: request) ?? AttributedString(code))
                .font(metrics.codeFont)
                .lineSpacing(metrics.codeLeading)
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
        }
        .background(.quaternaryWash(0.5), in: RoundedRectangle(cornerRadius: 6))
        .task(id: request) { await paint(request) }
    }

    /// What has been painted, if it is this snippet's — a reply streaming
    /// in leaves the colours of the version before behind, and those belong
    /// to code that is no longer on screen.
    private func colours(for request: CodeHighlightRequest) -> AttributedString? {
        guard let painted, painted.request == request else { return nil }
        return painted.text
    }

    private func paint(_ request: CodeHighlightRequest) async {
        if let held = await CodeHighlights.shared.held(request) {
            painted = Painted(request: request, text: attributed(held))
            return
        }
        if !closed {
            try? await Task.sleep(for: Self.settle)
            guard !Task.isCancelled else { return }
        }
        guard let read = await CodeHighlights.shared.highlight(request), !Task.isCancelled else { return }
        painted = Painted(request: request, text: attributed(read))
    }

    /// The tokens as one run of text. A token the theme gives no colour of
    /// its own takes the code's foreground where the theme names one, and
    /// otherwise the ink of the pane it is on — which under a theme is that
    /// theme's text anyway.
    private func attributed(_ highlighted: HighlightedCode) -> AttributedString {
        let plain = highlighted.foreground.map(Color.init(hex:))
        var text = AttributedString()
        for (index, line) in highlighted.lines.enumerated() {
            if index > 0 { text.append(AttributedString("\n")) }
            for token in line {
                var run = AttributedString(token.text)
                run.foregroundColor = token.color.map(Color.init(hex:)) ?? plain
                if token.italic == true || token.bold == true {
                    var face = metrics.codeFont
                    if token.italic == true { face = face.italic() }
                    if token.bold == true { face = face.bold() }
                    run.font = face
                }
                text.append(run)
            }
        }
        return text
    }
}
