import type { PathCommand } from "opentype.js";

const PRECISION = 1000;

function number(value: number) {
  const rounded = Math.round(value * PRECISION) / PRECISION;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

// opentype.js' own `toPathData` rounds through `Number.toFixed`-style string
// concatenation, which yields "NaN" as soon as a coordinate's fractional part
// is small enough that JavaScript prints it in exponential notation — and a
// non-integer font size makes that happen several times per word. Serialising
// the commands here keeps the outlines intact.
export function commandsToPathData(commands: Array<PathCommand>, offsetX = 0) {
  let data = "";
  for (const command of commands) {
    switch (command.type) {
      case "M":
      case "L":
        data += `${command.type}${number(command.x + offsetX)} ${number(command.y)}`;
        break;
      case "Q":
        data +=
          `Q${number(command.x1 + offsetX)} ${number(command.y1)} ` +
          `${number(command.x + offsetX)} ${number(command.y)}`;
        break;
      case "C":
        data +=
          `C${number(command.x1 + offsetX)} ${number(command.y1)} ` +
          `${number(command.x2 + offsetX)} ${number(command.y2)} ` +
          `${number(command.x + offsetX)} ${number(command.y)}`;
        break;
      case "Z":
        data += "Z";
        break;
    }
  }
  return data;
}
