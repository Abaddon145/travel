import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { usePreferences } from "@/stores/preferences";

export function Toaster({ ...props }: ToasterProps) {
  const theme = usePreferences((state) => state.theme);

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      offset="calc(env(safe-area-inset-top) + 12px)"
      mobileOffset="calc(env(safe-area-inset-top) + 12px)"
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      {...props}
    />
  );
}
