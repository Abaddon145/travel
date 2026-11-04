import { createBrowserRouter, type RouteObject } from "react-router";
import { AppShell } from "@/components/app-shell";
import { ExplorePage } from "@/pages/explore-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { ProfilePage } from "@/pages/profile-page";
import { TripsPage } from "@/pages/trips-page";

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <TripsPage /> },
      { path: "explore", element: <ExplorePage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);
