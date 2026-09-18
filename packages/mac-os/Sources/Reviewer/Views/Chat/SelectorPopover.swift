// One selector under the prompt box — effort, mode, access — as a picker
// rather than a word list: each option wears its glyph, its label, and the
// line saying what choosing it does, because these are settings whose
// consequences are not guessable from a single word. The button borrows
// the chosen option's glyph, so the row reads as a set of states rather
// than of buttons. The same button chrome is what the model picker wears,
// so the row is one instrument.
import SwiftUI

struct SelectorPopover<Value: Hashable>: View {
    let options: [SelectorOption<Value>]
    let value: Value
    let help: String
    let onSelect: (Value) -> Void
    @State private var open = false

    var body: some View {
        let current = options.first { $0.value == value }
        Button { open.toggle() } label: {
            HStack(spacing: 5) {
                if let current {
                    Image(systemName: current.symbol)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.secondary)
                }
                Text(current?.label ?? String(describing: value))
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.system(size: 8, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
        }
        .buttonStyle(ComposerChipStyle())
        .help(help)
        .popover(isPresented: $open, arrowEdge: .bottom) {
            VStack(alignment: .leading, spacing: 1) {
                ForEach(options) { option in
                    SelectorRow(option: option, chosen: option.value == value) {
                        onSelect(option.value)
                        open = false
                    }
                }
            }
            .padding(4)
            .frame(width: 280)
        }
    }
}

private struct SelectorRow<Value: Hashable>: View {
    let option: SelectorOption<Value>
    let chosen: Bool
    let action: () -> Void
    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: option.symbol)
                    .font(.system(size: 13))
                    .foregroundStyle(chosen ? Color.primary : Color.secondary)
                    .frame(width: 18)
                    .padding(.top, 1)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(option.label)
                            .font(.system(size: 13, weight: .medium))
                        if chosen {
                            Image(systemName: "checkmark")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(Color.accentColor)
                        }
                    }
                    if !option.hint.isEmpty {
                        Text(option.hint)
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 7)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                (chosen || isHovering ? Color.primary.opacity(isHovering ? 0.08 : 0.05) : Color.clear),
                in: RoundedRectangle(cornerRadius: 6))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
    }
}

/// The quiet chip the composer's row is made of: the label alone, a wash
/// under the pointer, 26pt tall. The wash is cut to the row it stands in
/// — the composer's rounded corners, or the capsule of a bar that is one
/// (see `chipShape`).
struct ComposerChipStyle: ButtonStyle {
    @Environment(\.chipShape) private var shape
    @State private var isHovering = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 11, weight: .medium))
            .padding(.horizontal, shape == .capsule ? 9 : 7)
            .frame(height: 26)
            .background(
                Color.primary.opacity(configuration.isPressed ? 0.12 : isHovering ? 0.07 : 0),
                in: shape.insettable)
            .contentShape(shape.insettable)
            .onHover { isHovering = $0 }
    }
}

enum ChipShape {
    case rounded
    case capsule

    var insettable: AnyShape {
        switch self {
        case .rounded: return AnyShape(RoundedRectangle(cornerRadius: 6))
        case .capsule: return AnyShape(Capsule())
        }
    }
}

extension EnvironmentValues {
    /// The shape every `ComposerChipStyle` under it is cut to.
    @Entry var chipShape: ChipShape = .rounded
}
