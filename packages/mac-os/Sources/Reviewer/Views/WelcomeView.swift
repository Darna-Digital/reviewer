// The welcome window: the one the system's own developer tools open on
// with no project to show — the app's icon, name and version with the way
// in under them, and beside that the projects the server remembers as a
// list. The list is the system's: a click picks a row, a double-click or
// Return opens it, the arrows move the pick, and the row's menu reaches
// the folder in Finder. The window is Xcode's welcome in its shape too: a
// fixed sheet with no title bar and only the close button, dragged by any
// of its surface. It is the window up while no project is (the workspace
// hands over to it, see `ContentView`), and the one the Window menu and
// the project chip bring up over an open workspace; a project opened in
// it hands back — the workspace forward, the welcome away. Everything it
// does goes through the same calls the File menu makes, so it is one
// more way to the picker rather than a picker of its own.
import AppKit
import SwiftUI

struct WelcomeWindow: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openWindow) private var openWindow
    @Environment(\.dismissWindow) private var dismissWindow

    var body: some View {
        WelcomeView()
            .frame(width: 800, height: 460)
            .background(WelcomeWindowChrome())
            .serverErrorAlert()
            .onChange(of: model.projectOpens) {
                openWindow(id: ReviewerWindow.workspace)
                dismissWindow(id: ReviewerWindow.welcome)
            }
    }
}

/// The window's chrome as Xcode's welcome wears it: the close button
/// alone at the corner, and the whole surface a handle, since there is no
/// title bar to drag it by. Reached through the view's own window once it
/// has one — SwiftUI's scene modifiers say nothing about the buttons.
private struct WelcomeWindowChrome: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView { ChromeView() }
    func updateNSView(_ view: NSView, context: Context) {}

    private final class ChromeView: NSView {
        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            guard let window else { return }
            window.isMovableByWindowBackground = true
            window.standardWindowButton(.miniaturizeButton)?.isHidden = true
            window.standardWindowButton(.zoomButton)?.isHidden = true
        }
    }
}

struct WelcomeView: View {
    @Environment(AppModel.self) private var model

    private static let recentsWidth: CGFloat = 300

    var body: some View {
        HStack(spacing: 0) {
            WelcomeHero()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(nsColor: .windowBackgroundColor))
            Divider()
            RecentProjects()
                .frame(width: Self.recentsWidth)
        }
    }
}

/// The app, and the way in: its icon over its name and version, with the
/// open action under them — the block left-aligned within itself and set
/// in the middle of the pane, as the Xcode welcome sets its own.
private struct WelcomeHero: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Image(nsImage: NSApp.applicationIconImage)
                .resizable()
                .interpolation(.high)
                .frame(width: 128, height: 128)
                .padding(.leading, -8)
            Text("Welcome to Reviewer")
                .font(.system(size: 34, weight: .semibold))
                .padding(.top, 10)
            if let version = Self.version {
                Text("Version \(version)")
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
                    .padding(.top, 4)
            }
            WelcomeAction(
                symbol: "folder",
                title: "Open Project…",
                subtitle: "Choose a folder holding one or more git repositories"
            ) {
                model.chooseProject()
            }
            .padding(.top, 36)
        }
        .padding(48)
    }

    /// The bundle's version, absent while the binary runs bare under
    /// `swift run` with no Info.plist to read it from.
    private static var version: String? {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
    }
}

/// One of the welcome's ways in: a symbol in the accent colour beside a
/// title and the line under it, the whole row a button that shows its
/// reach under the pointer and nothing else.
private struct WelcomeAction: View {
    let symbol: String
    let title: String
    let subtitle: String
    let action: () -> Void
    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: symbol)
                    .font(.system(size: 22, weight: .medium))
                    .foregroundStyle(Color.accentColor)
                    .frame(width: 32)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 13, weight: .semibold))
                    Text(subtitle)
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .frame(maxWidth: 360)
            .background(
                Color.primary.opacity(isHovering ? BarChipMetrics.hoverTint : 0),
                in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
        .animation(.easeOut(duration: 0.15), value: isHovering)
    }
}

/// The projects the server remembers, newest first, as the system's own
/// list: the pick is the row, the open is the double-click or Return on
/// it. The list takes the keyboard as the welcome comes up, so the arrows
/// move down it at once.
private struct RecentProjects: View {
    @Environment(AppModel.self) private var model
    @State private var selected: String?
    @FocusState private var isFocused: Bool

    private var recents: [String] { model.workspace?.recents ?? [] }

    var body: some View {
        Group {
            if recents.isEmpty {
                Text("No Recent Projects")
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(recents, id: \.self, selection: $selected) { path in
                    RecentProjectRow(path: path, home: model.workspace?.home)
                        .contentShape(Rectangle())
                        // The double-click declared ahead of the single: a
                        // row with only a two-click gesture on it swallows
                        // the one-click the list would have picked it by,
                        // so the pick is made here, after it.
                        .onTapGesture(count: 2) { open(path) }
                        .onTapGesture { selected = path }
                        .contextMenu {
                            Button("Show in Finder") { revealInFinder(path) }
                        }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .contentMargins(.vertical, 8, for: .scrollContent)
                .focused($isFocused)
                .onKeyPress(.return) {
                    guard let selected else { return .ignored }
                    open(selected)
                    return .handled
                }
                .onAppear { isFocused = true }
            }
        }
        .background(Color(nsColor: .controlBackgroundColor))
    }

    private func open(_ path: String) {
        Task { await model.openProject(path: path) }
    }

    private func revealInFinder(_ path: String) {
        NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: path)])
    }
}

/// A recent as the system lists documents: its avatar, its name, and under
/// the name the folder that tells two of one name apart, the home folder
/// folded to `~` as Finder's title bar has it.
private struct RecentProjectRow: View {
    let path: String
    let home: String?

    var body: some View {
        HStack(spacing: 10) {
            RepoAvatar(name: name, size: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(.system(size: 13, weight: .medium))
                    .lineLimit(1)
                Text(abbreviated)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
        }
        .padding(.vertical, 4)
    }

    private var name: String {
        URL(fileURLWithPath: path).lastPathComponent
    }

    private var abbreviated: String {
        let parent = URL(fileURLWithPath: path).deletingLastPathComponent().path
        guard let home, parent.hasPrefix(home) else { return parent }
        return "~" + parent.dropFirst(home.count)
    }
}
