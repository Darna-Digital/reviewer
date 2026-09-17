// swift-tools-version: 6.2
//
// reviewer mac-os — a native SwiftUI shell around the same embedded server the
// Electron desktop app runs, hosting the web app's surfaces as islands in its
// own layout. One executable target, no Xcode project: `swift build` produces
// the binary and `scripts/bundle.sh` wraps it in a `.app` so it gets a dock
// icon, an Info.plist and the ordinary Finder launch path.
import PackageDescription

let package = Package(
    name: "Reviewer",
    // macOS 26 is the floor: the window wears the system's current design —
    // the sidebar a glass pane floating over the content, the toolbar in it —
    // which AppKit only gives an app built against the 26 SDK. (SwiftPM
    // records the deployment target as the linked SDK, so the floor is what
    // decides it; a 15.0 floor came up in the old flat look on a 26 machine.)
    platforms: [.macOS(.v26)],
    dependencies: [
        // The terminal emulator behind the bottom pane's Terminal and the
        // Services output: a local shell in the project, and a view fed from
        // the server's dev-process sockets. Its Metal renderer needs Xcode's
        // Metal toolchain, a separate download:
        // `xcodebuild -downloadComponent MetalToolchain`.
        .package(url: "https://github.com/migueldeicaza/SwiftTerm.git", from: "1.20.0")
    ],
    targets: [
        .executableTarget(
            name: "Reviewer",
            dependencies: [.product(name: "SwiftTerm", package: "SwiftTerm")],
            path: "Sources/Reviewer",
            swiftSettings: [
                .swiftLanguageMode(.v6)
            ]
        )
    ]
)
