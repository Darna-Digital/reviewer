// The window: the native sidebar (the project tree) beside the detail
// column — the page island with the bottom pane under it — with the window
// tabs on the toolbar, the way the web app's window bar carries them, and
// the launchpad over all of it when it is up. Before the
// server answers, and before a project is open, the detail column shows the
// matching placeholder instead.
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
        // An empty title rather than none: the title slot is what holds the
        // leading and trailing groups apart, and without it the launchpad
        // button hugs the tabs instead of the trailing edge.
        .navigationTitle("")
        .toolbar { ToolbarItems() }
        .overlay {
            if model.launchpadShown {
                LaunchpadView()
                    .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: 0.15), value: model.launchpadShown)
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
            DetailColumn()
        }
    }

    private var errorShown: Binding<Bool> {
        Binding(get: { model.lastError != nil }, set: { if !$0 { model.lastError = nil } })
    }
}

/// The page the tab in front points at, and the bottom pane beneath.
private struct DetailColumn: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(spacing: 0) {
            IslandView(host: model.page)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            BottomPane()
        }
        .background(Color(nsColor: .windowBackgroundColor))
    }
}

struct ToolbarItems: ToolbarContent {
    @Environment(AppModel.self) private var model

    var body: some ToolbarContent {
        if model.hasProject {
            TabStripItems(model: model)
        }
        ToolbarItem(placement: .primaryAction) {
            Button { model.toggleLaunchpad() } label: {
                Label("Launchpad", systemImage: "square.grid.2x2")
            }
            .help("Show every open tab")
            .disabled(!model.hasProject)
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
