import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";

if (!("storage" in navigator)) {
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: {
      persist: async () => true,
      persisted: async () => false,
    },
  });
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});
