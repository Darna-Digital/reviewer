// reviewer mac-os — the app entry. One model shared by the windows and the
// menu bar, the server it depends on brought up before the first view asks
// for anything, and shut down again on quit when this process started it.
//
// Two windows, as Xcode has them: the workspace, and the welcome. The
// server holds one project at a time, so each is a single `Window` rather
// than a group. The workspace is the one that opens at launch — the server
// usually remembers a project, and the welcome would only flash ahead of
// it — and hands over to the welcome once the server answers with none
// (see `ContentView`); the welcome hands back as a project is opened in
// it (see `WelcomeWindow`), and is otherwise reached from the Window menu
// and the project chip while the workspace stays up.
import AppKit
import SwiftUI

enum ReviewerWindow {
    static let workspace = "workspace"
    static let welcome = "welcome"
}

@main
struct ReviewerApp: App {
    @State private var model = AppModel()
    @NSApplicationDelegateAdaptor private var delegate: AppDelegate

    var body: some Scene {
        Window("Reviewer", id: ReviewerWindow.workspace) {
            ContentView()
                .environment(model)
                // Re-opened from the welcome, the window finds the server
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

        Window("Welcome to Reviewer", id: ReviewerWindow.welcome) {
            WelcomeWindow()
                .environment(model)
        }
        .windowStyle(.hiddenTitleBar)
        .windowResizability(.contentSize)
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
/// The chords are the web app's own — ⌘T for a session, ⌘L the launchpad,
/// ⌘B the bottom pane, ⌘G across Code and Sessions, ⌘1–9 the sessions — so
/// the window answers the hands that learned it in the browser. The tab
/// chords are the island's strip's to answer, and a menu equivalent takes
/// the key before the page sees it, so each of those items hands its chord
/// back to the strip (`WindowTabAction`) rather than acting on tabs of its
/// own. Nothing here claims a chord the page alone answers: ⌘S is the SPA's
/// save of an edited `.env` file.
struct ReviewerCommands: Commands {
    let model: AppModel

    var body: some Commands {
        CommandGroup(replacing: .newItem) {
            Button("New Agent Session") { model.newSession() }
                .keyboardShortcut("t", modifiers: .command)
            Button("Open Project…") { model.chooseProject() }
                .keyboardShortcut("o", modifiers: .command)
        }
        CommandGroup(replacing: .saveItem) {
            Button("Close Tab") { model.closeCurrentTab() }
                .keyboardShortcut("w", modifiers: .command)
                .disabled(!model.canCloseTab)
        }
        // Into the Edit menu, under the pasteboard: the web app's ⌘⇧F, and
        // the IDEs' chord for the file search — the web app's ⇧⇧ is heard
        // too, but a double tap is no menu equivalent.
        CommandGroup(after: .pasteboard) {
            Divider()
            Button("Go to File…") { model.findFile() }
                .keyboardShortcut("o", modifiers: [.command, .shift])
                .disabled(!model.hasProject)
            Button("Search in Files…") { model.findInFiles() }
                .keyboardShortcut("f", modifiers: [.command, .shift])
                .disabled(!model.hasProject)
        }
        // The system's own Toggle Sidebar (⌃⌘S), which moves the split
        // view's column, and the rest into the View menu ahead of it, rather
        // than a second menu of the same name beside it.
        SidebarCommands()
        CommandGroup(before: .sidebar) {
            Button("Launchpad") { model.toggleLaunchpad() }
                .keyboardShortcut("l", modifiers: .command)
                .disabled(!model.hasProject)
            Button(model.bottomExpanded ? "Hide Bottom Pane" : "Show Bottom Pane") { model.toggleBottomPane() }
                .keyboardShortcut("b", modifiers: .command)
            Divider()
            ForEach(BottomPaneTab.allCases) { tab in
                Button(tab.title) { model.show(bottomTab: tab) }
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
    func applicationDidFinishLaunching(_ notification: Notification) {
        // A bare SwiftPM binary launches as a background process; without a
        // bundle it has to ask for a dock tile and the foreground itself.
        NSApp.setActivationPolicy(.regular)
        NSApp.activate()
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
