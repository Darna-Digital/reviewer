// The drag a person would do, done by a program: a file dragged out of this
// probe's own window and let go somewhere on screen — Reviewer's prompt box,
// its conversation — so a drop can be tried without a hand on the mouse.
//
// Dropping an image into an agent session broke four times over four days
// and each fix shipped unverified, because an AppKit drag is the one gesture
// nothing in the repo could perform: a `DragGesture` can be faked at the
// SwiftUI layer, but the drag a photo arrives on is a system dragging
// session, and only the app the file leaves can start one. So the probe is
// that app. It holds a real file, it begins a real `NSDraggingSession`, and
// the receiving side cannot tell the difference — which makes `island.covered`,
// `catcher.entered` and the rest of `DropDiagnostics` an oracle at last.
//
//   swift run DragProbe --image ~/photo.jpg --to 1200,600
//   swift run DragProbe --windows Reviewer          # where to aim
//
// The mouse is driven with `CGEvent`s posted to the HID tap, which the system
// only accepts from a process the user has trusted for Accessibility — the
// probe says so and names its own binary when it is not. The grant follows
// the binary's path, so it survives rebuilds and is asked for once.
//
// Coordinates everywhere here are the display's: the origin at the top-left
// of the main screen, y downwards, as `CGEvent` and the window list have it,
// rather than AppKit's bottom-left. `screenFrame` converts the one place the
// two meet.
import AppKit
import CoreGraphics

/// Where the drag starts, where it ends, and what it carries.
struct ProbeRun {
    var image: URL
    var from: CGPoint
    var to: CGPoint
    /// How long the pointer takes to cross, in steps of about 20ms — a drag
    /// that jumps in one move is a drag the destination never sees enter.
    var steps = 40
    /// The pause on the target before letting go, so `draggingUpdated` has
    /// settled and the destination has decided what it will do.
    var holdMilliseconds: UInt32 = 400
}

/// What the command line came to: a run to make, or what was wrong with it.
enum ProbeArguments {
    enum Outcome {
        case run(ProbeRun)
        case fault(String)
    }

    static func parse(_ arguments: [String]) -> Outcome {
        var image: URL?
        var from = CGPoint(x: 220, y: 220)
        var to: CGPoint?
        var run = ProbeRun(image: URL(fileURLWithPath: "/"), from: from, to: .zero)

        var index = 1
        while index < arguments.count {
            let flag = arguments[index]
            let value = index + 1 < arguments.count ? arguments[index + 1] : nil
            switch flag {
            case "--image":
                guard let value else { return .fault("--image needs a path") }
                image = URL(fileURLWithPath: (value as NSString).expandingTildeInPath)
            case "--from":
                guard let value, let point = point(from: value) else { return .fault("--from needs x,y") }
                from = point
            case "--to":
                guard let value, let point = point(from: value) else { return .fault("--to needs x,y") }
                to = point
            case "--steps":
                guard let value, let steps = Int(value), steps > 0 else { return .fault("--steps needs a count") }
                run.steps = steps
            case "--hold":
                guard let value, let hold = UInt32(value) else { return .fault("--hold needs milliseconds") }
                run.holdMilliseconds = hold
            default:
                return .fault("unknown argument \(flag)")
            }
            index += 2
        }

        guard let image else { return .fault("--image is required") }
        guard FileManager.default.fileExists(atPath: image.path) else { return .fault("no file at \(image.path)") }
        guard let to else { return .fault("--to is required") }
        run.image = image
        run.from = from
        run.to = to
        return .run(run)
    }

    private static func point(from text: String) -> CGPoint? {
        let parts = text.split(separator: ",")
        guard parts.count == 2, let x = Double(parts[0]), let y = Double(parts[1]) else { return nil }
        return CGPoint(x: x, y: y)
    }
}

/// The windows on screen, in the display's coordinates — what to aim `--to`
/// at, since a window's place is the shell's to know and not this probe's.
enum WindowList {
    static func print(app: String?) {
        let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
        let windows = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] ?? []
        for window in windows {
            let owner = window[kCGWindowOwnerName as String] as? String ?? "?"
            if let app, owner != app { continue }
            guard let bounds = window[kCGWindowBounds as String] as? [String: CGFloat],
                let x = bounds["X"], let y = bounds["Y"], let width = bounds["Width"], let height = bounds["Height"],
                width > 80, height > 80
            else { continue }
            let name = window[kCGWindowName as String] as? String ?? ""
            Swift.print("\(owner)\(name.isEmpty ? "" : " — \(name)"): origin \(Int(x)),\(Int(y)) size \(Int(width))×\(Int(height)) centre \(Int(x + width / 2)),\(Int(y + height / 2))")
        }
    }
}

/// The view the file leaves from. AppKit starts a dragging session only from
/// a view answering a real mouse drag, which is the whole reason the probe
/// has a window at all.
@MainActor
final class DragSourceView: NSView, NSDraggingSource {
    var file: URL?
    private var started = false

    override func mouseDragged(with event: NSEvent) {
        guard !started, let file else { return }
        started = true
        let item = NSDraggingItem(pasteboardWriter: file as NSURL)
        let preview = NSImage(contentsOf: file) ?? NSImage(size: NSSize(width: 64, height: 64))
        item.setDraggingFrame(bounds, contents: preview)
        beginDraggingSession(with: [item], event: event, source: self)
    }

    func draggingSession(_ session: NSDraggingSession, sourceOperationMaskFor context: NSDraggingContext) -> NSDragOperation {
        .copy
    }

    func draggingSession(_ session: NSDraggingSession, endedAt screenPoint: NSPoint, operation: NSDragOperation) {
        let took = operation.contains(.copy) || operation.contains(.move) || operation.contains(.generic)
        Swift.print(took ? "drop taken (operation \(operation.rawValue))" : "drop refused — nothing there took it")
        exit(took ? 0 : 2)
    }
}

@MainActor
final class Probe: NSObject, NSApplicationDelegate {
    private let run: ProbeRun
    private var window: NSWindow?

    init(run: ProbeRun) {
        self.run = run
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        let size = CGSize(width: 130, height: 130)
        let origin = CGPoint(x: run.from.x - size.width / 2, y: run.from.y - size.height / 2)
        let window = NSWindow(
            contentRect: NSRect(origin: Self.screenFrame(origin: origin, size: size), size: size),
            styleMask: [.borderless], backing: .buffered, defer: false)
        window.level = .floating
        window.backgroundColor = .systemYellow
        window.isReleasedWhenClosed = false

        let view = DragSourceView(frame: NSRect(origin: .zero, size: size))
        view.file = run.image
        window.contentView = view
        window.orderFrontRegardless()
        self.window = window

        let run = run
        Thread.detachNewThread { Mouse.drag(run) }
    }

    /// AppKit's origin is the bottom-left of the main screen and the display's
    /// is the top-left, so a window placed at a point the mouse will be sent
    /// to has to be flipped into the one from the other.
    private static func screenFrame(origin: CGPoint, size: CGSize) -> CGPoint {
        let height = NSScreen.screens.first?.frame.height ?? 0
        return CGPoint(x: origin.x, y: height - origin.y - size.height)
    }
}

enum Mouse {
    static func drag(_ run: ProbeRun) {
        post(.mouseMoved, at: run.from)
        usleep(150_000)
        post(.leftMouseDown, at: run.from)
        usleep(150_000)

        // The first short moves are what makes AppKit call the drag a drag
        // rather than a click, and they have to land on the source window.
        for step in 1...5 {
            post(.leftMouseDragged, at: CGPoint(x: run.from.x + Double(step) * 3, y: run.from.y + Double(step) * 3))
            usleep(40_000)
        }

        for step in 1...run.steps {
            let progress = Double(step) / Double(run.steps)
            post(
                .leftMouseDragged,
                at: CGPoint(
                    x: run.from.x + (run.to.x - run.from.x) * progress,
                    y: run.from.y + (run.to.y - run.from.y) * progress))
            usleep(20_000)
        }

        usleep(run.holdMilliseconds * 1000)
        post(.leftMouseUp, at: run.to)

        // The source hears how it ended and leaves; this is the way out when
        // nothing answers at all.
        usleep(3_000_000)
        Swift.print("no answer from the drag session — nothing took the drop and nothing refused it")
        exit(3)
    }

    private static func post(_ type: CGEventType, at point: CGPoint) {
        guard let event = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: point, mouseButton: .left) else {
            return
        }
        event.post(tap: .cghidEventTap)
    }
}

let arguments = CommandLine.arguments

if let index = arguments.firstIndex(of: "--windows") {
    WindowList.print(app: index + 1 < arguments.count ? arguments[index + 1] : nil)
    exit(0)
}

switch ProbeArguments.parse(arguments) {
case .fault(let reason):
    FileHandle.standardError.write(
        """
        DragProbe: \(reason)

          swift run DragProbe --image <path> --to <x>,<y> [--from <x>,<y>] [--steps 40] [--hold 400]
          swift run DragProbe --windows [app]

        """.data(using: .utf8)!)
    exit(64)
case .run(let run):
    // Asking with the prompt puts the probe in the Accessibility list itself,
    // so the grant is a switch to flip rather than a binary to go and find.
    // The key spelled out rather than `kAXTrustedCheckOptionPrompt`, which is
    // a global `var` the compiler will not let a Swift 6 program read.
    let trusted = AXIsProcessTrustedWithOptions(["AXTrustedCheckOptionPrompt" as CFString: true] as CFDictionary)
    if !trusted {
        FileHandle.standardError.write(
            """
            DragProbe is not trusted for Accessibility, so the mouse events it posts are dropped.
            System Settings › Privacy & Security › Accessibility is now open with DragProbe in the
            list: turn it on, and this holds for every build signed the same way.

              \(CommandLine.arguments[0])

            """.data(using: .utf8)!)
        exit(77)
    }
    let app = NSApplication.shared
    let probe = Probe(run: run)
    app.setActivationPolicy(.accessory)
    app.delegate = probe
    app.run()
}
