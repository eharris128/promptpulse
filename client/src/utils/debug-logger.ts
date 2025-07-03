class DebugLogger {
  private logs: Array<{
    timestamp: number;
    level: string;
    category: string;
    message: string;
    data?: any;
  }> = [];

  private isProduction = process.env.NODE_ENV === "production";
  private isRailway = typeof window !== "undefined" &&
    (window.location.hostname.includes("railway.app") ||
     window.location.hostname.includes("promptpulse.dev"));

  log(category: string, message: string, data?: any) {
    const entry = {
      timestamp: Date.now(),
      level: "info",
      category,
      message,
      data
    };

    this.logs.push(entry);

    // Always log in development or if Railway
    if (!this.isProduction || this.isRailway) {
      console.log(`[${category}] ${message}`, data || "");
    }

    // Keep only last 100 entries
    if (this.logs.length > 100) {
      this.logs.shift();
    }
  }

  error(category: string, message: string, error?: any) {
    const entry = {
      timestamp: Date.now(),
      level: "error",
      category,
      message,
      data: error
    };

    this.logs.push(entry);
    console.error(`[${category}] ${message}`, error || "");
  }

  warn(category: string, message: string, data?: any) {
    const entry = {
      timestamp: Date.now(),
      level: "warn",
      category,
      message,
      data
    };

    this.logs.push(entry);
    console.warn(`[${category}] ${message}`, data || "");
  }

  getLogs() {
    return [...this.logs];
  }

  getEnvironmentInfo() {
    if (typeof window === "undefined") return {};

    return {
      hostname: window.location.hostname,
      pathname: window.location.pathname,
      userAgent: navigator.userAgent,
      isRailway: this.isRailway,
      isProduction: this.isProduction,
      timestamp: Date.now(),
      connectionType: (navigator as any).connection?.effectiveType || "unknown",
      downlink: (navigator as any).connection?.downlink || "unknown",
      rtt: (navigator as any).connection?.rtt || "unknown"
    };
  }

  async measureNetworkLatency(url: string = window.location.origin) {
    const start = performance.now();

    try {
      const response = await fetch(`${url  }/favicon.ico`, {
        method: "HEAD",
        cache: "no-cache"
      });

      const end = performance.now();
      const latency = end - start;

      this.log("NetworkLatency", "Latency measurement", {
        url,
        latency,
        status: response.status,
        timestamp: end
      });

      return latency;
    } catch (error) {
      const end = performance.now();
      const latency = end - start;

      this.error("NetworkLatency", "Latency measurement failed", {
        url,
        latency,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: end
      });

      return latency;
    }
  }

  startNetworkMonitoring() {
    if (typeof window === "undefined") return;

    // Monitor network changes
    if ((navigator as any).connection) {
      (navigator as any).connection.addEventListener("change", () => {
        this.log("NetworkMonitoring", "Network connection changed", {
          effectiveType: (navigator as any).connection.effectiveType,
          downlink: (navigator as any).connection.downlink,
          rtt: (navigator as any).connection.rtt,
          timestamp: performance.now()
        });
      });
    }

    // Monitor online/offline
    window.addEventListener("online", () => {
      this.log("NetworkMonitoring", "Went online", { timestamp: performance.now() });
    });

    window.addEventListener("offline", () => {
      this.log("NetworkMonitoring", "Went offline", { timestamp: performance.now() });
    });

    // Initial latency measurement
    setTimeout(() => {
      this.measureNetworkLatency();
    }, 1000);

    // Periodic latency measurements
    setInterval(() => {
      this.measureNetworkLatency();
    }, 30000); // Every 30 seconds
  }

  clearLogs() {
    this.logs = [];
  }
}

export const debugLogger = new DebugLogger();
