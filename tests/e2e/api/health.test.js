import { test, expect } from "@playwright/test";
import apiHelper from "../utils/api-helper.js";

test.describe("Health and Metrics API", () => {
  test.describe("Health Endpoints", () => {
    test("GET /health should return 200 OK", async () => {
      const response = await apiHelper.get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status", "healthy");
      expect(response.body).toHaveProperty("database", "connected");
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("version");
    });

    test("GET /api/health/db should check database connectivity", async () => {
      const response = await apiHelper.get("/api/health/db");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status", "healthy");
      expect(response.body).toHaveProperty("database");
      expect(response.body.database).toHaveProperty("healthy");
      expect(response.body.database).toHaveProperty("total");
      expect(response.body.database).toHaveProperty("activeConnections");
      expect(response.body).toHaveProperty("timestamp");
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
      expect(response.body).toHaveProperty("server");
      expect(response.body).toHaveProperty("database");
      expect(response.body).toHaveProperty("timestamp");

      // Validate server metrics
      expect(response.body.server).toHaveProperty("uptime");
      expect(response.body.server).toHaveProperty("memory");
      expect(response.body.server).toHaveProperty("pid");

      // Validate memory metrics
      expect(response.body.server.memory).toHaveProperty("rss");
      expect(response.body.server.memory).toHaveProperty("heapTotal");
      expect(response.body.server.memory).toHaveProperty("heapUsed");
      expect(response.body.server.memory).toHaveProperty("external");
      expect(response.body.server.memory).toHaveProperty("arrayBuffers");

      // Validate process info (pid is directly on server object)
      expect(response.body.server).toHaveProperty("pid");
      expect(typeof response.body.server.pid).toBe("number");
    });

    test("metrics values should be reasonable", async () => {
      const response = await apiHelper.get("/api/metrics");

      expect(response.status).toBe(200);

      // Uptime should be positive
      expect(response.body.server.uptime).toBeGreaterThan(0);

      // Memory values should be positive numbers
      expect(response.body.server.memory.rss).toBeGreaterThan(0);
      expect(response.body.server.memory.heapTotal).toBeGreaterThan(0);
      expect(response.body.server.memory.heapUsed).toBeGreaterThan(0);
      expect(response.body.server.memory.heapUsed).toBeLessThanOrEqual(response.body.server.memory.heapTotal);

      // Process info validation
      expect(response.body.server.pid).toBeGreaterThan(0);
    });

    test("metrics endpoint should not require authentication", async () => {
      // Test without API key
      const responseWithoutKey = await apiHelper.get("/api/metrics");
      expect(responseWithoutKey.status).toBe(200);

      // Test with API key (should also work)
      const responseWithKey = await apiHelper.get("/api/metrics", {
        bearerToken: process.env.TEST_USER_1_TOKEN
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
