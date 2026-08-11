import { describe, expect, it } from "vitest";
import type { MockTask } from "@/interactions/collaboration/data/collaboration.mock";
import {
  beyondHorizon,
  conflictsFor,
  firstThing,
  formatSpent,
  isUpForGrabs,
  laneTasks,
  moveTask,
  pushInto,
  readHorizon,
  withinHorizon,
} from "./task-flow.functions";

const task = (
  id: string,
  scopeId: string,
  sequence: number,
  overrides: Partial<MockTask> = {}
): MockTask => ({
  id,
  key: id.toUpperCase(),
  projectId: "atlas",
  title: id,
  status: "todo",
  scopeId,
  sequence,
  blockedBy: [],
  spent: 0,
  assignee: "Unassigned",
  labels: [],
  updated: "Aug 11",
  description: [],
  activity: [],
  ...overrides,
});

const sequenceOf = (tasks: ReadonlyArray<MockTask>, scopeId: string) =>
  laneTasks(tasks, "atlas", scopeId).map((entry) => entry.id);

describe("laneTasks", () => {
  it("orders a horizon by position and leaves landed work out of it", () => {
    const tasks = [
      task("c", "today", 3),
      task("a", "today", 1),
      task("b", "today", 2, { status: "done" }),
      task("d", "week", 1),
    ];
    expect(sequenceOf(tasks, "today")).toEqual(["a", "c"]);
  });

  it("sequences sub-tasks among themselves", () => {
    const tasks = [
      task("parent", "today", 1),
      task("child-b", "today", 2, { parentId: "parent" }),
      task("child-a", "today", 1, { parentId: "parent" }),
    ];
    expect(
      laneTasks(tasks, "atlas", "today", "parent").map((t) => t.id)
    ).toEqual(["child-a", "child-b"]);
  });
});

describe("moveTask", () => {
  const lane = [
    task("a", "today", 1),
    task("b", "today", 2),
    task("c", "today", 3),
  ];

  it("puts a task at the position asked for and closes the gap it left", () => {
    const moved = moveTask(lane, "c", "today", 0);
    expect(sequenceOf(moved, "today")).toEqual(["c", "a", "b"]);
    expect(moved.map((t) => t.sequence)).toEqual([2, 3, 1]);
  });

  it("renumbers both horizons when a task changes one", () => {
    const moved = moveTask(lane, "a", "week", 0);
    expect(sequenceOf(moved, "today")).toEqual(["b", "c"]);
    expect(sequenceOf(moved, "week")).toEqual(["a"]);
    expect(moved.find((t) => t.id === "b")?.sequence).toBe(1);
  });

  it("clamps a position past the end of the horizon", () => {
    expect(sequenceOf(moveTask(lane, "a", "today", 99), "today")).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("leaves the array alone when the task is not there", () => {
    expect(moveTask(lane, "nope", "today", 0)).toBe(lane);
  });
});

describe("conflictsFor", () => {
  it("flags a blocker sitting in a later horizon", () => {
    const tasks = [
      task("early", "week", 1, { blockedBy: ["late"] }),
      task("late", "month", 1),
    ];
    expect(conflictsFor(tasks, tasks[0])).toMatchObject([
      { reason: "later-scope" },
    ]);
  });

  it("flags a blocker further down the same horizon", () => {
    const tasks = [
      task("first", "today", 1, { blockedBy: ["second"] }),
      task("second", "today", 2),
    ];
    expect(conflictsFor(tasks, tasks[0])).toMatchObject([
      { reason: "later-in-lane" },
    ]);
  });

  it("says nothing about a blocker that already landed", () => {
    const tasks = [
      task("now", "today", 1, { blockedBy: ["was"] }),
      task("was", "month", 1, { status: "done" }),
    ];
    expect(conflictsFor(tasks, tasks[0])).toEqual([]);
  });

  it("is happy when the blocker comes first", () => {
    const tasks = [
      task("second", "week", 1, { blockedBy: ["first"] }),
      task("first", "today", 1),
    ];
    expect(conflictsFor(tasks, tasks[0])).toEqual([]);
  });
});

describe("firstThing", () => {
  it("is the earliest position in the nearest horizon", () => {
    const tasks = [
      task("later", "week", 1),
      task("now", "today", 2),
      task("sooner", "today", 1),
    ];
    expect(firstThing(tasks, "atlas")?.id).toBe("sooner");
  });

  it("never picks something out of scope", () => {
    expect(firstThing([task("shelved", "out", 1)], "atlas")).toBeUndefined();
  });

  it("skips landed work", () => {
    const tasks = [
      task("done", "today", 1, { status: "done" }),
      task("open", "today", 2),
    ];
    expect(firstThing(tasks, "atlas")?.id).toBe("open");
  });
});

describe("formatSpent", () => {
  it("says nothing about time nobody spent", () => {
    expect(formatSpent(0)).toBe("—");
  });

  it("reads the way a person says it", () => {
    expect(formatSpent(45)).toBe("45m");
    expect(formatSpent(120)).toBe("2h");
    expect(formatSpent(380)).toBe("6h 20m");
  });
});

describe("pushInto", () => {
  // Today holds 4, this week holds 3, the cutover window holds 2.
  const full = [
    task("a", "today", 1),
    task("b", "today", 2),
    task("c", "today", 3),
    task("d", "today", 4),
    task("e", "week", 1),
    task("f", "week", 2),
    task("g", "week", 3),
    task("h", "month", 1),
  ];

  it("leaves a horizon with room alone", () => {
    const { tasks, displaced } = pushInto(full, "h", "cutover", 0);
    expect(displaced).toEqual([]);
    expect(sequenceOf(tasks, "cutover")).toEqual(["h"]);
  });

  it("pushes the tail out when an urgent task is squeezed in first", () => {
    const { tasks, displaced } = pushInto(full, "h", "today", 0);
    expect(sequenceOf(tasks, "today")).toEqual(["h", "a", "b", "c"]);
    expect(displaced.map((move) => [move.task.id, move.to])).toEqual([
      ["d", "week"],
      ["g", "cutover"],
    ]);
    expect(sequenceOf(tasks, "week")).toEqual(["e", "f", "d"]);
    expect(sequenceOf(tasks, "cutover")).toEqual(["g"]);
  });

  it("keeps the newcomer where it was dropped, even at the end", () => {
    const { tasks, displaced } = pushInto(full, "h", "today", 99);
    expect(sequenceOf(tasks, "today")).toEqual(["a", "b", "c", "h"]);
    expect(displaced.map((move) => move.task.id)).toEqual(["d", "g"]);
  });

  it("lets work fall out of scope at the end of the line", () => {
    // Month holds 4 and the quarter behind it holds 6; fill both and the chain
    // runs off the end of the timeline.
    const packed = [
      ...full,
      ...[2, 3, 4].map((n) => task(`month-${n}`, "month", n)),
      ...[1, 2, 3, 4, 5, 6].map((n) => task(`quarter-${n}`, "quarter", n)),
    ];
    const { displaced } = pushInto(packed, "a", "month", 0);
    expect(displaced.map((move) => move.to)).toEqual(["quarter", "out"]);
  });
});

describe("horizons nesting", () => {
  const spread = [
    task("now", "today", 1),
    task("soon", "week", 1),
    task("cutover", "cutover", 1),
    task("later", "month", 1),
    task("far", "quarter", 1),
    task("shelved", "out", 1),
  ];

  it("counts everything nearer than the horizon asked about", () => {
    expect(withinHorizon(spread, "month").map((t) => t.id)).toEqual([
      "now",
      "soon",
      "cutover",
      "later",
    ]);
  });

  it("never counts work nobody scoped", () => {
    expect(withinHorizon(spread, "quarter").map((t) => t.id)).not.toContain(
      "shelved"
    );
    expect(beyondHorizon(spread, "today").map((t) => t.id)).not.toContain(
      "shelved"
    );
  });

  it("splits the plan cleanly in two", () => {
    expect(beyondHorizon(spread, "week").map((t) => t.id)).toEqual([
      "cutover",
      "later",
      "far",
    ]);
  });

  it("reads the uncomfortable numbers as well as the total", () => {
    const tasks = [
      task("landed", "today", 1, { status: "done", spent: 60 }),
      task("unknown", "week", 1, {
        status: "figuring",
        assignee: "Nadia Alvi",
      }),
      task("nobodys", "week", 2),
      task("impossible", "week", 3, {
        assignee: "Theo Brandt",
        blockedBy: ["far"],
      }),
      task("far", "month", 1, { assignee: "Theo Brandt" }),
    ];
    expect(readHorizon(tasks, "week")).toEqual({
      total: 4,
      landed: 1,
      figuring: 1,
      unclaimed: 1,
      impossible: 1,
      tracked: 60,
    });
  });
});

describe("isUpForGrabs", () => {
  it("is work nobody holds with nothing in its way", () => {
    const tasks = [task("free", "today", 1)];
    expect(isUpForGrabs(tasks, tasks[0])).toBe(true);
  });

  it("is not up for grabs once somebody has it", () => {
    const tasks = [task("mine", "today", 1, { assignee: "Nadia Alvi" })];
    expect(isUpForGrabs(tasks, tasks[0])).toBe(false);
  });

  it("is not up for grabs while it waits on something", () => {
    const tasks = [
      task("waiting", "today", 2, { blockedBy: ["blocker"] }),
      task("blocker", "today", 1),
    ];
    expect(isUpForGrabs(tasks, tasks[0])).toBe(false);
  });

  it("counts a landed blocker as out of the way", () => {
    const tasks = [
      task("ready", "today", 2, { blockedBy: ["was"] }),
      task("was", "today", 1, { status: "done" }),
    ];
    expect(isUpForGrabs(tasks, tasks[0])).toBe(true);
  });

  it("ignores work nobody scoped", () => {
    const tasks = [task("shelved", "out", 1)];
    expect(isUpForGrabs(tasks, tasks[0])).toBe(false);
  });
});
