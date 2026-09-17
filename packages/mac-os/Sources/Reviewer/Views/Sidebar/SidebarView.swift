// The sidebar: the code page's file tree, drawn natively from what the
// page reports (see `SidebarTree`) in the layout the web sidebar gives that
// surface — the project's files as an outline on the browse page, and on a
// diff the changed files under a search, with the commit composer beneath
// them while the changes are your own — on an island floating beside the
// rail (see `ContentView`), under the branch picker, which stands over the
// tree the way the web header's does: the branch you are on is what the
// tree beneath it is a tree of. On the sessions surface the island holds
// the sessions list instead (see `SessionsList`) — every project's, so no
// branch names it, and the picker stands down with the tree. The project
// picker sits on the toolbar; the rail that moves the page between the
// surfaces stands beside the island (see `AppRail`). The sidebar follows
// the page, and a file or a session picked in it is carried to the page.
import SwiftUI

struct SidebarView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(spacing: 0) {
            if model.hasProject && model.sessions == nil {
                SidebarHeader()
            }
            if model.hasProject {
                TreeColumn()
                    .frame(maxWidth: .infinity)
            } else {
                Spacer()
            }
        }
    }
}

/// The band along the island's top: the web header's 36pt around a 28pt
/// chip, with the branch picker leading it. Over the tree only — the
/// sessions list is not one branch's.
private struct SidebarHeader: View {
    var body: some View {
        HStack(spacing: 4) {
            BranchPicker()
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 4)
        .frame(height: 36)
    }
}

/// The layout for the surface the page is on — its tree, or its sessions
/// — or nothing while the page reports neither: the merge requests, a dock
/// surface with the window to itself.
private struct TreeColumn: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        switch model.sidebar.mode {
        case .browse:
            ProjectTreeLayout()
        case .commit, .review:
            ChangesLayout()
        case nil where model.sessions != nil:
            SessionsList()
        case nil:
            Spacer()
        }
    }
}

/// The file tree layout: the project, as an outline.
private struct ProjectTreeLayout: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if model.sidebar.isEmpty {
            TreePlaceholder(loading: model.sidebar.listing?.loading ?? false, empty: "No files")
        } else {
            FileTreeOutline()
        }
    }
}

/// The git diff layout: the changed files, a search over them, and while
/// they are your own, the commit composer.
private struct ChangesLayout: View {
    @Environment(AppModel.self) private var model

    private var tree: SidebarTree { model.sidebar }

    var body: some View {
        @Bindable var tree = model.sidebar
        VStack(spacing: 0) {
            ChangesHeader(query: $tree.query, count: tree.listing?.paths.count ?? 0)
            if tree.isEmpty {
                TreePlaceholder(loading: tree.listing?.loading ?? false, empty: "No changes")
            } else {
                FileTreeOutline()
            }
            if let commit = tree.commit {
                CommitComposer(composer: commit, project: tree.listing?.projectPath ?? "")
            }
        }
    }
}

/// The search over the changed files, with how many there are.
private struct ChangesHeader: View {
    @Binding var query: String
    let count: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 5) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.secondary)
                TextField("Filter changed files", text: $query)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12))
                if !query.isEmpty {
                    Button {
                        query = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 11))
                            .foregroundStyle(.tertiary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 7)
            .frame(height: 24)
            .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 6))
            Text(count == 1 ? "1 changed file" : "\(count) changed files")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .padding(.leading, 4)
        }
        .padding(.horizontal, 10)
        .padding(.top, 2)
        .padding(.bottom, 6)
    }
}

private struct TreePlaceholder: View {
    let loading: Bool
    let empty: String

    var body: some View {
        VStack {
            Spacer()
            if loading {
                ProgressView()
                    .controlSize(.small)
            } else {
                Text(empty)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}
