import * as Schema from "effect/Schema";

/** Something asked for the cloud before the app was connected to it. */
export class CloudNotConnected extends Schema.TaggedErrorClass<CloudNotConnected>()(
  "CloudNotConnected",
  { reason: Schema.String },
  { httpApiStatus: 409 }
) {
  override get message(): string {
    return this.reason;
  }
}
