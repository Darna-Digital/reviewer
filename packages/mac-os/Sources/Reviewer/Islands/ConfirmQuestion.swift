// A yes/no question the island asks — the SPA's `ConfirmOptions` — asked
// natively: an alert sheet on the window, so "discard this file?" reads like
// every other Mac app's rather than like a web page's dialog. The page waits
// on the answer as a promise, so the sheet never blocks the renderer the way
// `window.confirm` would.
import AppKit

struct ConfirmQuestion {
    let title: String
    /// What the question is about — a path, a branch — on its own line.
    let subject: String?
    let description: String?
    let confirmLabel: String
    let cancelLabel: String
    let destructive: Bool

    static func decode(_ value: Any?) -> ConfirmQuestion? {
        guard let options = value as? [String: Any], let title = options["title"] as? String else { return nil }
        return ConfirmQuestion(
            title: title,
            subject: options["subject"] as? String,
            description: options["description"] as? String,
            confirmLabel: options["confirmLabel"] as? String ?? "Continue",
            cancelLabel: options["cancelLabel"] as? String ?? "Cancel",
            destructive: options["destructive"] as? Bool ?? false)
    }

    /// A sheet on `window`, or an app-modal alert when the island has no
    /// window to hang one from. A second question asked while one is up
    /// queues behind it — AppKit holds a window's sheets in line.
    @MainActor
    func ask(over window: NSWindow?) async -> Bool {
        let alert = makeAlert()
        guard let window else { return alert.runModal() == .alertFirstButtonReturn }
        return await withCheckedContinuation { answer in
            alert.beginSheetModal(for: window) { response in
                answer.resume(returning: response == .alertFirstButtonReturn)
            }
        }
    }

    @MainActor
    private func makeAlert() -> NSAlert {
        let alert = NSAlert()
        alert.alertStyle = destructive ? .warning : .informational
        alert.messageText = title
        alert.informativeText = [subject, description].compactMap { $0 }.joined(separator: "\n\n")
        let confirm = alert.addButton(withTitle: confirmLabel)
        confirm.hasDestructiveAction = destructive
        alert.addButton(withTitle: cancelLabel).keyEquivalent = "\u{1b}"
        return alert
    }
}
