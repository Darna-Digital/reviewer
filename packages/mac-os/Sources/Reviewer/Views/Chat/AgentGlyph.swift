// The agent CLIs' brand marks: Claude's spark, OpenAI's Blossom for Codex,
// Cursor's cube and opencode's block, from each vendor's own kit — the
// Anthropic press kit, Cursor's brand assets, opencode's repository — and
// for the Blossom, OpenAI's rule that it is black or white and nothing
// else. A mark is drawn two ways:
//
// - as a glyph (`AgentGlyph`), a template in the vendor's one colour —
//   Claude's clay, the ink of the page for the black-and-white marks — as
//   the web app draws them (`agent-icons`);
// - as an app icon (`AgentIcon`), the mark on a tile of the vendor's, in
//   the colours its own icon wears.
import AppKit
import SwiftUI

struct AgentGlyph: View {
    let kind: ChatProviderKind
    var size: CGFloat = 14

    var body: some View {
        Image(nsImage: Self.image(for: kind))
            .renderingMode(.template)
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
            .foregroundStyle(Self.tint(for: kind))
            .accessibilityLabel(kind.label)
    }

    static func tint(for kind: ChatProviderKind) -> Color {
        switch kind {
        case .claude: return Color(hex: AgentMark.claudeClay)
        case .codex, .cursor, .opencode: return .primary
        }
    }

    @MainActor private static var cache: [ChatProviderKind: NSImage] = [:]

    @MainActor static func image(for kind: ChatProviderKind) -> NSImage {
        if let image = cache[kind] { return image }
        let image = AgentMark.image(kind, ink: .template)
        image.isTemplate = true
        cache[kind] = image
        return image
    }
}

/// A vendor's mark as an app icon: the mark on a rounded tile in the
/// colours of the vendor's own icon, and at the share of the tile that icon
/// gives it. Each is the icon's light one, in either appearance: the
/// vendors' dark ones are near-black tiles, which on a dark bar are a mark
/// with no tile round it — and an icon on the Dock is the same in both.
///
/// - Claude: the press kit's icon, its spark in ivory on clay deepening
///   to the bottom.
/// - Codex: the Blossom black on white — black or white being the only
///   colours OpenAI lets it wear — as the ChatGPT app's icon has it.
/// - Cursor: the 2D app icon, its near-black cube on off-white.
/// - opencode: the light square logo, the frame and the block within it
///   in its two tones, on white.
struct AgentIcon {
    let top: String
    let bottom: String
    let ink: AgentMark.Ink
    /// How much of the tile's height the mark stands.
    let markShare: CGFloat

    /// The corner of Anthropic's icon, 30 on 128, which every tile wears so
    /// the four read as one set.
    static let cornerShare: CGFloat = 30 / 128

    static func of(_ kind: ChatProviderKind) -> AgentIcon {
        switch kind {
        case .claude:
            return AgentIcon(top: AgentMark.claudeClay, bottom: "#DC6038", ink: .solid("#FAF9F5"), markShare: 0.73)
        case .codex:
            return AgentIcon(top: "#FFFFFF", bottom: "#FFFFFF", ink: .solid("#000000"), markShare: 0.7)
        case .cursor:
            return AgentIcon(top: "#F8F8F6", bottom: "#F8F8F6", ink: .solid("#26251E"), markShare: 0.72)
        case .opencode:
            return AgentIcon(top: "#FFFFFF", bottom: "#FFFFFF", ink: .twoTone("#211E1E", "#CFCECD"), markShare: 0.625)
        }
    }

    @MainActor private static var marks: [String: NSImage] = [:]

    @MainActor func mark(of kind: ChatProviderKind) -> NSImage {
        let key = "\(kind.rawValue) \(ink)"
        if let image = Self.marks[key] { return image }
        let image = AgentMark.image(kind, ink: ink)
        Self.marks[key] = image
        return image
    }
}

/// The marks' paths and how they are inked. Each viewBox is cut to its
/// mark, so a mark drawn to fit a box fills it.
enum AgentMark {
    enum Ink: CustomStringConvertible {
        /// Black, to be tinted; opencode's block at the share of the ink
        /// its own two tones put it at, a quarter, so it reads the same.
        case template
        case solid(String)
        /// opencode's frame and the block within it.
        case twoTone(String, String)

        var description: String {
            switch self {
            case .template: return "template"
            case .solid(let ink): return ink
            case .twoTone(let frame, let block): return "\(frame)/\(block)"
            }
        }

        fileprivate var main: String {
            switch self {
            case .template: return "#000000"
            case .solid(let ink), .twoTone(let ink, _): return ink
            }
        }

        fileprivate var block: (fill: String, opacity: Double) {
            switch self {
            case .template: return ("#000000", 0.25)
            case .solid(let ink): return (ink, 0.25)
            case .twoTone(_, let block): return (block, 1)
            }
        }
    }

    /// Anthropic's clay, the spark's own colour.
    static let claudeClay = "#D97757"

    static func image(_ kind: ChatProviderKind, ink: Ink) -> NSImage {
        NSImage(data: Data(svg(kind, ink: ink).utf8))
            ?? NSImage(systemSymbolName: "cpu", accessibilityDescription: nil)!
    }

    private static func svg(_ kind: ChatProviderKind, ink: Ink) -> String {
        let fill = ink.main
        switch kind {
        case .claude:
            return """
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48"><path fill="\(fill)" d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/></svg>
                """
        case .codex:
            return """
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48"><path fill="\(fill)" d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/></svg>
                """
        case .cursor:
            return """
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 466.73 532.09" width="42" height="48"><path fill="\(fill)" d="M457.43,125.94L244.42,2.96c-6.84-3.95-15.28-3.95-22.12,0L9.3,125.94c-5.75,3.32-9.3,9.46-9.3,16.11v247.99c0,6.65,3.55,12.79,9.3,16.11l213.01,122.98c6.84,3.95,15.28,3.95,22.12,0l213.01-122.98c5.75-3.32,9.3-9.46,9.3-16.11v-247.99c0-6.65-3.55-12.79-9.3-16.11h-.01ZM444.05,151.99l-205.63,356.16c-1.39,2.4-5.06,1.42-5.06-1.36v-233.21c0-4.66-2.49-8.97-6.53-11.31L24.87,145.67c-2.4-1.39-1.42-5.06,1.36-5.06h411.26c5.84,0,9.49,6.33,6.57,11.39h-.01Z"/></svg>
                """
        case .opencode:
            let block = ink.block
            return """
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 300" width="40" height="50"><path fill="\(block.fill)" fill-opacity="\(block.opacity)" d="M180 240H60V120H180V240Z"/><path fill="\(fill)" fill-rule="evenodd" d="M180 60H60V240H180V60ZM240 300H0V0H240V300Z"/></svg>
                """
        }
    }
}
