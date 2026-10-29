// The one way the repository the window is on is picked, wherever it is
// picked — beside the branch chip at the sidebar's head, on the session
// bar's strip, at the leading edge of the Branches, History and Terminal
// bars — while the workspace holds more than one. It is the branch
// picker's twin, so the two read as a pair wherever they stand: the same
// chip where the branch chip is a chip, the same field where the pane's
// pickers are fields, and the same popover under both (`BranchPopover`) —
// a search over the repositories, ↑/↓ to walk them, Return to pick, each
// row naming the branch it is on and the one the window is on ticked. A
// pick turns the page to that repository (`AppModel.focus(root:)`), which
// every one-repository surface follows; the popover's foot adds a
// repository beside the others.
//
// JetBrains' VCS widget does the same with a project of several roots:
// the branch it shows is the current repository's, named beside it.
import SwiftUI

struct RepositoryPicker: View {
    /// How the picker stands: as the toolbar's chips do, or as the pane
    /// bars' fields do — the branch pickers' two looks.
    enum Look {
        case chip
        case paneField
    }

    var look: Look = .chip
    @Environment(AppModel.self) private var model
    @Environment(\.controlSize) private var controlSize
    @State private var open = false

    private var name: String { model.focusedRoot?.name ?? "Repository" }

    /// Narrower than the branch field beside it: a repository's name is a
    /// folder's, rarely a branch's length.
    private static let paneFieldWidth: CGFloat = 140

    var body: some View {
        if model.roots.count > 1 {
            label
                .popover(isPresented: $open, arrowEdge: .bottom) { popover }
                .closesOnNavigation($open)
        }
    }

    @ViewBuilder
    private var label: some View {
        switch look {
        case .chip:
            let font = NSFont.systemFont(ofSize: controlSize == .small ? 11 : 13)
            Button { open.toggle() } label: {
                HStack(spacing: 5) {
                    RepoAvatar(name: name, size: controlSize == .small ? 12 : 14)
                    Text(name)
                        .lineLimit(1)
                        .truncationMode(.middle)
                        .clipHelp(name, font: font)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 8, weight: .semibold))
                        .foregroundStyle(.secondary)
                }
                .font(Font(font))
            }
            .buttonStyle(.accessoryBar)
            .help("Repository — the one the page is on")
        case .paneField:
            Button { open.toggle() } label: {
                HStack(spacing: 5) {
                    RepoAvatar(name: name, size: 12)
                    Text(name)
                        .font(.system(size: 11))
                        .lineLimit(1)
                        .truncationMode(.middle)
                        .clipHelp(name, font: .systemFont(ofSize: 11))
                    Spacer(minLength: 0)
                    MenuChevron()
                }
                .paneField()
                .frame(width: Self.paneFieldWidth)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help("Repository — the one the page is on")
        }
    }

    private var popover: some View {
        BranchPopover(
            sections: [BranchChoiceSection(id: "repositories", title: nil, rows: rows)],
            placeholder: "Search repositories", pick: pick, dismiss: { open = false }, actions: nil
        ) {
            ThemedDivider()
            HStack(spacing: 2) {
                Button("Add repository…") {
                    open = false
                    model.chooseRootToAdd()
                }
                Spacer(minLength: 0)
            }
            .buttonStyle(.accessoryBar)
            .controlSize(.small)
            .padding(6)
        }
    }

    private var rows: [BranchChoice] {
        model.roots.map { root in
            BranchChoice(
                id: root.path, branch: nil, title: root.name, symbol: "folder",
                tint: nil, badge: nil, checked: root === model.focusedRoot,
                detail: root.branch ?? "Detached HEAD", monograms: [root.name])
        }
    }

    private func pick(_ choice: BranchChoice) {
        open = false
        guard let root = model.root(at: choice.id) else { return }
        model.focus(root: root)
    }
}
