// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { Alerts, askForText, confirm } from "@/components/ui/alerts";

afterEach(cleanup);

const dialog = () => screen.findByRole("alertdialog");

describe("alerts", () => {
  it("answers a confirm with true when it is gone through with", async () => {
    const user = userEvent.setup();
    render(<Alerts />);

    const answer = confirm({ title: "Delete this card?" });
    await dialog();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await answer).toBe(true);
  });

  it("answers a confirm with false when it is backed out of", async () => {
    const user = userEvent.setup();
    render(<Alerts />);

    const answer = confirm({ title: "Delete this card?" });
    await dialog();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await answer).toBe(false);
  });

  it("names both answers however the caller asked", async () => {
    const user = userEvent.setup();
    render(<Alerts />);

    const answer = confirm({
      title: "Discard the file?",
      description: "This cannot be undone.",
      confirmLabel: "Discard",
      cancelLabel: "Keep it",
      destructive: true,
    });
    await dialog();

    expect(screen.getByRole("button", { name: "Discard" })).toBeDefined();
    expect(screen.getByText("This cannot be undone.")).toBeDefined();
    // The store outlives the render, so every ask has to be answered or the
    // next test inherits it.
    await user.click(screen.getByRole("button", { name: "Keep it" }));
    expect(await answer).toBe(false);
  });

  it("hands back the text that was typed, and null when it is dismissed", async () => {
    const user = userEvent.setup();
    render(<Alerts />);

    const typed = askForText({ title: "Create a branch", label: "Name" });
    await dialog();
    await user.type(screen.getByLabelText("Name"), "feature/x");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await typed).toBe("feature/x");

    const dismissed = askForText({ title: "Create a branch" });
    await dialog();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await dismissed).toBeNull();
  });

  it("opens the field on what it was given", async () => {
    const user = userEvent.setup();
    render(<Alerts />);

    const answer = askForText({
      title: "Create a branch",
      label: "Name",
      defaultValue: "feature/",
    });
    await dialog();

    expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe(
      "feature/"
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await answer).toBe("feature/");
  });

  it("asks a queued question once the one before it is answered", async () => {
    const user = userEvent.setup();
    render(<Alerts />);

    // A drop landing on two existing files asks twice, without waiting.
    const first = confirm({ title: "Replace a.png?" });
    const second = confirm({ title: "Replace b.png?" });

    await screen.findByText("Replace a.png?");
    expect(screen.queryByText("Replace b.png?")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await first).toBe(true);

    await screen.findByText("Replace b.png?");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await second).toBe(false);

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });
});
