// The window `UpdateCheck` puts up when a newer release is out: the app's
// icon, what is new against what is running, and the three answers Sparkle
// taught Mac users to expect — skip this version, remind me later, download.
//
// A plain AppKit window rather than a SwiftUI scene: the check runs from the
// app delegate, outside any view's `openWindow`, and must be able to show
// whichever of the workspace or the opener is up — or neither. It never
// activates the app on its own; a check that lands while another app is in
// front orders the window forward within Reviewer and bounces the dock icon
// once, so it waits there rather than taking the keyboard mid-sentence.
import AppKit
import SwiftUI

@MainActor
final class UpdateWindowController: NSObject, NSWindowDelegate {
    private var window: NSWindow?
    private var shownVersion: String?
    private var onChoice: ((UpdateChoice) -> Void)?

    func show(_ update: AvailableUpdate, current: String, onChoice: @escaping (UpdateChoice) -> Void) {
        if let window, window.isVisible, shownVersion == update.version {
            window.orderFront(nil)
            return
        }
        dismiss()
        self.onChoice = onChoice
        shownVersion = update.version

        let content = UpdateAvailableView(update: update, current: current) { [weak self] choice in
            self?.finish(choice)
        }
        let hosting = NSHostingController(rootView: content)
        hosting.sizingOptions = .preferredContentSize
        let window = NSWindow(contentViewController: hosting)
        window.title = "Software update"
        window.styleMask = [.titled, .closable]
        window.isReleasedWhenClosed = false
        window.isRestorable = false
        window.delegate = self
        window.center()
        window.makeKeyAndOrderFront(nil)
        self.window = window

        if !NSApp.isActive { NSApp.requestUserAttention(.informationalRequest) }
    }

    private func finish(_ choice: UpdateChoice) {
        let answer = onChoice
        onChoice = nil
        answer?(choice)
        dismiss()
    }

    private func dismiss() {
        window?.delegate = nil
        window?.close()
        window = nil
        shownVersion = nil
    }

    /// The close button is a "later": the window goes, and comes back in a
    /// day rather than at the next check.
    func windowWillClose(_ notification: Notification) {
        let answer = onChoice
        onChoice = nil
        window = nil
        shownVersion = nil
        answer?(.later)
    }
}

private struct UpdateAvailableView: View {
    let update: AvailableUpdate
    let current: String
    let choose: (UpdateChoice) -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            Image(nsImage: NSApp.applicationIconImage)
                .resizable()
                .frame(width: 64, height: 64)
            VStack(alignment: .leading, spacing: 8) {
                Text("A new version of Reviewer is available!")
                    .font(.headline)
                Text("Reviewer \(update.version) is now available — you have \(current). Would you like to download it now?")
                    .fixedSize(horizontal: false, vertical: true)
                Text("Open the disk image and drag Reviewer into Applications, replacing this copy.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                HStack {
                    Button("Skip this version") { choose(.skip) }
                    Spacer()
                    Button("Remind me later") { choose(.later) }
                        .keyboardShortcut(.cancelAction)
                    Button("Download") { choose(.download) }
                        .keyboardShortcut(.defaultAction)
                }
                .padding(.top, 12)
            }
        }
        .padding(20)
        .frame(width: 500)
    }
}
