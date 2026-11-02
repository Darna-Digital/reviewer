// The workspace window, made by AppKit rather than by a SwiftUI `Window`
// scene, with `ContentView` hosted in it.
//
// So that the window's toolbar can be AppKit's own (see `WindowToolbar`).
// A scene's window has its toolbar kept by SwiftUI — made from the views'
// `.toolbar` content, and re-made whenever SwiftUI next lays the window
// out — and a toolbar put on that window in its place is torn down by
// SwiftUI as one of its own, which raises. A hosting controller can be
// told to leave the window's toolbar alone (`sceneBridgingOptions`), and
// only a window AppKit made is one whose hosting controller is ours to
// tell; it still hands the window its title, from `navigationTitle`.
//
// Everything else the scene gave the window is given here: the hidden
// title bar and the full-height unified toolbar, under which the
// sidebar's pane runs up to the window's top edge with the traffic lights
// inside it; the size it opens at and keeps between launches; and opening
// at launch and from the Dock. Closed, it lets its views go, so it opens
// again as the scene's window did — fresh, on whatever the model holds.
import AppKit
import SwiftUI

@MainActor
final class WorkspaceWindow: NSObject, NSWindowDelegate {
    private static var shared: WorkspaceWindow?

    private let model: AppModel
    private let window: NSWindow
    private let toolbar: WindowToolbar

    private static let minimumSize = NSSize(width: 900, height: 560)
    private static let defaultSize = NSSize(width: 1280, height: 800)
    private static let frameName = "ReviewerWorkspaceWindow"

    static func install(model: AppModel) {
        guard shared == nil else { return }
        shared = WorkspaceWindow(model: model)
    }

    /// Brings the window up, with its views made afresh if it was closed.
    static func show() {
        shared?.show()
    }

    static func close() {
        shared?.window.close()
    }

    static var isVisible: Bool { shared?.window.isVisible ?? false }

    private init(model: AppModel) {
        self.model = model
        window = NSWindow(
            contentRect: NSRect(origin: .zero, size: Self.defaultSize),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered, defer: true)
        toolbar = WindowToolbar(model: model)
        super.init()
        window.isReleasedWhenClosed = false
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.tabbingMode = .disallowed
        window.collectionBehavior.insert(.fullScreenPrimary)
        window.contentMinSize = Self.minimumSize
        window.delegate = self
        toolbar.install(in: window)
        if !window.setFrameUsingName(Self.frameName) {
            window.setContentSize(Self.defaultSize)
            window.center()
        }
        window.setFrameAutosaveName(Self.frameName)
    }

    private func show() {
        if window.contentViewController == nil {
            // A window takes a content controller's view at the view's own
            // size, which for the hosted content is its least — and the
            // autosave would keep that. The window keeps its frame instead.
            let frame = window.frame
            window.contentViewController = hosting()
            window.setFrame(frame, display: false)
        }
        window.makeKeyAndOrderFront(nil)
    }

    private func hosting() -> NSViewController {
        let model = model
        let root = ContentView()
            .environment(model)
            // Re-opened from the opener, the window finds the server
            // already answering, and only the first opening boots it.
            .task { if model.connection != .ready { await model.bootstrap() } }
            .frame(minWidth: Self.minimumSize.width, minHeight: Self.minimumSize.height)
        let controller = NSHostingController(rootView: root)
        controller.sceneBridgingOptions = [.title]
        controller.sizingOptions = []
        return controller
    }

    func windowWillClose(_ notification: Notification) {
        window.saveFrame(usingName: Self.frameName)
        // Let the views go after the window is off screen, not while
        // AppKit is still closing it.
        DispatchQueue.main.async { [window] in
            if !window.isVisible { window.contentViewController = nil }
        }
    }
}
