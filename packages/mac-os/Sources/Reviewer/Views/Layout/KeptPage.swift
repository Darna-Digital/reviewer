// A page kept built behind another, hidden the way AppKit hides a view.
//
// SwiftUI draws a view at no opacity but leaves its AppKit views live: a
// text view in a conversation kept behind the code page would still set
// its I-beam over the page in front, take the clicks that reach it, and be
// read out by VoiceOver. A view AppKit hides is none of those, and stays
// as it was built, so the page comes back without being made again. The
// page is hosted on its own for that, in the environment it stands in.
import SwiftUI

struct KeptPage<Content: View>: NSViewRepresentable {
    let inFront: Bool
    @ViewBuilder let content: Content

    func makeNSView(context: Context) -> NSHostingView<AnyView> {
        let host = NSHostingView(rootView: page(in: context.environment))
        host.sizingOptions = []
        host.isHidden = !inFront
        return host
    }

    func updateNSView(_ host: NSHostingView<AnyView>, context: Context) {
        host.rootView = page(in: context.environment)
        host.isHidden = !inFront
    }

    /// The page fills whatever it is given. Left to SwiftUI, the size is
    /// asked of the hosting view, which lays the whole page out to answer —
    /// every reply of a conversation measured, on every update of the
    /// window around it.
    func sizeThatFits(_ proposal: ProposedViewSize, nsView: NSHostingView<AnyView>, context: Context) -> CGSize? {
        proposal.replacingUnspecifiedDimensions()
    }

    private func page(in environment: EnvironmentValues) -> AnyView {
        AnyView(content.environment(\.self, environment))
    }
}
