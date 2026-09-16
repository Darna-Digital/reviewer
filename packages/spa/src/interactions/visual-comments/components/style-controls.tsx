/**
 * The controls of the style inspector, one per kind of property.
 *
 * Each is the control a design tool would give the property: a number scrubbed
 * off its label with the unit switchable beside it, a strip of icons for an
 * exclusive choice, a swatch that opens a real picker, a slider for a
 * fraction. They know nothing of the page; every change is a CSS value handed
 * back to whoever asked.
 */
import {
  IconAlignCenter,
  IconAlignJustified,
  IconAlignLeft,
  IconAlignRight,
  IconArrowAutofitHeight,
  IconArrowAutofitWidth,
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconArrowsHorizontal,
  IconBaseline,
  IconLayoutAlignBottom,
  IconLayoutAlignCenter,
  IconLayoutAlignLeft,
  IconLayoutAlignMiddle,
  IconLayoutAlignRight,
  IconLayoutAlignTop,
  IconLayoutDistributeVertical,
} from "@tabler/icons-react";
import { useRef, useState, type ComponentType, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import {
  NumberField,
  NumberFieldGroup,
  NumberFieldInput,
  NumberFieldScrubArea,
} from "@/components/ui/number-field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  formatColor,
  formatLength,
  hsvaToRgba,
  isTransparent,
  parseCssColor,
  parseLength,
  rgbaToHsva,
  type Hsva,
  type StyleControl as StyleControlSpec,
} from "../functions/visual-style.functions";

export const FIELD_LABEL =
  "truncate text-[0.6875rem] text-muted-foreground select-none";

const CHANGED = "border-ring-accent/60";

/** The checkerboard every colour picker uses to mean "nothing painted here". */
const TRANSPARENT_SWATCH =
  "repeating-conic-gradient(var(--color-muted) 0 25%, transparent 0 50%) 0 0 / 8px 8px";

type Icon = ComponentType<{ className?: string }>;

const SEGMENT_ICONS: Readonly<Record<string, Icon>> = {
  "text-align:left": IconAlignLeft,
  "text-align:center": IconAlignCenter,
  "text-align:right": IconAlignRight,
  "text-align:justify": IconAlignJustified,
  "flex-direction:row": IconArrowRight,
  "flex-direction:column": IconArrowDown,
  "flex-direction:row-reverse": IconArrowLeft,
  "flex-direction:column-reverse": IconArrowUp,
  "justify-content:flex-start": IconLayoutAlignLeft,
  "justify-content:center": IconLayoutAlignCenter,
  "justify-content:flex-end": IconLayoutAlignRight,
  "justify-content:space-between": IconLayoutDistributeVertical,
  "justify-content:space-around": IconArrowsHorizontal,
  "justify-content:space-evenly": IconArrowAutofitWidth,
  "align-items:flex-start": IconLayoutAlignTop,
  "align-items:center": IconLayoutAlignMiddle,
  "align-items:flex-end": IconLayoutAlignBottom,
  "align-items:stretch": IconArrowAutofitHeight,
  "align-items:baseline": IconBaseline,
};

/**
 * Some computed values are aliases of an offered option — `start` is what an
 * untouched `text-align` computes to, `normal` is `align-items: stretch` —
 * and the strip should light the option they mean.
 */
const SEGMENT_ALIASES: Readonly<Record<string, string>> = {
  "text-align:start": "left",
  "text-align:end": "right",
  "justify-content:normal": "flex-start",
  "justify-content:start": "flex-start",
  "justify-content:left": "flex-start",
  "justify-content:end": "flex-end",
  "justify-content:right": "flex-end",
  "align-items:normal": "stretch",
  "align-items:start": "flex-start",
  "align-items:self-start": "flex-start",
  "align-items:end": "flex-end",
  "align-items:self-end": "flex-end",
};

export interface ControlProps {
  property: string;
  value: string;
  changed: boolean;
  onEdit: (value: string) => void;
}

/**
 * A length: the number in a scrubbable field, the unit (or a keyword like
 * `auto`) in a menu at its end. `prefix` puts the label inside the field, for
 * the W/H and four-sides rows; `label` puts it in the row's label column. In
 * `compact` the unit menu is dropped so four can share a row.
 */
export function LengthControl({
  property,
  value,
  changed,
  onEdit,
  spec,
  label,
  prefix,
  compact = false,
}: ControlProps & {
  spec: Extract<StyleControlSpec, { kind: "length" }>;
  label?: ReactNode;
  prefix?: ReactNode;
  compact?: boolean;
}) {
  const length = parseLength(value);
  // The unit a number keeps is the one it had; a keyword keeps the last unit
  // seen so switching back lands on something sensible.
  const lastUnit = useRef(length.kind === "number" ? length.unit : "px");
  if (length.kind === "number") lastUnit.current = length.unit;
  const unit = lastUnit.current;

  const setNumber = (next: number | null) => {
    if (next === null) return;
    onEdit(formatLength({ kind: "number", value: next, unit }));
  };
  const setUnit = (next: string) => {
    if (spec.keywords.includes(next)) {
      onEdit(next);
      return;
    }
    onEdit(
      formatLength({
        kind: "number",
        value: length.kind === "number" ? length.value : 0,
        unit: next,
      })
    );
  };

  const unitMenu = !compact && (
    <Select
      value={length.kind === "number" ? unit : length.value}
      onValueChange={(next) => setUnit(String(next))}
    >
      <SelectTrigger
        size="sm"
        hideIcon
        aria-label={`${property} unit`}
        className="h-full shrink-0 rounded-l-none rounded-r-[5px] border-0 bg-transparent px-1.5 font-mono text-[0.625rem] text-muted-foreground shadow-none hover:bg-elevate hover:text-foreground"
      >
        <SelectValue>
          {(current: string) => (current === "" ? "—" : current)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-24">
        <SelectGroup>
          {spec.units.map((option) => (
            <SelectItem
              key={option}
              value={option}
              className="font-mono text-xs"
            >
              {option === "" ? "— (none)" : option}
            </SelectItem>
          ))}
        </SelectGroup>
        {spec.keywords.length > 0 && (
          <SelectGroup>
            <SelectGroupLabel>keyword</SelectGroupLabel>
            {spec.keywords.map((option) => (
              <SelectItem
                key={option}
                value={option}
                className="font-mono text-xs"
              >
                {option}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );

  return (
    <NumberField
      value={length.kind === "number" ? length.value : null}
      onValueChange={setNumber}
      step={1}
      smallStep={0.1}
      largeStep={10}
      allowWheelScrub
      format={{ maximumFractionDigits: 2 }}
      {...(spec.min !== undefined ? { min: spec.min } : {})}
      className="contents"
    >
      {label !== undefined && (
        <NumberFieldScrubArea className={FIELD_LABEL} title={property}>
          {label}
        </NumberFieldScrubArea>
      )}
      <NumberFieldGroup className={cn("min-w-0", changed && CHANGED)}>
        {prefix !== undefined && (
          <NumberFieldScrubArea
            className="flex h-full shrink-0 items-center pl-1.5 text-[0.625rem] text-muted-foreground [&_svg]:size-3"
            title={property}
          >
            {prefix}
          </NumberFieldScrubArea>
        )}
        {length.kind === "number" ? (
          <NumberFieldInput
            aria-label={property}
            className={cn(compact && "px-1")}
          />
        ) : (
          <button
            type="button"
            title={compact ? "Set a number" : undefined}
            onClick={() => compact && setUnit("px")}
            className="h-full min-w-0 flex-1 truncate px-1.5 text-left font-mono text-[0.6875rem] text-muted-foreground italic"
          >
            {length.value}
          </button>
        )}
        {unitMenu}
      </NumberFieldGroup>
    </NumberField>
  );
}

export function SelectControl({
  property,
  value,
  changed,
  onEdit,
  spec,
  prefix,
}: ControlProps & {
  spec: Extract<StyleControlSpec, { kind: "select" }>;
  prefix?: ReactNode;
}) {
  // A computed value outside the offered list still shows as itself rather
  // than as a blank placeholder.
  const known = spec.options.some((option) => option.value === value);
  const options = known
    ? spec.options
    : [{ value, label: value }, ...spec.options];
  return (
    <div
      className={cn(
        "flex h-6 min-w-0 items-center rounded-md border border-transparent bg-input/50 focus-within:border-ring-accent",
        changed && CHANGED
      )}
    >
      {prefix !== undefined && (
        <span className="shrink-0 pl-1.5 text-[0.625rem] text-muted-foreground select-none">
          {prefix}
        </span>
      )}
      <Select value={value} onValueChange={(next) => onEdit(String(next))}>
        <SelectTrigger
          size="sm"
          aria-label={property}
          className="h-full w-full min-w-0 border-0 bg-transparent px-1.5 font-mono text-[0.6875rem] shadow-none hover:bg-transparent [&_svg]:size-3"
        >
          <SelectValue className="truncate" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="text-xs"
            >
              <span className="font-mono text-muted-foreground">
                {option.value}
              </span>
              {option.label !== option.value && <span>{option.label}</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SegmentControl({
  property,
  value,
  changed,
  onEdit,
  spec,
}: ControlProps & { spec: Extract<StyleControlSpec, { kind: "segment" }> }) {
  const current = SEGMENT_ALIASES[`${property}:${value}`] ?? value;
  return (
    <ToggleGroup
      value={[current]}
      onValueChange={(next) => {
        // Pressing the lit segment again would clear the group; a property
        // always has a value, so that press means nothing.
        if (next[0] !== undefined) onEdit(next[0]);
      }}
      aria-label={property}
      className={cn("border border-transparent", changed && CHANGED)}
    >
      {spec.options.map((option) => {
        const Glyph = SEGMENT_ICONS[`${property}:${option}`];
        return (
          <ToggleGroupItem
            key={option}
            value={option}
            aria-label={option}
            title={option}
            className={cn(
              Glyph === undefined && "px-1 font-mono text-[0.625rem]"
            )}
          >
            {Glyph === undefined ? option : <Glyph />}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

/** A 0–1 value as a percentage: a slider with its number beside it. */
export function FractionControl({
  property,
  value,
  changed,
  onEdit,
  label,
}: ControlProps & { label: ReactNode }) {
  const parsed = Number.parseFloat(value);
  const percent = Number.isFinite(parsed) ? Math.round(parsed * 100) : 100;
  const set = (next: number) =>
    onEdit(String(Math.max(0, Math.min(100, next)) / 100));
  return (
    <NumberField
      value={percent}
      onValueChange={(next) => next !== null && set(next)}
      min={0}
      max={100}
      step={1}
      largeStep={10}
      allowWheelScrub
      className="contents"
    >
      <NumberFieldScrubArea className={FIELD_LABEL} title={property}>
        {label}
      </NumberFieldScrubArea>
      <div className="flex min-w-0 items-center gap-2">
        <Slider
          value={percent}
          onValueChange={set}
          min={0}
          max={100}
          aria-label={property}
        />
        <NumberFieldGroup className={cn("w-16 shrink-0", changed && CHANGED)}>
          <NumberFieldInput
            aria-label={`${property} percent`}
            className="pr-0"
          />
          <span className="pr-1.5 font-mono text-[0.625rem] text-muted-foreground">
            %
          </span>
        </NumberFieldGroup>
      </div>
    </NumberField>
  );
}

/**
 * A colour: the swatch opens the picker, the text keeps the exact value, and
 * the alpha has a field of its own — a fill is made translucent far more often
 * than it is re-hued.
 */
export function ColorControl({
  property,
  value,
  changed,
  onEdit,
}: ControlProps) {
  const rgba = parseCssColor(value);
  const transparent = isTransparent(value);
  const alpha = rgba === null ? 100 : Math.round(rgba.a * 100);
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Popover>
        <PopoverTrigger
          aria-label={`Pick ${property}`}
          className={cn(
            "relative size-6 shrink-0 cursor-pointer overflow-hidden rounded-md border border-frame-border outline-offset-1 outline-ring focus-visible:outline-2",
            changed && CHANGED
          )}
          style={{ background: TRANSPARENT_SWATCH }}
        >
          <span
            aria-hidden
            className="absolute inset-0"
            style={{ background: transparent ? "transparent" : value }}
          />
        </PopoverTrigger>
        <PopoverContent
          side="left"
          align="start"
          sideOffset={8}
          className="w-56 gap-2 p-2.5"
        >
          <ColorPicker
            value={
              rgba === null ? { h: 0, s: 0, v: 0, a: 1 } : rgbaToHsva(rgba)
            }
            onChange={(next) => onEdit(formatColor(hsvaToRgba(next)))}
          />
        </PopoverContent>
      </Popover>
      <Input
        value={value}
        spellCheck={false}
        aria-label={property}
        onChange={(event) => onEdit(event.target.value)}
        className={cn(
          "h-6 min-w-0 flex-1 rounded-md px-1.5 font-mono text-[0.6875rem]",
          changed && CHANGED
        )}
      />
      <NumberField
        value={alpha}
        disabled={rgba === null}
        onValueChange={(next) => {
          if (next === null || rgba === null) return;
          onEdit(
            formatColor({ ...rgba, a: Math.max(0, Math.min(100, next)) / 100 })
          );
        }}
        min={0}
        max={100}
        step={1}
        largeStep={10}
        allowWheelScrub
        className="contents"
      >
        <NumberFieldGroup className={cn("w-14 shrink-0", changed && CHANGED)}>
          <NumberFieldInput aria-label={`${property} alpha`} className="pr-0" />
          <span className="pr-1.5 font-mono text-[0.625rem] text-muted-foreground">
            %
          </span>
        </NumberFieldGroup>
      </NumberField>
    </div>
  );
}

/**
 * The picker itself: a saturation/value square under a hue strip and an alpha
 * ramp. Held in HSV while open so dragging the square does not drift the hue
 * the way round-tripping through RGB would.
 */
function ColorPicker({
  value,
  onChange,
}: {
  value: Hsva;
  onChange: (next: Hsva) => void;
}) {
  const [hsva, setHsva] = useState(value);
  const square = useRef<HTMLDivElement | null>(null);
  const update = (next: Hsva) => {
    setHsva(next);
    setHex(formatColor(hsvaToRgba({ ...next, a: 1 })));
    onChange(next);
  };
  // Typed separately from the colour it names: a half-typed hex is not a
  // colour yet, and must not be replaced by the last one that was.
  const [hex, setHex] = useState(() =>
    formatColor(hsvaToRgba({ ...value, a: 1 }))
  );
  const pick = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = square.current?.getBoundingClientRect();
    if (box === undefined) return;
    const s = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
    const v =
      1 - Math.max(0, Math.min(1, (event.clientY - box.top) / box.height));
    update({ ...hsva, s, v });
  };
  const hue = `hsl(${hsva.h} 100% 50%)`;
  const opaque = formatColor(hsvaToRgba({ ...hsva, a: 1 }));
  return (
    <>
      <div
        ref={square}
        role="slider"
        aria-label="Saturation and brightness"
        aria-valuetext={`${Math.round(hsva.s * 100)}% saturated, ${Math.round(hsva.v * 100)}% bright`}
        tabIndex={0}
        className="relative h-32 w-full cursor-crosshair touch-none rounded-md border border-frame-border"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hue})`,
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          pick(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            pick(event);
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute size-3 -translate-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.4)]"
          style={{
            left: `${hsva.s * 100}%`,
            top: `${(1 - hsva.v) * 100}%`,
            background: opaque,
          }}
        />
      </div>
      <Slider
        value={hsva.h}
        onValueChange={(h) => update({ ...hsva, h })}
        min={0}
        max={360}
        step={1}
        aria-label="Hue"
        indicator={false}
        trackClassName="h-2"
        trackStyle={{
          background:
            "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
        }}
      />
      <Slider
        value={Math.round(hsva.a * 100)}
        onValueChange={(a) => update({ ...hsva, a: a / 100 })}
        min={0}
        max={100}
        step={1}
        aria-label="Alpha"
        indicator={false}
        trackClassName="h-2"
        trackStyle={{
          background: `linear-gradient(to right, transparent, ${opaque}), ${TRANSPARENT_SWATCH}`,
        }}
      />
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="size-6 shrink-0 rounded-md border border-frame-border"
          style={{
            background: `linear-gradient(${formatColor(hsvaToRgba(hsva))}, ${formatColor(hsvaToRgba(hsva))}), ${TRANSPARENT_SWATCH}`,
          }}
        />
        <Input
          value={hex}
          spellCheck={false}
          aria-label="Hex"
          onChange={(event) => {
            setHex(event.target.value);
            const parsed = parseCssColor(event.target.value);
            if (parsed === null) return;
            const next = { ...rgbaToHsva(parsed), a: hsva.a };
            setHsva(next);
            onChange(next);
          }}
          className="h-6 flex-1 rounded-md px-1.5 font-mono text-[0.6875rem]"
        />
      </div>
    </>
  );
}
