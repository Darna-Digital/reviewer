// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RunTargetPicker } from "./run-target-picker";

afterEach(cleanup);

const open = async (cloudConnected: boolean) => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <RunTargetPicker
        value="local"
        onChange={onChange}
        cloudConnected={cloudConnected}
      />
    </TooltipProvider>
  );
  await user.click(screen.getByRole("button", { name: "Run target" }));
  const cloud = await screen.findByRole("menuitem", {
    name: /reviewer cloud/,
  });
  return { user, onChange, cloud };
};

describe("RunTargetPicker", () => {
  it("names this machine until the cloud is chosen", () => {
    render(
      <TooltipProvider>
        <RunTargetPicker value="local" onChange={() => {}} cloudConnected />
      </TooltipProvider>
    );
    expect(
      screen.getByRole("button", { name: "Run target" }).textContent
    ).toContain("This machine");
  });

  it("offers the cloud only once the app is connected to it", async () => {
    const { cloud, user, onChange } = await open(false);
    expect(cloud.getAttribute("aria-disabled")).toBe("true");
    expect(cloud.textContent).toContain("Connect in Settings");
    await user.click(cloud);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("hands the cloud over when it can take a session", async () => {
    const { cloud, user, onChange } = await open(true);
    expect(cloud.getAttribute("aria-disabled")).not.toBe("true");
    await user.click(cloud);
    expect(onChange).toHaveBeenCalledWith("cloud");
  });
});
