// reviewer mac-os — the app entry. One model shared by the window and the
// menu bar, the server it depends on brought up before the first view asks
// for anything, and shut down again on quit when this process started it.
import AppKit
import SwiftUI

@main
struct ReviewerApp: App {
    @State private var model = AppModel()
    @NSApplicationDelegateAdaptor private var delegate: AppDelegate

    var body: some Scene {
        WindowGroup("Reviewer") {
            ContentView()
                .environment(model)
                .task { await model.bootstrap() }
                .frame(minWidth: 900, minHeight: 560)
        }
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unifiedCompact)
        .defaultSize(width: 1280, height: 800)
        .commands { ReviewerCommands(model: model) }
    }
}

/// The menu bar. Commands live here rather than on the views so they work
/// while any part of the window has focus — the sidebar, a terminal — and
/// not only while the page island has the keyboard.
///
/// The chords are the web app's own — ⌘T for a session, ⌘L the launchpad,
/// ⌘B the bottom pane, ⌘1–9 the sessions — so the window answers the hands
/// that learned it in the browser. The tab chords are the island's strip's
/// to answer, and a menu equivalent takes the key before the page sees it,
/// so each of those items hands its chord back to the strip
/// (`WindowTabAction`) rather than acting on tabs of its own. Nothing here
/// claims a chord the page alone answers: ⌘S is the SPA's save in edit
/// mode.
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
        // Into the system's own View menu, ahead of its sidebar and tab-bar
        // items, rather than a second menu of the same name beside it.
        CommandGroup(before: .sidebar) {
            Button(model.sidebarShown ? "Hide Sidebar" : "Show Sidebar") { model.toggleSidebar() }
                .keyboardShortcut("s", modifiers: [.command, .control])
            Button("Launchpad") { model.toggleLaunchpad() }
                .keyboardShortcut("l", modifiers: .command)
                .disabled(!model.hasProject)
            Button(model.bottomExpanded ? "Hide Bottom Pane" : "Show Bottom Pane") { model.toggleBottomPane() }
                .keyboardShortcut("b", modifiers: .command)
            Divider()
            ForEach(DockSurface.allCases) { surface in
                Button(surface.title) { model.toggle(dock: surface) }
                    .disabled(!model.hasProject)
            }
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
        // The sessions alone take the digits, as they do on the web strip:
        // the pinned tabs are ways of working rather than tabs among them.
        CommandMenu("Tabs") {
            Button("Next Tab") { model.selectNextTab(offset: 1) }
                .keyboardShortcut("]", modifiers: [.command, .shift])
            Button("Previous Tab") { model.selectNextTab(offset: -1) }
                .keyboardShortcut("[", modifiers: [.command, .shift])
            Divider()
            ForEach(Array(model.windowTabs.sessions.prefix(9).enumerated()), id: \.element.id) { slot, tab in
                Button(tab.title) { model.select(sessionSlot: slot + 1) }
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
