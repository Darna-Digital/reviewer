// Makes sure the embedded API server is answering before the UI asks it for
// anything. Nothing running on the port yet means the shell spawns it: through
// pnpm from the repository root, so no bundling step is needed and the server
// runs on whatever Node the developer's shell resolves (a login shell, so
// version-manager shims are found).
//
// The port is the server's default, so an already running server (a `pnpm
// dev` one, or another Reviewer window's) is simply reused. Override with
// REVIEWER_PORT for a second instance — which is what "Open in New Window"
// does: the server holds one project, so a second window is a second
// instance of the app, on a free port of its own, booted straight onto the
// repository it was asked for (`launchInstance`).
import AppKit
import Foundation

enum ServerLauncherError: LocalizedError {
    case repositoryRootNotFound
    case timedOut(URL)
    case noFreePort

    var errorDescription: String? {
        switch self {
        case .repositoryRootNotFound:
            return "could not find the reviewer repository (no pnpm-workspace.yaml above the executable) — start the server yourself with `pnpm --filter @reviewer/embedded-server start`"
        case .timedOut(let url):
            return "the API server did not answer at \(url.absoluteString)"
        case .noFreePort:
            return "could not find a free port for another window's server"
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

    /// Another Reviewer, opened on `project`: the bundle launched again as a
    /// new instance — the bare binary run again under `swift run` — with a
    /// port nothing answers on yet, so it brings up a server of its own.
    func launchInstance(project: String) throws {
        guard let port = Self.freePort() else { throw ServerLauncherError.noFreePort }
        let environment = ["REVIEWER_PORT": String(port), "REVIEWER_REPO": project]
        if Bundle.main.bundleURL.pathExtension == "app" {
            let configuration = NSWorkspace.OpenConfiguration()
            configuration.createsNewApplicationInstance = true
            configuration.environment = environment
            NSWorkspace.shared.openApplication(at: Bundle.main.bundleURL, configuration: configuration)
            return
        }
        guard let executable = Bundle.main.executableURL else { throw ServerLauncherError.noFreePort }
        let process = Process()
        process.executableURL = executable
        process.environment = ProcessInfo.processInfo.environment.merging(environment) { _, launched in launched }
        try process.run()
    }

    /// A port the system has free right now, found by binding to none in
    /// particular and reading back which one it gave.
    private static func freePort() -> Int? {
        let socket = Darwin.socket(AF_INET, SOCK_STREAM, 0)
        guard socket >= 0 else { return nil }
        defer { close(socket) }
        var address = sockaddr_in()
        address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        address.sin_family = sa_family_t(AF_INET)
        address.sin_port = 0
        address.sin_addr.s_addr = inet_addr("127.0.0.1")
        let size = socklen_t(MemoryLayout<sockaddr_in>.size)
        let bound = withUnsafePointer(to: &address) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { bind(socket, $0, size) }
        }
        guard bound == 0 else { return nil }
        var length = size
        let read = withUnsafeMutablePointer(to: &address) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { getsockname(socket, $0, &length) }
        }
        guard read == 0 else { return nil }
        return Int(UInt16(bigEndian: address.sin_port))
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
    nonisolated static func repositoryRoot() -> URL? {
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
