import { safeStorage } from "@/lib/safeStorage";

const LIQUID_GLASS_STORAGE_KEY = "learnpath_liquid_glass";

const normalizeLiquidGlassPreference = (value: string | null): boolean => {
  if (value === "off" || value === "false" || value === "0") return false;
  if (value === "on" || value === "true" || value === "1") return true;
  return true;
};

export const getInitialLiquidGlassEnabled = (): boolean =>
  normalizeLiquidGlassPreference(safeStorage.getItem(LIQUID_GLASS_STORAGE_KEY));

export const setLiquidGlassPreference = (enabled: boolean): void => {
  safeStorage.setItem(LIQUID_GLASS_STORAGE_KEY, enabled ? "on" : "off");
};

export const applyLiquidGlassAttribute = (enabled: boolean): void => {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-liquid-glass", enabled ? "on" : "off");
};
