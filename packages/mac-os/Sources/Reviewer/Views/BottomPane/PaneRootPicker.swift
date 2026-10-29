// The repository a one-repository pane is on — Branches, History, Terminal
// — at its bar's leading edge while the workspace holds several. A pane
// like these acts on the focused root, the repository the page is on, so
// picking another here turns the page with it: the branch checked out, the
// commit read and the shell opened are always the repository in front.
import SwiftUI

struct PaneRootPicker: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if model.roots.count > 1 {
            Picker("Repository", selection: focusedPath) {
                ForEach(model.roots) { root in
                    Text(root.name).tag(Optional(root.path))
                }
            }
            .labelsHidden()
            .pickerStyle(.menu)
            .fixedSize()
            .help("The repository this pane shows — the one the page is on")
        }
    }

    private var focusedPath: Binding<String?> {
        Binding(
            get: { model.focusedRoot?.path },
            set: { path in
                if let root = model.root(at: path) { model.focus(root: root) }
            })
    }
}
