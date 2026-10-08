import type { CliRenderer } from '@opentui/core';

/** How long the parser waits for the rest of a split escape sequence. */
const PARSER_WAIT_MS = 120;
/** Stray bytes are only stray this soon after a wheel event. */
const AFTER_SCROLL_MS = 400;
/** The head the parser flushes alone when a report splits after it. */
const ORPHAN_HEAD = '\x1b[';
/** What is left of an SGR mouse report (`ESC [ < 64 ; 100 ; 15 M`) once its head is gone. */
const REPORT_BYTE = /^[<\d;Mm]$/;

/**
 * A fast wheel can split a mouse report across reads; OpenTUI flushes a
 * pending `ESC [` after 20 ms, and the rest — `<64;100;15M` — arrives as
 * typed keys (`4` opens the branch picker, `5` History). This waits longer
 * for the rest, and drops report bytes that still leak while the wheel is
 * turning. `stdinParser` is private in 0.5's typings, hence the cast.
 */
export function guardMouseFragments(renderer: CliRenderer) {
  const parser = (
    renderer as unknown as { stdinParser?: { timeoutMs: number } }
  ).stdinParser;
  if (parser) parser.timeoutMs = PARSER_WAIT_MS;

  let lastScroll = -Infinity;
  const swallow = (sequence: string) => {
    if (sequence === ORPHAN_HEAD) {
      lastScroll = Date.now();
      return true;
    }
    return (
      Date.now() - lastScroll < AFTER_SCROLL_MS && REPORT_BYTE.test(sequence)
    );
  };
  renderer.prependInputHandler(swallow);

  return {
    noteScroll: () => {
      lastScroll = Date.now();
    },
    dispose: () => renderer.removeInputHandler(swallow),
  };
}
