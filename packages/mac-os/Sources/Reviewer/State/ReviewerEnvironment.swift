// Where a workspace's code runs: this Mac today, a cloud environment next.
// An environment is a Reviewer server — the one the app starts beside
// itself, or the same API somewhere else — and owns its workspaces, so the
// window's toolbar chip names the environment before the workspace (see
// `WorkspaceChip`), the way Xcode's toolbar names a run destination.
//
// Only this Mac exists yet; it is a value rather than a constant so the
// chip, its popover and their wording already go through the one that is
// open, and a cloud environment is one more case, not a redesign.
import Foundation
import IOKit.ps

struct ReviewerEnvironment: Identifiable, Hashable, Sendable {
    enum Kind: Hashable, Sendable {
        case thisMac
    }

    let kind: Kind
    /// What the environment is called — "This Mac".
    let name: String
    /// What it is besides, in a smaller hand — the machine's own name.
    let detail: String?
    let symbol: String

    var id: Kind { kind }

    /// The Mac the app runs on, wearing a laptop or a desktop as it is one.
    static let thisMac = ReviewerEnvironment(
        kind: .thisMac,
        name: "This Mac",
        detail: Host.current().localizedName,
        symbol: hasInternalBattery ? "laptopcomputer" : "desktopcomputer")

    /// A Mac with a battery of its own is a laptop — read from the power
    /// sources, since an Apple silicon model identifier says nothing of it.
    private static var hasInternalBattery: Bool {
        guard let info = IOPSCopyPowerSourcesInfo()?.takeRetainedValue(),
              let sources = IOPSCopyPowerSourcesList(info)?.takeRetainedValue() as? [CFTypeRef]
        else { return false }
        return sources.contains { source in
            let description = IOPSGetPowerSourceDescription(info, source)?.takeUnretainedValue() as? [String: Any]
            return description?[kIOPSTypeKey] as? String == kIOPSInternalBatteryType
        }
    }
}
