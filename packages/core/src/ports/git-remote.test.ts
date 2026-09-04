import { describe, expect, it } from "vitest";
import {
  gitHostLabel,
  gitHostOf,
  gitHostRequestLabel,
  gitHostRequestRef,
  parseGitRemote,
} from "./git-remote.ts";

describe("parseGitRemote", () => {
  it("reads an scp-style GitHub remote", () => {
    expect(parseGitRemote("git@github.com:Darna-Digital/byconvo.git")).toEqual({
      host: "github",
      hostname: "github.com",
      owner: "Darna-Digital",
      repo: "byconvo",
      path: "Darna-Digital/byconvo",
      webUrl: "https://github.com",
    });
  });

  it("reads an https GitHub remote without the .git suffix", () => {
    expect(
      parseGitRemote("https://github.com/octocat/hello-world")
    ).toMatchObject({ host: "github", owner: "octocat", repo: "hello-world" });
  });

  it("keeps GitLab subgroups in the namespace", () => {
    expect(
      parseGitRemote("git@gitlab.com:acme/team/platform/api.git")
    ).toMatchObject({
      host: "gitlab",
      owner: "acme/team/platform",
      repo: "api",
      path: "acme/team/platform/api",
    });
  });

  it("reads an ssh:// remote with a port", () => {
    expect(
      parseGitRemote("ssh://git@gitlab.example.com:2222/group/proj.git")
    ).toMatchObject({
      host: "gitlab",
      hostname: "gitlab.example.com",
      path: "group/proj",
      webUrl: "https://gitlab.example.com",
    });
  });

  it("drops credentials and GitLab's /-/ browser suffix", () => {
    expect(
      parseGitRemote("https://oauth2:token@gitlab.com/group/proj/-/tree/main")
    ).toMatchObject({ host: "gitlab", owner: "group", repo: "proj" });
  });

  it("takes a self-hosted host from the hints it is given", () => {
    expect(
      parseGitRemote("git@git.acme.internal:team/app.git", {
        gitlabHosts: ["git.acme.internal"],
      })
    ).toMatchObject({ host: "gitlab", hostname: "git.acme.internal" });
    expect(
      parseGitRemote("git@code.acme.dev:team/app.git", {
        githubHosts: ["code.acme.dev"],
      })
    ).toMatchObject({ host: "github" });
  });

  it("answers null for a host it does not review against", () => {
    expect(parseGitRemote("git@bitbucket.org:team/app.git")).toBeNull();
  });

  it("answers null for a local path or an empty remote", () => {
    expect(parseGitRemote("/srv/repos/app.git")).toBeNull();
    expect(parseGitRemote("../sibling")).toBeNull();
    expect(parseGitRemote("")).toBeNull();
  });

  it("answers null when the URL names a host but no project", () => {
    expect(parseGitRemote("https://github.com/octocat")).toBeNull();
  });
});

describe("gitHostOf", () => {
  it("names the two public forges", () => {
    expect(gitHostOf("github.com")).toBe("github");
    expect(gitHostOf("GitLab.com")).toBe("gitlab");
  });

  it("guesses a self-hosted install from its own name", () => {
    expect(gitHostOf("gitlab.acme.com")).toBe("gitlab");
    expect(gitHostOf("git.gitlab.acme.com")).toBe("gitlab");
    expect(gitHostOf("github.acme.com")).toBe("github");
  });

  it("lets the caller's own list win over the guess", () => {
    expect(
      gitHostOf("gitlab.acme.com", { githubHosts: ["gitlab.acme.com"] })
    ).toBe("github");
  });

  it("does not guess from a hostname that merely contains the name", () => {
    expect(gitHostOf("mygitlab.com")).toBeNull();
  });
});

describe("labels", () => {
  it("names each forge and what it calls a change", () => {
    expect(gitHostLabel("gitlab")).toBe("GitLab");
    expect(gitHostRequestLabel("gitlab")).toBe("merge request");
    expect(gitHostRequestLabel("github")).toBe("pull request");
  });

  it("writes a request's number the way its forge does", () => {
    expect(gitHostRequestRef("github", 12)).toBe("#12");
    expect(gitHostRequestRef("gitlab", 12)).toBe("!12");
  });
});
