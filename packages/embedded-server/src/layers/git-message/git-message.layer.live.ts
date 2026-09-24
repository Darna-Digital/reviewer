import * as Layer from "effect/Layer";
import {
  GitMessageChanges,
  GitMessageService,
  makeGitMessageService,
} from "@reviewer/core/git-message";
import { makeWorkspaceChanges } from "./git-message.changes.ts";

// The changes are collected from the open repository, while everything it
// builds on (GitExec, TerminalExec) is a global singleton from InfraLive.
export const GitMessageLive = Layer.effect(GitMessageService)(
  makeGitMessageService
).pipe(Layer.provide(Layer.effect(GitMessageChanges)(makeWorkspaceChanges)));
