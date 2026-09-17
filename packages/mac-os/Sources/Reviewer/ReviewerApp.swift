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
        .windowToolbarStyle(.unified)
        .defaultSize(width: 1280, height: 800)
        .commands { ReviewerCommands(model: model) }
    }
}

/// The menu bar. Commands live here rather than on the views so they work
/// while any part of the window has focus, and so a tab can be closed from
/// the keyboard even when the strip itself never takes focus.
struct ReviewerCommands: Commands {
    let model: AppModel

    var body: some Commands {
        CommandGroup(replacing: .newItem) {
            Button("New Agent Session") { Task { await model.newChat() } }
                .keyboardShortcut("n", modifiers: .command)
            Button("Open Project…") { model.chooseProject() }
                .keyboardShortcut("o", modifiers: .command)
        }
        CommandGroup(replacing: .saveItem) {
            Button("Save") { Task { await model.saveCurrentFile() } }
                .keyboardShortcut("s", modifiers: .command)
                .disabled(model.currentFile?.isDirty != true)
            Button("Close Tab") { model.closeCurrentTab() }
                .keyboardShortcut("w", modifiers: .command)
                .disabled(model.selectedTabId == nil)
        }
        CommandMenu("Tabs") {
            Button("Next Tab") { model.selectNextTab(offset: 1) }
                .keyboardShortcut("]", modifiers: [.command, .shift])
            Button("Previous Tab") { model.selectNextTab(offset: -1) }
                .keyboardShortcut("[", modifiers: [.command, .shift])
            Divider()
            Button("Refresh Project") { Task { await model.refresh() } }
                .keyboardShortcut("r", modifiers: .command)
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
