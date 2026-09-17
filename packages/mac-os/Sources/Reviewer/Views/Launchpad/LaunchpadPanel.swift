// The launchpad: every window tab laid out as a card, each wearing the last
// picture taken of it, so the one you want is found by look rather than by
// title. It slides out from under the toolbar and pushes the islands down
// — the web app's `tab-overview`, native — standing on the frame's own
// material and nothing else: no sheet, no fill, the bare window the panels
// stand on. Click a card to go there, its mark to close it; the dimmed page
// under the panel, the tab on its bottom edge, Escape, or ⌘L again put it
// away. The seam along that same edge sizes it, and pulled up far enough
// shuts it; the same seam along the top of the page pulls it out again.
// The tabs are the island's (see `WindowTabStrip`); the pictures are the
// shell's, taken of the page as each tab is left; the height and the moves
// are `Launchpad`'s.
import SwiftUI

struct LaunchpadPanel: View {
    @Environment(AppModel.self) private var model
    @State private var settled = false

    /// The pause between the panel coming to rest and its collapse tab
    /// appearing on the edge: landing on the same frame the panel does, the
    /// tab reads as part of the arrival rather than as something it left.
    private static let handleBeat: Duration = .milliseconds(400)

    var body: some View {
        let launchpad = model.launchpad
        let grid = launchpad.grid
        ScrollView {
            LazyVGrid(columns: grid.items, spacing: LaunchpadGrid.gap) {
                ForEach(model.windowTabs.tabs) { tab in
                    LaunchpadCard(
                        tab: tab,
                        image: model.snapshots[tab.id],
                        isCurrent: tab.id == model.windowTabs.activeId,
                        width: grid.cardWidth)
                }
            }
            .padding(.top, LaunchpadGrid.inset)
            .padding(.bottom, LaunchpadGrid.foot)
            .frame(maxWidth: .infinity)
        }
        .frame(maxWidth: .infinity)
        .overlay(alignment: .bottom) {
            LaunchpadSeam(edge: .panelFoot)
        }
        // Over the seam it shares the edge with, so a press in the middle of
        // it closes the panel rather than starting a drag.
        .overlay(alignment: .bottom) {
            if settled && launchpad.isShown {
                CollapseTab()
            }
        }
        .focusable()
        .focusEffectDisabled()
        .onExitCommand { launchpad.close() }
        .task {
            try? await Task.sleep(for: Self.handleBeat)
            settled = true
        }
    }
}

private struct LaunchpadCard: View {
    let tab: WindowTab
    let image: NSImage?
    let isCurrent: Bool
    let width: CGFloat
    @Environment(AppModel.self) private var model
    @State private var isHovering = false

    var body: some View {
        VStack(alignment: .leading, spacing: LaunchpadGrid.captionSpacing) {
            // The rounded rect alone decides the card's size; the snapshot is
            // drawn as an overlay so a `.fill`-scaled image can't push the
            // card wider than its grid cell.
            RoundedRectangle(cornerRadius: 10)
                .fill(Color(nsColor: IslandPalette.island))
                .aspectRatio(LaunchpadGrid.pictureAspect, contentMode: .fit)
                .overlay {
                    if let image {
                        Image(nsImage: image)
                            .resizable()
                            .scaledToFill()
                    } else {
                        Image(systemName: tab.kind.symbol)
                            .font(.system(size: 28))
                            .foregroundStyle(.secondary)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .strokeBorder(
                            isCurrent ? Color.accentColor : Color.primary.opacity(isHovering ? 0.3 : 0.12),
                            lineWidth: isCurrent ? 2 : 1)
                )
                .overlay(alignment: .topTrailing) {
                    if !tab.pinned && isHovering {
                        Button { model.closeTab(id: tab.id) } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 18))
                                .symbolRenderingMode(.palette)
                                .foregroundStyle(.white, .black.opacity(0.6))
                        }
                        .buttonStyle(.plain)
                        .padding(8)
                        .help("Close tab")
                    }
                }
            HStack(spacing: 6) {
                Image(systemName: tab.kind.symbol)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                Text(tab.title)
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
            }
            .frame(height: LaunchpadGrid.captionHeight)
            .padding(.horizontal, 2)
        }
        .frame(width: width)
        // Hover is the border and nothing else: a grid of cards that each
        // lift under the pointer reads as a page of things being nudged.
        .animation(.easeOut(duration: 0.15), value: isHovering)
        .contentShape(Rectangle())
        .onTapGesture { model.select(tabId: tab.id) }
        .onHover { isHovering = $0 }
    }
}

/// The page giving way to the launchpad: still there, and plainly not the
/// thing being looked at. Dimmed, not blurred — it is still the page you
/// were reading, and a blur is a full-surface filter on every frame of the
/// push. Clicking it is the way back, as with any scrim.
struct LaunchpadScrim: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Color(nsColor: IslandPalette.frame)
            .opacity(0.45)
            .contentShape(Rectangle())
            .onTapGesture { model.launchpad.close() }
            .accessibilityLabel("Collapse launchpad")
    }
}

/// The way out, standing on the edge the panel ends at: a chevron pointing
/// back up at the bar, where clicking it takes the window. It does not
/// move under the pointer and it does not fade: a thing fixed to an edge
/// that shifts when approached is a thing coming loose. Only its colour
/// under the pointer is worth animating.
private struct CollapseTab: View {
    @Environment(AppModel.self) private var model
    @State private var isHovering = false

    var body: some View {
        Button { model.launchpad.close() } label: {
            Image(systemName: "chevron.up")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(isHovering ? .primary : .secondary)
                .frame(width: 36, height: 20)
                .background(Color(nsColor: IslandPalette.island).opacity(isHovering ? 0.9 : 0.6))
                .clipShape(UnevenRoundedRectangle(topLeadingRadius: 6, topTrailingRadius: 6))
                .overlay {
                    UnevenRoundedRectangle(topLeadingRadius: 6, topTrailingRadius: 6)
                        .strokeBorder(Color(nsColor: .separatorColor), lineWidth: 1)
                }
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .animation(.easeOut(duration: 0.2), value: isHovering)
        .onHover { isHovering = $0 }
        .help("Collapse launchpad (⌘L)")
    }
}

/// The seam the launchpad is pulled by. It lies along the top of the page,
/// on the run of frame under the bar: pulling it down brings the panel out
/// under the pointer, and once the panel is out it stands on the panel's
/// bottom edge, where it takes room away and, pulled up far enough, shuts
/// it. Pressed without a pull, it opens the panel onto its rows or puts it
/// back — one edge, pressed the same way, whichever side of it the panel
/// is on.
///
/// It is two views for one seam: the page's head rides the page, reaching
/// a few points over the islands' top edge like the island seams do, and
/// the panel's foot lines the last points of the panel — a view hung past
/// the panel's bounds is not hit there, so each side of the edge is
/// covered by the view that owns it. Both drive the same pull.
struct LaunchpadSeam: View {
    enum Edge {
        case pageHead
        case panelFoot
    }

    let edge: Edge
    @Environment(AppModel.self) private var model
    @State private var isPulling = false

    private static let reach: CGFloat = 3

    var body: some View {
        let thickness = edge == .pageHead ? IslandMetrics.gap + 2 * Self.reach : IslandMetrics.gap
        Color.clear
            .frame(height: thickness)
            .offset(y: edge == .pageHead ? -Self.reach : 0)
            .zIndex(1)
            .contentShape(Rectangle())
            .onHover { hovering in
                if hovering { NSCursor.resizeUpDown.push() } else { NSCursor.pop() }
            }
            .gesture(
                DragGesture(minimumDistance: 0, coordinateSpace: .global)
                    .onChanged { drag in
                        if !isPulling {
                            isPulling = true
                            model.launchpad.beginPull()
                        }
                        model.launchpad.pull(travel: drag.translation.height)
                    }
                    .onEnded { drag in
                        isPulling = false
                        if abs(drag.translation.height) < Launchpad.clickTravel {
                            model.launchpad.click()
                        } else {
                            model.launchpad.endPull()
                        }
                    }
            )
    }
}
