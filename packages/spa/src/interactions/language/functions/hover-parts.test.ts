import { describe, expect, it } from "vitest";
import { splitHover } from "./hover-parts";

const TS_HOVER = [
  "```ts",
  "(method) Repository.commit(message: string): Promise<void>",
  "```",
  "",
  "Records the staged changes.",
  "",
  "*@throws* — when nothing is staged",
].join("\n");

describe("splitHover", () => {
  it("lifts the fenced signature away from the prose", () => {
    const parts = splitHover(TS_HOVER);
    expect(parts.signature).toBe(
      "```ts\nRepository.commit(message: string): Promise<void>\n```"
    );
    expect(parts.body).toBe(
      "Records the staged changes.\n\n*@throws* — when nothing is staged"
    );
  });

  it("names the kind TypeScript parenthesises, and stops repeating it", () => {
    expect(splitHover(TS_HOVER).kind).toBe("method");
    expect(splitHover(TS_HOVER).signature).not.toContain("(method)");
  });

  it("reads a declaration keyword as the kind, leaving the signature whole", () => {
    const parts = splitHover(
      "```ts\nfunction greet(name: string): string\n```"
    );
    expect(parts.kind).toBe("function");
    expect(parts.signature).toBe(
      "```ts\nfunction greet(name: string): string\n```"
    );
  });

  it("keeps a multi-word parenthesised kind", () => {
    expect(splitHover("```ts\n(local var) count: number\n```").kind).toBe(
      "local var"
    );
  });

  it("leaves the kind empty when the signature does not announce one", () => {
    const parts = splitHover("```css\ngrid-template-columns\n```");
    expect(parts.kind).toBe("");
    expect(parts.signature).toBe("```css\ngrid-template-columns\n```");
  });

  it("keeps a bare kind as the signature rather than emptying the block", () => {
    const parts = splitHover("```ts\n(alias)\n```");
    expect(parts.kind).toBe("alias");
    expect(parts.signature).toBe("```ts\n(alias)\n```");
  });

  it("lifts trailing reference links into their own list", () => {
    const parts = splitHover(
      [
        "Specifies the track sizing functions of the grid.",
        "",
        "[MDN Reference](https://developer.mozilla.org/docs/Web/CSS/grid)",
      ].join("\n")
    );
    expect(parts.body).toBe(
      "Specifies the track sizing functions of the grid."
    );
    expect(parts.links).toEqual([
      {
        label: "MDN Reference",
        href: "https://developer.mozilla.org/docs/Web/CSS/grid",
      },
    ]);
  });

  it("takes several links from one trailing paragraph", () => {
    const parts = splitHover("Docs\n\n[MDN](https://a) | [Spec](https://b)");
    expect(parts.links).toEqual([
      { label: "MDN", href: "https://a" },
      { label: "Spec", href: "https://b" },
    ]);
  });

  it("leaves a link that is part of a sentence where it is", () => {
    const contents = "See [the guide](https://a) for the rest.";
    const parts = splitHover(contents);
    expect(parts.body).toBe(contents);
    expect(parts.links).toEqual([]);
  });

  it("leaves a link paragraph that is not the last one alone", () => {
    const parts = splitHover("[MDN](https://a)\n\nSpecifies the track list.");
    expect(parts.body).toBe("[MDN](https://a)\n\nSpecifies the track list.");
    expect(parts.links).toEqual([]);
  });

  it("treats a hover that opens with prose as all body", () => {
    const parts = splitHover("Just a sentence.");
    expect(parts).toEqual({
      kind: "",
      signature: "",
      body: "Just a sentence.",
      links: [],
    });
  });

  it("leaves an unterminated fence alone rather than swallowing the hover", () => {
    const parts = splitHover("```ts\nfunction greet(): void");
    expect(parts.signature).toBe("");
    expect(parts.body).toBe("```ts\nfunction greet(): void");
  });
});
