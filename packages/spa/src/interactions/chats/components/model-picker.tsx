/**
 * The composer's model picker — a popover with a provider rail on the left
 * (favorites first), a search box, and the model list with star toggles
 * (t3code's ProviderModelPicker, sized down to our catalog). Favorites persist
 * in ui-prefs.
 */
import {
  IconChevronDown,
  IconSearch,
  IconStar,
  IconStarFilled,
} from "@tabler/icons-react"
import { Fragment, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TruncatedRow } from "@/components/ui/truncated-text"
import type { ChatModelCatalog, ChatProviderKind } from "@byconvo/core/chats"
import {
  type CatalogModel,
  catalogModels,
} from "@/interactions/chats/functions/chat-model.functions"
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs"
import { cn } from "@/lib/utils"
import { ProviderIcon } from "./provider-icons"

const FAVORITES_RAIL = "favorites"

export function ModelPicker({
  catalog,
  model,
  onSelect,
}: {
  catalog: ChatModelCatalog | undefined
  model: string
  onSelect: (model: string, provider: ChatProviderKind) => void
}) {
  const [open, setOpen] = useState(false)
  const [rail, setRail] = useState<string>(FAVORITES_RAIL)
  const [search, setSearch] = useState("")
  const favorites = useUiPrefs().chatModelFavorites

  const allModels = useMemo(() => catalogModels(catalog), [catalog])
  const current = allModels.find((m) => m.id === model)

  const onFavorites = rail === FAVORITES_RAIL
  const railLabel = catalog?.providers.find((p) => p.id === rail)?.label
  const visible = useMemo(() => {
    const inRail = onFavorites
      ? allModels.filter((m) => favorites.includes(m.id))
      : allModels.filter((m) => m.provider === rail)
    // An empty favorites rail falls back to everything, so the picker never
    // opens onto a blank list. A provider rail must not: its models are
    // whatever that agent's CLI reported, and showing another agent's models
    // under it would offer a model this provider can't run.
    const base = onFavorites && inRail.length === 0 ? allModels : inRail
    const query = search.trim().toLowerCase()
    return query.length === 0
      ? base
      : base.filter((m) => m.label.toLowerCase().includes(query))
  }, [allModels, favorites, onFavorites, rail, search])

  const toggleFavorite = (id: string) => {
    setUiPrefs({
      chatModelFavorites: favorites.includes(id)
        ? favorites.filter((f) => f !== id)
        : [...favorites, id],
    })
  }

  const pick = (m: CatalogModel) => {
    onSelect(m.id, m.provider)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 px-2 text-xs font-medium"
            aria-label="Choose model"
          />
        }
      >
        <ProviderIcon
          provider={current?.provider ?? "claude"}
          className="size-3.5 text-muted-foreground"
        />
        <span className="max-w-40 truncate">
          {current?.label ?? (model.length > 0 ? model : "Model")}
        </span>
        <IconChevronDown className="size-3 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-96 gap-0 rounded-2xl p-0"
      >
        <div className="flex">
          {/* Provider rail */}
          <div className="flex flex-col items-center gap-1 border-r p-2">
            <button
              type="button"
              aria-label="Favorites"
              onClick={() => setRail(FAVORITES_RAIL)}
              className={cn(
                "flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted",
                rail === FAVORITES_RAIL && "bg-muted text-foreground"
              )}
            >
              <IconStarFilled className="size-4.5" />
            </button>
            {(catalog?.providers ?? []).map((p) => (
              <button
                key={p.id}
                type="button"
                aria-label={p.label}
                title={p.label}
                onClick={() => setRail(p.id)}
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted",
                  rail === p.id && "bg-muted text-foreground"
                )}
              >
                <ProviderIcon provider={p.id} className="size-4.5" />
              </button>
            ))}
          </div>
          {/* Search + model list */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b px-2.5 py-2">
              <IconSearch className="size-4 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <ScrollArea
              className="max-h-80"
              viewportClassName="scroll-fade p-1"
            >
              {visible.length === 0 && (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  {search.trim().length > 0
                    ? "No models match."
                    : onFavorites
                      ? "No models available."
                      : // Models are read from each agent's own CLI, so an
                        // empty provider means that CLI didn't answer.
                        `No models reported by ${railLabel ?? "this agent"} — is its CLI installed?`}
                </p>
              )}
              {visible.map((m, index) => {
                const starred = favorites.includes(m.id)
                // An agent that brokers other vendors' models (opencode) sends
                // them grouped; head each run so a long rail stays readable.
                const startsGroup =
                  m.group !== undefined && m.group !== visible[index - 1]?.group
                return (
                  <Fragment key={`${m.provider}:${m.id}`}>
                    {startsGroup && (
                      <div className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                        {m.group}
                      </div>
                    )}
                    <TruncatedRow
                      render={
                        <div
                          className={cn(
                            "group/model flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted",
                            m.id === model && "bg-muted/60"
                          )}
                          onClick={() => pick(m)}
                        />
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <span className="truncate">{m.label}</span>
                          {m.id === model && (
                            <span className="text-primary">✓</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <ProviderIcon
                            provider={m.provider}
                            className="size-3"
                          />
                          {m.providerLabel}
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={starred ? "Unstar model" : "Star model"}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleFavorite(m.id)
                        }}
                        className={cn(
                          "text-muted-foreground opacity-0 transition-opacity group-hover/model:opacity-100 hover:text-foreground",
                          starred && "opacity-100"
                        )}
                      >
                        {starred ? (
                          <IconStarFilled className="size-3.5 text-amber-400" />
                        ) : (
                          <IconStar className="size-3.5" />
                        )}
                      </button>
                    </TruncatedRow>
                  </Fragment>
                )
              })}
            </ScrollArea>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
