import { PageTransition } from "@/components/page-transition";
import { TabBar } from "@/components/tab-bar";

export function AppShell() {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-lg flex-col bg-background">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PageTransition />
      </div>
      <TabBar />
    </div>
  );
}
