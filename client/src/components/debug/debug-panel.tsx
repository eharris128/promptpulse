"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { debugLogger } from "@/utils/debug-logger";
import { X, Bug, Download, Trash2 } from "lucide-react";

export function DebugPanel() {
  const [isVisible, setIsVisible] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        setLogs(debugLogger.getLogs());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  useEffect(() => {
    // Show debug panel by default on Railway
    const isRailway = typeof window !== "undefined" &&
      (window.location.hostname.includes("railway.app") ||
       window.location.hostname.includes("promptpulse.dev"));

    if (isRailway) {
      setIsVisible(true);
    }
  }, []);

  const refreshLogs = () => {
    setLogs(debugLogger.getLogs());
  };

  const clearLogs = () => {
    debugLogger.clearLogs();
    setLogs([]);
  };

  const downloadLogs = () => {
    const logData = {
      timestamp: new Date().toISOString(),
      environment: debugLogger.getEnvironmentInfo(),
      logs: debugLogger.getLogs()
    };

    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `debug-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getRouterInfo = () => {
    if (typeof window === "undefined") return {};

    return {
      pathname,
      href: window.location.href,
      search: window.location.search,
      hash: window.location.hash,
      referrer: document.referrer,
      userAgent: `${navigator.userAgent.substring(0, 100)  }...`
    };
  };

  const getPerformanceInfo = () => {
    if (typeof window === "undefined" || !window.performance) return {};

    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;

    return {
      loadComplete: navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0,
      domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart : 0,
      domInteractive: navigation ? navigation.domInteractive - navigation.fetchStart : 0,
      firstPaint: performance.getEntriesByName("first-paint")[0]?.startTime || 0,
      firstContentfulPaint: performance.getEntriesByName("first-contentful-paint")[0]?.startTime || 0
    };
  };

  // Toggle with keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setIsVisible(!isVisible);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible]);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-red-500 text-white p-2 rounded-full shadow-lg hover:bg-red-600 z-50"
        title="Show Debug Panel (Ctrl+Shift+D)"
      >
        <Bug size={20} />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Debug Panel</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={downloadLogs}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title="Download logs"
            >
              <Download size={18} />
            </button>
            <button
              onClick={clearLogs}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title="Clear logs"
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-auto max-h-[calc(90vh-200px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Router Info</h3>
              <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-x-auto">
                {JSON.stringify(getRouterInfo(), null, 2)}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Performance Info</h3>
              <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-x-auto">
                {JSON.stringify(getPerformanceInfo(), null, 2)}
              </pre>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Debug Logs ({logs.length})</h3>
            <div className="flex items-center space-x-2">
              <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                <span>Auto-refresh</span>
              </label>
              <button
                onClick={refreshLogs}
                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {logs.slice(-50).reverse().map((log, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-600 rounded p-2">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span className="font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    log.level === "error" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" :
                    log.level === "warn" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" :
                    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  }`}>
                    {log.level}
                  </span>
                </div>
                <div className="text-sm text-gray-900 dark:text-white">
                  <strong>[{log.category}]</strong> {log.message}
                </div>
                {log.data && (
                  <pre className="text-xs bg-gray-50 dark:bg-gray-700 p-2 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
