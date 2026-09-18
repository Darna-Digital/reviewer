// One island: the web view showing one part of the SPA, and the bridge the
// two sides talk over. The shell tells the island where to be (`navigate`)
// and when what it holds has gone stale (`refresh`); the island tells the
// shell when it is up (`ready`) and where it has gone (`navigated`). That is
// the whole protocol — the SPA's `lib/shell` is the other half of it — but
// for three more pairs: the sidebar's file tree the code island reports for
// the shell to draw natively (`tree`, and `treeState` for what moves under
// it), acted on by sending the click back (`tree` again, the other way); the
// sessions list it reports the same way while the page is on the sessions
// surface (`sessions`, both ways); and the window tabs, which are the
// island's own strip — reported as a picture (`windowTabs`) for the menu bar
// to name, and asked things of by the menu items that claim the strip's
// chords (`windowTabs`, the other way). And two more for what the island
// and the shell share of the foot of the window: the find-usages drawer the
// code island keeps under its page — up or down (`dock`), so the native
// pane can leave the foot to it, and put away (`dock`, the other way) when
// the pane takes it back — and a file's history asked for from the page
// (`history`), which the shell's own History surface answers. And one
// for the review in hand: the comments the code island holds for a
// hand-off (`review`), which the shell floats its assign bar over the page
// for, and what the bar was asked to do (`review`, the other way).
//
// The web view is made once and kept for the life of the host: SwiftUI can
// take it out of the hierarchy and put it back, and the page, its scroll and
// its open file survive the trip.
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
    @ObservationIgnored var onWindowTabsReported: ((WindowTabStrip) -> Void)?
    @ObservationIgnored var onTreeReported: ((ShellTree?) -> Void)?
    @ObservationIgnored var onTreeStateReported: ((ShellTreeState) -> Void)?
    @ObservationIgnored var onSessionsReported: ((ShellSessions?) -> Void)?
    @ObservationIgnored var onDockReported: ((DockState) -> Void)?
    @ObservationIgnored var onHistoryRequested: ((String) -> Void)?
    @ObservationIgnored var onReviewReported: ((ShellReview?) -> Void)?

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

    /// The address is the shell's own as soon as it is asked for, not once
    /// the island confirms it, so what follows the address natively — the
    /// sessions surface in the page's place — moves with the click.
    func navigate(to href: String) {
        self.href = href
        onNavigated?(href)
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

    /// A menu item claimed one of the strip's chords — see `WindowTabAction`.
    func send(_ action: WindowTabAction) {
        guard isReady else { return }
        dispatch(["type": "windowTabs", "action": action.payload])
    }

    /// The native sidebar acted on a row of the island's tree — see `TreeAction`.
    func send(_ action: TreeAction) {
        guard isReady else { return }
        dispatch(["type": "tree", "action": action.payload])
    }

    /// The native sidebar acted on a row of the island's sessions list — see
    /// `SessionAction`.
    func send(_ action: SessionAction) {
        guard isReady else { return }
        dispatch(["type": "sessions", "action": action.payload])
    }

    /// The native pane took the foot of the window from the island's
    /// find-usages drawer — see `DockAction`.
    func send(_ action: DockAction) {
        guard isReady else { return }
        dispatch(["type": "dock", "action": action.payload])
    }

    /// The native assign bar acted on the island's review — see
    /// `ReviewAction`.
    func send(_ action: ReviewAction) {
        guard isReady else { return }
        dispatch(["type": "review", "action": action.payload])
    }

    private func dispatch(_ event: [String: Any]) {
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
    /// of the page runs, so nothing paints in the wrong palette first. Into
    /// every frame, not only the top one: the launchpad photographs the app
    /// in a frame of the page, and a picture painted in the app's own palette
    /// would not match the page it stands for. The SPA keeps a frame from
    /// talking back over the bridge (`lib/shell`).
    private func installUserScripts(in content: WKUserContentController) {
        content.removeAllUserScripts()
        content.addUserScript(
            WKUserScript(source: bridgeScript, injectionTime: .atDocumentStart, forMainFrameOnly: false))
        content.addUserScript(
            WKUserScript(source: NativePalette.applyScript(), injectionTime: .atDocumentStart, forMainFrameOnly: false))
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
    /// plus the island's name, the appearance the window is in — said
    /// outright, since inside the sidebar's vibrancy the view inherits a
    /// vibrant variant that WebKit does not report as dark — and the channel
    /// `lib/shell` talks over. Replies come back as the promise `postMessage`
    /// returns.
    private var bridgeScript: String {
        """
        (() => {
          const handler = window.webkit.messageHandlers.\(Self.messageHandlerName);
          const listeners = new Set();
          window.reviewer = {
            island: "\(kind.rawValue)",
            appearance: "\(NativePalette.appearanceName())",
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
        case "windowTabs":
            if let strip = WindowTabStrip.decode(body["strip"]) { onWindowTabsReported?(strip) }
            return (nil, nil)
        case "tree":
            onTreeReported?(ShellTree.decode(body["tree"]))
            return (nil, nil)
        case "treeState":
            if let state = ShellTreeState.decode(body["state"]) { onTreeStateReported?(state) }
            return (nil, nil)
        case "sessions":
            onSessionsReported?(ShellSessions.decode(body["list"]))
            return (nil, nil)
        case "dock":
            onDockReported?(DockState.decode(body["shown"]))
            return (nil, nil)
        case "history":
            if let path = body["path"] as? String { onHistoryRequested?(path) }
            return (nil, nil)
        case "review":
            onReviewReported?(ShellReview.decode(body["review"]))
            return (nil, nil)
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
