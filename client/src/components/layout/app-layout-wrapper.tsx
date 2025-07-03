"use client";

import { useAuth } from "@/contexts/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { AppLayout } from "./app-layout";
import { LoginForm } from "@/components/auth/login-form";
import { debugLogger } from "@/utils/debug-logger";
import { useEffect } from "react";

interface AppLayoutWrapperProps {
  children: React.ReactNode
}

export function AppLayoutWrapper({ children }: AppLayoutWrapperProps) {
  const { isAuthenticated, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    debugLogger.log("AppLayoutWrapper", "Component mounted", {
      pathname,
      isAuthenticated,
      loading
    });
  }, [pathname, isAuthenticated, loading]);

  useEffect(() => {
    debugLogger.log("AppLayoutWrapper", "Route changed", {
      pathname,
      timestamp: performance.now()
    });
  }, [pathname]);

  useEffect(() => {
    debugLogger.log("AppLayoutWrapper", "Auth state changed", {
      isAuthenticated,
      loading,
      timestamp: performance.now()
    });
  }, [isAuthenticated, loading]);

  // Routes that don't require authentication
  const publicRoutes = ["/teams/join/"];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // For public routes, render children directly without authentication check
  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <LoginForm />
      </div>
    );
  }

  return (
    <AppLayout onLogout={logout}>
      {children}
    </AppLayout>
  );
}
