// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  resetRunTarget,
  setCloudRepoId,
  setRunTarget,
  useRunTarget,
} from "./run-target.store";

afterEach(() => {
  cleanup();
  resetRunTarget();
});

describe("run target store", () => {
  it("starts on this machine with no cloud repository chosen", () => {
    const { result } = renderHook(() => useRunTarget());
    expect(result.current).toEqual({ target: "local", cloudRepoId: null });
  });

  it("publishes a change of target to every subscriber", () => {
    const a = renderHook(() => useRunTarget());
    const b = renderHook(() => useRunTarget());
    act(() => setRunTarget("cloud"));
    expect(a.result.current.target).toBe("cloud");
    expect(b.result.current.target).toBe("cloud");
  });

  it("keeps the chosen repository across a change of target", () => {
    const { result } = renderHook(() => useRunTarget());
    act(() => setCloudRepoId("repo-2"));
    act(() => setRunTarget("cloud"));
    act(() => setRunTarget("local"));
    expect(result.current.cloudRepoId).toBe("repo-2");
  });

  it("does not re-render for a change that changes nothing", () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useRunTarget();
    });
    const before = renders;
    act(() => setRunTarget("local"));
    expect(renders).toBe(before);
    expect(result.current.target).toBe("local");
  });
});
