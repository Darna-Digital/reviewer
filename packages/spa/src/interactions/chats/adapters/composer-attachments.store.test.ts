// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  addComposerAttachment,
  clearComposerAttachments,
  composerAttachments,
  removeComposerAttachment,
  resetComposerAttachments,
  useComposerAttachments,
} from "./composer-attachments.store";

const shot = (id: string) => ({
  id,
  name: `${id}.png`,
  mimeType: "image/png",
  data: "AAAA",
  thumbnail: "data:image/jpeg;base64,AAAA",
});

/** The store as a composer sees it: through the hook it publishes. */
const watch = (key: string) =>
  renderHook(() => useComposerAttachments(key).map((a) => a.id));

afterEach(() => {
  cleanup();
  resetComposerAttachments();
});

describe("pending composer attachments", () => {
  it("starts with nothing attached", () => {
    const { result } = watch("new");

    expect(result.current).toEqual([]);
  });

  it("keeps images in the order they were attached", () => {
    const { result } = watch("new");

    act(() => addComposerAttachment("new", shot("a")));
    act(() => addComposerAttachment("new", shot("b")));

    expect(result.current).toEqual(["a", "b"]);
  });

  it("holds each composer's images apart", () => {
    const draft = watch("new");
    const thread = watch("chat-1");

    act(() => addComposerAttachment("new", shot("a")));
    act(() => addComposerAttachment("chat-1", shot("b")));

    expect(draft.result.current).toEqual(["a"]);
    expect(thread.result.current).toEqual(["b"]);
  });

  it("keeps a screenshot attached across the composer unmounting", () => {
    const first = watch("new");
    act(() => addComposerAttachment("new", shot("a")));
    expect(first.result.current).toEqual(["a"]);

    // Navigating away and back: the composer is a different mount entirely.
    first.unmount();
    const second = watch("new");

    expect(second.result.current).toEqual(["a"]);
  });

  it("removes only the image that was dismissed", () => {
    const { result } = watch("new");

    act(() => addComposerAttachment("new", shot("a")));
    act(() => addComposerAttachment("new", shot("b")));
    act(() => removeComposerAttachment("new", "a"));

    expect(result.current).toEqual(["b"]);
  });

  it("ignores a removal of something that is not attached", () => {
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useComposerAttachments("new");
    });
    act(() => addComposerAttachment("new", shot("a")));
    const before = renders;

    act(() => removeComposerAttachment("new", "gone"));

    expect(renders).toBe(before);
    expect(composerAttachments("new")).toHaveLength(1);
  });

  it("clears what a sent message took with it, leaving other composers alone", () => {
    const draft = watch("new");
    const thread = watch("chat-1");

    act(() => addComposerAttachment("new", shot("a")));
    act(() => addComposerAttachment("chat-1", shot("b")));
    act(() => clearComposerAttachments("new"));

    expect(draft.result.current).toEqual([]);
    expect(thread.result.current).toEqual(["b"]);
  });

  it("hands an untouched composer a stable snapshot", () => {
    expect(composerAttachments("new")).toBe(composerAttachments("chat-1"));
  });

  it("forgets a cleared composer rather than keeping an empty entry", () => {
    act(() => addComposerAttachment("new", shot("a")));
    act(() => clearComposerAttachments("new"));

    expect(composerAttachments("new")).toBe(composerAttachments("untouched"));
  });
});
