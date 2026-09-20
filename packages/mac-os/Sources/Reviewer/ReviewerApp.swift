// reviewer mac-os — the app entry. One model shared by the windows and the
// menu bar, the server it depends on brought up before the first view asks
// for anything, and shut down again on quit when this process started it.
//
// Two windows: the workspace, and the opener — the Finder-like list of
// every repository the machine holds. The server holds one project at a
// time, so each is a single `Window` rather than a group. The workspace is
// the one that opens at launch — the server usually remembers a project,
// and the opener would only flash ahead of it — and hands over to the
// opener once the server answers with none (see `ContentView`); the opener
// hands back as a repository is opened in it (see `RepoOpenerWindow`), and
// is otherwise reached with ⌘O, from the Window menu and from the project
// chip while the workspace stays up.
import AppKit
import SwiftUI

enum ReviewerWindow {
    static let workspace = "workspace"
    static let opener = "opener"
}

@main
struct ReviewerApp: App {
    @State private var model = AppModel()
    @NSApplicationDelegateAdaptor private var delegate: AppDelegate

    var body: some Scene {
        Window("Reviewer", id: ReviewerWindow.workspace) {
            ContentView()
                .environment(model)
                // Re-opened from the opener, the window finds the server
                // already answering, and only the first opening boots it.
                .task { if model.connection != .ready { await model.bootstrap() } }
                .frame(minWidth: 900, minHeight: 560)
        }
        .windowStyle(.hiddenTitleBar)
        // The full-height toolbar, not the compact one: only under it does
        // the system run the sidebar's pane up to the window's top edge,
        // with the traffic lights and the sidebar toggle inside it, as
        // Music has it. Compact keeps a title bar strip above the pane.
        .windowToolbarStyle(.unified)
        .defaultSize(width: 1280, height: 800)
        .commands { ReviewerCommands(model: model) }

        Window("Open Repository", id: ReviewerWindow.opener) {
            RepoOpenerWindow()
                .environment(model)
        }
        .windowToolbarStyle(.unified)
        .defaultSize(width: 1040, height: 620)
        .defaultPosition(.center)
        // Xcode's chord for its welcome, on the Window menu item the system
        // adds for the scene.
        .keyboardShortcut("1", modifiers: [.command, .shift])
        // Never the window a relaunch restores, and never the one the
        // launch opens: the workspace decides whether it is wanted.
        .restorationBehavior(.disabled)
        .defaultLaunchBehavior(.suppressed)
    }
}

/// The menu bar. Commands live here rather than on the views so they work
/// while any part of the window has focus — the sidebar, a terminal — and
/// not only while the page island has the keyboard.
///
/// The chords are the web app's own — ⌘T for a session, ⌘B the bottom
/// pane, ⌘G across Code and Sessions, ⌘1–9 the sessions — so the window
/// answers the hands that learned it in the browser; the rail's buttons,
/// which the web app gives no chords, take ⌥⌘1–7 (see `RailShortcut`).
/// The tab chords are the island's strip's to answer, and a menu
/// equivalent takes the key before the page sees it, so each of those
/// items hands its chord back to the strip (`WindowTabAction`) rather than
/// acting on tabs of its own. Nothing here claims a chord the page alone
/// answers: ⌘S is the SPA's save of an edited `.env` file.
struct ReviewerCommands: Commands {
    let model: AppModel

    var body: some Commands {
        CommandGroup(replacing: .newItem) {
            Button("New Agent Session") { model.newSession() }
                .keyboardShortcut("t", modifiers: .command)
            Button("Open Repository…") { model.showOpener() }
                .keyboardShortcut("o", modifiers: .command)
        }
        CommandGroup(replacing: .saveItem) {
            Button("Close Tab") { model.closeCurrentTab() }
                .keyboardShortcut("w", modifiers: .command)
                .disabled(!model.canCloseTab)
        }
        // Into the Edit menu, under the pasteboard: the web app's ⌘K and
        // ⌘⇧F, and the IDEs' chord for the file search — the web app's ⇧⇧
        // is heard too, but a double tap is no menu equivalent.
        CommandGroup(after: .pasteboard) {
            Divider()
            Button("Commands…") { model.showCommands() }
                .keyboardShortcut("k", modifiers: .command)
                .disabled(!model.hasProject)
            Button("Go to File…") { model.findFile() }
                .keyboardShortcut("o", modifiers: [.command, .shift])
                .disabled(!model.hasProject)
            Button("Search in Files…") { model.findInFiles() }
                .keyboardShortcut("f", modifiers: [.command, .shift])
                .disabled(!model.hasProject)
        }
        // The View menu: the sidebar on the system's own chord for it,
        // ⌃⌘S, but moved through the model rather than by the split view,
        // so the menu, the palette and the bar's toggle all move the one
        // switch; then the rail, button by button in the rail's own order,
        // each on its chord (see `RailShortcut`) and ticked while it is on
        // — a bottom surface's item puts the pane away again as its rail
        // button does.
        CommandGroup(before: .sidebar) {
            Button(model.sidebarShown ? "Hide Sidebar" : "Show Sidebar") { model.toggleSidebar() }
                .keyboardShortcut("s", modifiers: [.control, .command])
            Divider()
            ForEach(CodeSurface.allCases) { surface in
                Toggle(surface.title, isOn: Binding(
                    get: { model.codeSurface == surface },
                    set: { if $0 { model.show(surface: surface) } }))
                    .keyboardShortcut(surface.railShortcut)
                    .disabled(!model.hasProject)
            }
            Divider()
            Button(model.bottomExpanded ? "Hide Bottom Pane" : "Show Bottom Pane") { model.toggleBottomPane() }
                .keyboardShortcut("b", modifiers: .command)
            ForEach(BottomPaneTab.allCases) { tab in
                Toggle(tab.title, isOn: Binding(
                    get: { model.bottomExpanded && model.bottomTab == tab },
                    set: { _ in model.toggle(bottomTab: tab) }))
                    .keyboardShortcut(tab.railShortcut)
                    .disabled(!model.hasProject)
            }
            Divider()
            Button("Refresh Project") { Task { await model.refresh() } }
                .keyboardShortcut("r", modifiers: .command)
            Button("Reload Island") { model.page.reload() }
            .keyboardShortcut("r", modifiers: [.command, .shift])
            Divider()
        }
        // ⌘G crosses between the two ways of working the strip leads with,
        // and the sessions alone take the digits, as on the web strip: the
        // pinned tabs are ways of working rather than tabs among them.
        CommandMenu("Tabs") {
            Button("Switch Between Code and Sessions") { model.switchMode() }
                .keyboardShortcut("g", modifiers: .command)
                .disabled(!model.windowTabs.canSwitchMode)
            Divider()
            Button("Next Tab") { model.selectNextTab(offset: 1) }
                .keyboardShortcut("]", modifiers: [.command, .shift])
            Button("Previous Tab") { model.selectNextTab(offset: -1) }
                .keyboardShortcut("[", modifiers: [.command, .shift])
            Divider()
            ForEach(Array(model.windowTabs.sessions.prefix(9).enumerated()), id: \.element.id) { slot, tab in
                Button(tab.title) { model.select(tabId: tab.id) }
                    .keyboardShortcut(KeyEquivalent(Character(String(slot + 1))), modifiers: .command)
            }
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var appearanceObservation: NSKeyValueObservation?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // A bare SwiftPM binary launches as a background process; without a
        // bundle it has to ask for a dock tile and the foreground itself.
        NSApp.setActivationPolicy(.regular)
        NSApp.activate()
        appearanceObservation = NSApp.observe(\.effectiveAppearance, options: [.initial, .new]) { app, _ in
            MainActor.assumeIsolated { DockIcon.follow(app.effectiveAppearance) }
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        MainActor.assumeIsolated {
            ServerLauncher.shared.stop()
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}
