"use client";

import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  isAuthenticated: boolean
  loading: boolean
  login: () => void
  logout: () => void
  user: any
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState(null);
  // Always start with loading true for consistent hydration
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Handle pending team invites after authentication
  const handlePendingTeamInvite = () => {
    // Don't redirect if we're already on a join page to prevent loops
    if (pathname && pathname.startsWith("/teams/join/")) {
      return;
    }

    const pendingInvite = sessionStorage.getItem("pendingTeamInvite");
    if (pendingInvite) {
      sessionStorage.removeItem("pendingTeamInvite");
      router.push(`/teams/join/${pendingInvite}`);
    }
  };

  // Custom function to fetch user profile from Express server
  const fetchUserProfile = async (isBackgroundPoll = false) => {
    const wasAuthenticated = !!user;

    // During static generation (build time), skip authentication
    if (typeof window === "undefined") {
      setLoading(false);
      setUser(null);
      return;
    }

    try {
      // Only show loading spinner for initial auth check, not background polling
      if (!isBackgroundPoll) {
        setLoading(true);
      }

      const response = await fetch("/auth/profile", {
        credentials: "include" // Include cookies for session
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);

        // If user just became authenticated, check for pending invites
        if (!wasAuthenticated && userData) {
          setTimeout(handlePendingTeamInvite, 100); // Small delay to ensure router is ready
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      setUser(null);
    } finally {
      // Only clear loading spinner if we set it
      if (!isBackgroundPoll) {
        setLoading(false);
      }
    }
  };

  // Check authentication status on mount and periodically
  useEffect(() => {
    fetchUserProfile();

    // Check auth status every 30 seconds to handle session expiration
    // Use background polling to avoid showing loading spinners
    const interval = setInterval(() => fetchUserProfile(true), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = () => {
    // Redirect to Express server login endpoint
    window.location.href = "/auth/login";
  };

  const logout = () => {
    // Redirect to Express server logout endpoint
    window.location.href = "/auth/logout";
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      loading,
      login,
      logout,
      user
    }}>
      {children}
    </AuthContext.Provider>
  );
}
