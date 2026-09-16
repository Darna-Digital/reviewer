import type { Fill } from "@/brand/config";
import { ColorField, Field, Segmented, Slider } from "./primitives";

const KINDS = [
  { value: "transparent" as const, label: "None" },
  { value: "solid" as const, label: "Solid" },
  { value: "gradient" as const, label: "Gradient" },
];

export function FillControl({
  label,
  fill,
  onChange,
  allowNone = true,
}: {
  label: string;
  fill: Fill;
  onChange: (fill: Fill) => void;
  /** The plate and tile can be left out; the mark and wordmark cannot. */
  allowNone?: boolean;
}) {
  return (
    <div className="space-y-2.5">
      <Field label={label}>
        <Segmented
          options={allowNone ? KINDS : KINDS.slice(1)}
          value={fill.kind}
          onChange={(kind) => onChange({ ...fill, kind })}
        />
      </Field>
      {fill.kind !== "transparent" ? (
        <ColorField
          label={fill.kind === "gradient" ? "From" : "Colour"}
          value={fill.color}
          onChange={(color) => onChange({ ...fill, color })}
        />
      ) : null}
      {fill.kind === "gradient" ? (
        <>
          <ColorField
            label="To"
            value={fill.colorTo}
            onChange={(colorTo) => onChange({ ...fill, colorTo })}
          />
          <Slider
            label="Angle"
            value={fill.angle}
            min={0}
            max={360}
            step={5}
            format={(value) => `${value}°`}
            onChange={(angle) => onChange({ ...fill, angle })}
          />
        </>
      ) : null}
    </div>
  );
}
