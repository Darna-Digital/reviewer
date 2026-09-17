// The window, laid out as panels on the web app's frame colour: the
// toolbar along the top — the project chip, the window tabs, the sidebar
// and launchpad buttons — and the rail down the leading edge
// are the window's own bare surface, and on it stand three rounded panels:
// the sidebar's project tree, the page island wearing
// the open-file band along its top, and the bottom pane under it. The seams
// between them are the frame showing through, and two of them resize what
// they part. The search dialog and the launchpad go over all of it when
// they are up. Before the server answers, and before a project is open, the
// page's island shows the matching placeholder instead.
import SwiftUI

struct ContentView: View {
    @Environment(AppModel.self) private var model

    private static let sidebarWidths: ClosedRange<CGFloat> = 200...520
    private static let bottomHeights: ClosedRange<CGFloat> = 120...800

    var body: some View {
        @Bindable var model = model
        HStack(spacing: 0) {
            AppRail()
            if model.sidebarShown {
                SidebarView()
                    .frame(width: model.sidebarWidth)
                    .island()
                    .transition(.move(edge: .leading).combined(with: .opacity))
                IslandSeam(between: .columns, size: $model.sidebarWidth, range: Self.sidebarWidths)
            }
            VStack(spacing: 0) {
                page
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .island()
                if model.hasProject && model.bottomExpanded {
                    IslandSeam(between: .rows, size: $model.bottomHeight, range: Self.bottomHeights)
                    BottomPane()
                        .frame(height: model.bottomHeight)
                        .island()
                }
            }
        }
        .padding(.top, IslandMetrics.gap)
        .padding(.trailing, IslandMetrics.gap)
        .padding(.bottom, IslandMetrics.gap)
        .background(Color(nsColor: IslandPalette.frame))
        .animation(.easeOut(duration: 0.18), value: model.sidebarShown)
        .navigationTitle("")
        .toolbar { ToolbarItems() }
        .toolbarBackgroundVisibility(.hidden, for: .windowToolbar)
        .overlay {
            if model.search.isShown {
                SearchOverlay()
                    .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: 0.12), value: model.search.isShown)
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
    private var page: some View {
        switch model.connection {
        case .starting:
            ConnectionView(state: .starting)
        case .failed(let reason):
            ConnectionView(state: .failed(reason))
        case .ready where !model.hasProject:
            WelcomeView()
        case .ready:
            IslandView(host: model.page)
        }
    }

    private var errorShown: Binding<Bool> {
        Binding(get: { model.lastError != nil }, set: { if !$0 { model.lastError = nil } })
    }
}

/// The toolbar: the sidebar's switch and the project chip — what the window
/// is on — then the window tabs, and the launchpad trailing: the web app's
/// window bar, on the window's own bar, so nothing on it is drawn a second
/// time inside the island. The branch picker is the sidebar's, over the tree
/// it names, as the web header has it.
private struct ToolbarItems: ToolbarContent {
    @Environment(AppModel.self) private var model

    var body: some ToolbarContent {
        ToolbarItem(placement: .navigation) {
            Button { model.toggleSidebar() } label: {
                Label("Sidebar", systemImage: "sidebar.leading")
            }
            .help(model.sidebarShown ? "Hide the sidebar (⌃⌘S)" : "Show the sidebar (⌃⌘S)")
        }
        ToolbarItem(placement: .navigation) {
            ProjectChip()
        }
        if model.hasProject {
            TabStripItems(model: model)
        }
        ToolbarItem(placement: .primaryAction) {
            Button { model.toggleLaunchpad() } label: {
                Label("Launchpad", systemImage: "square.grid.2x2")
            }
            .help("Show every open tab (⌘L)")
            .disabled(!model.hasProject)
        }
    }
}

/// The project the window is on, as a pull-down: the recents the server
/// remembers, and the folder panel for any other.
private struct ProjectChip: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Menu {
            ForEach(model.workspace?.recents ?? [], id: \.self) { path in
                Button(URL(fileURLWithPath: path).lastPathComponent) {
                    Task { await model.openProject(path: path) }
                }
            }
            Divider()
            Button("Open Project…") { model.chooseProject() }
        } label: {
            Label(model.workspace?.projectName ?? "No Project", systemImage: "folder")
                .labelStyle(.titleAndIcon)
        }
        .help("Switch project")
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
