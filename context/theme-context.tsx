import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

type ThemeMode = "light" | "dark";

export const DARK_COLORS = {
  background: "#09182d",
  surface: "#13243a",
  card: "#102440",
  cardSoft: "#0f223b",
  surfaceDark: "#102036",
  surfaceLight: "#172b44",
  border: "rgba(255,255,255,0.07)",
  divider: "rgba(255,255,255,0.06)",
  text: "#f8fafc",
  muted: "#aebbd0",
  mutedDark: "#74849a",
  primary: "#3268f7",
  blue: "#4a90ff",
  primarySoft: "#4f8cff",
  input: "#0f1f34",
  danger: "#ef4444",
  error: "#f87171",
  success: "#34d399",
  warning: "#facc15",
  green: "#00d56f",
  greenSoft: "rgba(0, 213, 111, 0.16)",
  red: "#ff5d6c",
  redSoft: "rgba(255, 93, 108, 0.18)",
  yellow: "#ffd400",
  star: "#f59e0b",
  starEmpty: "rgba(245,158,11,0.25)",
};

export const LIGHT_COLORS = {
  background: "#f4f7fb",
  surface: "#ffffff",
  card: "#ffffff",
  cardSoft: "#f8fafc",
  surfaceDark: "#eef2f7",
  surfaceLight: "#e8eef6",
  border: "rgba(15,23,42,0.10)",
  divider: "rgba(15,23,42,0.08)",
  text: "#0f172a",
  muted: "#475569",
  mutedDark: "#64748b",
  primary: "#3268f7",
  blue: "#2563eb",
  primarySoft: "#2563eb",
  input: "#f1f5f9",
  danger: "#ef4444",
  error: "#dc2626",
  success: "#16a34a",
  warning: "#ca8a04",
  green: "#16a34a",
  greenSoft: "rgba(22,163,74,0.12)",
  red: "#dc2626",
  redSoft: "rgba(220,38,38,0.10)",
  yellow: "#ca8a04",
  star: "#f59e0b",
  starEmpty: "rgba(245,158,11,0.25)",
};

export type AppColors = typeof DARK_COLORS;

type AppThemeContextType = {
  themeMode: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
};

const AppThemeContext = createContext<AppThemeContextType | undefined>(
  undefined
);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = await AsyncStorage.getItem("app_theme");

      if (savedTheme === "dark" || savedTheme === "light") {
        setThemeModeState(savedTheme);
      }
    };

    loadTheme();
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await AsyncStorage.setItem("app_theme", mode);
  };

  const toggleTheme = () => {
    setThemeMode(themeMode === "dark" ? "light" : "dark");
  };

  return (
    <AppThemeContext.Provider
      value={{
        themeMode,
        isDark: themeMode === "dark",
        toggleTheme,
        setThemeMode,
      }}
    >
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);

  if (!context) {
    throw new Error("useAppTheme must be used inside AppThemeProvider");
  }

  return context;
}

export function useThemeColors() {
  const { isDark } = useAppTheme();
  return isDark ? DARK_COLORS : LIGHT_COLORS;
}
