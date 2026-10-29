// The commit message being written, kept per scope — a repository, or a
// workspace of several — so a switch away and back finds it, and so a
// message drafted while the composer is off screen (⌃G from anywhere, see
// `AppModel.generateCommitMessage`) is waiting in the box when Review
// opens. Also the agent the composer drafts with, as it was last picked.
import Foundation

enum CommitMessages {
    /// The defaults key the composer's agent picker keeps its pick under.
    static let agentKey = "commit-agent"

    static var agent: CommitAgent {
        UserDefaults.standard.string(forKey: agentKey).flatMap(CommitAgent.init(rawValue:)) ?? .claude
    }

    static func remembered(for scope: String) -> String {
        UserDefaults.standard.string(forKey: key(for: scope)) ?? ""
    }

    static func remember(_ message: String, for scope: String) {
        if message.isEmpty {
            UserDefaults.standard.removeObject(forKey: key(for: scope))
        } else {
            UserDefaults.standard.set(message, forKey: key(for: scope))
        }
    }

    private static func key(for scope: String) -> String { "commit-message:\(scope)" }
}

/// A message drafted away from the composer, for a composer that came on
/// screen while the draft ran to take in; the serial tells two apart.
struct LandedCommitMessage: Equatable {
    let scope: String
    let message: String
    let serial: Int
}
