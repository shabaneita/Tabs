"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "sonner";
import { ServiceWorkerRegistrar } from "./sw-registrar";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="ournest-theme">
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          dir="rtl"
          position="top-center"
          offset={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
          mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
          toastOptions={{
            classNames: {
              toast: "!rounded-2xl !border !border-border !bg-card !text-foreground !shadow-card !font-sans",
              description: "!text-foreground-muted",
              actionButton: "!bg-primary !text-primary-foreground !rounded-lg",
            },
          }}
        />
        <ServiceWorkerRegistrar />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
