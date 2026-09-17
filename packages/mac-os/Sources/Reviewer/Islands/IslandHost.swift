// One island: the web view showing one part of the SPA, and the bridge the
// two sides talk over. The shell tells the island where to be (`navigate`)
// and when what it holds has gone stale (`refresh`); the island tells the
// shell when it is up (`ready`) and where it has gone (`navigated`). That is
// the whole protocol — the SPA's `lib/shell` is the other half of it.
//
// The web view is made once and kept for the life of the host: SwiftUI can
// take it out of the hierarchy and put it back — a chat tab in front of the
// code island — and the page, its scroll and its open file survive the trip.
import AppKit
import Observation
import WebKit

@MainActor
@Observable
final class IslandHost: NSObject {
    let kind: IslandKind
    private(set) var href: String
    private(set) var isReady = false

    @ObservationIgnored var onNavigated: ((String) -> Void)?
    @ObservationIgnored var onOpenDirectory: (() -> String?)?

    @ObservationIgnored private let source: SpaSource
    @ObservationIgnored private let apiBaseURL: URL
    @ObservationIgnored private var loaded = false
    @ObservationIgnored private lazy var view: WKWebView = makeWebView()
    @ObservationIgnored private var appearanceObservation: NSKeyValueObservation?

    init(kind: IslandKind, href: String, source: SpaSource, apiBaseURL: URL) {
        self.kind = kind
        self.href = href
        self.source = source
        self.apiBaseURL = apiBaseURL
    }

    /// The web view, loading its document on first ask so an island that is
    /// never shown never spends a web process.
    var webView: WKWebView {
        if !loaded {
            loaded = true
            view.load(URLRequest(url: source.url(for: href)))
        }
        return view
    }

    func navigate(to href: String) {
        self.href = href
        guard isReady else { return }
        dispatch(["type": "navigate", "href": href])
    }

    func refresh() {
        guard isReady else { return }
        dispatch(["type": "refresh"])
    }

    func reload() {
        isReady = false
        view.load(URLRequest(url: source.url(for: href)))
    }

    private func dispatch(_ event: [String: String]) {
        guard let data = try? JSONSerialization.data(withJSONObject: event),
            let json = String(data: data, encoding: .utf8)
        else { return }
        view.evaluateJavaScript("window.reviewer.shell.dispatch(\(json))") { _, _ in }
    }

    // MARK: web view

    private func makeWebView() -> WKWebView {
        let configuration = WKWebViewConfiguration()
        // Every island is the one origin in the one default store, so they
        // share cookies and local storage — the SPA's prefs — as one app.
        configuration.websiteDataStore = .default()
        if case .bundled(let directory) = source {
            configuration.setURLSchemeHandler(SpaSchemeHandler(directory: directory), forURLScheme: SpaSource.scheme)
        }
        let content = configuration.userContentController
        content.addScriptMessageHandler(self, contentWorld: .page, name: Self.messageHandlerName)
        installUserScripts(in: content)

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isInspectable = true
        // The document is transparent (see `.island body` in the SPA's styles)
        // and the window's own material shows through where it paints nothing.
        webView.underPageBackgroundColor = .clear
        webView.setValue(false, forKey: "drawsBackground")
        observeAppearance(for: webView)
        return webView
    }

    /// The bridge, and the window's colours — both before the first script
    /// of the page runs, so nothing paints in the wrong palette first.
    private func installUserScripts(in content: WKUserContentController) {
        content.removeAllUserScripts()
        content.addUserScript(
            WKUserScript(source: bridgeScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        content.addUserScript(
            WKUserScript(source: NativePalette.applyScript(), injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }

    /// Dark to light and back: the live document is repainted, and the
    /// document-start script rewritten so a reload paints right from the
    /// start too.
    private func observeAppearance(for webView: WKWebView) {
        appearanceObservation = NSApp.observe(\.effectiveAppearance) { [weak self] _, _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.installUserScripts(in: webView.configuration.userContentController)
                webView.evaluateJavaScript(NativePalette.applyScript()) { _, _ in }
            }
        }
    }

    private static let messageHandlerName = "reviewerShell"

    /// The `window.reviewer` bridge, installed before the first script runs.
    /// The same shape the Electron preload exposes (`lib/desktop` reads it),
    /// plus the island's name and the channel `lib/shell` talks over. Replies
    /// come back as the promise `postMessage` returns.
    private var bridgeScript: String {
        """
        (() => {
          const handler = window.webkit.messageHandlers.\(Self.messageHandlerName);
          const listeners = new Set();
          window.reviewer = {
            island: "\(kind.rawValue)",
            apiBaseUrl: "\(apiBaseURL.absoluteString)",
            openDirectory: () => handler.postMessage({ type: "openDirectory" }),
            shell: {
              post: (intent) => handler.postMessage(intent),
              subscribe(listener) {
                listeners.add(listener);
                return () => listeners.delete(listener);
              },
              dispatch(event) {
                for (const listener of listeners) listener(event);
              },
            },
          };
        })();
        """
    }
}

extension IslandHost: WKScriptMessageHandlerWithReply {
    func userContentController(
        _ userContentController: WKUserContentController, didReceive message: WKScriptMessage
    ) async -> (Any?, String?) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else {
            return (nil, "malformed shell message")
        }
        switch type {
        case "ready":
            isReady = true
            dispatch(["type": "navigate", "href": href])
            return (nil, nil)
        case "navigated":
            if let href = body["href"] as? String {
                self.href = href
                onNavigated?(href)
            }
            return (nil, nil)
        case "openDirectory":
            return (onOpenDirectory?() as Any?, nil)
        default:
            return (nil, "unknown shell message: \(type)")
        }
    }
}

extension IslandHost: WKNavigationDelegate, WKUIDelegate {
    /// The app's own origins stay in the view; a link out to the web — a pull
    /// request on GitHub — goes to the default browser, the window having no
    /// address bar to come back with.
    func webView(
        _ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction
    ) async -> WKNavigationActionPolicy {
        guard let url = navigationAction.request.url else { return .cancel }
        if isInternal(url) { return .allow }
        NSWorkspace.shared.open(url)
        return .cancel
    }

    func webView(
        _ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url { NSWorkspace.shared.open(url) }
        return nil
    }

    private func isInternal(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else { return true }
        if scheme == SpaSource.scheme || scheme == "about" || scheme == "blob" || scheme == "data" {
            return true
        }
        return sameOrigin(url, source.origin) || sameOrigin(url, apiBaseURL)
    }

    private func sameOrigin(_ a: URL, _ b: URL) -> Bool {
        a.scheme?.lowercased() == b.scheme?.lowercased() && a.host == b.host && a.port == b.port
    }
}
