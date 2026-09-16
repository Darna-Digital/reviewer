/**
 * The style panel of the visual-comment popover: the catalogue's groups, each
 * a stack of rows, opening on the element's computed values.
 *
 * Every change is an edit applied to the page as it happens — the field is the
 * control, the page is the preview — and a row that differs from what the
 * element started with says so and offers the way back. Nothing here knows how
 * the edit reaches the guest; it reports the property and the value and the
 * pane does the rest.
 */
import {
  IconBoxAlignBottom,
  IconBoxAlignLeft,
  IconBoxAlignRight,
  IconBoxAlignTop,
  IconChevronRight,
  IconLink,
  IconLinkOff,
  IconRestore,
} from "@tabler/icons-react";
import { useState, type ReactNode } from "react";
import { Disclosure } from "@/components/ui/disclosure";
import { cn } from "@/lib/utils";
import {
  rowProperties,
  STYLE_GROUPS,
  type ComputedStyles,
  type StyleEdits,
  type StyleProperty,
  type StyleRow,
} from "../functions/visual-style.functions";
import {
  ColorControl,
  FIELD_LABEL,
  FractionControl,
  LengthControl,
  SegmentControl,
  SelectControl,
} from "./style-controls";

const ROW =
  "grid min-h-6 grid-cols-[4rem_minmax(0,1fr)_1rem] items-center gap-2";

const SIDE_ICONS = [
  IconBoxAlignTop,
  IconBoxAlignRight,
  IconBoxAlignBottom,
  IconBoxAlignLeft,
] as const;

interface Editing {
  readonly value: (property: string) => string;
  readonly changed: (property: string) => boolean;
  readonly onEdit: (property: string, value: string) => void;
  readonly onReset: (property: string) => void;
}

export function StyleInspector({
  computed,
  edits,
  onEdit,
  onReset,
}: {
  computed: ComputedStyles;
  edits: StyleEdits;
  onEdit: (property: string, value: string) => void;
  onReset: (property: string) => void;
}) {
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setClosed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const editing: Editing = {
    value: (property) => edits[property] ?? computed[property] ?? "",
    changed: (property) => property in edits,
    onEdit,
    onReset,
  };

  return (
    <div className="flex flex-col">
      {STYLE_GROUPS.map((group) => {
        const changed = group.rows
          .flatMap(rowProperties)
          .filter((property) => property.name in edits).length;
        const isOpen = !closed.has(group.id);
        return (
          <section key={group.id} className="border-t border-frame-border">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggle(group.id)}
              className="flex h-7 w-full items-center gap-1 text-left text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground"
            >
              <IconChevronRight
                className={cn(
                  "size-3 transition-transform duration-150",
                  isOpen && "rotate-90"
                )}
              />
              <span className="flex-1">{group.label}</span>
              {changed > 0 && (
                <span className="rounded-full bg-elevate-strong px-1.5 font-mono text-[0.625rem] text-foreground normal-case">
                  {changed}
                </span>
              )}
            </button>
            <Disclosure open={isOpen}>
              <div className="flex flex-col gap-1.5 pb-2.5">
                {group.rows.map((row) => (
                  <InspectorRow
                    key={rowProperties(row)
                      .map((p) => p.name)
                      .join("+")}
                    row={row}
                    editing={editing}
                  />
                ))}
              </div>
            </Disclosure>
          </section>
        );
      })}
    </div>
  );
}

function InspectorRow({ row, editing }: { row: StyleRow; editing: Editing }) {
  const properties = rowProperties(row);
  const changed = properties.some((property) => editing.changed(property.name));
  const reset = () => {
    for (const property of properties) {
      if (editing.changed(property.name)) editing.onReset(property.name);
    }
  };
  const resetButton = changed ? (
    <button
      type="button"
      aria-label={`Reset ${properties.map((p) => p.name).join(", ")}`}
      title="Reset"
      onClick={reset}
      className="flex size-4 items-center justify-center rounded text-muted-foreground hover:text-foreground"
    >
      <IconRestore className="size-3" />
    </button>
  ) : (
    <span aria-hidden />
  );

  if (row.kind === "sides") {
    return (
      <SidesRow row={row} editing={editing}>
        {resetButton}
      </SidesRow>
    );
  }

  if (row.kind === "pair") {
    return (
      <div className={cn(ROW, "grid-cols-[minmax(0,1fr)_1rem]")}>
        <div className="grid grid-cols-2 gap-1.5">
          {row.properties.map((property) => (
            <Control
              key={property.name}
              property={property}
              editing={editing}
              inline
            />
          ))}
        </div>
        {resetButton}
      </div>
    );
  }

  return (
    <div className={ROW}>
      <Control property={row.property} editing={editing} />
      {resetButton}
    </div>
  );
}

/**
 * The four sides of a box, linked by default when they agree — one number for
 * all — and unlinked into top, right, bottom, left when they do not, or when
 * the link is broken by hand.
 */
function SidesRow({
  row,
  editing,
  children,
}: {
  row: Extract<StyleRow, { kind: "sides" }>;
  editing: Editing;
  children: ReactNode;
}) {
  const values = row.properties.map((property) => editing.value(property.name));
  const uniform = values.every((value) => value === values[0]);
  const [linked, setLinked] = useState(uniform);
  const [top] = row.properties;
  const setAll = (value: string) => {
    for (const property of row.properties) editing.onEdit(property.name, value);
  };
  return (
    <div className={ROW}>
      <span className={FIELD_LABEL} title={row.label}>
        {row.label}
      </span>
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          aria-pressed={linked}
          aria-label={
            linked ? "Edit sides separately" : "Edit all sides together"
          }
          title={linked ? "Unlink sides" : "Link sides"}
          onClick={() => setLinked((current) => !current)}
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md border border-transparent bg-input/50 text-muted-foreground hover:text-foreground",
            linked && "text-foreground"
          )}
        >
          {linked ? (
            <IconLink className="size-3.5" />
          ) : (
            <IconLinkOff className="size-3.5" />
          )}
        </button>
        {linked ? (
          <LengthControl
            property={row.label}
            value={values[0]}
            changed={row.properties.some((p) => editing.changed(p.name))}
            onEdit={setAll}
            spec={top.control.kind === "length" ? top.control : never()}
            prefix="all"
          />
        ) : (
          <div className="grid min-w-0 flex-1 grid-cols-4 gap-1">
            {row.properties.map((property, index) => {
              const Glyph = SIDE_ICONS[index];
              return (
                <LengthControl
                  key={property.name}
                  property={property.name}
                  value={editing.value(property.name)}
                  changed={editing.changed(property.name)}
                  onEdit={(value) => editing.onEdit(property.name, value)}
                  spec={
                    property.control.kind === "length"
                      ? property.control
                      : never()
                  }
                  prefix={<Glyph />}
                  compact
                />
              );
            })}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

const never = (): never => {
  throw new Error("a sides row is made of lengths");
};

function Control({
  property,
  editing,
  inline = false,
}: {
  property: StyleProperty;
  editing: Editing;
  inline?: boolean;
}) {
  const props = {
    property: property.name,
    value: editing.value(property.name),
    changed: editing.changed(property.name),
    onEdit: (value: string) => editing.onEdit(property.name, value),
  };
  const { control } = property;
  const label = (
    <span className={FIELD_LABEL} title={property.name}>
      {property.label}
    </span>
  );

  switch (control.kind) {
    case "length":
      return (
        <LengthControl
          {...props}
          spec={control}
          {...(inline ? { prefix: property.label } : { label: property.label })}
        />
      );
    case "fraction":
      return <FractionControl {...props} label={property.label} />;
    case "select":
      return inline ? (
        <SelectControl {...props} spec={control} prefix={property.label} />
      ) : (
        <>
          {label}
          <SelectControl {...props} spec={control} />
        </>
      );
    case "segment":
      return (
        <>
          {label}
          <SegmentControl {...props} spec={control} />
        </>
      );
    case "color":
      return (
        <>
          {label}
          <ColorControl {...props} />
        </>
      );
  }
}
