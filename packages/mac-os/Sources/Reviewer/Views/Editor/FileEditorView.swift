// A syntax-highlighted buffer (see `CodeEditor`) with a status footer.
import SwiftUI

struct FileEditorView: View {
    @Bindable var file: OpenFile

    var body: some View {
        VStack(spacing: 0) {
            if file.isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if file.isBinary {
                ContentUnavailableView(
                    "Binary file", systemImage: "doc.zipper",
                    description: Text("\(file.name) is \(file.sizeBytes.formatted(.byteCount(style: .file))) of binary data."))
            } else {
                CodeEditor(text: $file.text, buffer: file.buffer)
            }
            footer
        }
    }

    private var footer: some View {
        HStack(spacing: 12) {
            Text(file.path)
                .lineLimit(1)
                .truncationMode(.middle)
            if let language = file.buffer.language {
                Text(language)
            }
            Spacer()
            if let error = file.error {
                Label(error, systemImage: "exclamationmark.triangle")
                    .foregroundStyle(.red)
                    .lineLimit(1)
            }
            if file.isSaving {
                ProgressView().controlSize(.mini)
            } else if file.isDirty {
                Text("Unsaved — ⌘S")
            } else if !file.isBinary {
                Text(file.sizeBytes.formatted(.byteCount(style: .file)))
            }
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .padding(.horizontal, 12)
        .frame(height: 24)
        .background(.bar)
        .overlay(alignment: .top) { Divider() }
    }
}
