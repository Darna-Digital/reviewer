import type { ChatModelCatalog, ChatProviderKind } from "@byconvo/core/chats"

export interface CatalogModel {
  readonly id: string
  readonly label: string
  readonly provider: ChatProviderKind
  readonly providerLabel: string
  /** The upstream vendor, for agents that broker other people's models. */
  readonly group: string | undefined
}

export const catalogModels = (
  catalog: ChatModelCatalog | undefined
): CatalogModel[] =>
  (catalog?.providers ?? []).flatMap((provider) =>
    provider.models.map((model) => ({
      id: model.id,
      label: model.label,
      provider: provider.id,
      providerLabel: provider.label,
      group: model.group,
    }))
  )

/**
 * The model a fresh composer starts on: the first favorite in catalog order —
 * the one at the top of the picker's favorites rail — else the first model.
 */
export const preferredChatModel = (
  catalog: ChatModelCatalog | undefined,
  favorites: ReadonlyArray<string>
): CatalogModel | undefined => {
  const models = catalogModels(catalog)
  return models.find((model) => favorites.includes(model.id)) ?? models[0]
}
