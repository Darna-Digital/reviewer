export interface paths {
    "/api/workspace": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["workspace.info"];
        put?: never;
        post: operations["workspace.setCurrent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/fs/browse": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["workspace.browse"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/file": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["workspace.readFile"];
        put: operations["workspace.writeFile"];
        post?: never;
        delete: operations["workspace.deleteFile"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/file/rename": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["workspace.renameFile"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/repo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["repo.info"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/files": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["repo.files"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["repo.status"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/branches": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["repo.branches"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/remote-branches": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["repo.remoteBranches"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/log": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["repo.log"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/commit/{sha}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["repo.commitDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/diff": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["repo.diff"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/checkout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["repo.checkout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/commit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["repo.commit"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/discard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["repo.discard"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/discard-hunk": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["repo.discardHunk"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/push": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["repo.push"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/pull": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["repo.pull"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/fetch": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["repo.fetch"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/merge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["repo.merge"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/rebase": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["repo.rebase"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/merge-state": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["repo.mergeState"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/conflict": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["repo.conflict"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/conflicts/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["repo.resolveConflict"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/merge/abort": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["repo.abortMerge"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/merge/continue": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["repo.continueMerge"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/branch": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["repo.createBranch"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/branch/rename": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["repo.renameBranch"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/branch/delete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["repo.deleteBranch"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/comments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["comments.list"];
        put?: never;
        post: operations["comments.add"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/comments/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["comments.remove"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/github/pulls": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["github.pulls"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/github/pulls/{number}/diff": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["github.pullDiff"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/github/pulls/{number}/comments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["github.pullComments"];
        put?: never;
        post: operations["github.createPullComment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/github/pulls/{number}/comments/{commentId}/replies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["github.replyPullComment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/git-message/generate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["gitMessage.generate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/threads": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["threads.list"];
        put?: never;
        post: operations["threads.create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/threads/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["threads.get"];
        put?: never;
        post?: never;
        delete: operations["threads.remove"];
        options?: never;
        head?: never;
        patch: operations["threads.rename"];
        trace?: never;
    };
    "/api/threads/{id}/run": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["threads.run"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/chats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["chats.list"];
        put?: never;
        post: operations["chats.create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/chats/models": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["chats.models"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/chats/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["chats.get"];
        put?: never;
        post?: never;
        delete: operations["chats.remove"];
        options?: never;
        head?: never;
        patch: operations["chats.update"];
        trace?: never;
    };
    "/api/chats/{id}/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["chats.send"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/chats/{id}/stop": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["chats.stop"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/docs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["docs.list"];
        put?: never;
        post: operations["docs.create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/docs/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["docs.get"];
        put: operations["docs.update"];
        post?: never;
        delete: operations["docs.remove"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/tasks/board": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["tasks.board"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/tasks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["tasks.listTasks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/tasks/resolve/{ref}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["tasks.resolveTask"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/tasks/prefix": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["tasks.setPrefix"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/tasks/cards": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["tasks.create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/tasks/cards/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["tasks.remove"];
        options?: never;
        head?: never;
        patch: operations["tasks.update"];
        trace?: never;
    };
    "/api/tasks/columns": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["tasks.addColumn"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/tasks/columns/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["tasks.removeColumn"];
        options?: never;
        head?: never;
        patch: operations["tasks.updateColumn"];
        trace?: never;
    };
    "/api/tasks/cards/{id}/comments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["tasks.addComment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/tasks/cards/{id}/comments/{commentId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["tasks.removeComment"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/tasks/comments/{commentId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["tasks.resolveComment"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/local-dev/commands": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["localDev.list"];
        put?: never;
        post: operations["localDev.create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/local-dev/commands/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["localDev.get"];
        put?: never;
        post?: never;
        delete: operations["localDev.remove"];
        options?: never;
        head?: never;
        patch: operations["localDev.update"];
        trace?: never;
    };
    "/api/local-dev/commands/{id}/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["localDev.start"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/local-dev/commands/{id}/stop": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["localDev.stop"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/local-dev/start-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["localDev.startAll"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/local-dev/stop-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["localDev.stopAll"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        StorageError: {
            _tag: "StorageError";
            reason: string;
        };
        InvalidRepo: {
            _tag: "InvalidRepo";
            path: string;
            reason: string;
        };
        NoRepoSelected: {
            _tag: "NoRepoSelected";
        };
        GitError: {
            _tag: "GitError";
            args: string[];
            exitCode: number;
            stderr: string;
        };
        GitHubError: {
            _tag: "GitHubError";
            reason: string;
        };
        TerminalError: {
            _tag: "TerminalError";
            reason: string;
        };
        NotFound: {
            _tag: "NotFound";
            reason: string;
        };
        ChatBusy: {
            _tag: "ChatBusy";
            chatId: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    "workspace.info": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        current: string | null;
                        recents: string[];
                        home: string;
                        isGitRepo: boolean;
                        childRepos: {
                            name: string;
                            path: string;
                        }[];
                    };
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "workspace.setCurrent": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    path: string;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        current: string | null;
                        recents: string[];
                        home: string;
                        isGitRepo: boolean;
                        childRepos: {
                            name: string;
                            path: string;
                        }[];
                    };
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvalidRepo"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "workspace.browse": {
        parameters: {
            query?: {
                path?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        path: string;
                        parent: string | null;
                        isGitRepo: boolean;
                        entries: {
                            name: string;
                            path: string;
                            isGitRepo: boolean;
                        }[];
                    };
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "workspace.readFile": {
        parameters: {
            query: {
                path: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        name: string;
                        contents: string;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "workspace.writeFile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    path: string;
                    contents: string;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "workspace.deleteFile": {
        parameters: {
            query: {
                path: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "workspace.renameFile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    from: string;
                    to: string;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "repo.info": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        root: string;
                        name: string;
                        currentBranch: string;
                        remoteUrl: string | null;
                        github: {
                            owner: string;
                            repo: string;
                        } | null;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.files": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        paths: string[];
                        gitStatus: {
                            path: string;
                            status: "added" | "deleted" | "ignored" | "modified" | "renamed" | "untracked";
                        }[];
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        branch: string;
                        upstream: string | null;
                        ahead: number;
                        behind: number;
                        headSha: string;
                        changed: number;
                        staged: number;
                        unstaged: number;
                        untracked: number;
                        conflicted: number;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.branches": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        name: string;
                        sha: string;
                        isCurrent: boolean;
                        upstream: string | null;
                        ahead: number;
                        behind: number;
                        committedAt: string;
                        subject: string;
                    }[];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.remoteBranches": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        name: string;
                        remote: string;
                        shortName: string;
                        sha: string;
                        committedAt: string;
                        subject: string;
                    }[];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.log": {
        parameters: {
            query?: {
                ref?: string;
                limit?: string;
                author?: string;
                grep?: string;
                regex?: string;
                case?: string;
                after?: string;
                before?: string;
                path?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        sha: string;
                        shortSha: string;
                        author: string;
                        authoredAt: string;
                        subject: string;
                        refs: string[];
                        parents: string[];
                    }[];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.commitDetail": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sha: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        sha: string;
                        shortSha: string;
                        author: string;
                        authorEmail: string;
                        authoredAt: string;
                        subject: string;
                        body: string;
                        refs: string[];
                        parents: string[];
                        files: {
                            path: string;
                            status: "added" | "deleted" | "ignored" | "modified" | "renamed" | "untracked";
                            oldPath: string | null;
                        }[];
                        containingBranches: string[];
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.diff": {
        parameters: {
            query?: {
                commit?: string;
                base?: string;
                head?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": string;
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.checkout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    branch: string;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.commit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    message: string;
                    paths?: string[];
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        sha: string;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.discard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    paths: string[];
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.discardHunk": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    path: string;
                    hunkIndex: number;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.push": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        output: string;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.pull": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        output: string;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.fetch": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        output: string;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.merge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    branch: string;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        output: string;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.rebase": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    onto: string;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        output: string;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.mergeState": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        operation: "merge" | "rebase" | "cherry-pick" | "revert" | "none";
                        incoming: string | null;
                        onto: string | null;
                        conflicted: {
                            path: string;
                            kind: "both-modified" | "both-added" | "both-deleted" | "added-by-us" | "added-by-them" | "deleted-by-us" | "deleted-by-them";
                        }[];
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.conflict": {
        parameters: {
            query: {
                path: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        path: string;
                        base: string | null;
                        ours: string;
                        theirs: string;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.resolveConflict": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    path: string;
                    resolution: "ours" | "theirs" | "content";
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.abortMerge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        output: string;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.continueMerge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        output: string;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.createBranch": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name: string;
                    startPoint?: string;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.renameBranch": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    from: string;
                    to: string;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "repo.deleteBranch": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name: string;
                    force?: boolean;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"];
                };
            };
        };
    };
    "comments.list": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        filePath: string;
                        side: "deletions" | "additions";
                        lineNumber: number;
                        body: string;
                        author: string;
                        createdAt: string;
                        target: string;
                        source: "local" | "github";
                    }[];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "comments.add": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    filePath: string;
                    side: "deletions" | "additions";
                    lineNumber: number;
                    body: string;
                    author?: string;
                    target?: string;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        filePath: string;
                        side: "deletions" | "additions";
                        lineNumber: number;
                        body: string;
                        author: string;
                        createdAt: string;
                        target: string;
                        source: "local" | "github";
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "comments.remove": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "github.pulls": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        number: number;
                        title: string;
                        author: string;
                        baseRef: string;
                        headRef: string;
                        headSha: string;
                        url: string;
                        updatedAt: string;
                    }[];
                };
            };
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitHubError"];
                };
            };
        };
    };
    "github.pullDiff": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                number: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": string;
                };
            };
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitHubError"];
                };
            };
        };
    };
    "github.pullComments": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                number: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        filePath: string;
                        side: "deletions" | "additions";
                        lineNumber: number;
                        body: string;
                        author: string;
                        createdAt: string;
                        target: string;
                        source: "local" | "github";
                    }[];
                };
            };
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitHubError"];
                };
            };
        };
    };
    "github.createPullComment": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                number: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    filePath: string;
                    side: "deletions" | "additions";
                    lineNumber: number;
                    body: string;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        filePath: string;
                        side: "deletions" | "additions";
                        lineNumber: number;
                        body: string;
                        author: string;
                        createdAt: string;
                        target: string;
                        source: "local" | "github";
                    };
                };
            };
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitHubError"];
                };
            };
        };
    };
    "github.replyPullComment": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                number: string;
                commentId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    body: string;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        filePath: string;
                        side: "deletions" | "additions";
                        lineNumber: number;
                        body: string;
                        author: string;
                        createdAt: string;
                        target: string;
                        source: "local" | "github";
                    };
                };
            };
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitHubError"];
                };
            };
        };
    };
    "gitMessage.generate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    paths?: string[];
                    agent?: "claude" | "opencode" | "codex";
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message: string;
                    };
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GitError"] | components["schemas"]["TerminalError"];
                };
            };
        };
    };
    "threads.list": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        title: string;
                        agent: "terminal" | "claude" | "opencode" | "codex";
                        branch: string;
                        taskKey: string | null;
                        createdAt: string;
                        updatedAt: string;
                        entryCount: number;
                        lastCommand: string | null;
                    }[];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"] | components["schemas"]["TerminalError"];
                };
            };
        };
    };
    "threads.create": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    title?: string;
                    agent?: "terminal" | "claude" | "opencode" | "codex";
                    branch?: string;
                    taskKey?: string;
                    initialPrompt?: string;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        title: string;
                        agent: "terminal" | "claude" | "opencode" | "codex";
                        branch: string;
                        taskKey: string | null;
                        initialPrompt: string;
                        agentSessionId: string | null;
                        createdAt: string;
                        updatedAt: string;
                        entries: {
                            id: string;
                            command: string;
                            stdout: string;
                            stderr: string;
                            exitCode: number;
                            createdAt: string;
                        }[];
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"] | components["schemas"]["TerminalError"];
                };
            };
        };
    };
    "threads.get": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        title: string;
                        agent: "terminal" | "claude" | "opencode" | "codex";
                        branch: string;
                        taskKey: string | null;
                        initialPrompt: string;
                        agentSessionId: string | null;
                        createdAt: string;
                        updatedAt: string;
                        entries: {
                            id: string;
                            command: string;
                            stdout: string;
                            stderr: string;
                            exitCode: number;
                            createdAt: string;
                        }[];
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"] | components["schemas"]["TerminalError"];
                };
            };
        };
    };
    "threads.remove": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"] | components["schemas"]["TerminalError"];
                };
            };
        };
    };
    "threads.rename": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    title: string;
                    branch?: string;
                    taskKey?: string | null;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        title: string;
                        agent: "terminal" | "claude" | "opencode" | "codex";
                        branch: string;
                        taskKey: string | null;
                        initialPrompt: string;
                        agentSessionId: string | null;
                        createdAt: string;
                        updatedAt: string;
                        entries: {
                            id: string;
                            command: string;
                            stdout: string;
                            stderr: string;
                            exitCode: number;
                            createdAt: string;
                        }[];
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"] | components["schemas"]["TerminalError"];
                };
            };
        };
    };
    "threads.run": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    command: string;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        command: string;
                        stdout: string;
                        stderr: string;
                        exitCode: number;
                        createdAt: string;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"] | components["schemas"]["TerminalError"];
                };
            };
        };
    };
    "chats.list": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        title: string;
                        provider: "claude" | "codex" | "opencode";
                        model: string;
                        branch: string;
                        createdAt: string;
                        updatedAt: string;
                        messageCount: number;
                        lastMessage: string | null;
                        turnState: ("running" | "completed" | "interrupted" | "error") | null;
                    }[];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"] | components["schemas"]["ChatBusy"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"] | components["schemas"]["TerminalError"];
                };
            };
        };
    };
    "chats.create": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    title?: string;
                    provider?: "claude" | "codex" | "opencode";
                    model?: string;
                    effort?: "low" | "medium" | "high";
                    access?: "supervised" | "acceptEdits" | "fullAccess";
                    mode?: "build" | "plan";
                    branch?: string;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        title: string;
                        provider: "claude" | "codex" | "opencode";
                        model: string;
                        effort: "low" | "medium" | "high";
                        access: "supervised" | "acceptEdits" | "fullAccess";
                        mode: "build" | "plan";
                        branch: string;
                        sessionId: string | null;
                        createdAt: string;
                        updatedAt: string;
                        messages: {
                            id: string;
                            role: "user" | "assistant";
                            text: string;
                            turnId: string;
                            streaming: boolean;
                            createdAt: string;
                            attachments?: {
                                name: string;
                                thumbnail: string;
                            }[];
                            pending?: boolean;
                        }[];
                        activities: {
                            id: string;
                            turnId: string;
                            kind: string;
                            tone: "info" | "tool" | "error";
                            summary: string;
                            detail: string | null;
                            createdAt: string;
                        }[];
                        latestTurn: {
                            id: string;
                            state: "running" | "completed" | "interrupted" | "error";
                            startedAt: string;
                            endedAt: string | null;
                            errorMessage: string | null;
                            totalCostUsd: (number) | null;
                        } | null;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"] | components["schemas"]["ChatBusy"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"] | components["schemas"]["TerminalError"];
                };
            };
        };
    };
    "chats.models": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        providers: {
                            id: "claude" | "codex" | "opencode";
                            label: string;
                            models: {
                                id: string;
                                label: string;
                            }[];
                        }[];
                        defaults: {
                            provider: "claude" | "codex" | "opencode";
                            model: string;
                            effort: "low" | "medium" | "high";
                            access: "supervised" | "acceptEdits" | "fullAccess";
                            mode: "build" | "plan";
                        };
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"] | components["schemas"]["ChatBusy"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"] | components["schemas"]["TerminalError"];
                };
            };
        };
    };
    "chats.get": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        title: string;
                        provider: "claude" | "codex" | "opencode";
                        model: string;
                        effort: "low" | "medium" | "high";
                        access: "supervised" | "acceptEdits" | "fullAccess";
                        mode: "build" | "plan";
                        branch: string;
                        sessionId: string | null;
                        createdAt: string;
                        updatedAt: string;
                        messages: {
                            id: string;
                            role: "user" | "assistant";
                            text: string;
                            turnId: string;
                            streaming: boolean;
                            createdAt: string;
                            attachments?: {
                                name: string;
                                thumbnail: string;
                            }[];
                            pending?: boolean;
                        }[];
                        activities: {
                            id: string;
                            turnId: string;
                            kind: string;
                            tone: "info" | "tool" | "error";
                            summary: string;
                            detail: string | null;
                            createdAt: string;
                        }[];
                        latestTurn: {
                            id: string;
                            state: "running" | "completed" | "interrupted" | "error";
                            startedAt: string;
                            endedAt: string | null;
                            errorMessage: string | null;
                            totalCostUsd: (number) | null;
                        } | null;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"] | components["schemas"]["ChatBusy"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"] | components["schemas"]["TerminalError"];
                };
            };
        };
    };
    "chats.remove": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"] | components["schemas"]["ChatBusy"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"] | components["schemas"]["TerminalError"];
                };
            };
        };
    };
    "chats.update": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    title?: string;
                    provider?: "claude" | "codex" | "opencode";
                    model?: string;
                    effort?: "low" | "medium" | "high";
                    access?: "supervised" | "acceptEdits" | "fullAccess";
                    mode?: "build" | "plan";
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        title: string;
                        provider: "claude" | "codex" | "opencode";
                        model: string;
                        effort: "low" | "medium" | "high";
                        access: "supervised" | "acceptEdits" | "fullAccess";
                        mode: "build" | "plan";
                        branch: string;
                        sessionId: string | null;
                        createdAt: string;
                        updatedAt: string;
                        messages: {
                            id: string;
                            role: "user" | "assistant";
                            text: string;
                            turnId: string;
                            streaming: boolean;
                            createdAt: string;
                            attachments?: {
                                name: string;
                                thumbnail: string;
                            }[];
                            pending?: boolean;
                        }[];
                        activities: {
                            id: string;
                            turnId: string;
                            kind: string;
                            tone: "info" | "tool" | "error";
                            summary: string;
                            detail: string | null;
                            createdAt: string;
                        }[];
                        latestTurn: {
                            id: string;
                            state: "running" | "completed" | "interrupted" | "error";
                            startedAt: string;
                            endedAt: string | null;
                            errorMessage: string | null;
                            totalCostUsd: (number) | null;
                        } | null;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"] | components["schemas"]["ChatBusy"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"] | components["schemas"]["TerminalError"];
                };
            };
        };
    };
    "chats.send": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    text: string;
                    images?: {
                        name: string;
                        data: string;
                        thumbnail: string;
                    }[];
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        title: string;
                        provider: "claude" | "codex" | "opencode";
                        model: string;
                        effort: "low" | "medium" | "high";
                        access: "supervised" | "acceptEdits" | "fullAccess";
                        mode: "build" | "plan";
                        branch: string;
                        sessionId: string | null;
                        createdAt: string;
                        updatedAt: string;
                        messages: {
                            id: string;
                            role: "user" | "assistant";
                            text: string;
                            turnId: string;
                            streaming: boolean;
                            createdAt: string;
                            attachments?: {
                                name: string;
                                thumbnail: string;
                            }[];
                            pending?: boolean;
                        }[];
                        activities: {
                            id: string;
                            turnId: string;
                            kind: string;
                            tone: "info" | "tool" | "error";
                            summary: string;
                            detail: string | null;
                            createdAt: string;
                        }[];
                        latestTurn: {
                            id: string;
                            state: "running" | "completed" | "interrupted" | "error";
                            startedAt: string;
                            endedAt: string | null;
                            errorMessage: string | null;
                            totalCostUsd: (number) | null;
                        } | null;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"] | components["schemas"]["ChatBusy"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"] | components["schemas"]["TerminalError"];
                };
            };
        };
    };
    "chats.stop": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"] | components["schemas"]["ChatBusy"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"] | components["schemas"]["TerminalError"];
                };
            };
        };
    };
    "docs.list": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        title: string;
                        updatedAt: string;
                    }[];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "docs.create": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    title: string;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        title: string;
                        content: string;
                        updatedAt: string;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "docs.get": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        title: string;
                        content: string;
                        updatedAt: string;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "docs.update": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    content: string;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        title: string;
                        content: string;
                        updatedAt: string;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "docs.remove": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "tasks.board": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        cards: {
                            id: string;
                            key: string;
                            title: string;
                            description: string;
                            column: string;
                            order: number;
                            comments: {
                                id: string;
                                body: string;
                                parentId: string | null;
                                createdAt: string;
                            }[];
                            createdAt: string;
                            updatedAt: string;
                        }[];
                        columns: {
                            id: string;
                            name: string;
                            order: number;
                        }[];
                        prefix: string;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "tasks.listTasks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        key: string;
                        title: string;
                        description: string;
                        column: string;
                        order: number;
                        comments: {
                            id: string;
                            body: string;
                            parentId: string | null;
                            createdAt: string;
                        }[];
                        createdAt: string;
                        updatedAt: string;
                    }[];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "tasks.resolveTask": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                ref: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        key: string;
                        title: string;
                        description: string;
                        column: string;
                        order: number;
                        comments: {
                            id: string;
                            body: string;
                            parentId: string | null;
                            createdAt: string;
                        }[];
                        createdAt: string;
                        updatedAt: string;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "tasks.setPrefix": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    prefix: string;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        cards: {
                            id: string;
                            key: string;
                            title: string;
                            description: string;
                            column: string;
                            order: number;
                            comments: {
                                id: string;
                                body: string;
                                parentId: string | null;
                                createdAt: string;
                            }[];
                            createdAt: string;
                            updatedAt: string;
                        }[];
                        columns: {
                            id: string;
                            name: string;
                            order: number;
                        }[];
                        prefix: string;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "tasks.create": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    title: string;
                    description?: string;
                    column?: string;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        key: string;
                        title: string;
                        description: string;
                        column: string;
                        order: number;
                        comments: {
                            id: string;
                            body: string;
                            parentId: string | null;
                            createdAt: string;
                        }[];
                        createdAt: string;
                        updatedAt: string;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "tasks.remove": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "tasks.update": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    title?: string;
                    description?: string;
                    column?: string;
                    order?: number;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        key: string;
                        title: string;
                        description: string;
                        column: string;
                        order: number;
                        comments: {
                            id: string;
                            body: string;
                            parentId: string | null;
                            createdAt: string;
                        }[];
                        createdAt: string;
                        updatedAt: string;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "tasks.addColumn": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name: string;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        cards: {
                            id: string;
                            key: string;
                            title: string;
                            description: string;
                            column: string;
                            order: number;
                            comments: {
                                id: string;
                                body: string;
                                parentId: string | null;
                                createdAt: string;
                            }[];
                            createdAt: string;
                            updatedAt: string;
                        }[];
                        columns: {
                            id: string;
                            name: string;
                            order: number;
                        }[];
                        prefix: string;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "tasks.removeColumn": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        cards: {
                            id: string;
                            key: string;
                            title: string;
                            description: string;
                            column: string;
                            order: number;
                            comments: {
                                id: string;
                                body: string;
                                parentId: string | null;
                                createdAt: string;
                            }[];
                            createdAt: string;
                            updatedAt: string;
                        }[];
                        columns: {
                            id: string;
                            name: string;
                            order: number;
                        }[];
                        prefix: string;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "tasks.updateColumn": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name?: string;
                    order?: number;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        cards: {
                            id: string;
                            key: string;
                            title: string;
                            description: string;
                            column: string;
                            order: number;
                            comments: {
                                id: string;
                                body: string;
                                parentId: string | null;
                                createdAt: string;
                            }[];
                            createdAt: string;
                            updatedAt: string;
                        }[];
                        columns: {
                            id: string;
                            name: string;
                            order: number;
                        }[];
                        prefix: string;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "tasks.addComment": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    body: string;
                    parentId?: string;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        key: string;
                        title: string;
                        description: string;
                        column: string;
                        order: number;
                        comments: {
                            id: string;
                            body: string;
                            parentId: string | null;
                            createdAt: string;
                        }[];
                        createdAt: string;
                        updatedAt: string;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "tasks.removeComment": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                commentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        key: string;
                        title: string;
                        description: string;
                        column: string;
                        order: number;
                        comments: {
                            id: string;
                            body: string;
                            parentId: string | null;
                            createdAt: string;
                        }[];
                        createdAt: string;
                        updatedAt: string;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "tasks.resolveComment": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                commentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        card: {
                            id: string;
                            key: string;
                            title: string;
                            description: string;
                            column: string;
                            order: number;
                            comments: {
                                id: string;
                                body: string;
                                parentId: string | null;
                                createdAt: string;
                            }[];
                            createdAt: string;
                            updatedAt: string;
                        };
                        comment: {
                            id: string;
                            body: string;
                            parentId: string | null;
                            createdAt: string;
                        };
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "localDev.list": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        name: string;
                        command: string;
                        createdAt: string;
                        updatedAt: string;
                        status: "stopped" | "running" | "exited";
                        exitCode: (number) | null;
                    }[];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "localDev.create": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name: string;
                    command: string;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        name: string;
                        command: string;
                        createdAt: string;
                        updatedAt: string;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "localDev.get": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        name: string;
                        command: string;
                        createdAt: string;
                        updatedAt: string;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "localDev.remove": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "localDev.update": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name?: string;
                    command?: string;
                };
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        name: string;
                        command: string;
                        createdAt: string;
                        updatedAt: string;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "localDev.start": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        name: string;
                        command: string;
                        createdAt: string;
                        updatedAt: string;
                        status: "stopped" | "running" | "exited";
                        exitCode: (number) | null;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "localDev.stop": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "localDev.startAll": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        name: string;
                        command: string;
                        createdAt: string;
                        updatedAt: string;
                        status: "stopped" | "running" | "exited";
                        exitCode: (number) | null;
                    }[];
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
    "localDev.stopAll": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotFound"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NoRepoSelected"];
                };
            };
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StorageError"];
                };
            };
        };
    };
}
