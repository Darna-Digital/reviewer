// The Projects widget drawn: the hero for the small family, the tile grid
// for the others, and the two empty states. Every tile is a `Link` to its
// project; the small family, which the system gives one click, carries
// its link on the widget itself. The tiles stand on the system's fill
// colours and the monograms are the only colour of their own, marked
// accentable so a tinted desktop tints them with everything else.
import ReviewerShared
import SwiftUI
import WidgetKit

struct ProjectsWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ProjectsEntry

    var body: some View {
        if entry.feed == nil {
            NoFeedView()
        } else if family == .systemSmall {
            HeroView(project: entry.hero, current: entry.feed?.current)
        } else {
            GridView(entry: entry, slots: family == .systemLarge ? 6 : 2)
        }
    }
}

/// The small family: the open project, or the last one, as one big tile —
/// its monogram over its name, and the two openings along the foot.
private struct HeroView: View {
    let project: ProjectFeed.Project?
    let current: String?

    var body: some View {
        if let project {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    Monogram(name: project.name, size: 38)
                    Spacer(minLength: 6)
                    if project.path == current {
                        CurrentBadge()
                    }
                }
                Spacer(minLength: 10)
                Text(project.name)
                    .font(.system(size: 15, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                BranchLine(branch: project.branch, size: 11)
                    .padding(.top, 2)
                Spacer(minLength: 10)
                ProjectActions(project: project, height: 26, font: 11)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        } else {
            EmptyListView(list: .recents)
        }
    }
}

/// The medium and large families: the list's name over two columns of
/// tiles, as many as the family has room for.
private struct GridView: View {
    let entry: ProjectsEntry
    let slots: Int

    private var projects: [ProjectFeed.Project] { Array(entry.projects.prefix(slots)) }

    var body: some View {
        if projects.isEmpty {
            EmptyListView(list: entry.list)
        } else {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    ReviewerMark()
                        .frame(width: 9, height: 12)
                    Text(entry.list.title)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                Grid(horizontalSpacing: 8, verticalSpacing: 8) {
                    ForEach(Array(stride(from: 0, to: slots, by: 2)), id: \.self) { first in
                        GridRow {
                            tile(at: first)
                            tile(at: first + 1)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
    }

    @ViewBuilder
    private func tile(at index: Int) -> some View {
        if index < projects.count {
            ProjectTile(project: projects[index], isCurrent: projects[index].path == entry.feed?.current)
        } else {
            Color.clear
                .gridCellUnsizedAxes(.vertical)
        }
    }
}

/// One repository: its monogram, name and branch on a soft tile that is a
/// link to opening it; the open project's tile wears the accent as a
/// hairline.
private struct ProjectTile: View {
    let project: ProjectFeed.Project
    let isCurrent: Bool

    private var shape: RoundedRectangle { RoundedRectangle(cornerRadius: 13, style: .continuous) }

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            Link(destination: ProjectLink.open(project.path)) {
                HStack(spacing: 9) {
                    Monogram(name: project.name, size: 26)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(project.name)
                            .font(.system(size: 12.5, weight: .semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                        BranchLine(branch: project.branch, size: 10)
                    }
                    Spacer(minLength: 0)
                    if isCurrent {
                        CurrentBadge()
                    }
                }
            }
            ProjectActions(project: project, height: 22, font: 10)
        }
        .padding(9)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(shape.fill(.fill.quaternary))
        .overlay {
            shape.strokeBorder(isCurrent ? AnyShapeStyle(.tint.opacity(0.55)) : AnyShapeStyle(.separator.opacity(0.6)), lineWidth: 0.7)
                .widgetAccentable(isCurrent)
        }
    }
}

/// The open project's mark: a dot in the accent, where a list would put a
/// tick. It says which tile the app is already on, so the tiles beside it
/// read as the windows it does not have open.
private struct CurrentBadge: View {
    var body: some View {
        Circle()
            .fill(.tint)
            .frame(width: 5, height: 5)
            .widgetAccentable()
    }
}

/// What the opener's row menu offers, as far as a widget can carry it: the
/// project opened on its own, or with its dev commands started. The two
/// stand as one segmented control along the tile's foot — a single quiet
/// shape parted by a hairline, rather than two buttons competing with the
/// name above them. A widget has no menu and no hover, so an action it is
/// to offer has to stand as something to click.
private struct ProjectActions: View {
    let project: ProjectFeed.Project
    let height: CGFloat
    let font: CGFloat

    private var shape: RoundedRectangle { RoundedRectangle(cornerRadius: height / 2.6, style: .continuous) }

    var body: some View {
        HStack(spacing: 0) {
            action(url: ProjectLink.open(project.path)) {
                Text("Open")
            }
            Rectangle()
                .fill(.separator.opacity(0.7))
                .frame(width: 0.7, height: height * 0.55)
            action(url: ProjectLink.open(project.path, run: true)) {
                HStack(spacing: 3) {
                    Image(systemName: "play.fill")
                        .font(.system(size: font - 2, weight: .semibold))
                    Text("Run")
                }
            }
        }
        .frame(height: height)
        .background(shape.fill(.fill.tertiary))
        .overlay(shape.strokeBorder(.separator.opacity(0.5), lineWidth: 0.7))
    }

    private func action(url: URL, @ViewBuilder label: () -> some View) -> some View {
        Link(destination: url) {
            label()
                .font(.system(size: font, weight: .medium))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(Rectangle())
        }
    }
}

/// The branch under a name, or a dash where the index knows none.
private struct BranchLine: View {
    let branch: String?
    let size: CGFloat

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: "arrow.triangle.branch")
                .font(.system(size: size - 1, weight: .medium))
            Text(branch ?? "—")
                .font(.system(size: size))
        }
        .foregroundStyle(.secondary)
        .lineLimit(1)
        .truncationMode(.middle)
    }
}

/// The repository's avatar, as the app draws it (see `RepoAvatar`), with
/// the widget's depth: a gradient of its hue and a glint along the top.
private struct Monogram: View {
    let name: String
    let size: CGFloat

    var body: some View {
        let hue = Color(hex: RepoMonogram.hue(of: name))
        let shape = RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
        Text(RepoMonogram.initials(of: name))
            .font(.system(size: size * 0.42, weight: .bold, design: .rounded))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background {
                shape
                    .fill(LinearGradient(colors: [hue.opacity(0.85), hue], startPoint: .top, endPoint: .bottom))
                    .overlay(shape.strokeBorder(.white.opacity(0.22), lineWidth: 0.5))
                    .widgetAccentable()
            }
    }
}

/// A widget on a machine the app has never run on: nothing to list yet,
/// and a click brings the app up, which writes the first feed.
private struct NoFeedView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ReviewerMark()
                .frame(width: 15, height: 20)
            Spacer(minLength: 0)
            Text("Open Reviewer")
                .font(.system(size: 14, weight: .semibold))
            Text("Your repositories will show up here.")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(ProjectLink.launch)
    }
}

/// A list with nothing in it yet, and how it fills.
private struct EmptyListView: View {
    let list: ProjectList

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                ReviewerMark()
                    .frame(width: 9, height: 12)
                Text(list.title)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            switch list {
            case .recents:
                Text("No recent repositories")
                    .font(.system(size: 13, weight: .semibold))
                Text("Repositories you open show up here.")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            case .favorites:
                Text("No favorites yet")
                    .font(.system(size: 13, weight: .semibold))
                Text("Star repositories in Reviewer's opener.")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(ProjectLink.launch)
    }
}

/// Behind everything: the widget's own background with the faintest wash
/// of the accent across it, so the tiles' fills read as glass over it.
struct WidgetBackdrop: View {
    var body: some View {
        ZStack {
            Rectangle().fill(.background)
            LinearGradient(
                colors: [.accentColor.opacity(0.12), .accentColor.opacity(0.02), .clear],
                startPoint: .topLeading,
                endPoint: .bottomTrailing)
        }
    }
}

/// The app's mark — the blocky R of the dock icon — as a shape, so it
/// takes whatever style the widget is rendered in.
struct ReviewerMark: Shape {
    private static let cells: [(column: Int, row: Int)] = [
        (0, 0), (1, 0), (2, 0),
        (0, 1), (2, 1),
        (0, 2), (1, 2),
        (0, 3), (2, 3),
    ]

    func path(in rect: CGRect) -> Path {
        let cell = CGSize(width: rect.width / 3, height: rect.height / 4)
        var path = Path()
        for (column, row) in Self.cells {
            path.addRect(CGRect(
                x: rect.minX + CGFloat(column) * cell.width,
                y: rect.minY + CGFloat(row) * cell.height,
                width: cell.width,
                height: cell.height))
        }
        return path
    }
}

extension Color {
    /// `#rrggbb`, the way the monogram palette is written.
    init(hex: String) {
        var value: UInt64 = 0
        Scanner(string: String(hex.dropFirst())).scanHexInt64(&value)
        self.init(
            .sRGB,
            red: Double((value >> 16) & 0xff) / 255,
            green: Double((value >> 8) & 0xff) / 255,
            blue: Double(value & 0xff) / 255)
    }
}
