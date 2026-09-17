// What the detail column shows with no project open: the recent projects the
// server remembers, and the button that opens a new one.
import SwiftUI

struct WelcomeView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "chevron.left.forwardslash.chevron.right")
                .font(.system(size: 40, weight: .light))
                .foregroundStyle(.secondary)
            Text("Open a project to get started")
                .font(.title2)
            Button("Open Project…") { model.chooseProject() }
                .keyboardShortcut(.defaultAction)

            if let recents = model.workspace?.recents, !recents.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Recent")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(.bottom, 4)
                    ForEach(recents, id: \.self) { path in
                        Button {
                            Task { await model.openProject(path: path) }
                        } label: {
                            HStack {
                                Image(systemName: "folder")
                                VStack(alignment: .leading) {
                                    Text(URL(fileURLWithPath: path).lastPathComponent)
                                    Text(abbreviated(path))
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .padding(.vertical, 4)
                    }
                }
                .frame(width: 360)
                .padding(.top, 12)
            }
        }
        .padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func abbreviated(_ path: String) -> String {
        guard let home = model.workspace?.home, path.hasPrefix(home) else { return path }
        return "~" + path.dropFirst(home.count)
    }
}
