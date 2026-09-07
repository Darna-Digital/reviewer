// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useListEditing } from "./use-list-editing";

/** A composer with nothing on its keys but the list edits themselves. */
function Composer() {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [text, setText] = useState("");
  const editList = useListEditing({ textareaRef, text, setText });
  return (
    <textarea
      ref={textareaRef}
      aria-label="Comment"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={editList}
    />
  );
}

function typed(value: string): HTMLTextAreaElement {
  const field = screen.getByLabelText<HTMLTextAreaElement>("Comment");
  fireEvent.change(field, { target: { value } });
  field.setSelectionRange(value.length, value.length);
  return field;
}

beforeEach(() => {
  render(<Composer />);
  // jsdom has no `execCommand`, so every edit here takes the path that writes
  // the text back through React and restores the caret afterwards.
  (document as Document & { execCommand: () => boolean }).execCommand = () =>
    false;
});

afterEach(cleanup);

describe("useListEditing", () => {
  it("opens the next item on Enter", () => {
    const field = typed("- one");

    fireEvent.keyDown(field, { key: "Enter" });

    expect(field.value).toBe("- one\n- ");
    expect(field.selectionStart).toBe(field.value.length);
  });

  it("numbers a sub-item under the item it was nested below", () => {
    const field = typed("1. one\n2. two");

    fireEvent.keyDown(field, { key: "Tab" });

    expect(field.value).toBe("1. one\n  1.1 two");
  });

  it("closes the list when the item was left empty", () => {
    const field = typed("- one\n- ");

    fireEvent.keyDown(field, { key: "Enter" });

    expect(field.value).toBe("- one\n");
  });

  it("leaves a newline outside a list to the browser", () => {
    const field = typed("plain prose");
    const enter = fireEvent.keyDown(field, { key: "Enter" });

    expect(enter).toBe(true);
    expect(field.value).toBe("plain prose");
  });
});
