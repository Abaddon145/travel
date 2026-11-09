import { useEffect } from "react";
import { resolveDark, usePreferences } from "@/stores/preferences";

const LIGHT = "#f6f3ec";
const DARK = "#1c1916";

export function ThemeSync() {
  const theme = usePreferences((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const dark = resolveDark(theme, media.matches);
      root.classList.toggle("dark", dark);
      const color = dark ? DARK : LIGHT;
      document.querySelectorAll('meta[name="theme-color"]').forEach((node) => {
        node.setAttribute("content", color);
      });
    };

    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(display-mode: standalone)");
    const apply = () => {
      root.dataset.display = media.matches ? "standalone" : "browser";
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  return null;
}
