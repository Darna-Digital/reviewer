// swift-tools-version: 6.0
//
// reviewer mac-os — a native SwiftUI shell around the same embedded server the
// Electron desktop app runs. One executable target, no Xcode project: `swift
// build` produces the binary and `scripts/bundle.sh` wraps it in a `.app` so it
// gets a dock icon, an Info.plist and the ordinary Finder launch path.
import PackageDescription

let package = Package(
    name: "Reviewer",
    // macOS 15 is the floor: the sidebar/detail split, `.inspector`, the
    // `@Observable` model and `TextEditor` styling used here all settle there.
    platforms: [.macOS(.v15)],
    dependencies: [
        // highlight.js run through JavaScriptCore — 180+ grammars without
        // shipping a parser per language, which is what makes it the right
        // size for this shell. It only turns a string into an attributed one;
        // keeping the text view's storage current is `CodeEditor`'s job.
        .package(url: "https://github.com/smittytone/HighlighterSwift.git", from: "3.0.0")
    ],
    targets: [
        .executableTarget(
            name: "Reviewer",
            dependencies: [.product(name: "Highlighter", package: "HighlighterSwift")],
            path: "Sources/Reviewer",
            swiftSettings: [
                .swiftLanguageMode(.v6)
            ]
        )
    ]
)
