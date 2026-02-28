import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  applyLiquidGlassAttribute,
  getInitialLiquidGlassEnabled,
  setLiquidGlassPreference,
} from "@/lib/liquidGlassPreference";

interface AppearanceContextType {
  liquidGlassEnabled: boolean;
  setLiquidGlassEnabled: (enabled: boolean) => void;
}

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

export const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [liquidGlassEnabled, setLiquidGlassEnabled] = useState<boolean>(() => getInitialLiquidGlassEnabled());

  useEffect(() => {
    applyLiquidGlassAttribute(liquidGlassEnabled);
    setLiquidGlassPreference(liquidGlassEnabled);
  }, [liquidGlassEnabled]);

  const value = useMemo<AppearanceContextType>(
    () => ({
      liquidGlassEnabled,
      setLiquidGlassEnabled,
    }),
    [liquidGlassEnabled],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAppearance = () => {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error("useAppearance must be used within an AppearanceProvider");
  }
  return context;
};
