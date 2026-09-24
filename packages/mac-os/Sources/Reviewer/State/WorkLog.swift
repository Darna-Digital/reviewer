// A turn's flat activity log folded into the steps the timeline draws — the
// SPA's `work-log.functions`. The wire carries a tool call as two
// activities, one when it starts and one when it settles, because that is
// how every provider CLI reports it; drawn as two rows a turn reads like
// twice the work it was, so they are paired here into one step that owns a
// status, a duration and both payloads. Providers that send a call id
// (claude, whose tools overlap) match on it; those that do not (codex,
// strictly sequential) close the oldest open step of the same kind.
import Foundation

enum WorkStepStatus: Hashable, Sendable {
    case running, done, failed
}

struct WorkStep: Identifiable, Hashable, Sendable {
    let id: String
    let label: String
    let summary: String
    /// The part of the summary after the tool name — `"Bash — pnpm test"` →
    /// `"pnpm test"`.
    let detail: String?
    var status: WorkStepStatus
    let thinking: Bool
    /// The call's arguments, from the activity that opened it.
    var input: String?
    /// What the tool returned, from the activity that settled it.
    var output: String?
    let startedAt: String
    var endedAt: String?
    var durationMs: Int?

    var isExpandable: Bool { input != nil || output != nil }

    /// The face a step wears, by what its tool is called; thinking has its own.
    var symbol: String {
        if thinking { return "brain" }
        let name = label.lowercased()
        if name.hasPrefix("bash") || name.hasPrefix("command") || name.contains("shell") || name.contains("terminal") {
            return "terminal"
        }
        if name.hasPrefix("read") || name.hasPrefix("notebookread") || name.hasPrefix("cat") { return "doc.text" }
        if name.hasPrefix("write") || name.hasPrefix("edit") || name.hasPrefix("multiedit") || name.hasPrefix("notebookedit")
            || name.contains("file_change") || name.contains("filechange") || name.contains("edited")
        {
            return "pencil"
        }
        if name.hasPrefix("grep") || name.hasPrefix("glob") || name.hasPrefix("search") || name.hasPrefix("ls") {
            return "magnifyingglass"
        }
        if name.hasPrefix("web") || name.hasPrefix("fetch") || name.hasPrefix("url") { return "globe" }
        if name.hasPrefix("todo") { return "checklist" }
        if name.hasPrefix("task") || name.hasPrefix("agent") || name.hasPrefix("mcp") { return "arrow.triangle.branch" }
        return "wrench"
    }
}

enum WorkLog {
    private static let openingKinds: Set<String> = ["tool.started", "thinking"]
    private static let closingKinds: Set<String> = ["tool.completed", "tool.failed", "thinking.completed"]

    /// `activities` folded into steps. With the turn no longer running, a step
    /// that never got its closing activity — the agent was killed, or the
    /// provider does not report completions — is shown settled rather than
    /// left spinning forever.
    static func steps(of activities: [ChatActivity], turnRunning: Bool) -> [WorkStep] {
        var steps: [(step: WorkStep, callId: String?)] = []

        func openStep(for activity: ChatActivity) -> Int? {
            if let callId = activity.callId {
                return steps.firstIndex { $0.callId == callId && $0.step.status == .running }
            }
            let closesThinking = activity.kind == "thinking.completed"
            return steps.firstIndex {
                $0.callId == nil && $0.step.status == .running && $0.step.thinking == closesThinking
            }
        }

        for activity in activities {
            guard closingKinds.contains(activity.kind) else {
                steps.append((opening(activity), activity.callId))
                continue
            }
            guard let index = openStep(for: activity) else {
                steps.append((alreadyClosed(activity), activity.callId))
                continue
            }
            steps[index].step = closed(steps[index].step, by: activity)
        }

        return steps.map { entry in
            var step = entry.step
            if step.status == .running && !turnRunning { step.status = .done }
            return step
        }
    }

    /// The step to name in the live status line: whatever is still in flight.
    static func activeStep(_ steps: [WorkStep]) -> WorkStep? {
        steps.last { $0.status == .running }
    }

    /// Wall-clock span of the whole turn, first start to last settle.
    static func elapsedMs(_ steps: [WorkStep]) -> Int? {
        var first: Date?
        var last: Date?
        for step in steps {
            if let started = Wire.date(step.startedAt), first.map({ started < $0 }) ?? true { first = started }
            if let ended = Wire.date(step.endedAt ?? step.startedAt), last.map({ ended > $0 }) ?? true { last = ended }
        }
        guard let first, let last, last >= first else { return nil }
        return Int(last.timeIntervalSince(first) * 1000)
    }

    static func formatDuration(_ ms: Int) -> String {
        if ms < 1000 { return "\(ms)ms" }
        if ms < 60_000 {
            let seconds = Double(ms) / 1000
            return ms < 10_000 ? String(format: "%.1fs", seconds) : "\(Int(seconds.rounded()))s"
        }
        return "\(ms / 60_000)m \(Int((Double(ms % 60_000) / 1000).rounded()))s"
    }

    private static func isFailure(_ activity: ChatActivity) -> Bool {
        activity.kind == "tool.failed" || activity.tone == .error
    }

    /// `"Bash — pnpm test"` → `"Bash"`, where the provider sent no label.
    private static func label(of activity: ChatActivity) -> String {
        activity.label ?? activity.summary.components(separatedBy: " — ").first ?? activity.summary
    }

    private static func detail(of activity: ChatActivity) -> String? {
        let tail = activity.summary.components(separatedBy: " — ").dropFirst().joined(separator: " — ")
        return tail.isEmpty ? nil : tail
    }

    private static func opening(_ activity: ChatActivity) -> WorkStep {
        let settled = !openingKinds.contains(activity.kind)
        return WorkStep(
            id: activity.id, label: label(of: activity), summary: activity.summary, detail: detail(of: activity),
            status: !settled ? .running : isFailure(activity) ? .failed : .done,
            thinking: activity.kind == "thinking",
            input: activity.detail, output: nil,
            startedAt: activity.createdAt, endedAt: settled ? activity.createdAt : nil, durationMs: nil)
    }

    private static func alreadyClosed(_ activity: ChatActivity) -> WorkStep {
        WorkStep(
            id: activity.id, label: label(of: activity), summary: activity.summary, detail: detail(of: activity),
            status: isFailure(activity) ? .failed : .done,
            thinking: activity.kind == "thinking.completed",
            input: nil, output: activity.detail,
            startedAt: activity.createdAt, endedAt: activity.createdAt, durationMs: nil)
    }

    private static func closed(_ open: WorkStep, by activity: ChatActivity) -> WorkStep {
        var step = open
        step.status = isFailure(activity) ? .failed : .done
        step.output = activity.detail
        step.endedAt = activity.createdAt
        if let started = Wire.date(open.startedAt), let ended = Wire.date(activity.createdAt), ended >= started {
            step.durationMs = Int(ended.timeIntervalSince(started) * 1000)
        }
        return step
    }
}
