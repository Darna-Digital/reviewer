// The detail column once a project is open: the tab strip, and beneath it
// whatever the current tab holds — a file buffer or an agent session — or a
// hint when nothing is open yet.
import SwiftUI

struct EditorArea: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(spacing: 0) {
            if !model.tabs.isEmpty {
                TabStrip()
            }
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color(nsColor: .textBackgroundColor))
    }

    @ViewBuilder
    private var content: some View {
        if let file = model.currentFile {
            FileEditorView(file: file)
                .id(file.id)
        } else if let session = model.currentSession {
            ChatView(session: session)
                .id(session.id)
        } else {
            ContentUnavailableView {
                Label("No file open", systemImage: "doc.text")
            } description: {
                Text("Pick a file in the sidebar, or press ⌘N to start an agent session.")
            }
        }
    }
}
