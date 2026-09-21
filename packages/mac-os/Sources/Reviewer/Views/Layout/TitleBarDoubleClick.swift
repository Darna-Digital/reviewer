// A double-click on the window's bar zooms the window — or minimizes it,
// or fills the screen, whatever the Desktop settings say a title bar's
// double-click does. The system only answers it on the bar's bare glass,
// and the detail's run of the bar is neither bare — the tabs stand on it —
// nor glass — its background is put away and the islands run up under it
// (see `ContentView`) — so a double-click there did nothing where one on
// the sidebar's pane worked. The app watches its own event stream instead:
// a second click landing anywhere in a window's bar, short of the traffic
// lights, goes to the window as the title bar would have sent it, and is
// consumed so whatever stands under it is not pressed twice.
import AppKit

@MainActor
enum TitleBarDoubleClick {
    private static var monitor: Any?

    static func install() {
        guard monitor == nil else { return }
        monitor = NSEvent.addLocalMonitorForEvents(matching: .leftMouseDown) { event in
            guard event.clickCount == 2, let window = event.window, window.barCovers(event.locationInWindow)
            else { return event }
            window.performTitleBarDoubleClickAction()
            return nil
        }
    }
}

private extension NSWindow {
    /// The bar is the band the content layout leaves free at the top — the
    /// toolbar's height, with or without a toolbar of its own — less the
    /// traffic lights, whose own presses are theirs.
    func barCovers(_ pointInWindow: NSPoint) -> Bool {
        guard styleMask.contains(.titled), contentView != nil else { return false }
        let bar = NSRect(
            x: 0, y: contentLayoutRect.maxY,
            width: frame.width, height: frame.height - contentLayoutRect.maxY)
        guard bar.contains(pointInWindow) else { return false }
        let trafficLights: [NSWindow.ButtonType] = [.closeButton, .miniaturizeButton, .zoomButton]
        return !trafficLights.compactMap(standardWindowButton).contains { light in
            light.superview.map { $0.convert(light.frame, to: nil).contains(pointInWindow) } ?? false
        }
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
