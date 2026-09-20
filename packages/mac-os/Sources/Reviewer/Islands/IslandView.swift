// Puts an island's web view in a SwiftUI hierarchy. The view is the host's
// and outlives this representable — see `IslandHost` — and stands in a
// `HeldView`, so a move of the sidebar does not resize it frame by frame.
import SwiftUI
import WebKit

struct IslandView: NSViewRepresentable {
    let host: IslandHost

    func makeNSView(context: Context) -> HeldView {
        HeldView(holding: host.webView)
    }

    func updateNSView(_ nsView: HeldView, context: Context) {
        nsView.follow(context.environment.sidebarHold)
    }
}
