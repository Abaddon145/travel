import { useEffect } from "react";

export function syncVisualViewport() {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  if (!viewport) {
    root.style.setProperty("--vvh", "100dvh");
    root.style.setProperty("--vv-bottom", "0px");
    return;
  }
  const bottom = Math.max(0, window.innerHeight - viewport.offsetTop - viewport.height);
  root.style.setProperty("--vvh", `${viewport.height}px`);
  root.style.setProperty("--vv-bottom", `${bottom}px`);
}

export function useVisualViewport() {
  useEffect(() => {
    syncVisualViewport();
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", syncVisualViewport);
    viewport?.addEventListener("scroll", syncVisualViewport);
    window.addEventListener("resize", syncVisualViewport);
    return () => {
      viewport?.removeEventListener("resize", syncVisualViewport);
      viewport?.removeEventListener("scroll", syncVisualViewport);
      window.removeEventListener("resize", syncVisualViewport);
    };
  }, []);
}
