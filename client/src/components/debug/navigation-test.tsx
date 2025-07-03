"use client";

import { useRouter, usePathname } from "next/navigation";
import { debugLogger } from "@/utils/debug-logger";
import { useState } from "react";

export function NavigationTest() {
  const router = useRouter();
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);

  const testNavigation = async (href: string, method: "push" | "replace" | "window" | "production") => {
    const startTime = performance.now();

    debugLogger.log("NavigationTest", `Testing navigation to ${href} via ${method}`, {
      href,
      method,
      currentPathname: pathname,
      startTime
    });

    try {
      switch (method) {
        case "push":
          router.push(href);
          break;
        case "replace":
          router.replace(href);
          break;
        case "window":
          window.location.href = href;
          break;
        case "production":
          // Same logic as production SideNav
          if (href !== pathname) {
            debugLogger.log("NavigationTest", "Using production navigation method", { href });
            window.location.href = href;
          }
          break;
      }

      // Check if navigation worked after a delay
      setTimeout(() => {
        const endTime = performance.now();
        const success = window.location.pathname === href || window.location.pathname.startsWith(href);

        debugLogger.log("NavigationTest", `Navigation result for ${href} via ${method}`, {
          href,
          method,
          success,
          actualPath: window.location.pathname,
          duration: endTime - startTime,
          endTime
        });
      }, 500);

    } catch (error) {
      const endTime = performance.now();
      debugLogger.error("NavigationTest", `Navigation failed for ${href} via ${method}`, {
        href,
        method,
        error: error instanceof Error ? error.message : "Unknown error",
        duration: endTime - startTime,
        endTime
      });
    }
  };

  // Only show on Railway for debugging
  const isRailway = typeof window !== "undefined" &&
    (window.location.hostname.includes("railway.app") ||
     window.location.hostname.includes("promptpulse.dev"));

  if (!isRailway) return null;

  return (
    <div className="fixed top-4 right-4 z-40">
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600"
      >
        Nav Test
      </button>

      {isVisible && (
        <div className="absolute top-8 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-4 shadow-lg min-w-[200px]">
          <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">Navigation Test</h4>
          <div className="space-y-2">
            <button
              onClick={() => testNavigation("/", "push")}
              className="block w-full text-left px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm hover:bg-blue-200 dark:hover:bg-blue-800"
            >
              Dashboard (push)
            </button>
            <button
              onClick={() => testNavigation("/sessions", "push")}
              className="block w-full text-left px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm hover:bg-blue-200 dark:hover:bg-blue-800"
            >
              Sessions (push)
            </button>
            <button
              onClick={() => testNavigation("/leaderboard", "push")}
              className="block w-full text-left px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm hover:bg-blue-200 dark:hover:bg-blue-800"
            >
              Leaderboard (push)
            </button>
            <button
              onClick={() => testNavigation("/sessions", "window")}
              className="block w-full text-left px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded text-sm hover:bg-red-200 dark:hover:bg-red-800"
            >
              Sessions (window.location)
            </button>
            <button
              onClick={() => testNavigation("/sessions", "production")}
              className="block w-full text-left px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-sm hover:bg-green-200 dark:hover:bg-green-800"
            >
              Sessions (production method)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
