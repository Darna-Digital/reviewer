// The history's lane graph, laid out the way the web app's `commit-graph`
// lays it: commits arrive newest first, each lane tracks the next commit it
// expects — a child placed it there — a commit takes the leftmost lane
// pointing at it, its first parent continues that lane, and its other
// parents (a merge's) open new ones. Only parents in this window get a
// lane: a filtered log — one file's history, an author search — is a
// sparse slice of the graph where almost no commit's parent is on screen,
// and lanes waiting on commits that never arrive would pile up into a
// staircase of lines connecting nothing.
import SwiftUI

/// A lane that is reserved for the next commit it expects to reach.
struct GraphLane: Equatable {
    let target: String
    let color: Color
}

/// One commit's geometry: which column holds its dot, and the lanes that
/// pass through above (`before`) and below (`after`) it.
struct GraphRow: Equatable {
    let sha: String
    let dotColumn: Int
    let color: Color
    let isMerge: Bool
    let before: [GraphLane?]
    let after: [GraphLane?]
    /// The columns this row wrote into: its dot's, and any merge lane it opened.
    let written: [Int]
}

struct CommitGraphLayout: Equatable {
    var rows: [GraphRow] = []
    /// The widest lane count across the rows, which sets every cell's width.
    var width = 1

    static let empty = CommitGraphLayout()

    /// The web graph's own lane hues, which read on both palettes.
    static let colors: [Color] = [
        "#5b9bf8", "#48b884", "#e0533d", "#d8a13a", "#a86fd4", "#3bb0c9", "#e06fa8", "#8c9440",
    ].map(Color.init(hex:))

    static let columnWidth: CGFloat = 14
    static let dotRadius: CGFloat = 3.5
    static let rowHeight: CGFloat = 30

    static func layout(_ commits: [CommitInfo]) -> CommitGraphLayout {
        let inWindow = Set(commits.map(\.sha))
        var lanes: [GraphLane?] = []
        var colorCounter = 0
        func nextColor() -> Color {
            defer { colorCounter += 1 }
            return colors[colorCounter % colors.count]
        }
        func firstFree() -> Int {
            lanes.firstIndex { $0 == nil } ?? lanes.count
        }
        func place(_ lane: GraphLane, at column: Int) {
            if column == lanes.count { lanes.append(lane) } else { lanes[column] = lane }
        }

        var layout = CommitGraphLayout()
        for commit in commits {
            let before = lanes
            var dotColumn = lanes.firstIndex { $0?.target == commit.sha } ?? -1
            let color: Color
            if dotColumn == -1 {
                dotColumn = firstFree()
                color = nextColor()
                place(GraphLane(target: commit.sha, color: color), at: dotColumn)
            } else {
                color = lanes[dotColumn]!.color
            }

            for column in lanes.indices where column != dotColumn && lanes[column]?.target == commit.sha {
                lanes[column] = nil
            }

            var written = [dotColumn]
            let parents = commit.parents.filter(inWindow.contains)
            if let first = parents.first {
                lanes[dotColumn] = GraphLane(target: first, color: color)
                for parent in parents.dropFirst() {
                    let column = firstFree()
                    place(GraphLane(target: parent, color: nextColor()), at: column)
                    written.append(column)
                }
            } else {
                lanes[dotColumn] = nil
            }

            let after = lanes
            layout.width = max(layout.width, before.count, after.count)
            layout.rows.append(GraphRow(
                sha: commit.sha, dotColumn: dotColumn, color: color, isMerge: commit.parents.count > 1,
                before: before, after: after, written: written))

            while let last = lanes.last, last == nil { lanes.removeLast() }
        }
        return layout
    }

    /// The horizontal centre of a lane's column.
    static func centerX(_ column: Int) -> CGFloat {
        CGFloat(column) * columnWidth + columnWidth / 2
    }

    /// A lane's edge: straight while its column holds, a soft S-curve when
    /// it shifts.
    static func edge(from start: CGPoint, to end: CGPoint) -> Path {
        var path = Path()
        path.move(to: start)
        if start.x == end.x {
            path.addLine(to: end)
        } else {
            let middle = (start.y + end.y) / 2
            path.addCurve(to: end, control1: CGPoint(x: start.x, y: middle), control2: CGPoint(x: end.x, y: middle))
        }
        return path
    }
}

/// One commit's cell of the graph: the lanes passing through it, the edges
/// converging into and branching out of its dot, and the dot — hollow for
/// a merge.
struct GraphCell: View {
    let row: GraphRow
    let width: Int

    var body: some View {
        let cellWidth = CGFloat(max(width, 1)) * CommitGraphLayout.columnWidth
        let height = CommitGraphLayout.rowHeight
        let middle = height / 2
        Canvas { context, _ in
            for (column, lane) in row.before.enumerated() {
                guard let lane else { continue }
                let toColumn = lane.target == row.sha ? row.dotColumn : column
                let edge = CommitGraphLayout.edge(
                    from: CGPoint(x: CommitGraphLayout.centerX(column), y: 0),
                    to: CGPoint(x: CommitGraphLayout.centerX(toColumn), y: middle))
                context.stroke(edge, with: .color(lane.color), lineWidth: 1.5)
            }
            for (column, lane) in row.after.enumerated() {
                guard let lane else { continue }
                let fromColumn = row.written.contains(column) ? row.dotColumn : column
                let edge = CommitGraphLayout.edge(
                    from: CGPoint(x: CommitGraphLayout.centerX(fromColumn), y: middle),
                    to: CGPoint(x: CommitGraphLayout.centerX(column), y: height))
                context.stroke(edge, with: .color(lane.color), lineWidth: 1.5)
            }
            let radius = CommitGraphLayout.dotRadius
            let dot = Path(ellipseIn: CGRect(
                x: CommitGraphLayout.centerX(row.dotColumn) - radius, y: middle - radius,
                width: radius * 2, height: radius * 2))
            if row.isMerge {
                context.fill(dot, with: .color(Color(nsColor: IslandPalette.island)))
                context.stroke(dot, with: .color(row.color), lineWidth: 1.5)
            } else {
                context.fill(dot, with: .color(row.color))
            }
        }
        .frame(width: cellWidth, height: height)
    }
}
