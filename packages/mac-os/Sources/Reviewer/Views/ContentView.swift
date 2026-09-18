// The window: the system's own sidebar — the full-height pane of glass the
// current design gives a window, carrying the rail down its leading edge
// and the project tree beside it — and on the detail column, the web app's
// frame colour with two rounded panels standing on it: the page island
// wearing the open-file band along its top, and the bottom pane under it.
// The toolbar — the window tabs, the launchpad button — is the window's
// own bare surface over the detail. The title bar is put away, so the pane
// runs to the window's top edge with the traffic lights and the sidebar's
// own toggle standing inside it, as Music has it — which the system only
// does for the full-height unified toolbar (see `ReviewerApp`); ⌃⌘S and
// the View menu move the sidebar too. The project picker stands in that
// same pane, beside the toggle, where Notes keeps its folder button: the
// sidebar is the project's — its tree, its sessions — so the chip that
// names the project heads the column it fills, and goes with it.
// The seam between the islands is the frame showing through, and resizes
// what it parts; the seam between the sidebar and the detail is the
// system's. The search dialog goes over all of it when it is up; the
// launchpad slides out from under the toolbar across the whole window and
// pushes the whole split view down — the sidebar's pane of glass along
// with the frame and the islands on it, one surface giving way, dimmed
// under one scrim — by exactly its own height, onto the bare frame the
// window shows above it (see `Launchpad`, `LaunchpadLayer`). With the
// sidebar put away, the rail moves onto the frame beside the page: the dock
// and the bottom pane are reached from it either way. Before the server
// answers, the page's island shows the connection instead; answered with
// no project, the window hands over to the welcome (see `WelcomeWindow`)
// and puts itself away, so the island's bare sheet is only ever a frame
// of that handover.
import SwiftUI

struct ContentView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openWindow) private var openWindow
    @Environment(\.dismissWindow) private var dismissWindow

    var body: some View {
        let launchpad = model.launchpad
        NavigationSplitView(columnVisibility: columnVisibility) {
            SidebarColumn()
                .navigationSplitViewColumnWidth(min: 240, ideal: 320, max: 560)
                // Declared on the column rather than the window, so the
                // system lays it out in the sidebar's own run of the bar,
                // beside the toggle it puts there.
                .toolbar { SidebarToolbarItems() }
        } detail: {
            DetailColumn()
        }
        .navigationTitle("")
        .toolbar { ToolbarItems() }
        .toolbarBackgroundVisibility(.hidden, for: .windowToolbar)
        // The split view giving way to the launchpad: dimmed, and moved
        // down by the panel's height — not resized, so the web view, the
        // outline and the terminal are composited down rather than laid
        // out again on every frame of the push — glass, frame and islands
        // as one, and what goes past the window's bottom edge is simply
        // gone. The scrim rides what it dims, so the surface the panel
        // stands on stays bright. Behind it all the bare frame, run up
        // under the toolbar, is what the push uncovers.
        .overlay {
            if launchpad.isShown {
                LaunchpadScrim()
                    .transition(.opacity)
            }
        }
        .offset(y: launchpad.isShown ? launchpad.height : 0)
        .background(Color(nsColor: IslandPalette.frame).ignoresSafeArea())
        .overlay(alignment: .top) {
            LaunchpadLayer()
        }
        .overlay {
            if model.search.isShown {
                SearchOverlay()
                    .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: 0.12), value: model.search.isShown)
        .branchPrompts()
        .serverErrorAlert()
        .onChange(of: model.awaitingProject) { _, awaiting in
            guard awaiting else { return }
            openWindow(id: ReviewerWindow.welcome)
            dismissWindow(id: ReviewerWindow.workspace)
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

}

extension View {
    /// The server's last refusal, as an alert over whichever window asked:
    /// the workspace, or the welcome opening a project.
    func serverErrorAlert() -> some View {
        modifier(ServerErrorAlert())
    }
}

private struct ServerErrorAlert: ViewModifier {
    @Environment(AppModel.self) private var model

    func body(content: Content) -> some View {
        content.alert("Something went wrong", isPresented: errorShown) {
            Button("OK") { model.lastError = nil }
        } message: {
            Text(model.lastError ?? "")
        }
    }

    private var errorShown: Binding<Bool> {
        Binding(get: { model.lastError != nil }, set: { if !$0 { model.lastError = nil } })
    }
}

/// The launchpad over the window: the panel along the top, bare, on the
/// frame the pushed split view uncovers. An overlay on the split view
/// rather than a view in either column, so it is one grid across the
/// window's width — the sidebar's edge has no say in where its cards
/// break — and the width the grid is fitted to is the window's. Clipped,
/// so the panel slides out from under the toolbar rather than over it.
/// Empty while the launchpad is in, and nothing to hit.
private struct LaunchpadLayer: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let launchpad = model.launchpad
        ZStack(alignment: .top) {
            if launchpad.isShown {
                LaunchpadPanel()
                    .frame(height: launchpad.height)
                    .transition(.move(edge: .top))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .clipped()
        .onGeometryChange(for: CGSize.self) { $0.size } action: { launchpad.canvas = $0 }
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

/// The sidebar's run of the toolbar: the project picker, trailing, beside
/// the toggle the system puts at the end of that run — where Notes keeps
/// its folder button. It goes with the sidebar: a column's items are the
/// column's, and the chip is on the bar only while the pane it names is.
private struct SidebarToolbarItems: ToolbarContent {
    var body: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            ProjectPicker()
        }
        .sharedBackgroundVisibility(.hidden)
    }
}

/// The islands on the frame — the page and the bottom pane under it, and
/// while a pull request is open, its own column ahead of them (see
/// `PullRequestColumn`) — with the rail beside them while the sidebar is
/// away. The seam the launchpad is pulled out by lies along their top
/// edge, on the run of frame under the bar.
private struct DetailColumn: View {
    @Environment(AppModel.self) private var model

    private static let bottomHeights: ClosedRange<CGFloat> = 120...800

    var body: some View {
        islands
            .overlay(alignment: .top) {
                LaunchpadSeam(edge: .pageHead)
            }
            .background(Color(nsColor: IslandPalette.frame))
    }

    private var islands: some View {
        @Bindable var model = model
        return HStack(spacing: 0) {
            if !model.sidebarShown {
                AppRail()
            }
            if model.connection == .ready, let pull = model.reviewingPull {
                PullRequestColumn(pull: pull)
                    .padding(.leading, model.sidebarShown ? IslandMetrics.gap : 0)
                IslandSeam(between: .columns, size: $model.pullColumnWidth, range: PullRequestColumn.widths)
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
            .padding(.leading, model.sidebarShown && model.reviewingPull == nil ? IslandMetrics.gap : 0)
        }
        // No run of our own along the top: the bar keeps as much air under
        // its items as it keeps over them, and that air is the gap — a gap
        // of ours on top of it set the island further from the tabs than
        // the tabs stand from the window's edge.
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
            Color.clear
        case .ready:
            IslandView(host: model.page)
        }
    }
}

/// The toolbar over the detail: the window tabs, and the launchpad at the
/// bar's far end — the web app's window bar, on the window's own bar, so
/// nothing on it is drawn a second time inside the island. The tabs' pinned
/// pair are the system's own glass toggles (see `TabStripItems`); every
/// other item wears the web bar's chip instead, the glass put away per
/// item (see `BarChipStyle`). The launchpad is held at the trailing edge
/// by a `Spacer` item ahead of it — the bar otherwise sets the detail's
/// items in one run from its leading end and leaves the button on the
/// tabs' heels, and a `ToolbarSpacer(.flexible)` in the same place stays
/// at its minimum on this bar, where a bare `Spacer` becomes the toolbar's
/// own flexible space. The sidebar's toggle is the system's, standing
/// in the sidebar's own pane beside the traffic lights rather than
/// here, and the project chip stands with it (see
/// `SidebarToolbarItems`). The branch picker is the sidebar's, over the
/// tree it names, as the web header has it.
private struct ToolbarItems: ToolbarContent {
    @Environment(AppModel.self) private var model

    var body: some ToolbarContent {
        if model.hasProject {
            TabStripItems(model: model)
        }
        ToolbarItem(placement: .primaryAction) { Spacer() }
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

/// The project the window is on, as the web bar's chip — its avatar and
/// its name — and the way to any other: pressing it brings up the
/// welcome window, where the recents the server remembers are listed and
/// the folder panel is reached (see `WelcomeWindow`). Level with the
/// toggle beside it rather than riding low as the detail's chips do: this
/// run of the bar has the system's own control on it, and the chip keeps
/// its line.
private struct ProjectPicker: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Button {
            openWindow(id: ReviewerWindow.welcome)
        } label: {
            HStack(spacing: 6) {
                if let name = model.workspace?.projectName {
                    RepoAvatar(name: name)
                    Text(name)
                        .font(.system(size: 13))
                        .lineLimit(1)
                        .truncationMode(.tail)
                } else {
                    Image(systemName: "folder")
                        .font(.system(size: 12, weight: .medium))
                    Text("Choose project")
                        .font(.system(size: 13))
                }
            }
            // A little more than the air above and below: the capsule's
            // rounded ends cut into the sides.
            .padding(.horizontal, 8)
            .frame(maxWidth: 176)
        }
        // The toggle's air above and below its glyph, around the avatar.
        .buttonStyle(BarChipStyle(height: 30))
        .help("Switch project (⇧⌘1)")
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
