import * as Layer from "effect/Layer";
import { make, LocalTasksService } from "./local-tasks.service.ts";

export const LocalTasksLive = Layer.effect(LocalTasksService)(make);
