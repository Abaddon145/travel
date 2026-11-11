import { lazy, Suspense, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const BudgetPage = lazy(() =>
  import("@/pages/budget-page").then((module) => ({ default: module.BudgetPage })),
);
const BookingsPage = lazy(() =>
  import("@/pages/bookings-page").then((module) => ({ default: module.BookingsPage })),
);
const KitPage = lazy(() => import("@/pages/kit-page").then((module) => ({ default: module.KitPage })));
const GuidePage = lazy(() =>
  import("@/pages/guide-page").then((module) => ({ default: module.GuidePage })),
);

function RouteFallback() {
  return (
    <div className="flex flex-col gap-4 px-4 py-6" aria-busy="true">
      <p className="sr-only">正在打开</p>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}

function defer(page: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{page}</Suspense>;
}

export function BudgetRoute() {
  return defer(<BudgetPage />);
}

export function BookingsRoute() {
  return defer(<BookingsPage />);
}

export function KitRoute() {
  return defer(<KitPage />);
}

export function GuideRoute() {
  return defer(<GuidePage />);
}
