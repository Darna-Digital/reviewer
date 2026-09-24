// What git said, read into a sentence for the notice (see `Notices`): the
// card says what happened — "3 files changed · +9 −7", "Conflicts in
// Notices.swift", "The remote has commits you don't have yet" — and git's
// own account stays behind the card's Details, the way Xcode and GitHub
// Desktop report a push. Git's messages are stable enough to read by
// shape: the ref lines of a push and a fetch, the diffstat of a pull and a
// merge, the CONFLICT lines of either, the "would be overwritten" list.
// Output that fits none of them is shown by its first error lines.
import Foundation

struct GitSummary: Equatable {
    /// A headline better than the action's own — "Nothing to push" over
    /// "Pushed" — or nil for the action's.
    var headline: String?
    var detail: String?
    /// A merge or rebase stopped on conflicts: git exits 1 on those, but
    /// the server passes them on as output once the tree is mid-operation.
    var conflicted = false
}

enum GitReport {
    static func read(_ output: String) -> GitSummary {
        let lines = output.split(separator: "\n").map(String.init)
        return conflicts(lines)
            ?? overwritten(lines)
            ?? rejectedPush(lines)
            ?? unreachable(lines)
            ?? unmergedBranch(lines)
            ?? upToDate(lines)
            ?? changed(lines)
            ?? pushed(lines)
            ?? fetched(lines)
            ?? rebased(lines)
            ?? GitSummary(detail: fallback(lines))
    }

    // MARK: refusals

    private static func conflicts(_ lines: [String]) -> GitSummary? {
        let files = lines.compactMap { line -> String? in
            guard line.hasPrefix("CONFLICT ("), let range = line.range(of: " in ") else { return nil }
            return String(line[range.upperBound...])
        }
        guard !files.isEmpty else { return nil }
        let rebasing = lines.contains { $0.contains("git rebase --continue") || $0.hasPrefix("error: could not apply") }
        let applying = lines.first { $0.hasPrefix("error: could not apply ") }
            .map { String($0.dropFirst("error: could not apply ".count)) }
            .flatMap { $0.split(separator: " ", maxSplits: 1).first.map(String.init) }
            .map { $0.replacingOccurrences(of: "...", with: "") }
        var detail = "Conflicts in \(named(files))"
        if let applying { detail += " while applying \(applying)" }
        detail += rebasing ? ". Resolve them, then continue the rebase." : ". Resolve them, then commit the merge."
        return GitSummary(detail: detail, conflicted: true)
    }

    private static func overwritten(_ lines: [String]) -> GitSummary? {
        guard let start = lines.firstIndex(where: { $0.hasPrefix("error: Your local changes to the following files would be overwritten") }) else { return nil }
        let files = lines[(start + 1)...].prefix { $0.hasPrefix(" ") }.map { $0.trimmingCharacters(in: .whitespaces) }
        return GitSummary(detail: "Local changes in \(named(files)) would be overwritten. Commit or stash them first.")
    }

    private static func rejectedPush(_ lines: [String]) -> GitSummary? {
        guard let line = lines.first(where: { $0.contains("[rejected]") || $0.contains("[remote rejected]") }) else { return nil }
        let reason = line.split(separator: "(").last.map { $0.replacingOccurrences(of: ")", with: "") } ?? ""
        let detail: String
        switch reason {
        case "fetch first", "non-fast-forward":
            detail = "The remote has commits you don't have yet. Pull first, then push again."
        case "stale info":
            detail = "The remote has moved since it was last fetched. Fetch, then push again."
        default:
            detail = line.contains("[remote rejected]") ? "The remote rejected the push: \(reason)." : "The remote refused the update: \(reason)."
        }
        return GitSummary(headline: "Push rejected", detail: detail)
    }

    private static func unreachable(_ lines: [String]) -> GitSummary? {
        guard lines.contains(where: { $0.hasPrefix("fatal: Could not read from remote repository") || $0.contains("Could not resolve host") }) else { return nil }
        let host = lines.lazy.compactMap { line -> String? in
            guard let match = line.firstMatch(of: /Could not resolve host(?:name)?:? ([^\s:]+)/) else { return nil }
            return String(match.1)
        }.first
        let reached = host.map { "Couldn't reach \($0)." } ?? "Couldn't reach the remote."
        return GitSummary(detail: "\(reached) Check your connection and access rights.")
    }

    private static func unmergedBranch(_ lines: [String]) -> GitSummary? {
        guard let match = lines.lazy.compactMap({ $0.firstMatch(of: /error: the branch '([^']+)' is not fully merged/) }).first else { return nil }
        return GitSummary(detail: "\(match.1) has commits that are on no other branch.")
    }

    // MARK: outcomes

    private static func upToDate(_ lines: [String]) -> GitSummary? {
        if lines.contains("Everything up-to-date") {
            return GitSummary(headline: "Nothing to push", detail: "The remote already has everything.")
        }
        if lines.contains("Already up to date.") {
            return GitSummary(headline: "Already up to date")
        }
        return nil
    }

    /// A pull's or a merge's diffstat: "3 files changed · +9 −7", with the
    /// fast-forward said where git said it.
    private static func changed(_ lines: [String]) -> GitSummary? {
        guard let match = lines.lazy.compactMap({ $0.firstMatch(of: /(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/) }).first else { return nil }
        let files = Int(match.1) ?? 0
        var parts = ["\(files) \(files == 1 ? "file" : "files") changed"]
        if let added = match.2 { parts.append("+\(added)") }
        if let removed = match.3 { parts.append("−\(removed)") }
        if lines.contains("Fast-forward") { parts.insert("Fast-forward", at: 0) }
        return GitSummary(detail: parts.joined(separator: " · "))
    }

    private static func pushed(_ lines: [String]) -> GitSummary? {
        guard let remote = lines.first(where: { $0.hasPrefix("To ") }).map({ prettyRemote(String($0.dropFirst(3))) }) else { return nil }
        if let match = lines.lazy.compactMap({ $0.firstMatch(of: /^\s*([0-9a-f]+)\.\.([0-9a-f]+)\s+(\S+) -> (\S+)/) }).first {
            return GitSummary(headline: "Pushed \(match.3)", detail: "\(match.1) → \(match.2) · \(remote)")
        }
        if let match = lines.lazy.compactMap({ $0.firstMatch(of: /\* \[new branch\]\s+\S+ -> (\S+)/) }).first {
            return GitSummary(headline: "Pushed new branch \(match.1)", detail: remote)
        }
        return nil
    }

    private static func fetched(_ lines: [String]) -> GitSummary? {
        guard lines.contains(where: { $0.hasPrefix("From ") }) else { return nil }
        let new = lines.filter { $0.contains("[new branch]") || $0.contains("[new tag]") }.count
        let updated = lines.filter { $0.firstMatch(of: /^\s*[+ ]?[0-9a-f]+\.\.\.?[0-9a-f]+\s+\S+\s+->/) != nil }.count
        let deleted = lines.filter { $0.contains("[deleted]") }.count
        var parts: [String] = []
        if new > 0 { parts.append("\(new) new") }
        if updated > 0 { parts.append("\(updated) updated") }
        if deleted > 0 { parts.append("\(deleted) deleted") }
        guard !parts.isEmpty else { return nil }
        return GitSummary(detail: parts.joined(separator: " · ") + (parts.count == 1 && new + updated + deleted == 1 ? " branch" : " branches"))
    }

    private static func rebased(_ lines: [String]) -> GitSummary? {
        lines.contains { $0.hasPrefix("Successfully rebased") } ? GitSummary() : nil
    }

    // MARK: pieces

    /// The first lines worth reading — the error and fatal lines when there
    /// are any, else the first of all — as sentences, three at most.
    private static func fallback(_ lines: [String]) -> String? {
        let errors = lines.filter { $0.hasPrefix("error:") || $0.hasPrefix("fatal:") || $0.hasPrefix("✖") }
        let chosen = (errors.isEmpty ? lines : errors).prefix(3).map { line in
            var text = line
            for prefix in ["error: ", "fatal: "] where text.hasPrefix(prefix) { text.removeFirst(prefix.count) }
            return text.prefix(1).uppercased() + text.dropFirst()
        }
        return chosen.isEmpty ? nil : chosen.joined(separator: "\n")
    }

    /// Files by their last path component: "a.swift", "a.swift and b.tsx",
    /// "a.swift and 2 other files".
    private static func named(_ paths: [String]) -> String {
        let names = paths.map { $0.split(separator: "/").last.map(String.init) ?? $0 }
        switch names.count {
        case 0: return "files"
        case 1: return names[0]
        case 2: return "\(names[0]) and \(names[1])"
        default: return "\(names[0]) and \(names.count - 1) other files"
        }
    }

    /// "github.com:darna-digital/reviewer.git" and its https twin as
    /// "github.com/darna-digital/reviewer".
    private static func prettyRemote(_ url: String) -> String {
        var pretty = url.trimmingCharacters(in: .whitespaces)
        for prefix in ["https://", "http://", "ssh://", "git@"] where pretty.hasPrefix(prefix) { pretty.removeFirst(prefix.count) }
        if pretty.hasSuffix(".git") { pretty.removeLast(4) }
        if let colon = pretty.firstIndex(of: ":"), !pretty[..<colon].contains("/") {
            pretty.replaceSubrange(colon...colon, with: "/")
        }
        return pretty
    }
}
