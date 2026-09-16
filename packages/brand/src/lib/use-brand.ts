import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_CONFIG, type BrandConfig } from "@/brand/config";
import { loadFont, outlineText, type LoadedFont } from "@/brand/font";
import { MARK_HEIGHT, buildScene } from "@/brand/geometry";
import { renderSvg } from "@/brand/svg";

export function useBrand() {
  const [config, setConfig] = useState<BrandConfig>(DEFAULT_CONFIG);
  const [font, setFont] = useState<LoadedFont | null>(null);

  const update = useCallback(
    (patch: Partial<BrandConfig>) =>
      setConfig((current) => ({ ...current, ...patch })),
    []
  );

  useEffect(() => {
    let current = true;
    void loadFont(config.fontWeight).then((loaded) => {
      if (current) setFont(loaded);
    });
    return () => {
      current = false;
    };
  }, [config.fontWeight]);

  const text = useMemo(() => {
    if (!font) return null;
    const label = config.uppercase
      ? config.wordmark.toUpperCase()
      : config.wordmark;
    if (!label.trim()) return null;
    return outlineText(
      font,
      label,
      config.wordmarkScale * MARK_HEIGHT,
      config.letterSpacing
    );
  }, [
    font,
    config.wordmark,
    config.uppercase,
    config.wordmarkScale,
    config.letterSpacing,
  ]);

  const scene = useMemo(() => buildScene(config, text), [config, text]);
  const svg = useMemo(() => renderSvg(scene, config), [scene, config]);

  return {
    config,
    update,
    reset: useCallback(() => setConfig(DEFAULT_CONFIG), []),
    text,
    scene,
    svg,
    fontReady: font !== null && font.weight === config.fontWeight,
  };
}

export type Brand = ReturnType<typeof useBrand>;
