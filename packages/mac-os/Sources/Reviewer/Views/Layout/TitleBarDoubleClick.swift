// A double-click on the window's bar zooms the window — or minimizes it,
// or fills the screen, whatever the Desktop settings say a title bar's
// double-click does. The system only answers it on the bar's bare glass,
// and the detail's run of the bar is neither bare — the tabs stand on it —
// nor glass — its background is put away and the islands run up under it
// (see `ContentView`) — so a double-click there did nothing where one on
// the sidebar's pane worked. The app watches its own event stream instead:
// a second click landing on the bare run of a window's bar goes to the
// window as the title bar would have sent it, and is consumed so whatever
// stands under it is not pressed twice.
//
// Bare is the whole of the bar but the controls on it: the traffic lights,
// and the toolbar's own items — the tabs, their ✕, the project chip. The
// window is not zoomed out from under a control that is being worked, and
// a click on one is never eaten: clicking the same tab twice, or
// shift-clicking a run of them closed, lands two clicks in a row in the
// same place, and the second of those is a double-click.
import AppKit

@MainActor
enum TitleBarDoubleClick {
    private static var monitor: Any?

    static func install() {
        guard monitor == nil else { return }
        monitor = NSEvent.addLocalMonitorForEvents(matching: .leftMouseDown) { event in
            guard event.clickCount == 2, event.barModifiers.isEmpty,
                let window = event.window, window.barCovers(event.locationInWindow)
            else { return event }
            window.performTitleBarDoubleClickAction()
            return nil
        }
    }
}

private extension NSEvent {
    /// The keys held with the click, Caps Lock aside — a state rather than
    /// a press. A click carrying one is somebody reaching for something
    /// else, a shift-click closing a tab among them, so the bar keeps out
    /// of its way.
    var barModifiers: NSEvent.ModifierFlags {
        modifierFlags.intersection(.deviceIndependentFlagsMask).subtracting(.capsLock)
    }
}

private extension NSWindow {
    /// The bar is the band the content layout leaves free at the top — the
    /// toolbar's height, with or without a toolbar of its own — less the
    /// traffic lights, whose own presses are theirs, and less whatever the
    /// toolbar has standing in it.
    func barCovers(_ pointInWindow: NSPoint) -> Bool {
        guard styleMask.contains(.titled), let frameView = contentView?.superview else { return false }
        let bar = NSRect(
            x: 0, y: contentLayoutRect.maxY,
            width: frame.width, height: frame.height - contentLayoutRect.maxY)
        guard bar.contains(pointInWindow) else { return false }
        let trafficLights: [NSWindow.ButtonType] = [.closeButton, .miniaturizeButton, .zoomButton]
        let onALight = trafficLights.compactMap(standardWindowButton).contains { light in
            light.superview.map { $0.convert(light.frame, to: nil).contains(pointInWindow) } ?? false
        }
        return !onALight && frameView.hitTest(pointInWindow)?.isToolbarItemContent != true
    }

    /// What the system does for a double-click on this window's title bar,
    /// as the Desktop & Dock setting has it. Fill has no public entry, so it
    /// goes through the selector the Window menu's own item uses.
    func performTitleBarDoubleClickAction() {
        switch UserDefaults.standard.string(forKey: "AppleActionOnDoubleClick") {
        case "None":
            break
        case "Minimize":
            miniaturize(nil)
        case "Fill" where responds(to: Selector(("_zoomFill:"))):
            perform(Selector(("_zoomFill:")), with: nil)
        default:
            zoom(nil)
        }
    }
}

private extension NSView {
    /// Whether this view is a toolbar item's own content — a tab, the
    /// sidebar's toggle, the project chip — rather than the bar's bare
    /// surface.
    ///
    /// Read off the view hierarchy for want of anywhere else to read it: a
    /// SwiftUI scene's `toolbar` is not on the window, so there is no run
    /// of items to ask where each landed, and the toolbar leaves no other
    /// mark than the view it wraps every item in. The bar's spaces are
    /// wrapped in one too and are bare, so what is looked for is a hosted
    /// view inside the wrapper — which is what an item of ours is, the
    /// toolbar hosting each one's SwiftUI view — and the island running up
    /// under the bar, hosted but no part of the toolbar, is bare as it
    /// should be.
    var isToolbarItemContent: Bool {
        var hosted = false
        var view: NSView? = self
        while let current = view {
            let name = String(describing: type(of: current))
            if name.contains("HostingView") { hosted = true }
            if name.hasPrefix("NSToolbarItemViewer") { return hosted }
            view = current.superview
        }
        return false
    }
}
