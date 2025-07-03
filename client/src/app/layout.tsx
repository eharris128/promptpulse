"use client";

import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/auth-context";
import { AppLayoutWrapper } from "@/components/layout/app-layout-wrapper";
import { DebugPanel } from "@/components/debug/debug-panel";
import { RouterDebug } from "@/components/debug/router-debug";
import { NavigationTest } from "@/components/debug/navigation-test";
import { debugLogger } from "@/utils/debug-logger";
import { useEffect } from "react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    debugLogger.log("RootLayout", "Layout mounted", debugLogger.getEnvironmentInfo());

    // Start network monitoring
    debugLogger.startNetworkMonitoring();

    // Log hydration timing
    const hydrationStart = performance.now();
    debugLogger.log("RootLayout", "Hydration start", { timestamp: hydrationStart });

    const checkHydration = () => {
      const hydrationEnd = performance.now();
      debugLogger.log("RootLayout", "Hydration complete", {
        duration: hydrationEnd - hydrationStart,
        timestamp: hydrationEnd
      });
    };

    // Use setTimeout to ensure hydration is complete
    setTimeout(checkHydration, 0);

    // Also listen for DOMContentLoaded
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        debugLogger.log("RootLayout", "DOMContentLoaded", { timestamp: performance.now() });
      });
    } else {
      debugLogger.log("RootLayout", "DOM already loaded", { timestamp: performance.now() });
    }

    // Log page visibility changes
    document.addEventListener("visibilitychange", () => {
      debugLogger.log("RootLayout", "Visibility changed", {
        hidden: document.hidden,
        timestamp: performance.now()
      });
    });

  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>PromptPulse Dashboard</title>
        <meta name="description" content="Track and analyze your Claude Code usage across multiple machines" />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <AppLayoutWrapper>
              {children}
            </AppLayoutWrapper>
            <RouterDebug />
          </AuthProvider>
          <NavigationTest />
          <DebugPanel />
        </ThemeProvider>
      </body>
    </html>
  );
}
