import type { Metadata } from "next";

import { SidebarInset, SidebarProvider } from "@nauta/ui/sidebar";
import { Toaster } from "@nauta/ui/sonner";

import { AppSidebar } from "~/components/app-sidebar";
import { ThemeProvider } from "~/components/theme-provider";
import { TRPCReactProvider } from "~/trpc/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nauta — Emails",
  description: "Inbound email viewer",
};

/**
 * Root app shell (D-20/D-21). The whole app renders inside a persistent frosted
 * left rail. Provider nesting preserves the original ordering — TRPCReactProvider
 * stays outermost over the UI tree, the Toaster stays a sibling of the shell —
 * while ThemeProvider (next-themes) + SidebarProvider wrap the content. `{children}`
 * paints in the SidebarInset content slot (the editor keeps its full-viewport canvas
 * inside this slot). `suppressHydrationWarning` is required by next-themes, which
 * writes the resolved theme class onto <html> after hydration.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <TRPCReactProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset>{children}</SidebarInset>
            </SidebarProvider>
          </ThemeProvider>
        </TRPCReactProvider>
        <Toaster />
      </body>
    </html>
  );
}
