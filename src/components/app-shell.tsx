import { useLocation } from "react-router";
import { PageTransition } from "@/components/page-transition";
import { TabBar } from "@/components/tab-bar";

const tabPaths = new Set(["/", "/explore", "/profile"]);

export function AppShell() {
  const { pathname } = useLocation();
  const showTabs = tabPaths.has(pathname);

  return (
    <div className="mx-auto flex h-dvh w-full max-w-lg flex-col bg-background">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PageTransition />
      </div>
      {showTabs ? <TabBar /> : null}
    </div>
  );
}
