import * as Layer from "effect/Layer";
import {
  GitMessageChanges,
  GitMessageService,
  makeGitMessageService,
} from "@reviewer/core/git-message";
import { makeWorkspaceChanges } from "./git-message.changes.ts";

// The changes are collected the workspace's way — one root, or every root a
// multi-root project holds — while everything it builds on (GitExec,
// TerminalExec, the workspace context) is a global singleton from InfraLive.
export const GitMessageLive = Layer.effect(GitMessageService)(
  makeGitMessageService
).pipe(Layer.provide(Layer.effect(GitMessageChanges)(makeWorkspaceChanges)));
