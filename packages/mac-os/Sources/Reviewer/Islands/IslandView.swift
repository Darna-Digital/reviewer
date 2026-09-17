// Puts an island's web view in a SwiftUI hierarchy. The view is the host's
// and outlives this representable — see `IslandHost`.
import SwiftUI
import WebKit

struct IslandView: NSViewRepresentable {
    let host: IslandHost

    func makeNSView(context: Context) -> WKWebView {
        host.webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}
}
