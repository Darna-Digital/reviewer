// One open file buffer. It loads itself from the server, tracks whether the
// text has drifted from what is on disk, and writes back on save. A binary
// file is opened too — the editor shows a placeholder instead of an empty
// buffer that would otherwise be "saved" over the real bytes.
import Foundation
import Observation

@MainActor
@Observable
final class OpenFile {
    let path: String
    var text: String = ""
    var isBinary = false
    var sizeBytes = 0
    var isLoading = true
    var isSaving = false
    var error: String?

    @ObservationIgnored let buffer: CodeBuffer
    private var savedText: String = ""
    private let client: ReviewerClient

    var id: String { path }
    var name: String { URL(fileURLWithPath: path).lastPathComponent }
    var isDirty: Bool { !isBinary && text != savedText }

    init(path: String, client: ReviewerClient) {
        self.path = path
        self.client = client
        buffer = CodeBuffer(language: CodeLanguage.forFile(named: URL(fileURLWithPath: path).lastPathComponent))
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let file = try await client.readFile(path: path)
            isBinary = file.binary
            sizeBytes = file.sizeBytes
            text = file.contents
            savedText = file.contents
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    func save() async {
        guard isDirty, !isSaving else { return }
        // Snapshot before the round trip: a keystroke that lands while the
        // write is in flight must leave the buffer dirty again afterwards.
        let contents = text
        isSaving = true
        defer { isSaving = false }
        do {
            try await client.writeFile(path: path, contents: contents)
            savedText = contents
            sizeBytes = contents.utf8.count
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }
}
