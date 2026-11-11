import { ScrollRestoration, useLocation } from "react-router";
import { PageTransition } from "@/components/page-transition";
import { TabBar } from "@/components/tab-bar";
import { UpdatePrompt } from "@/components/update-prompt";
import { useVisualViewport } from "@/hooks/use-visual-viewport";
import { cn } from "@/lib/utils";

const tabPaths = new Set(["/", "/explore", "/profile"]);

export function AppShell() {
  const { pathname } = useLocation();
  const showTabs = tabPaths.has(pathname);
  useVisualViewport();

  return (
    <div
      data-app-shell
      className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-background print:block print:h-auto print:max-w-none"
    >
      <div
        className={
          showTabs
            ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))] print:pb-0"
            : "pb-safe print:pb-0"
        }
      >
        <PageTransition />
      </div>
      <div
        className={cn(
          "no-print fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-lg",
          showTabs ? "" : "pb-safe",
        )}
      >
        <UpdatePrompt />
        {showTabs ? <TabBar /> : null}
      </div>
      <ScrollRestoration />
    </div>
  );
}
