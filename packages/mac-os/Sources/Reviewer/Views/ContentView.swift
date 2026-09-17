// The window: the system's own sidebar — the full-height pane of glass the
// current design gives a window, carrying the rail down its leading edge
// and the project tree beside it — and on the detail column, the web app's
// frame colour with two rounded panels standing on it: the page island
// wearing the open-file band along its top, and the bottom pane under it.
// The toolbar — the project chip, the window tabs, the launchpad button —
// is the window's own bare surface over the detail. The title bar is put
// away, so the pane runs to the window's top edge with the traffic lights
// and the sidebar's own toggle standing inside it, as Music has it — which
// the system only does for the full-height unified toolbar (see
// `ReviewerApp`); ⌃⌘S and the View menu move the sidebar too.
// The seam between the islands is the frame showing through, and resizes
// what it parts; the seam between the sidebar and the detail is the
// system's. The search dialog goes over all of it when it is up; the
// launchpad slides out from under the toolbar and pushes the islands down,
// dimmed under a scrim, by exactly its own height (see `Launchpad`) — the
// sidebar stands where it is, the way a system sidebar does. With the
// sidebar put away, the rail moves onto the frame beside the page: the dock
// and the bottom pane are reached from it either way. Before the server
// answers, and before a project is open, the page's island shows the
// matching placeholder instead.
import SwiftUI

struct ContentView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        NavigationSplitView(columnVisibility: columnVisibility) {
            SidebarColumn()
                .navigationSplitViewColumnWidth(min: 240, ideal: 320, max: 560)
        } detail: {
            DetailColumn()
        }
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
        .branchPrompts()
        .alert("Something went wrong", isPresented: errorShown) {
            Button("OK") { model.lastError = nil }
        } message: {
            Text(model.lastError ?? "")
        }
    }

    /// The system's column state as the model's one switch, so the sidebar
    /// button on the bar, ⌃⌘S and the View menu all move the same thing,
    /// and the rail knows which column to stand in.
    private var columnVisibility: Binding<NavigationSplitViewVisibility> {
        Binding(
            get: { model.sidebarShown ? .all : .detailOnly },
            set: { model.sidebarShown = $0 != .detailOnly })
    }

    private var errorShown: Binding<Bool> {
        Binding(get: { model.lastError != nil }, set: { if !$0 { model.lastError = nil } })
    }
}

/// The rail down the sidebar's leading edge, and the tree beside it.
private struct SidebarColumn: View {
    var body: some View {
        HStack(spacing: 0) {
            AppRail()
            SidebarView()
                .frame(maxWidth: .infinity)
        }
    }
}

/// The islands on the frame — the page and the bottom pane under it — with
/// the rail beside them while the sidebar is away, and the launchpad
/// pushing them down when it is out.
private struct DetailColumn: View {
    @Environment(AppModel.self) private var model

    private static let bottomHeights: ClosedRange<CGFloat> = 120...800

    var body: some View {
        let launchpad = model.launchpad
        ZStack(alignment: .top) {
            islands
                .overlay {
                    if launchpad.isShown {
                        LaunchpadScrim()
                            .transition(.opacity)
                    }
                }
                .overlay(alignment: .top) {
                    LaunchpadSeam(edge: .pageHead)
                }
                // Moved, not resized: the islands keep the size they have
                // and slide off the bottom of the window, so the web view,
                // the outline and the terminal are composited down rather
                // than laid out again on every frame.
                .offset(y: launchpad.isShown ? launchpad.height : 0)
            if launchpad.isShown {
                LaunchpadPanel()
                    .frame(height: launchpad.height)
                    .transition(.move(edge: .top))
                    // Kept above the islands on its way out too: a view
                    // leaving a stack loses its place in it.
                    .zIndex(1)
            }
        }
        .clipped()
        .onGeometryChange(for: CGSize.self) { $0.size } action: { launchpad.canvas = $0 }
        .background(Color(nsColor: IslandPalette.frame))
    }

    private var islands: some View {
        @Bindable var model = model
        return HStack(spacing: 0) {
            if !model.sidebarShown {
                AppRail()
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
            .padding(.leading, model.sidebarShown ? IslandMetrics.gap : 0)
        }
        .padding(.top, IslandMetrics.gap)
        .padding(.trailing, IslandMetrics.gap)
        .padding(.bottom, IslandMetrics.gap)
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
}

/// The toolbar: the project chip — what the window is on — then the window
/// tabs, and the launchpad trailing: the web app's window bar, on the
/// window's own bar, so nothing on it is drawn a second time inside the
/// island. Every item wears the web bar's chip rather than the system's
/// glass, put away per item (see `BarChipStyle`). The sidebar's toggle is
/// the system's, standing in the sidebar's own pane beside the traffic
/// lights rather than here. The branch picker is the sidebar's, over the
/// tree it names, as the web header has it.
private struct ToolbarItems: ToolbarContent {
    @Environment(AppModel.self) private var model

    var body: some ToolbarContent {
        ToolbarItem(placement: .navigation) {
            ProjectChip()
        }
        .sharedBackgroundVisibility(.hidden)
        if model.hasProject {
            TabStripItems(model: model)
        }
        ToolbarItem(placement: .primaryAction) {
            Button { model.toggleLaunchpad() } label: {
                Label("Launchpad", systemImage: "square.grid.2x2")
                    .barGlyph()
            }
            .buttonStyle(BarChipStyle(isOn: model.launchpad.isShown))
            .help("Show every open tab (⌘L)")
            .disabled(!model.hasProject)
        }
        .sharedBackgroundVisibility(.hidden)
    }
}

/// The project the window is on, as a pull-down: the recents the server
/// remembers, and the folder panel for any other. The chevron is the
/// chip's own, in place of the arrow the system's menu button wears, so the
/// chip is cut like the web bar's.
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
            HStack(spacing: 6) {
                Image(systemName: "folder")
                    .font(.system(size: 12, weight: .medium))
                Text(model.workspace?.projectName ?? "No Project")
                    .font(.system(size: 13))
                    .lineLimit(1)
                    .truncationMode(.tail)
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
            .padding(.leading, 8)
            .padding(.trailing, 6)
            .frame(maxWidth: 176)
        }
        .menuStyle(.button)
        .menuIndicator(.hidden)
        .buttonStyle(BarChipStyle())
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
