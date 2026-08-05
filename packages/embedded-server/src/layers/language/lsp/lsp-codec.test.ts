import { describe, expect, it } from "vitest";
import { encodeMessage, makeMessageDecoder } from "./lsp-codec.ts";

const frame = (
  json: string,
  header = `Content-Length: ${Buffer.byteLength(json)}`
) => Buffer.from(`${header}\r\n\r\n${json}`, "utf8");

describe("encodeMessage", () => {
  it("prefixes a byte-counted header", () => {
    const encoded = encodeMessage({ jsonrpc: "2.0", id: 1 });
    const body = '{"jsonrpc":"2.0","id":1}';
    expect(encoded.toString("utf8")).toBe(
      `Content-Length: ${body.length}\r\n\r\n${body}`
    );
  });

  it("counts bytes, not characters", () => {
    const encoded = encodeMessage({ text: "héllo 😀" });
    const [header, body] = encoded.toString("utf8").split("\r\n\r\n");
    expect(Number(header.split(": ")[1])).toBe(Buffer.byteLength(body, "utf8"));
    expect(Buffer.byteLength(body, "utf8")).toBeGreaterThan(body.length);
  });

  it("round-trips through the decoder", () => {
    const decoder = makeMessageDecoder();
    const message = { jsonrpc: "2.0", method: "initialized", params: {} };
    expect(decoder.push(encodeMessage(message)).messages).toEqual([message]);
  });
});

describe("makeMessageDecoder", () => {
  it("returns nothing until a message is complete", () => {
    const decoder = makeMessageDecoder();
    // `{"a":1234}` is ten bytes.
    expect(
      decoder.push(Buffer.from("Content-Length: 10\r\n")).messages
    ).toEqual([]);
    expect(decoder.push(Buffer.from('\r\n{"a":')).messages).toEqual([]);
    expect(decoder.push(Buffer.from("1234}")).messages).toEqual([{ a: 1234 }]);
    expect(decoder.pending()).toBe(0);
  });

  it("splits several messages arriving in one chunk", () => {
    const decoder = makeMessageDecoder();
    const chunk = Buffer.concat([
      encodeMessage({ id: 1 }),
      encodeMessage({ id: 2 }),
      encodeMessage({ id: 3 }),
    ]);
    expect(decoder.push(chunk).messages).toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);
  });

  it("handles a header split mid-way across chunks", () => {
    const decoder = makeMessageDecoder();
    const encoded = encodeMessage({ id: 7 });
    expect(decoder.push(encoded.subarray(0, 5)).messages).toEqual([]);
    expect(decoder.push(encoded.subarray(5)).messages).toEqual([{ id: 7 }]);
  });

  it("decodes multi-byte bodies correctly", () => {
    const decoder = makeMessageDecoder();
    const message = { message: "type 'ß' is not assignable — 😀" };
    expect(decoder.push(encodeMessage(message)).messages).toEqual([message]);
  });

  it("ignores extra headers and matches Content-Length case-insensitively", () => {
    const decoder = makeMessageDecoder();
    const json = '{"ok":true}';
    const buffer = frame(
      json,
      `Content-Type: application/vscode-jsonrpc; charset=utf-8\r\ncontent-length: ${json.length}`
    );
    expect(decoder.push(buffer).messages).toEqual([{ ok: true }]);
  });

  it("counts an unparseable body as malformed and keeps going", () => {
    const decoder = makeMessageDecoder();
    const chunk = Buffer.concat([frame("{not json"), encodeMessage({ id: 9 })]);
    const result = decoder.push(chunk);
    expect(result.malformed).toBe(1);
    expect(result.messages).toEqual([{ id: 9 }]);
  });

  it("resynchronises after a header with no Content-Length", () => {
    const decoder = makeMessageDecoder();
    const chunk = Buffer.concat([
      Buffer.from("Content-Type: text/plain\r\n\r\n"),
      encodeMessage({ id: 4 }),
    ]);
    const result = decoder.push(chunk);
    expect(result.malformed).toBe(1);
    expect(result.messages).toEqual([{ id: 4 }]);
  });

  it("rejects a non-numeric Content-Length rather than reading garbage", () => {
    const decoder = makeMessageDecoder();
    const result = decoder.push(frame('{"a":1}', "Content-Length: abc"));
    expect(result.malformed).toBe(1);
    expect(result.messages).toEqual([]);
  });

  it("holds an incomplete message, header and all", () => {
    const decoder = makeMessageDecoder();
    const partial = "Content-Length: 99\r\n\r\npartial";
    decoder.push(Buffer.from(partial));
    expect(decoder.pending()).toBe(partial.length);
  });
});
