// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { guardKeyboard } from "./preview-focus.functions";

const stops: Array<() => void> = [];

const composerAndFrame = () => {
  const composer = document.createElement("textarea");
  composer.value = "half a sentence";
  const frame = document.createElement("iframe");
  document.body.append(composer, frame);
  const guard = guardKeyboard(frame);
  stops.push(guard.stop);
  return { composer, frame, guard };
};

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.innerHTML = "";
});

describe("guardKeyboard", () => {
  it("gives the keyboard back to whoever was typing", () => {
    const { composer, frame } = composerAndFrame();
    composer.focus();
    composer.setSelectionRange(4, 4);

    frame.focus();

    expect(document.activeElement).toBe(composer);
    expect(composer.selectionStart).toBe(4);
  });

  it("hands it back again the next time the frame takes it", () => {
    const { composer, frame } = composerAndFrame();
    composer.focus();

    frame.focus();
    frame.focus();

    expect(document.activeElement).toBe(composer);
  });

  it("takes the keyboard off the frame when nobody was typing", () => {
    const { frame } = composerAndFrame();

    frame.focus();

    expect(document.activeElement).not.toBe(frame);
  });

  it("leaves an owner that has since gone away alone", () => {
    const { composer, frame } = composerAndFrame();
    composer.focus();
    composer.remove();

    frame.focus();

    expect(document.activeElement).not.toBe(frame);
  });

  it("stops giving the keyboard back once stopped", () => {
    const { composer, frame, guard } = composerAndFrame();
    composer.focus();
    guard.stop();

    frame.focus();

    expect(document.activeElement).toBe(frame);
  });
});
