// The window: a native sidebar (project tree and agent sessions) beside the
// tabbed editor area, with the project, branch and working-tree summary in
// the unified toolbar. Before the server answers, and before a project is
// open, the detail column shows the matching placeholder instead.
import SwiftUI

struct ContentView: View {
    @Environment(AppModel.self) private var model
    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            SidebarView()
                .navigationSplitViewColumnWidth(min: 200, ideal: 260, max: 420)
        } detail: {
            detail
        }
        .navigationTitle(model.workspace?.projectName ?? "Reviewer")
        .navigationSubtitle(subtitle)
        .toolbar { ToolbarItems() }
        .alert("Something went wrong", isPresented: errorShown) {
            Button("OK") { model.lastError = nil }
        } message: {
            Text(model.lastError ?? "")
        }
    }

    @ViewBuilder
    private var detail: some View {
        switch model.connection {
        case .starting:
            ConnectionView(state: .starting)
        case .failed(let reason):
            ConnectionView(state: .failed(reason))
        case .ready where !model.hasProject:
            WelcomeView()
        case .ready:
            EditorArea()
        }
    }

    private var subtitle: String {
        guard let status = model.status else { return "" }
        var parts = [status.branch]
        if status.ahead > 0 { parts.append("↑\(status.ahead)") }
        if status.behind > 0 { parts.append("↓\(status.behind)") }
        if status.changed > 0 { parts.append("\(status.changed) changed") }
        return parts.joined(separator: "  ")
    }

    private var errorShown: Binding<Bool> {
        Binding(get: { model.lastError != nil }, set: { if !$0 { model.lastError = nil } })
    }
}

struct ToolbarItems: ToolbarContent {
    @Environment(AppModel.self) private var model

    var body: some ToolbarContent {
        ToolbarItem(placement: .navigation) {
            Button { model.chooseProject() } label: {
                Label("Open Project", systemImage: "folder")
            }
            .help("Open a project folder")
        }
        ToolbarItem(placement: .primaryAction) {
            Button { Task { await model.newChat() } } label: {
                Label("New Agent Session", systemImage: "sparkles")
            }
            .help("Start a new agent session in this project")
            .disabled(!model.hasProject)
        }
        ToolbarItem(placement: .primaryAction) {
            Button { Task { await model.refresh() } } label: {
                Label("Refresh", systemImage: "arrow.clockwise")
            }
            .help("Reload the project tree, status and sessions")
            .disabled(model.connection != .ready)
        }
    }
}

struct ConnectionView: View {
    let state: ConnectionState
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(spacing: 12) {
            switch state {
            case .failed(let reason):
                Image(systemName: "bolt.slash")
                    .font(.system(size: 36))
                    .foregroundStyle(.secondary)
                Text("The API server is not answering")
                    .font(.title3)
                Text(reason)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 480)
                Button("Try Again") { Task { await model.bootstrap() } }
                    .keyboardShortcut(.defaultAction)
            default:
                ProgressView()
                Text("Starting the API server…")
                    .foregroundStyle(.secondary)
            }
        }
        .padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
