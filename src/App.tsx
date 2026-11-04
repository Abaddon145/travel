import { MotionConfig } from "motion/react";
import { RouterProvider } from "react-router";
import { AppProviders } from "@/providers/app-providers";
import { router } from "@/router";

export default function App() {
  return (
    <AppProviders>
      <MotionConfig reducedMotion="user">
        <RouterProvider router={router} />
      </MotionConfig>
    </AppProviders>
  );
}
