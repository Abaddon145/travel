import { useLocation } from "react-router";
import { OfflineBanner } from "@/components/offline-banner";
import { PageTransition } from "@/components/page-transition";
import { TabBar } from "@/components/tab-bar";
import { UpdatePrompt } from "@/components/update-prompt";

const tabPaths = new Set(["/", "/explore", "/profile"]);

export function AppShell() {
  const { pathname } = useLocation();
  const showTabs = tabPaths.has(pathname);

  return (
    <div
      data-app-shell
      className="mx-auto flex h-dvh w-full max-w-lg flex-col bg-background print:block print:h-auto print:max-w-none print:overflow-visible"
    >
      <OfflineBanner />
      <div
        data-app-scroll
        tabIndex={0}
        aria-label="页面内容"
        className="min-h-0 flex-1 overflow-y-auto outline-none focus-visible:ring-3 focus-visible:ring-ring/50 print:overflow-visible"
      >
        <PageTransition />
      </div>
      <UpdatePrompt />
      {showTabs ? <TabBar /> : null}
    </div>
  );
}
