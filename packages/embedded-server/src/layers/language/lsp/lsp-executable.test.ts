import { describe, expect, it } from "vitest"
import { findExecutable } from "./lsp-executable.ts"

const posix = (present: ReadonlyArray<string>) => ({
  platform: "linux",
  cwd: "/work",
  env: { PATH: "/usr/local/bin:/usr/bin" },
  exists: (path: string) => present.includes(path),
})

describe("findExecutable", () => {
  it("searches PATH in order", () => {
    expect(
      findExecutable("gopls", posix(["/usr/bin/gopls", "/usr/local/bin/gopls"]))
    ).toBe("/usr/local/bin/gopls")
  })

  it("returns null when nothing on PATH matches", () => {
    expect(findExecutable("gopls", posix([]))).toBeNull()
  })

  it("skips empty PATH entries", () => {
    expect(
      findExecutable("gopls", {
        ...posix(["/usr/bin/gopls"]),
        env: { PATH: "::/usr/bin" },
      })
    ).toBe("/usr/bin/gopls")
  })

  it("treats a command with a separator as a path", () => {
    expect(
      findExecutable("/opt/ra/rust-analyzer", posix(["/opt/ra/rust-analyzer"]))
    ).toBe("/opt/ra/rust-analyzer")
  })

  it("resolves a relative path against the working directory", () => {
    expect(findExecutable("./bin/server", posix(["/work/bin/server"]))).toBe(
      "/work/bin/server"
    )
  })

  it("does not search PATH for a command given as a path", () => {
    expect(
      findExecutable("./bin/server", posix(["/usr/bin/server"]))
    ).toBeNull()
  })

  it("rejects a blank command", () => {
    expect(findExecutable("   ", posix(["/usr/bin/gopls"]))).toBeNull()
  })

  it("tries PATHEXT suffixes on Windows", () => {
    expect(
      findExecutable("gopls", {
        platform: "win32",
        cwd: "C:\\work",
        env: { PATH: "C:\\tools", PATHEXT: ".COM;.EXE;.CMD" },
        exists: (path: string) => path === "C:\\tools\\gopls.EXE",
      })
    ).toBe("C:\\tools\\gopls.EXE")
  })

  it("splits a Windows PATH on ';', not on the drive-letter colon", () => {
    expect(
      findExecutable("gopls", {
        platform: "win32",
        cwd: "C:\\work",
        env: { PATH: "C:\\tools;D:\\bin", PATHEXT: ".EXE" },
        exists: (path: string) => path === "D:\\bin\\gopls.EXE",
      })
    ).toBe("D:\\bin\\gopls.EXE")
  })

  it("reads Path when PATH is unset, as Windows spells it", () => {
    expect(
      findExecutable("gopls", {
        platform: "linux",
        cwd: "/work",
        env: { Path: "/usr/bin" },
        exists: (path: string) => path === "/usr/bin/gopls",
      })
    ).toBe("/usr/bin/gopls")
  })
})
