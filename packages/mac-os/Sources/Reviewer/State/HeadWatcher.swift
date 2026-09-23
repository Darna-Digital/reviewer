// The project's HEAD, watched on disk — so a branch checked out anywhere
// else, a terminal, another app, moves the picker too. Git never edits
// HEAD in place: it writes HEAD.lock beside it and renames that over it,
// so it is the git directory that is watched, not the file. Everything
// else git does there — the index rewritten by every `git status` — is
// heard as well, which is why a change only counts once HEAD reads
// differently from the last time it was read.
import Foundation

@MainActor
final class HeadWatcher {
    /// How long a burst of writes to the git directory is let settle
    /// before HEAD is read — a checkout touches it several times over.
    private static let settle: Duration = .milliseconds(250)

    private let onMoved: @MainActor () -> Void
    private var watched: URL?
    private var head: String?
    private var source: DispatchSourceFileSystemObject?
    private var pending: Task<Void, Never>?

    init(onMoved: @escaping @MainActor () -> Void) {
        self.onMoved = onMoved
    }

    /// Watch the repository at `project` — again, only if it is another
    /// one than already watched; nil stops.
    func watch(project: String?) {
        let gitDirectory = project.flatMap(Self.gitDirectory(of:))
        guard gitDirectory != watched else { return }
        stop()
        guard let gitDirectory else { return }
        let descriptor = open(gitDirectory.path, O_EVTONLY)
        guard descriptor >= 0 else { return }
        watched = gitDirectory
        head = Self.read(headIn: gitDirectory)
        let source = DispatchSource.makeFileSystemObjectSource(fileDescriptor: descriptor, eventMask: .write, queue: .main)
        source.setEventHandler { [weak self] in
            MainActor.assumeIsolated { self?.heard() }
        }
        source.setCancelHandler { close(descriptor) }
        source.resume()
        self.source = source
    }

    func stop() {
        pending?.cancel()
        pending = nil
        source?.cancel()
        source = nil
        watched = nil
        head = nil
    }

    private func heard() {
        pending?.cancel()
        pending = Task { [weak self] in
            try? await Task.sleep(for: Self.settle)
            guard !Task.isCancelled else { return }
            self?.reread()
        }
    }

    private func reread() {
        guard let watched else { return }
        let now = Self.read(headIn: watched)
        guard now != head else { return }
        head = now
        onMoved()
    }

    private static func read(headIn gitDirectory: URL) -> String? {
        try? String(contentsOf: gitDirectory.appendingPathComponent("HEAD"), encoding: .utf8)
    }

    /// Where the repository keeps HEAD: its `.git` folder — or, for a
    /// linked worktree, whose `.git` is a file, the folder that file names.
    private static func gitDirectory(of project: String) -> URL? {
        let dotGit = URL(fileURLWithPath: project).appendingPathComponent(".git")
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: dotGit.path, isDirectory: &isDirectory) else { return nil }
        if isDirectory.boolValue { return dotGit }
        guard let pointer = try? String(contentsOf: dotGit, encoding: .utf8),
              let line = pointer.split(whereSeparator: \.isNewline).first,
              line.hasPrefix("gitdir:")
        else { return nil }
        let path = line.dropFirst("gitdir:".count).trimmingCharacters(in: .whitespaces)
        return URL(fileURLWithPath: path, relativeTo: URL(fileURLWithPath: project, isDirectory: true)).standardizedFileURL
    }
}
