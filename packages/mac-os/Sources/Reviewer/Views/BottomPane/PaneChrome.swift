// The pieces the bottom pane's two surfaces are built from, so they read as
// one instrument: the 28pt bar a detail column wears along its top, the
// footer a source list wears along its bottom — the system's own add and
// remove marks, as in Settings and Xcode — the flat bar button both carry,
// and the dot that says whether a process is up.
import SwiftUI

enum PaneMetrics {
    static let barHeight: CGFloat = 28
    static let footerHeight: CGFloat = 24
    static let listMinWidth: CGFloat = 200
    static let listIdealWidth: CGFloat = 240
    static let listMaxWidth: CGFloat = 380
}

/// The bar along the top of a detail column: what is shown, and what can
/// be done to it, on one line, parted from the content by a rule.
struct PaneBar<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        HStack(spacing: 8) { content }
            .controlSize(.small)
            .padding(.leading, 10)
            .padding(.trailing, 6)
            .frame(height: PaneMetrics.barHeight)
            .frame(maxWidth: .infinity)
            .overlay(alignment: .bottom) { Divider() }
    }
}

/// The footer along the bottom of a source list: a rule, then the marks —
/// add and remove leading, the list's own actions trailing.
struct PaneFooter<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        HStack(spacing: 2) { content }
            .padding(.horizontal, 4)
            .frame(height: PaneMetrics.footerHeight)
            .frame(maxWidth: .infinity)
            .overlay(alignment: .top) { Divider() }
    }
}

/// A flat symbol button for the bars: the system's accessory-bar style,
/// which lights only on hover, in a square hit area.
struct PaneBarButton: View {
    let symbol: String
    let help: String
    var role: ButtonRole? = nil
    let action: () -> Void

    var body: some View {
        Button(role: role, action: action) {
            Image(systemName: symbol)
                .font(.system(size: 11, weight: .medium))
                .frame(width: 20, height: 18)
        }
        .buttonStyle(.accessoryBar)
        .help(help)
    }
}

/// The filter over a list, in the shape the sidebar's own filter has.
struct PaneFilterField: View {
    let prompt: String
    @Binding var text: String

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
            TextField(prompt, text: $text)
                .textFieldStyle(.plain)
                .font(.system(size: 12))
            if !text.isEmpty {
                Button { text = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(.tertiary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 7)
        .frame(height: 24)
        .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 6))
    }
}

/// Whether a process is up, as a dot: filled green while it runs, red
/// when it exited badly, grey once it exited cleanly, and only a ring
/// while it has not been started.
struct ProcessDot: View {
    let status: DevCommandView.Status
    let exitCode: Int?

    var body: some View {
        Group {
            if status == .stopped {
                Circle().strokeBorder(.tertiary, lineWidth: 1)
            } else {
                Circle().fill(tint)
            }
        }
        .frame(width: 8, height: 8)
    }

    private var tint: Color {
        switch status {
        case .running: return .green
        case .exited: return (exitCode ?? 0) == 0 ? Color.secondary.opacity(0.6) : .red
        case .stopped: return .clear
        }
    }
}

extension DevCommandView {
    var statusLabel: String {
        switch status {
        case .running: return "Running"
        case .exited:
            if let exitCode, exitCode != 0 { return "Exited (\(exitCode))" }
            return "Exited"
        case .stopped: return "Not running"
        }
    }

    var isRunning: Bool { status == .running }
}

/// The material a terminal is set on: the island's own, so the shell reads
/// as part of the pane rather than a hole in it.
struct TerminalWell<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(EdgeInsets(top: 6, leading: 8, bottom: 4, trailing: 4))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(nsColor: IslandPalette.island))
    }
}

/// A short placeholder for a column with nothing to show, sized for the
/// pane rather than a page.
struct PanePlaceholder<Actions: View>: View {
    let title: String
    let symbol: String
    var detail: String? = nil
    @ViewBuilder var actions: Actions

    init(_ title: String, symbol: String, detail: String? = nil, @ViewBuilder actions: () -> Actions = { EmptyView() }) {
        self.title = title
        self.symbol = symbol
        self.detail = detail
        self.actions = actions()
    }

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: symbol)
                .font(.system(size: 22, weight: .light))
                .foregroundStyle(.tertiary)
            Text(title)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.secondary)
            if let detail {
                Text(detail)
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 260)
            }
            actions
                .controlSize(.small)
                .padding(.top, 4)
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
