/**
 * The base protocol of LSP: JSON-RPC bodies behind `Content-Length` headers,
 * over a pipe that splits and joins them wherever it likes.
 *
 * Framing is where a hand-written client usually goes wrong, so it lives alone
 * here, as pure buffer arithmetic, and is tested against split headers, glued
 * messages and multi-byte payloads. `Content-Length` counts bytes, not
 * characters — a decoder that slices the string instead of the buffer works
 * until the first non-ASCII identifier.
 */

const HEADER_SEPARATOR = "\r\n\r\n";
const CONTENT_LENGTH = "content-length:";

export interface DecodeResult {
  /** Complete JSON-RPC messages, in arrival order. */
  readonly messages: ReadonlyArray<unknown>;
  /**
   * Frames consumed but not understood — an unparseable body, or a header block
   * with no usable `Content-Length`. Counted rather than thrown so one bad
   * message from a misbehaving server cannot tear down the connection.
   */
  readonly malformed: number;
}

export interface MessageDecoder {
  readonly push: (chunk: Uint8Array) => DecodeResult;
  /** Bytes held back waiting for the rest of their message. */
  readonly pending: () => number;
}

export const encodeMessage = (message: unknown): Buffer => {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.from(
    `Content-Length: ${body.length}${HEADER_SEPARATOR}`,
    "ascii"
  );
  return Buffer.concat([header, body]);
};

/** Content-Length from a header block, or null when absent or unparseable. */
const contentLengthOf = (headers: string): number | null => {
  for (const line of headers.split("\r\n")) {
    if (!line.toLowerCase().startsWith(CONTENT_LENGTH)) continue;
    const raw = line.slice(CONTENT_LENGTH.length).trim();
    if (!/^\d+$/.test(raw)) return null;
    const length = Number(raw);
    return Number.isSafeInteger(length) ? length : null;
  }
  return null;
};

export const makeMessageDecoder = (): MessageDecoder => {
  let buffer = Buffer.alloc(0);

  const push = (chunk: Uint8Array): DecodeResult => {
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
    const messages: Array<unknown> = [];
    let malformed = 0;

    for (;;) {
      const headerEnd = buffer.indexOf(HEADER_SEPARATOR, 0, "ascii");
      if (headerEnd === -1) break;

      const bodyStart = headerEnd + HEADER_SEPARATOR.length;
      const length = contentLengthOf(
        buffer.subarray(0, headerEnd).toString("ascii")
      );
      if (length === null) {
        // Unusable header: drop it and resynchronise at the next body start.
        buffer = buffer.subarray(bodyStart);
        malformed += 1;
        continue;
      }
      if (buffer.length < bodyStart + length) break;

      const body = buffer.subarray(bodyStart, bodyStart + length);
      buffer = buffer.subarray(bodyStart + length);
      try {
        messages.push(JSON.parse(body.toString("utf8")));
      } catch {
        malformed += 1;
      }
    }

    return { messages, malformed };
  };

  return { push, pending: () => buffer.length };
};
