// Makes sure the embedded API server is answering before the UI asks it for
// anything — the same job the Electron shell does in `ensureServer`. Nothing
// running on the port yet means the shell spawns it: through pnpm from the
// repository root, exactly as the Electron dev path does, so no bundling step
// is needed and the server runs on whatever Node the developer's shell
// resolves (a login shell, so version-manager shims are found).
//
// The port is shared with the desktop app's production default, so an already
// running Reviewer desktop (or a `pnpm dev` server) is simply reused. Override
// with REVIEWER_PORT for a second instance.
import Foundation

enum ServerLauncherError: LocalizedError {
    case repositoryRootNotFound
    case timedOut(URL)

    var errorDescription: String? {
        switch self {
        case .repositoryRootNotFound:
            return "could not find the reviewer repository (no pnpm-workspace.yaml above the executable) — start the server yourself with `pnpm --filter @reviewer/embedded-server start`"
        case .timedOut(let url):
            return "the API server did not answer at \(url.absoluteString)"
        }
    }
}

@MainActor
final class ServerLauncher {
    static let shared = ServerLauncher()

    let port: Int = Int(ProcessInfo.processInfo.environment["REVIEWER_PORT"] ?? "") ?? 41811

    /// Dialled by IP rather than `localhost`: App Transport Security exempts
    /// literal addresses, so plain http works without any plist entitlement
    /// even when the binary runs bare from `swift run`.
    var baseURL: URL { URL(string: "http://127.0.0.1:\(port)")! }

    private var process: Process?

    /// True when the shell had to spawn the server itself — it is then also
    /// the shell's to stop on quit.
    private(set) var ownsServer = false

    func ensureRunning() async throws {
        let probe = baseURL.appending(path: "/api/workspace")
        if await isReachable(probe) { return }
        try spawn()
        try await waitFor(probe, timeout: .seconds(30))
    }

    func stop() {
        guard ownsServer, let process, process.isRunning else { return }
        process.terminate()
    }

    private func spawn() throws {
        guard let root = Self.repositoryRoot() else {
            throw ServerLauncherError.repositoryRootNotFound
        }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-lc", "exec pnpm --filter @reviewer/embedded-server start"]
        process.currentDirectoryURL = root
        var environment = ProcessInfo.processInfo.environment
        environment["REVIEWER_PORT"] = String(port)
        process.environment = environment
        process.standardOutput = FileHandle.standardOutput
        process.standardError = FileHandle.standardError
        try process.run()
        self.process = process
        ownsServer = true
    }

    /// The monorepo root, found by walking up from the executable — `swift
    /// run` leaves it under `packages/mac-os/.build/...`, and the bundled app
    /// under `.build/Reviewer.app/Contents/MacOS`. REVIEWER_REPO_ROOT wins when
    /// set, for a binary copied elsewhere.
    private static func repositoryRoot() -> URL? {
        if let explicit = ProcessInfo.processInfo.environment["REVIEWER_REPO_ROOT"] {
            return URL(fileURLWithPath: explicit)
        }
        var directory = Bundle.main.executableURL?.deletingLastPathComponent()
        while let current = directory, current.path != "/" {
            let marker = current.appending(path: "pnpm-workspace.yaml")
            if FileManager.default.fileExists(atPath: marker.path) { return current }
            directory = current.deletingLastPathComponent()
        }
        return nil
    }

    private func isReachable(_ url: URL) async -> Bool {
        var request = URLRequest(url: url)
        request.timeoutInterval = 1
        do {
            _ = try await URLSession.shared.data(for: request)
            return true
        } catch {
            return false
        }
    }

    private func waitFor(_ url: URL, timeout: Duration) async throws {
        let clock = ContinuousClock()
        let deadline = clock.now + timeout
        while clock.now < deadline {
            if await isReachable(url) { return }
            try await Task.sleep(for: .milliseconds(300))
        }
        throw ServerLauncherError.timedOut(url)
    }
}
