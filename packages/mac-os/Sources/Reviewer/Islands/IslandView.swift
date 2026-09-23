// Puts an island's web view in a SwiftUI hierarchy. The view is the host's
// and outlives this representable — see `IslandHost` — and stands in a
// `HeldView`, so a move of the sidebar does not resize it frame by frame,
// with the view's cover drop proxy in front of it (see `IslandWebView`).
import SwiftUI
import WebKit

struct IslandView: NSViewRepresentable {
    let host: IslandHost

    func makeNSView(context: Context) -> HeldView {
        let held = HeldView(holding: host.webView)
        host.coverDropProxy.frame = held.bounds
        held.addSubview(host.coverDropProxy)
        return held
    }

    func updateNSView(_ nsView: HeldView, context: Context) {
        nsView.follow(context.environment.sidebarHold)
    }
}
