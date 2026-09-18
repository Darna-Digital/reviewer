// What your own changes are read against, said out loud and changed from
// there — the web header's compare picker, which stands over the diff in
// the browser; here it stands beside the branch picker at the head of the
// sidebar, since that is where the shell keeps the commit view's controls.
// The branch picker names the branch the tree is a tree of; this names
// what its changes are measured from: the branch as it is committed,
// or the merge base with another branch, so "how does this branch differ
// from main" can be asked before there is a pull request to ask it for you.
// The menu is the web one's — uncommitted only, then the local branches,
// then the remotes, the branch the work is aimed at marked — plus a search,
// as the branch picker has.
import SwiftUI

struct ComparePicker: View {
    let comparison: ShellComparison
    @Environment(AppModel.self) private var model
    @State private var searching = false

    private var candidates: ComparisonCandidates {
        ComparisonCandidates(
            local: model.branches.filter { !$0.isCurrent }.map(BranchRef.init),
            remote: model.remoteBranches.map(BranchRef.init),
            aim: comparison.aim)
    }

    private var labels: ComparisonLabels {
        ComparisonLabels(against: comparison.against, branch: model.currentBranch)
    }

    private var symbol: String {
        guard let against = comparison.against else { return "arrow.left.arrow.right" }
        return against.contains("/") ? "cloud" : "arrow.triangle.branch"
    }

    var body: some View {
        Menu {
            Button("Search Branches…") { searching = true }
            Divider()
            CandidateItem(label: "Uncommitted changes", on: comparison.against == nil) {
                model.readChanges(against: nil)
            }
            if !candidates.local.isEmpty {
                Section("Compare against a branch") {
                    ForEach(candidates.local, id: \.ref) { candidate in
                        CandidateItem(label: candidates.label(for: candidate), on: comparison.against == candidate.ref) {
                            model.readChanges(against: candidate.ref)
                        }
                    }
                }
            }
            if !candidates.remote.isEmpty {
                Section("Compare against a remote") {
                    ForEach(candidates.remote, id: \.ref) { candidate in
                        CandidateItem(label: candidates.label(for: candidate), on: comparison.against == candidate.ref) {
                            model.readChanges(against: candidate.ref)
                        }
                    }
                }
            }
        } label: {
            HStack(spacing: 5) {
                Image(systemName: symbol)
                    .foregroundStyle(.secondary)
                Text(labels.base)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .layoutPriority(1)
                Image(systemName: "arrow.left.arrow.right")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(.secondary)
                Text(labels.headShort)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
        }
        .menuStyle(.button)
        .buttonStyle(.accessoryBar)
        .controlSize(.regular)
        .help(labels.summary)
        .popover(isPresented: $searching, arrowEdge: .bottom) {
            CompareSearch(candidates: candidates, comparison: comparison, dismiss: { searching = false })
        }
    }
}

/// A row of the menu, checked when it is the comparison that is on.
private struct CandidateItem: View {
    let label: String
    let on: Bool
    let select: () -> Void

    var body: some View {
        Toggle(isOn: Binding(get: { on }, set: { if $0 { select() } })) {
            Text(label)
        }
    }
}

/// The branches worth offering, split by where they live, the way core's
/// `comparisonCandidates` splits them: the checked-out branch is left out of
/// the local list — diffed with itself it says nothing "uncommitted only"
/// does not — while its remote counterpart stays in, since `origin/feature`
/// against `feature` is the question "what have I not pushed yet".
struct ComparisonCandidates {
    let local: [BranchRef]
    let remote: [BranchRef]
    let aim: String?

    func label(for candidate: BranchRef) -> String {
        candidate.ref == aim ? "\(candidate.display)   lands here" : candidate.display
    }

    func matching(_ query: String) -> [BranchRef] {
        let needle = query.trimmingCharacters(in: .whitespaces)
        let all = local + remote
        guard !needle.isEmpty else { return all }
        return all.filter { $0.display.localizedCaseInsensitiveContains(needle) }
    }
}

/// How a comparison reads — core's `comparisonLabels`: the two sides, the
/// head without repeating a name the base has just said, and the sentence
/// they make for a tooltip.
struct ComparisonLabels {
    let base: String
    let head: String
    let headShort: String
    let summary: String

    init(against: String?, branch: String?) {
        let here = branch.flatMap { $0.isEmpty ? nil : $0 } ?? "this checkout"
        base = against ?? here
        head = "\(here) with changes"
        headShort = against == nil ? "with changes" : head
        summary = "Comparing ‘\(base)’ against ‘\(head)’"
    }
}

/// The search: a field over every branch that can be compared against,
/// local and remote; a row picked reads the changes against it, and Return
/// picks the first match.
private struct CompareSearch: View {
    let candidates: ComparisonCandidates
    let comparison: ShellComparison
    let dismiss: () -> Void
    @Environment(AppModel.self) private var model
    @State private var query = ""
    @FocusState private var fieldFocused: Bool

    private var matches: [BranchRef] { candidates.matching(query) }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("Search branches", text: $query)
                    .textFieldStyle(.plain)
                    .focused($fieldFocused)
                    .onSubmit {
                        guard let first = matches.first else { return }
                        pick(first)
                    }
            }
            .padding(10)
            Divider()
            if matches.isEmpty {
                Text("No branch matches.")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 80)
            } else {
                List {
                    ForEach(matches, id: \.ref) { branch in
                        HStack(spacing: 8) {
                            Image(systemName: branch.isRemote ? "cloud" : "arrow.triangle.branch")
                                .foregroundStyle(.secondary)
                                .frame(width: 14)
                            Text(branch.display)
                                .lineLimit(1)
                                .truncationMode(.middle)
                            Spacer(minLength: 4)
                            if branch.ref == candidates.aim {
                                Text("lands here")
                                    .foregroundStyle(.secondary)
                            }
                            if branch.ref == comparison.against {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .font(.system(size: 12))
                        .contentShape(Rectangle())
                        .onTapGesture { pick(branch) }
                    }
                }
                .listStyle(.plain)
            }
        }
        .frame(width: 320, height: 320)
        .onAppear { fieldFocused = true }
    }

    private func pick(_ branch: BranchRef) {
        dismiss()
        model.readChanges(against: branch.ref)
    }
}
