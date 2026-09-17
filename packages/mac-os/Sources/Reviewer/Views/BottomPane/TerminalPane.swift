// The Terminal surface: the model's shell, put in the hierarchy. The view is
// the session's and outlives this representable, so collapsing the pane or
// switching surfaces leaves the shell exactly where it was.
import SwiftTerm
import SwiftUI

struct TerminalPane: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if let directory = model.terminalDirectory {
            TerminalHost(view: model.terminal.terminal(in: directory))
                .padding(.top, 4)
        } else {
            ContentUnavailableView("No project open", systemImage: "terminal")
        }
    }
}

struct TerminalHost: NSViewRepresentable {
    let view: TerminalView

    func makeNSView(context: Context) -> TerminalView { view }
    func updateNSView(_ nsView: TerminalView, context: Context) {}
}
