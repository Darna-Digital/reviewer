import * as Layer from "effect/Layer";
import {
  CloudService,
  CloudSettingsRepository,
  makeCloudService,
} from "@byconvo/core/cloud";
import { AgentAuthLive } from "./agent-auth.live.ts";
import { CloudApiLive } from "./cloud-api.live.ts";
import { makeSqliteCloudSettingsRepository } from "./cloud.repository.sqlite.ts";

export const CloudLive = Layer.effect(CloudService)(makeCloudService).pipe(
  Layer.provide(
    Layer.effect(CloudSettingsRepository)(makeSqliteCloudSettingsRepository)
  ),
  Layer.provide(CloudApiLive),
  Layer.provide(AgentAuthLive)
);
