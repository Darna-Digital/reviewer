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
            HeroView(project: entry.hero)
        } else {
            GridView(entry: entry, slots: family == .systemLarge ? 10 : 4)
        }
    }
}

/// The small family: the list's first project as one big tile, the whole
/// widget the click that opens it.
private struct HeroView: View {
    let project: ProjectFeed.Project?

    var body: some View {
        if let project {
            VStack(alignment: .leading, spacing: 0) {
                Spacer(minLength: 6)
                Monogram(name: project.name, size: 40)
                Text(project.name)
                    .font(.system(size: 15, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .padding(.top, 10)
                BranchLine(branch: project.branch, size: 11)
                    .padding(.top, 2)
                Text(project.location)
                    .font(.system(size: 10))
                    .foregroundStyle(.tertiary)
                    .lineLimit(1)
                    .truncationMode(.head)
                    .padding(.top, 1)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .widgetURL(ProjectLink.open(project.path, run: true))
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
                Text(entry.list.title)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.secondary)
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
            ProjectTile(project: projects[index])
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

    private var shape: RoundedRectangle { RoundedRectangle(cornerRadius: 11, style: .continuous) }

    var body: some View {
        Link(destination: ProjectLink.open(project.path, run: true)) {
            HStack(spacing: 8) {
                Monogram(name: project.name, size: 28)
                VStack(alignment: .leading, spacing: 1) {
                    Text(project.name)
                        .font(.system(size: 12, weight: .semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    BranchLine(branch: project.branch, size: 10)
                }
                Spacer(minLength: 0)
            }
            .padding(.leading, 7)
            .padding(.trailing, 8)
            .padding(.vertical, 7)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(shape.fill(.fill.tertiary))
            .overlay(shape.strokeBorder(.fill.secondary, lineWidth: 0.5))
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
            Text(list.title)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.secondary)
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
