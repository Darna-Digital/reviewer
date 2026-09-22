// A turn's work log over its reply: one line saying how many steps it took
// and how long, opening to a row per tool call or thinking block — the
// tool's glyph, its name, what it was given, how long it ran and how it
// ended — each row opening in turn to its arguments and its output. The
// web timeline's `WorkLog`, in the system's ink.
import SwiftUI

struct WorkLogView: View {
    let steps: [WorkStep]
    @State private var open = false

    var body: some View {
        let failures = steps.filter { $0.status == .failed }.count
        VStack(alignment: .leading, spacing: 4) {
            Button {
                withAnimation(.easeOut(duration: 0.15)) { open.toggle() }
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 9, weight: .semibold))
                        .rotationEffect(.degrees(open ? 90 : 0))
                    Text(summary(failures: failures))
                        .foregroundStyle(failures > 0 ? Color.red : Color.secondary)
                }
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if open {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(steps.enumerated()), id: \.element.id) { index, step in
                        WorkStepRow(step: step, last: index == steps.count - 1)
                    }
                }
                .padding(.leading, 6)
                .padding(.top, 2)
            }
        }
    }

    private func summary(failures: Int) -> String {
        var parts = ["\(steps.count) \(steps.count == 1 ? "step" : "steps")"]
        if let elapsed = WorkLog.elapsedMs(steps), elapsed >= 1000 { parts.append(WorkLog.formatDuration(elapsed)) }
        if failures > 0 { parts.append("\(failures) failed") }
        return parts.joined(separator: " · ")
    }
}

private struct WorkStepRow: View {
    let step: WorkStep
    let last: Bool
    @State private var open = false

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            VStack(spacing: 0) {
                Image(systemName: step.symbol)
                    .font(.system(size: 11))
                    .foregroundStyle(step.status == .failed ? Color.red : Color.secondary)
                    .frame(width: 14, height: 18)
                if !last {
                    Rectangle()
                        .fill(Color(nsColor: IslandPalette.separator))
                        .frame(width: 1)
                        .frame(maxHeight: .infinity)
                }
            }
            .frame(width: 14)
            VStack(alignment: .leading, spacing: 4) {
                Button {
                    guard step.isExpandable else { return }
                    withAnimation(.easeOut(duration: 0.15)) { open.toggle() }
                } label: {
                    HStack(spacing: 6) {
                        Text(step.label)
                            .fontWeight(.medium)
                            .foregroundStyle(step.status == .failed ? Color.red : Color.primary)
                            .shimmering(step.status == .running)
                        if let detail = step.detail {
                            Text(detail)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                                .truncationMode(.tail)
                        }
                        if let duration = step.durationMs, duration >= 1000 {
                            Text(WorkLog.formatDuration(duration))
                                .font(.system(size: 10).monospacedDigit())
                                .foregroundStyle(.tertiary)
                        }
                        Spacer(minLength: 0)
                        if step.isExpandable {
                            Image(systemName: "chevron.right")
                                .font(.system(size: 9, weight: .semibold))
                                .foregroundStyle(.tertiary)
                                .rotationEffect(.degrees(open ? 90 : 0))
                        }
                        StepStatusMark(status: step.status)
                    }
                    .font(.system(size: 11))
                    .frame(height: 18)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                if open {
                    VStack(alignment: .leading, spacing: 6) {
                        if let input = step.input {
                            Payload(title: step.thinking ? "Reasoning" : "Input", text: input)
                        }
                        if let output = step.output {
                            Payload(title: step.thinking ? "Reasoning" : "Output", text: output)
                        }
                    }
                    .padding(.bottom, 6)
                }
            }
            .padding(.bottom, last ? 0 : 2)
        }
    }
}

private struct StepStatusMark: View {
    let status: WorkStepStatus

    var body: some View {
        switch status {
        case .failed:
            Image(systemName: "exclamationmark.circle")
                .font(.system(size: 11))
                .foregroundStyle(.red)
        case .done:
            Image(systemName: "checkmark")
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.tertiary)
        case .running:
            Orb(size: 14)
        }
    }
}

private struct Payload: View {
    let title: String
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.secondary)
            ScrollView(.horizontal, showsIndicators: false) {
                Text(text)
                    .font(.system(size: 11, design: .monospaced))
                    .lineSpacing(2)
                    .textSelection(.enabled)
                    .padding(8)
            }
            .frame(maxHeight: 320)
            .background(.quaternaryWash(0.5), in: RoundedRectangle(cornerRadius: 6))
        }
    }
}

/// The highlight that sweeps a label while its step runs — the web's
/// `shimmer-text`.
private struct Shimmer: ViewModifier {
    let active: Bool
    @State private var phase: CGFloat = -1

    func body(content: Content) -> some View {
        if active {
            content
                .overlay {
                    LinearGradient(
                        colors: [.clear, .primary.opacity(0.5), .clear], startPoint: .leading, endPoint: .trailing
                    )
                    .offset(x: phase * 80)
                    .mask(content)
                }
                .onAppear {
                    withAnimation(.linear(duration: 1.6).repeatForever(autoreverses: false)) { phase = 1 }
                }
        } else {
            content
        }
    }
}

extension View {
    func shimmering(_ active: Bool) -> some View {
        modifier(Shimmer(active: active))
    }
}
