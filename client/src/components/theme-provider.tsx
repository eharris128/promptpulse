"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Prevent hydration mismatch by only rendering after mount
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // For static export, always start with light theme to match server
  // and let client-side logic handle theme switching after mount
  if (!mounted) {
    return (
      <div className="light" style={{ colorScheme: 'light' }}>
        {children}
      </div>
    );
  }

  return (
    <NextThemesProvider 
      {...props}
      enableColorScheme={false} // Disable automatic color-scheme to prevent script injection
      enableSystem={true}
    >
      {children}
    </NextThemesProvider>
  );
}
