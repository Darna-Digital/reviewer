// The bottom pane: a native strip choosing between its surfaces, a drag
// seam above it, and beneath the strip either a native surface — the
// Terminal, the Services — or the dock island on one of the web app's dock
// pages. Collapsed, only the strip remains, so the surfaces are one click
// away and the shell in the Terminal keeps running behind it.
import SwiftUI

struct BottomPane: View {
    @Environment(AppModel.self) private var model

    private static let stripHeight: CGFloat = 32
    private static let minHeight: CGFloat = 120

    var body: some View {
        VStack(spacing: 0) {
            if model.bottomExpanded { seam }
            strip
            if model.bottomExpanded {
                content
                    .frame(height: model.bottomHeight)
            }
        }
    }

    private var strip: some View {
        HStack(spacing: 2) {
            ForEach(BottomPaneTab.allCases) { tab in
                PaneTabButton(tab: tab, isSelected: model.bottomTab == tab && model.bottomExpanded) {
                    model.show(bottomTab: tab)
                }
            }
            Spacer(minLength: 8)
            Button { model.toggleBottomPane() } label: {
                Image(systemName: model.bottomExpanded ? "chevron.down" : "chevron.up")
                    .font(.system(size: 11, weight: .semibold))
                    .frame(width: 24, height: 24)
            }
            .buttonStyle(.borderless)
            .help(model.bottomExpanded ? "Collapse" : "Expand")
        }
        .padding(.horizontal, 6)
        .frame(height: Self.stripHeight)
        .background(.bar)
        .overlay(alignment: .top) { Divider() }
    }

    @ViewBuilder
    private var content: some View {
        switch model.bottomTab {
        case .terminal:
            TerminalPane()
        case .services:
            ServicesPane()
        case .branches, .history, .find, .threads:
            IslandView(host: model.dock)
        }
    }

    /// The seam is the pane's top edge: dragging it resizes the pane, live,
    /// since the terminal and the island both reflow as it moves.
    private var seam: some View {
        Rectangle()
            .fill(Color.clear)
            .frame(height: 6)
            .contentShape(Rectangle())
            .onHover { hovering in
                if hovering { NSCursor.resizeUpDown.push() } else { NSCursor.pop() }
            }
            .gesture(
                DragGesture(minimumDistance: 1, coordinateSpace: .global)
                    .onChanged { drag in
                        // The drag reports its whole translation each change,
                        // so the height it started from is what it applies to.
                        let start = dragStart ?? model.bottomHeight
                        dragStart = start
                        model.bottomHeight = max(Self.minHeight, start - drag.translation.height)
                    }
                    .onEnded { _ in dragStart = nil }
            )
    }

    @State private var dragStart: CGFloat?
}

private struct PaneTabButton: View {
    let tab: BottomPaneTab
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(tab.title, systemImage: tab.symbol)
                .font(.system(size: 11.5, weight: isSelected ? .medium : .regular))
                .labelStyle(.titleAndIcon)
                .padding(.horizontal, 8)
                .frame(height: 22)
                .foregroundStyle(isSelected ? .primary : .secondary)
                .background(
                    isSelected ? Color.secondary.opacity(0.16) : Color.clear,
                    in: RoundedRectangle(cornerRadius: 5))
        }
        .buttonStyle(.plain)
    }
}
