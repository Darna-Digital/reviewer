// swift-tools-version: 6.2
//
// reviewer mac-os — a native SwiftUI shell around the embedded server,
// hosting the web app's surfaces as islands in its own layout. One executable target, no Xcode project: `swift build` produces
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
        // What the app and its widget agree on: the project feed the app
        // writes for the widget to read, the `reviewer://open` link the
        // widget opens a project through, and the repository monogram.
        .target(
            name: "ReviewerShared",
            path: "Sources/ReviewerShared",
            swiftSettings: [
                .swiftLanguageMode(.v6)
            ]
        ),
        .executableTarget(
            name: "Reviewer",
            dependencies: [
                "ReviewerShared",
                .product(name: "SwiftTerm", package: "SwiftTerm"),
            ],
            path: "Sources/Reviewer",
            swiftSettings: [
                .swiftLanguageMode(.v6)
            ]
        ),
        // The drag a person would otherwise have to do by hand: a file
        // dragged out of its own window into whatever is under the point it
        // is sent to, so a drop into the app can be tried from a script.
        // See `Sources/DragProbe/main.swift`.
        .executableTarget(
            name: "DragProbe",
            path: "Sources/DragProbe",
            swiftSettings: [
                .swiftLanguageMode(.v6)
            ]
        ),
        // The WidgetKit extension — the Projects widget for the desktop and
        // Notification Centre. SwiftPM builds it as one more executable;
        // `scripts/bundle.sh` wraps it as ReviewerWidget.appex inside the
        // app, where the system finds it. Compiled as an application
        // extension, as Xcode would, so the compiler keeps it to the API an
        // extension may use.
        .executableTarget(
            name: "ReviewerWidget",
            dependencies: ["ReviewerShared"],
            path: "Sources/ReviewerWidget",
            swiftSettings: [
                .swiftLanguageMode(.v6),
                .unsafeFlags(["-application-extension"]),
            ],
            linkerSettings: [
                // What Xcode links an extension with: the bundle loads as
                // an extension rather than a program, and NSExtensionMain
                // is its entry — the XPC bootstrap that answers the widget
                // host when it asks which widgets this bundle vends. Left
                // at Swift's own `main`, the process comes up with no
                // listener, the host gets no descriptors back, and the
                // widget never reaches the gallery.
                .unsafeFlags(["-Xlinker", "-application_extension"]),
                .unsafeFlags(["-Xlinker", "-e", "-Xlinker", "_NSExtensionMain"]),
                .linkedFramework("WidgetKit"),
                .linkedFramework("SwiftUI"),
            ]
        ),
    ]
)
