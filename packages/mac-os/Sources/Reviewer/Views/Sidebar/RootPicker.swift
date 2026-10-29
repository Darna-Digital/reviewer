// The repository chip beside the branch chip, while the workspace holds
// more than one: the repository the page is on — whose branch the chip
// beside it names and switches, whose changes the commit chords take — and
// a menu of the workspace's others, each with the branch it is on, to turn
// the page to. JetBrains' status-bar VCS widget does the same with a
// project of several roots: the branch shown is the current repository's.
// The foot of the menu adds a repository beside the others.
import SwiftUI

struct RootPicker: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Menu {
            ForEach(model.roots) { root in
                Button {
                    model.focus(root: root)
                } label: {
                    if root === model.focusedRoot {
                        Label(title(of: root), systemImage: "checkmark")
                    } else {
                        Text(title(of: root))
                    }
                }
            }
            Divider()
            Button("Add repository…") { model.chooseRootToAdd() }
        } label: {
            HStack(spacing: 5) {
                RepoAvatar(name: model.focusedRoot?.name ?? "", size: 14)
                Text(model.focusedRoot?.name ?? "Repository")
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            .font(.system(size: 13))
        }
        .menuStyle(.button)
        .buttonStyle(.accessoryBar)
        .fixedSize()
        .help("The repository the page is on — switch to another of the workspace's")
    }

    private func title(of root: RootModel) -> String {
        root.branch.map { "\(root.name) — \($0)" } ?? root.name
    }
}
