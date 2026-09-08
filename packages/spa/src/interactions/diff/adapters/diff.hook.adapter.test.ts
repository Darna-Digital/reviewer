import { describe, expect, it } from "vitest";
import { parsePatchStably } from "./diff.hook.adapter";

const patchFor = (path: string, added: string) =>
  `diff --git a/${path} b/${path}
index 1111111..2222222 100644
--- a/${path}
+++ b/${path}
@@ -1,2 +1,3 @@
 const a = 1;
+${added}
 const b = 2;
`;

const ONE_FILE = patchFor("src/a.ts", "const added = 1;");
const OTHER_FILE = patchFor("src/b.ts", "const added = 2;");

describe("parsePatchStably", () => {
  it("gives back the same file objects for the same patch", () => {
    const first = parsePatchStably(ONE_FILE);
    const second = parsePatchStably(ONE_FILE);

    expect(second).toBe(first);
    expect(second[0]).toBe(first[0]);
  });

  // The renderer reads two files sharing a cache key as one file, and compares
  // the object it laid out against the one it draws by reference — so equal
  // keys on different objects is the state that crashes it.
  it("never answers one cache key with two different objects", () => {
    const first = parsePatchStably(ONE_FILE);
    parsePatchStably(OTHER_FILE);
    const again = parsePatchStably(ONE_FILE);

    expect(again[0]?.cacheKey).toBe(first[0]?.cacheKey);
    expect(again[0]).toBe(first[0]);
  });

  it("parses different patches into their own files", () => {
    const one = parsePatchStably(ONE_FILE);
    const other = parsePatchStably(OTHER_FILE);

    expect(one[0]?.name).toBe("src/a.ts");
    expect(other[0]?.name).toBe("src/b.ts");
    expect(other[0]?.cacheKey).not.toBe(one[0]?.cacheKey);
  });

  it("lets go of patches once newer ones have crowded them out", () => {
    const first = parsePatchStably(ONE_FILE);
    for (let i = 0; i < 3; i++) {
      parsePatchStably(patchFor(`src/held-${i}.ts`, `const n = ${i};`));
    }

    expect(parsePatchStably(ONE_FILE)).not.toBe(first);
  });
});
