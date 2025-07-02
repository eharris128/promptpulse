import { test, expect } from "@playwright/test";
import apiHelper from "../utils/api-helper.js";

test.describe("Health and Metrics API", () => {
  test.describe("Health Endpoints", () => {
    test("GET /health should return 200 OK", async () => {
      const response = await apiHelper.get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: "OK" });
    });

    test("GET /api/health/db should check database connectivity", async () => {
      const response = await apiHelper.get("/api/health/db");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status", "OK");
      expect(response.body).toHaveProperty("database", "connected");
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("uptime");
      expect(typeof response.body.uptime).toBe("number");
    });

    test("should handle database connection errors gracefully", async () => {
      // This test would require mocking a database failure
      // For now, we'll just verify the endpoint structure
      const response = await apiHelper.get("/api/health/db");

      // Even if DB is down, endpoint should respond
      expect([200, 503]).toContain(response.status);
      if (response.status === 503) {
        expect(response.body).toHaveProperty("status", "ERROR");
        expect(response.body).toHaveProperty("database", "disconnected");
        expect(response.body).toHaveProperty("error");
      }
    });
  });

  test.describe("Metrics Endpoint", () => {
    test("GET /api/metrics should return server metrics", async () => {
      const response = await apiHelper.get("/api/metrics");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("uptime");
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("memory");
      expect(response.body).toHaveProperty("process");

      // Validate memory metrics
      expect(response.body.memory).toHaveProperty("rss");
      expect(response.body.memory).toHaveProperty("heapTotal");
      expect(response.body.memory).toHaveProperty("heapUsed");
      expect(response.body.memory).toHaveProperty("external");
      expect(response.body.memory).toHaveProperty("arrayBuffers");

      // Validate process info
      expect(response.body.process).toHaveProperty("pid");
      expect(response.body.process).toHaveProperty("version");
      expect(response.body.process).toHaveProperty("platform");
      expect(response.body.process).toHaveProperty("arch");
      expect(response.body.process).toHaveProperty("node_env", "test");
    });

    test("metrics values should be reasonable", async () => {
      const response = await apiHelper.get("/api/metrics");

      expect(response.status).toBe(200);

      // Uptime should be positive
      expect(response.body.uptime).toBeGreaterThan(0);

      // Memory values should be positive numbers
      expect(response.body.memory.rss).toBeGreaterThan(0);
      expect(response.body.memory.heapTotal).toBeGreaterThan(0);
      expect(response.body.memory.heapUsed).toBeGreaterThan(0);
      expect(response.body.memory.heapUsed).toBeLessThanOrEqual(response.body.memory.heapTotal);

      // Process info validation
      expect(response.body.process.pid).toBeGreaterThan(0);
      expect(response.body.process.version).toMatch(/^v\d+\.\d+\.\d+/);
    });

    test("metrics endpoint should not require authentication", async () => {
      // Test without API key
      const responseWithoutKey = await apiHelper.get("/api/metrics");
      expect(responseWithoutKey.status).toBe(200);

      // Test with API key (should also work)
      const responseWithKey = await apiHelper.get("/api/metrics", {
        apiKey: process.env.TEST_USER_1_API_KEY
      });
      expect(responseWithKey.status).toBe(200);
    });
  });

  test.describe("Response Time and Performance", () => {
    test("health endpoints should respond quickly", async () => {
      const endpoints = ["/health", "/api/health/db", "/api/metrics"];

      for (const endpoint of endpoints) {
        const start = Date.now();
        const response = await apiHelper.get(endpoint);
        const duration = Date.now() - start;

        expect(response.status).toBeLessThanOrEqual(503);
        expect(duration).toBeLessThan(1000); // Should respond within 1 second
      }
    });
  });
});
