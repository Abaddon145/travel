import { createBrowserRouter, type RouteObject } from "react-router";
import { AppShell } from "@/components/app-shell";
import { BookingsRoute, BudgetRoute, GuideRoute, KitRoute } from "@/lazy-pages";
import { ExplorePage } from "@/pages/explore-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { PlanPage } from "@/pages/plan-page";
import { ProfilePage } from "@/pages/profile-page";
import { TripDetailPage } from "@/pages/trip-detail-page";
import { TripsPage } from "@/pages/trips-page";

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <TripsPage /> },
      { path: "plan", element: <PlanPage /> },
      { path: "trips/:tripId", element: <TripDetailPage /> },
      { path: "trips/:tripId/budget", element: <BudgetRoute /> },
      { path: "trips/:tripId/bookings", element: <BookingsRoute /> },
      { path: "trips/:tripId/kit", element: <KitRoute /> },
      { path: "trips/:tripId/guide", element: <GuideRoute /> },
      { path: "explore", element: <ExplorePage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);
