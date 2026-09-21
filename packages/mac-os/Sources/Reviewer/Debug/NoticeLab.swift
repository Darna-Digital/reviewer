// TEMPORARY — a lab for the notices (see `Notices`, `NoticeStack`): a
// window of sample notices to click, each posting into the workspace
// window's stack what a real action would — git's own words at their real
// lengths, a push seen being tried and then settling, a commit walking
// its three steps — so the cards can be looked at without a remote to
// reject a push or a merge to conflict. Opened from the Debug menu (⌥⌘N).
// Delete this file, and its lines in `ReviewerApp`, once the cards are
// settled.
import SwiftUI

enum NoticeLabWindow {
    static let id = "notice-lab"
}

struct NoticeLabView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        List {
            ForEach(NoticeSample.groups, id: \.title) { group in
                Section(group.title) {
                    ForEach(group.samples, id: \.name) { sample in
                        Button {
                            let notices = model.notices
                            Task { await sample.run(notices) }
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: sample.symbol)
                                    .frame(width: 16)
                                    .foregroundStyle(.secondary)
                                Text(sample.name)
                                Spacer()
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .toolbar {
            Button("Clear all") { for notice in model.notices.items { model.notices.dismiss(notice.id) } }
        }
        .navigationTitle("Notice lab")
    }
}

struct NoticeSampleGroup {
    let title: String
    let samples: [NoticeSample]
}

struct NoticeSample {
    let name: String
    let symbol: String
    let run: @MainActor (Notices) async -> Void

    /// How long a simulated action takes to answer — long enough to see
    /// the orb and the settle.
    static let latency: Duration = .milliseconds(1400)

    private static func pause() async {
        try? await Task.sleep(for: latency)
    }

    /// What the server relays of a git failure: its stderr.
    private struct GitRefusal: CommandOutputError, LocalizedError {
        let commandOutput: String?
        var errorDescription: String? { commandOutput }
    }

    private struct Refusal: LocalizedError {
        let errorDescription: String?
    }

    /// A git action through the real `Notices.run`, answering `output` —
    /// what git printed, progress chatter and all — after the pause.
    private static func git(_ name: String, _ pending: String, done: String, failed: String, output: String? = nil) -> NoticeSample {
        NoticeSample(name: name, symbol: "arrow.triangle.2.circlepath") { notices in
            await notices.run(pending, done: done, failed: failed, report: .command) {
                await pause()
                return output
            }
        }
    }

    private static func gitRefused(_ name: String, _ pending: String, done: String, failed: String, stderr: String) -> NoticeSample {
        NoticeSample(name: name, symbol: "arrow.triangle.2.circlepath") { notices in
            await notices.run(pending, done: done, failed: failed, report: .command) {
                await pause()
                throw GitRefusal(commandOutput: stderr)
            }
        }
    }

    /// A server action answering prose — GitHub's own sentence.
    private static func prose(_ name: String, _ pending: String, done: String, failed: String, answer: String? = nil) -> NoticeSample {
        NoticeSample(name: name, symbol: "arrow.triangle.2.circlepath") { notices in
            await notices.run(pending, done: done, failed: failed) {
                await pause()
                return answer
            }
        }
    }

    private static func refused(_ name: String, _ pending: String, done: String, failed: String, reason: String) -> NoticeSample {
        NoticeSample(name: name, symbol: "arrow.triangle.2.circlepath") { notices in
            await notices.run(pending, done: done, failed: failed) {
                await pause()
                throw Refusal(errorDescription: reason)
            }
        }
    }

    private static func instant(_ name: String, _ kind: NoticeKind, _ title: String, detail: String? = nil) -> NoticeSample {
        NoticeSample(name: name, symbol: "bolt") { notices in
            notices.post(kind, title, detail: detail)
        }
    }

    private static let rejectedPush = """
    To github.com:darna-digital/reviewer.git
     ! [rejected]        task/mac-os-experiment -> task/mac-os-experiment (fetch first)
    error: failed to push some refs to 'github.com:darna-digital/reviewer.git'
    hint: Updates were rejected because the remote contains work that you do not
    hint: have locally. This is usually caused by another repository pushing to
    hint: the same ref. If you want to integrate the remote changes, use
    hint: 'git pull' before pushing again.
    hint: See the 'Note about fast-forwards' in 'git push --help' for details.
    """

    static let groups: [NoticeSampleGroup] = [
        NoticeSampleGroup(title: "Push", samples: [
            git("Pushed", "Pushing…", done: "Pushed", failed: "Push failed", output: """
            Enumerating objects: 13, done.
            Counting objects: 100% (13/13), done.
            Delta compression using up to 10 threads
            Compressing objects: 100% (7/7), done.
            Writing objects: 100% (7/7), 1.02 KiB | 1.02 MiB/s, done.
            Total 7 (delta 5), reused 0 (delta 0), pack-reused 0 (from 0)
            remote: Resolving deltas: 100% (5/5), completed with 5 local objects.
            To github.com:darna-digital/reviewer.git
               37f05176..a1b2c3d4  task/mac-os-experiment -> task/mac-os-experiment
            """),
            git("Pushed, nothing new", "Pushing…", done: "Pushed", failed: "Push failed", output: "Everything up-to-date"),
            git("Pushed a new branch", "Pushing…", done: "Pushed", failed: "Push failed", output: """
            remote:
            remote: Create a pull request for 'feat/notice-lab' on GitHub by visiting:
            remote:      https://github.com/darna-digital/reviewer/pull/new/feat/notice-lab
            remote:
            To github.com:darna-digital/reviewer.git
             * [new branch]      HEAD -> feat/notice-lab
            branch 'feat/notice-lab' set up to track 'origin/feat/notice-lab'.
            """),
            gitRefused("Push rejected", "Pushing…", done: "Pushed", failed: "Push failed", stderr: rejectedPush),
            gitRefused("Push, no network", "Pushing…", done: "Pushed", failed: "Push failed", stderr: """
            ssh: Could not resolve hostname github.com: nodename nor servname provided, or not known
            fatal: Could not read from remote repository.

            Please make sure you have the correct access rights
            and the repository exists.
            """),
        ]),
        NoticeSampleGroup(title: "Pull and fetch", samples: [
            git("Pulled, fast-forward", "Pulling…", done: "Pulled", failed: "Pull failed", output: """
            From github.com:darna-digital/reviewer
               37f05176..a1b2c3d4  task/mac-os-experiment -> origin/task/mac-os-experiment
            Updating 37f05176..a1b2c3d4
            Fast-forward
             packages/mac-os/Sources/Reviewer/State/Notices.swift | 12 ++++++------
             packages/mac-os/Sources/Reviewer/Views/Layout/NoticeStack.swift |  3 +++
             packages/spa/src/app.tsx                             |  1 -
             3 files changed, 9 insertions(+), 7 deletions(-)
            """),
            git("Pulled, up to date", "Pulling…", done: "Pulled", failed: "Pull failed", output: "Already up to date."),
            gitRefused("Pull blocked by local changes", "Pulling…", done: "Pulled", failed: "Pull failed", stderr: """
            error: Your local changes to the following files would be overwritten by merge:
            \tpackages/mac-os/Sources/Reviewer/State/Notices.swift
            \tpackages/spa/src/app.tsx
            Please commit your changes or stash them before you merge.
            Aborting
            """),
            git("Fetched, quiet", "Fetching…", done: "Fetched", failed: "Fetch failed"),
            git("Fetched with changes", "Fetching…", done: "Fetched", failed: "Fetch failed", output: """
            From github.com:darna-digital/reviewer
             - [deleted]         (none)     -> origin/task/old-sidebar
               a1b2c3d4..e5f6a7b8  main       -> origin/main
             * [new branch]      feat/pull-request-column -> origin/feat/pull-request-column
            """),
        ]),
        NoticeSampleGroup(title: "Merge and rebase", samples: [
            git("Merged, fast-forward", "Merging main…", done: "Merged main", failed: "Merge of main stopped", output: """
            Updating 37f05176..e5f6a7b8
            Fast-forward
             packages/spa/src/app.tsx | 4 ++--
             1 file changed, 2 insertions(+), 2 deletions(-)
            """),
            git("Merged with a commit", "Merging main…", done: "Merged main", failed: "Merge of main stopped", output: """
            Merge made by the 'ort' strategy.
             packages/embedded-server/src/layers/git/git-exec.ts | 18 +++++++++++++-----
             packages/spa/src/app.tsx                            |  4 ++--
             2 files changed, 15 insertions(+), 7 deletions(-)
            """),
            git("Merge conflict", "Merging main…", done: "Merged main", failed: "Merge of main stopped", output: """
            Auto-merging packages/mac-os/Sources/Reviewer/State/Notices.swift
            CONFLICT (content): Merge conflict in packages/mac-os/Sources/Reviewer/State/Notices.swift
            Auto-merging packages/spa/src/app.tsx
            Automatic merge failed; fix conflicts and then commit the result.
            """),
            git("Rebased", "Rebasing onto main…", done: "Rebased onto main", failed: "Rebase onto main stopped", output: "Successfully rebased and updated refs/heads/task/mac-os-experiment."),
            git("Rebase conflict", "Rebasing onto main…", done: "Rebased onto main", failed: "Rebase onto main stopped", output: """
            Auto-merging packages/mac-os/Sources/Reviewer/State/Notices.swift
            CONFLICT (content): Merge conflict in packages/mac-os/Sources/Reviewer/State/Notices.swift
            error: could not apply 6361d696... Increase chrome token contrast and tint pinned tabs
            hint: Resolve all conflicts manually, mark them as resolved with
            hint: "git add/rm <conflicted_files>", then run "git rebase --continue".
            hint: You can instead skip this commit: run "git rebase --skip".
            hint: To abort and get back to the state before "git rebase", run "git rebase --abort".
            Could not apply 6361d696... Increase chrome token contrast and tint pinned tabs
            """),
        ]),
        NoticeSampleGroup(title: "Commit", samples: [
            NoticeSample(name: "Committed", symbol: "arrow.triangle.2.circlepath") { notices in
                let id = notices.post(.loading, "Committing…")
                await pause()
                notices.settle(id, .success, "Committed a1b2c3d4")
            },
            NoticeSample(name: "Committed and pushed", symbol: "arrow.triangle.2.circlepath") { notices in
                let id = notices.post(.loading, "Committing…")
                await pause()
                notices.settle(id, .loading, "Committed a1b2c3d4, pushing…")
                await pause()
                notices.settle(id, .success, "Committed a1b2c3d4 and pushed")
            },
            NoticeSample(name: "Committed, push failed", symbol: "arrow.triangle.2.circlepath") { notices in
                let id = notices.post(.loading, "Committing…")
                await pause()
                notices.settle(id, .loading, "Committed a1b2c3d4, pushing…")
                await pause()
                notices.settle(id, failed: "Committed a1b2c3d4, but push failed", with: GitRefusal(commandOutput: rejectedPush))
            },
            NoticeSample(name: "Nothing to commit", symbol: "arrow.triangle.2.circlepath") { notices in
                let id = notices.post(.loading, "Committing…")
                await pause()
                notices.settle(id, failed: "Commit failed", with: GitRefusal(commandOutput: "nothing to commit, working tree clean"))
            },
            NoticeSample(name: "Hook refused the commit", symbol: "arrow.triangle.2.circlepath") { notices in
                let id = notices.post(.loading, "Committing…")
                await pause()
                notices.settle(id, failed: "Commit failed", with: GitRefusal(commandOutput: """
                ✖ packages/spa/src/app.tsx
                  12:7  error  'unused' is assigned a value but never used  @typescript-eslint/no-unused-vars
                ✖ 1 problem (1 error, 0 warnings)
                husky - pre-commit script failed (code 1)
                """))
            },
        ]),
        NoticeSampleGroup(title: "Branches and pull requests", samples: [
            git("Checked out", "Checking out feat/pull-request-column…", done: "Checked out feat/pull-request-column", failed: "Checkout failed"),
            git("Checked out and updated", "Checking out main…", done: "Checked out and updated main", failed: "Checkout failed", output: """
            From github.com:darna-digital/reviewer
               a1b2c3d4..e5f6a7b8  main       -> origin/main
            Updating a1b2c3d4..e5f6a7b8
            Fast-forward
             packages/spa/src/app.tsx | 4 ++--
             1 file changed, 2 insertions(+), 2 deletions(-)
            """),
            gitRefused("Checkout blocked", "Checking out main…", done: "Checked out main", failed: "Checkout failed", stderr: """
            error: Your local changes to the following files would be overwritten by checkout:
            \tpackages/mac-os/Sources/Reviewer/State/Notices.swift
            Please commit your changes or stash them before you switch branches.
            Aborting
            """),
            git("Created branch", "Creating feat/notice-lab…", done: "Created branch feat/notice-lab", failed: "Could not create feat/notice-lab"),
            git("Renamed branch", "Renaming feat/notice-lab…", done: "Renamed feat/notice-lab → feat/notice-stack-lab", failed: "Could not rename feat/notice-lab"),
            git("Deleted branch", "Deleting feat/notice-lab…", done: "Deleted feat/notice-lab", failed: "Could not delete feat/notice-lab"),
            gitRefused("Delete refused, unmerged", "Deleting feat/notice-lab…", done: "Deleted feat/notice-lab", failed: "Could not delete feat/notice-lab", stderr: """
            error: the branch 'feat/notice-lab' is not fully merged
            hint: If you are sure you want to delete it, run 'git branch -D feat/notice-lab'
            hint: Disable this message with "git config set advice.forceDeleteBranch false"
            """),
            prose("Discarded", "Discarding changes in 3 files…", done: "Discarded changes in 3 files", failed: "Discard failed"),
            prose("Checked out #42", "Checking out #42…", done: "Checked out pr/42-native-notice-stack", failed: "Checkout of #42 failed"),
            prose("Merged #42", "Merging #42…", done: "Merged #42", failed: "Merge of #42 failed", answer: "Pull Request successfully merged"),
            refused("Merge #42 refused", "Merging #42…", done: "Merged #42", failed: "Merge of #42 failed", reason: "Pull Request is not mergeable: the base branch policy prohibits the merge"),
            prose("Closed #42", "Closing #42…", done: "Closed #42", failed: "Could not close #42"),
        ]),
        NoticeSampleGroup(title: "Other", samples: [
            instant("Info", .info, "Open a project before starting an agent session"),
            instant("Server refused", .error, "NoRepoSelected"),
            instant("Server down", .error, "request failed (502)"),
            instant("Bare error, one word", .error, "Forbidden"),
            instant("Very long single line", .error, "fatal: unable to access 'https://github.com/darna-digital/reviewer-project-with-a-rather-long-name-for-the-sake-of-the-lab.git/': Could not resolve host: github.com"),
            NoticeSample(name: "Endless loading (dismiss by hand)", symbol: "hourglass") { notices in
                notices.post(.loading, "Pushing…")
            },
            NoticeSample(name: "Flood past capacity", symbol: "water.waves") { notices in
                for n in 1...7 {
                    notices.post(n.isMultiple(of: 2) ? .error : .success, "Notice \(n) of 7 — the oldest should give way at \(Notices.capacity)")
                    try? await Task.sleep(for: .milliseconds(180))
                }
            },
            NoticeSample(name: "One of each kind", symbol: "square.stack.3d.up") { notices in
                notices.post(.loading, "Pushing…")
                notices.post(.success, "Pushed", output: "Everything up-to-date")
                notices.post(.error, "Commit failed", output: "nothing to commit, working tree clean")
                notices.post(.info, "Open a project before starting an agent session")
            },
        ]),
    ]
}
