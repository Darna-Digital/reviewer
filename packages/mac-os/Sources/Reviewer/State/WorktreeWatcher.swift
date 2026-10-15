// The project's working tree, watched on disk — so a file an agent writes,
// in a session here or in a terminal, or one saved from another editor,
// reaches a diff already on screen. Nothing else hears it: the server
// answers what it is asked and pushes nothing, and the page only asks
// again when something tells it to.
//
// What counts is what git would show. A path git ignores — a build's
// output, a dev server's cache, `node_modules` — changes all the time and
// moves no diff, so a batch made only of those is let go, git itself
// saying which they are. Inside the git directory only what a diff or a
// status is read against counts — HEAD, the refs, the index — and not the
// objects and logs every commit and fetch writes around them.
//
// Changes are gathered for a moment and told once: an agent's edit lands
// as a burst of writes, and every telling has the page ask git again.
import CoreServices
import Foundation

@MainActor
final class WorktreeWatcher {
    /// How long changes are gathered before they are told — about the
    /// length of one burst of writes, and short enough that the diff
    /// follows the edit.
    private static let gather: Duration = .milliseconds(300)
    /// How long the system holds events before handing them over.
    private static let latency: CFTimeInterval = 0.1
    /// What, inside a git directory, a diff or a status is read against.
    private static let gitPathsThatCount = ["HEAD", "index", "packed-refs"]

    private let onChanged: @MainActor () -> Void
    private var project: String?
    private var gitDirectories: [String] = []
    private var stream: FSEventStreamRef?
    private var heard: Set<String> = []
    private var heardGitState = false
    private var gathering: Task<Void, Never>?

    init(onChanged: @escaping @MainActor () -> Void) {
        self.onChanged = onChanged
    }

    /// The stream holds this watcher unretained, so it goes first.
    isolated deinit {
        stop()
    }

    /// Watch the working tree at `project` — again, only if it is another
    /// one than already watched; nil stops.
    func watch(project: String?) {
        guard project != self.project else { return }
        stop()
        guard let project else { return }
        self.project = project
        gitDirectories = Self.gitDirectories(of: project).map(\.path)
        let roots = ([project] + gitDirectories.filter { !$0.hasPrefix(project + "/") }) as CFArray
        var context = FSEventStreamContext(
            version: 0, info: Unmanaged.passUnretained(self).toOpaque(), retain: nil, release: nil, copyDescription: nil)
        let flags = FSEventStreamCreateFlags(kFSEventStreamCreateFlagFileEvents | kFSEventStreamCreateFlagUseCFTypes)
        guard let stream = FSEventStreamCreate(
            kCFAllocatorDefault, Self.callback, &context, roots,
            FSEventStreamEventId(kFSEventStreamEventIdSinceNow), Self.latency, flags)
        else { return }
        FSEventStreamSetDispatchQueue(stream, .main)
        FSEventStreamStart(stream)
        self.stream = stream
    }

    func stop() {
        gathering?.cancel()
        gathering = nil
        if let stream {
            FSEventStreamStop(stream)
            FSEventStreamInvalidate(stream)
            FSEventStreamRelease(stream)
        }
        stream = nil
        project = nil
        gitDirectories = []
        heard = []
        heardGitState = false
    }

    private static let callback: FSEventStreamCallback = { _, info, count, paths, flags, _ in
        guard let info else { return }
        let watcher = Unmanaged<WorktreeWatcher>.fromOpaque(info).takeUnretainedValue()
        let paths = Unmanaged<CFArray>.fromOpaque(paths).takeUnretainedValue() as? [String] ?? []
        let flags = Array(UnsafeBufferPointer(start: flags, count: count))
        MainActor.assumeIsolated { watcher.take(paths, flags: flags) }
    }

    private func take(_ paths: [String], flags: [FSEventStreamEventFlags]) {
        guard let project else { return }
        let rescan = FSEventStreamEventFlags(kFSEventStreamEventFlagMustScanSubDirs | kFSEventStreamEventFlagRootChanged)
        for (path, flag) in zip(paths, flags) {
            if flag & rescan != 0 {
                heardGitState = true
            } else if let inGit = gitDirectories.lazy.compactMap({ Self.path(path, inside: $0) }).first {
                if Self.counts(gitPath: inGit) { heardGitState = true }
            } else if let inTree = Self.path(path, inside: project) {
                heard.insert(inTree)
            }
        }
        guard gathering == nil, heardGitState || !heard.isEmpty else { return }
        gathering = Task { [weak self] in
            try? await Task.sleep(for: Self.gather)
            guard !Task.isCancelled else { return }
            await self?.tell()
        }
    }

    /// Tells what was gathered, if any of it counts; what is heard while
    /// git is asked is gathered for the next telling.
    private func tell() async {
        guard let project else { return }
        let paths = heard
        let gitState = heardGitState
        heard = []
        heardGitState = false
        let counts = gitState ? true : await Self.anyTracked(paths, in: project)
        gathering = nil
        guard project == self.project else { return }
        if counts { onChanged() }
        if heardGitState || !heard.isEmpty { take([], flags: []) }
    }

    private static func counts(gitPath: String) -> Bool {
        gitPathsThatCount.contains(gitPath) || gitPath.hasPrefix("refs/")
    }

    private static func path(_ path: String, inside directory: String) -> String? {
        guard path.hasPrefix(directory + "/") else { return nil }
        return String(path.dropFirst(directory.count + 1))
    }

    /// Whether any of `paths` is one git does not ignore — asked of git
    /// itself, so every `.gitignore` and exclude in play is honoured. A
    /// git that cannot answer counts as a change: a diff asked for once
    /// too often is cheaper than one left behind.
    private nonisolated static func anyTracked(_ paths: Set<String>, in project: String) async -> Bool {
        guard !paths.isEmpty else { return false }
        return await Task.detached(priority: .utility) {
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/git")
            process.arguments = ["-C", project, "check-ignore", "-z", "--stdin"]
            let input = Pipe()
            let output = Pipe()
            process.standardInput = input
            process.standardOutput = output
            process.standardError = FileHandle.nullDevice
            do {
                try process.run()
            } catch {
                return true
            }
            let writing = Thread {
                input.fileHandleForWriting.write(Data(paths.joined(separator: "\0").utf8 + [0]))
                try? input.fileHandleForWriting.close()
            }
            writing.start()
            let answer = output.fileHandleForReading.readDataToEndOfFile()
            process.waitUntilExit()
            // 0: some are ignored, 1: none are; anything else is git failing.
            guard process.terminationStatus <= 1 else { return true }
            let ignored = Set(answer.split(separator: 0).map { String(decoding: $0, as: UTF8.self) })
            return paths.contains { !ignored.contains($0) }
        }.value
    }

    /// The repository's git directory, and for a linked worktree the
    /// common one its branches live in too.
    private static func gitDirectories(of project: String) -> [URL] {
        guard let gitDirectory = HeadWatcher.gitDirectory(of: project) else { return [] }
        guard let pointer = try? String(contentsOf: gitDirectory.appendingPathComponent("commondir"), encoding: .utf8)
        else { return [gitDirectory] }
        let common = URL(
            fileURLWithPath: pointer.trimmingCharacters(in: .whitespacesAndNewlines),
            relativeTo: gitDirectory.appendingPathComponent("", isDirectory: true)
        ).standardizedFileURL
        return [gitDirectory, common]
    }
}
