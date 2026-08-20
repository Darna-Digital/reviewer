export type FeatureFlagValue = "enabled" | "enabled-in-beta" | "disabled";

export type ReleaseChannel = "stable" | "beta";

const FEATURE_FLAGS = {
  "collaboration-button": "enabled",
  "sessions-button": "enabled",
} satisfies Record<string, FeatureFlagValue>;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

const RELEASE_CHANNEL: ReleaseChannel = "stable";

export const featureFlagValue = (flag: FeatureFlag): FeatureFlagValue =>
  FEATURE_FLAGS[flag];

export function isFeatureEnabled(
  flag: FeatureFlag,
  channel?: ReleaseChannel
): boolean {
  switch (featureFlagValue(flag)) {
    case "enabled":
      return true;
    case "enabled-in-beta":
      return (channel ?? RELEASE_CHANNEL) === "beta";
    case "disabled":
      return false;
  }
}
