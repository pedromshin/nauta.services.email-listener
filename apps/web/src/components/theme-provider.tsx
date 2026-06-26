"use client";

import type { ComponentProps, ReactElement } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

type ThemeProviderProps = ComponentProps<typeof NextThemesProvider>;

/**
 * next-themes wrapper (D-21). Wired into the root layout in 09-06 with
 * `attribute="class" defaultTheme="system" enableSystem` so the glassy
 * light/dark surfaces resolve against the existing :root / .dark token sets.
 */
export function ThemeProvider({
  children,
  ...props
}: ThemeProviderProps): ReactElement {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
