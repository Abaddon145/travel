import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ThemeSync } from "@/components/theme-sync";
import { Toaster } from "@/components/ui/sonner";
import { TravelErrorBoundary } from "@/components/travel-error-boundary";
import { createQueryClient } from "@/lib/query-client";
import { DatabaseProvider } from "@/providers/database-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      <Toaster position="top-center" />
      <DatabaseProvider>
        <TravelErrorBoundary>{children}</TravelErrorBoundary>
      </DatabaseProvider>
    </QueryClientProvider>
  );
}
