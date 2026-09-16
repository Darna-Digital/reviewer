import { FONT_WEIGHTS } from "@/brand/font";
import {
  DEFAULT_CONFIG,
  PRESETS,
  type Fill,
  type LayoutKind,
} from "@/brand/config";
import type { Brand } from "@/lib/use-brand";
import { cn } from "@/lib/cn";
import { FillControl } from "./fill-control";
import {
  Button,
  Field,
  Section,
  Segmented,
  Slider,
  TextInput,
  Toggle,
} from "./primitives";

const LAYOUTS: Array<{ value: LayoutKind; label: string; title: string }> = [
  { value: "mark", label: "Mark", title: "Square icon" },
  {
    value: "horizontal",
    label: "Horizontal",
    title: "Mark beside the wordmark",
  },
  { value: "stacked", label: "Stacked", title: "Mark above the wordmark" },
  { value: "wordmark", label: "Word", title: "Wordmark only" },
];

const percent = (value: number) => `${Math.round(value * 100)}%`;

/** The colour stops of a fill, without its kind — for swapping two fills over. */
const swatch = ({ color, colorTo, angle }: Fill) => ({ color, colorTo, angle });

export function ControlPanel({ brand }: { brand: Brand }) {
  const { config, update, reset } = brand;
  const hasWordmark = config.layout !== "mark";
  const hasTile = config.layout === "mark" || config.markTile;

  const swapColours = () => {
    const background =
      config.plate.kind === "transparent" ? config.tile : config.plate;
    update({
      plate: { ...config.plate, ...swatch(config.blocks) },
      tile: { ...config.tile, ...swatch(config.blocks) },
      blocks: { ...config.blocks, ...swatch(background) },
      wordmarkFill: { ...config.wordmarkFill, ...swatch(background) },
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <span className="text-[11px] font-medium tracking-[0.14em] text-muted uppercase">
          Controls
        </span>
        <button
          type="button"
          onClick={reset}
          className="cursor-pointer text-[11px] text-muted transition-colors hover:text-white"
        >
          Reset all
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title="Preset">
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                title={preset.hint}
                onClick={() => update(preset.config)}
                className={cn(
                  "cursor-pointer rounded-lg border border-line bg-raised px-2 py-2 text-left text-xs",
                  "transition-colors hover:border-white/30 hover:bg-white/5"
                )}
              >
                <span className="block">{preset.label}</span>
                <span className="block text-[10px] text-muted">
                  {preset.hint}
                </span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Lockup">
          <Field label="Layout">
            <Segmented
              options={LAYOUTS.slice(0, 2)}
              value={config.layout}
              onChange={(layout) => update({ layout })}
            />
          </Field>
          <Segmented
            options={LAYOUTS.slice(2)}
            value={config.layout}
            onChange={(layout) => update({ layout })}
          />
          {hasWordmark ? (
            <>
              <TextInput
                label="Wordmark"
                value={config.wordmark}
                placeholder="Reviewer"
                onChange={(wordmark) => update({ wordmark })}
              />
              <Toggle
                label="Uppercase"
                checked={config.uppercase}
                onChange={(uppercase) => update({ uppercase })}
              />
            </>
          ) : null}
        </Section>

        <Section title="Colour">
          {config.layout !== "mark" ? (
            <>
              <FillControl
                label="Plate"
                fill={config.plate}
                onChange={(plate) => update({ plate })}
              />
              <Toggle
                label="Tile behind the mark"
                checked={config.markTile}
                onChange={(markTile) => update({ markTile })}
              />
            </>
          ) : null}
          {hasTile ? (
            <FillControl
              label={config.layout === "mark" ? "Icon background" : "Tile"}
              fill={config.tile}
              onChange={(tile) => update({ tile })}
            />
          ) : null}
          <FillControl
            label="Mark"
            fill={config.blocks}
            allowNone={false}
            onChange={(blocks) => update({ blocks })}
          />
          {hasWordmark ? (
            <>
              <Toggle
                label="Wordmark matches blocks"
                checked={config.linkWordmarkColor}
                onChange={(linkWordmarkColor) => update({ linkWordmarkColor })}
              />
              {!config.linkWordmarkColor ? (
                <FillControl
                  label="Wordmark"
                  fill={config.wordmarkFill}
                  allowNone={false}
                  onChange={(wordmarkFill) => update({ wordmarkFill })}
                />
              ) : null}
            </>
          ) : null}
          <Button onClick={swapColours} className="w-full">
            Swap foreground and background
          </Button>
        </Section>

        <Section title="Shape">
          <Slider
            label="Mark padding"
            value={config.markPadding}
            min={0}
            max={0.35}
            step={0.005}
            format={percent}
            onChange={(markPadding) => update({ markPadding })}
            onReset={() => update({ markPadding: DEFAULT_CONFIG.markPadding })}
          />
          {hasTile ? (
            <Slider
              label="Tile corner radius"
              value={config.tileRadius}
              min={0}
              max={0.5}
              step={0.005}
              format={(value) => (value >= 0.5 ? "Circle" : percent(value))}
              onChange={(tileRadius) => update({ tileRadius })}
              onReset={() => update({ tileRadius: DEFAULT_CONFIG.tileRadius })}
            />
          ) : null}
          {config.layout !== "mark" && config.plate.kind !== "transparent" ? (
            <Slider
              label="Plate corner radius"
              value={config.plateRadius}
              min={0}
              max={0.5}
              step={0.005}
              format={percent}
              onChange={(plateRadius) => update({ plateRadius })}
              onReset={() =>
                update({ plateRadius: DEFAULT_CONFIG.plateRadius })
              }
            />
          ) : null}
          {config.layout !== "wordmark" ? (
            <>
              <Slider
                label="Block corner radius"
                value={config.blockRadius}
                min={0}
                max={0.5}
                step={0.005}
                format={percent}
                onChange={(blockRadius) => update({ blockRadius })}
                onReset={() =>
                  update({ blockRadius: DEFAULT_CONFIG.blockRadius })
                }
              />
              <Slider
                label="Block gap"
                value={config.blockGap}
                min={0}
                max={0.3}
                step={0.005}
                format={percent}
                onChange={(blockGap) => update({ blockGap })}
                onReset={() => update({ blockGap: DEFAULT_CONFIG.blockGap })}
              />
            </>
          ) : null}
          <Slider
            label="Canvas padding"
            value={config.canvasPadding}
            min={0}
            max={0.6}
            step={0.01}
            format={percent}
            onChange={(canvasPadding) => update({ canvasPadding })}
            onReset={() =>
              update({ canvasPadding: DEFAULT_CONFIG.canvasPadding })
            }
          />
        </Section>

        {hasWordmark ? (
          <Section title="Typography">
            <Field label="Weight" value={`Space Grotesk ${config.fontWeight}`}>
              <Segmented
                options={FONT_WEIGHTS.map((weight) => ({
                  value: weight,
                  label: String(weight),
                }))}
                value={config.fontWeight}
                onChange={(fontWeight) => update({ fontWeight })}
              />
            </Field>
            <Slider
              label="Cap height"
              value={config.wordmarkScale}
              min={0.2}
              max={1}
              step={0.01}
              format={percent}
              onChange={(wordmarkScale) => update({ wordmarkScale })}
              onReset={() =>
                update({ wordmarkScale: DEFAULT_CONFIG.wordmarkScale })
              }
            />
            <Slider
              label="Letter spacing"
              value={config.letterSpacing}
              min={-0.08}
              max={0.3}
              step={0.005}
              format={(value) =>
                `${value > 0 ? "+" : ""}${(value * 1000).toFixed(0)}`
              }
              onChange={(letterSpacing) => update({ letterSpacing })}
              onReset={() =>
                update({ letterSpacing: DEFAULT_CONFIG.letterSpacing })
              }
            />
            {config.layout !== "wordmark" ? (
              <Slider
                label="Lockup gap"
                value={config.lockupGap}
                min={0}
                max={1}
                step={0.01}
                format={percent}
                onChange={(lockupGap) => update({ lockupGap })}
                onReset={() => update({ lockupGap: DEFAULT_CONFIG.lockupGap })}
              />
            ) : null}
          </Section>
        ) : null}
      </div>
    </div>
  );
}
