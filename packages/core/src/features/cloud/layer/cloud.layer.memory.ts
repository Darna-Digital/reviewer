import * as Layer from "effect/Layer";
import {
  memoryCloudApi,
  type MemoryCloudApiScript,
} from "../../../ports/cloud-api.ts";
import { CloudSettingsRepository } from "../repository/cloud.repository.ts";
import { makeMemoryCloudSettingsRepository } from "../repository/cloud.repository.memory.ts";
import type { StoredCloudConnection } from "../repository/cloud.repository.ts";
import { CloudService, makeCloudService } from "../service/cloud.service.ts";

/**
 * The cloud feature over a memory store and a scripted cloud. `calls` is what
 * the scripted cloud was asked, so a test can check the token it was handed.
 */
export const CloudMemory = (
  seed: StoredCloudConnection | null = null,
  script: MemoryCloudApiScript = {}
) => {
  const api = memoryCloudApi(script);
  const layer: Layer.Layer<CloudService> = Layer.effect(CloudService)(
    makeCloudService
  ).pipe(
    Layer.provide(
      Layer.effect(CloudSettingsRepository)(
        makeMemoryCloudSettingsRepository(seed)
      )
    ),
    Layer.provide(api.layer)
  );
  return { layer, calls: api.calls };
};
