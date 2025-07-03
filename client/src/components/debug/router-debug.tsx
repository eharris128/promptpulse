"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { debugLogger } from "@/utils/debug-logger";

export function RouterDebug() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Log initial router state
    debugLogger.log("RouterDebug", "Router initialized", {
      pathname,
      href: window.location.href,
      timestamp: performance.now()
    });

    // Override router.push to add logging
    const originalPush = router.push;
    const originalReplace = router.replace;
    const originalBack = router.back;
    const originalForward = router.forward;

    router.push = function(href: string, options?: any) {
      debugLogger.log("RouterDebug", "router.push() called", {
        href,
        options,
        currentPathname: pathname,
        timestamp: performance.now()
      });

      // Add a timeout to check if navigation actually happened
      setTimeout(() => {
        debugLogger.log("RouterDebug", "router.push() result check", {
          href,
          actualPathname: window.location.pathname,
          success: window.location.pathname === href || window.location.pathname.startsWith(href),
          timestamp: performance.now()
        });
      }, 100);

      return originalPush.call(this, href, options);
    };

    router.replace = function(href: string, options?: any) {
      debugLogger.log("RouterDebug", "router.replace() called", {
        href,
        options,
        currentPathname: pathname,
        timestamp: performance.now()
      });
      return originalReplace.call(this, href, options);
    };

    router.back = function() {
      debugLogger.log("RouterDebug", "router.back() called", {
        currentPathname: pathname,
        timestamp: performance.now()
      });
      return originalBack.call(this);
    };

    router.forward = function() {
      debugLogger.log("RouterDebug", "router.forward() called", {
        currentPathname: pathname,
        timestamp: performance.now()
      });
      return originalForward.call(this);
    };

    // Listen for popstate events (back/forward button)
    const handlePopState = (event: PopStateEvent) => {
      debugLogger.log("RouterDebug", "popstate event", {
        state: event.state,
        pathname: window.location.pathname,
        timestamp: performance.now()
      });
    };

    window.addEventListener("popstate", handlePopState);

    // Listen for hashchange events
    const handleHashChange = (event: HashChangeEvent) => {
      debugLogger.log("RouterDebug", "hashchange event", {
        oldURL: event.oldURL,
        newURL: event.newURL,
        timestamp: performance.now()
      });
    };

    window.addEventListener("hashchange", handleHashChange);

    // Listen for beforeunload (when leaving the page)
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      debugLogger.log("RouterDebug", "beforeunload event", {
        pathname: window.location.pathname,
        timestamp: performance.now()
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);

      // Restore original methods
      router.push = originalPush;
      router.replace = originalReplace;
      router.back = originalBack;
      router.forward = originalForward;
    };
  }, []);

  useEffect(() => {
    debugLogger.log("RouterDebug", "Pathname changed via useEffect", {
      pathname,
      href: window.location.href,
      timestamp: performance.now()
    });
  }, [pathname]);

  return null;
}
