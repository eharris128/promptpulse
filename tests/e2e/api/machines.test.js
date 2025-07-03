import { test, expect } from "@playwright/test";
import apiHelper from "../utils/api-helper.js";

test.describe("Machines API", () => {
  test.describe("GET /api/machines", () => {
    test("should return user machines", async () => {
      const response = await apiHelper.get("/api/machines", {
        bearerToken: process.env.TEST_USER_1_TOKEN
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("machines");
      expect(response.body.machines).toBeInstanceOf(Array);

      if (response.body.machines.length > 0) {
        const machine = response.body.machines[0];
        expect(machine).toHaveProperty("machine_id");
        expect(machine).toHaveProperty("total_sessions");
        expect(machine).toHaveProperty("total_blocks");
        expect(machine).toHaveProperty("total_cost");
        expect(machine).toHaveProperty("first_seen");
        expect(machine).toHaveProperty("last_seen");
      }
    });

    test("should require authentication", async () => {
      const response = await apiHelper.get("/api/machines");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Authentication required");
    });

    test("should isolate machines by user", async () => {
      const user1Response = await apiHelper.get("/api/machines", {
        bearerToken: process.env.TEST_USER_1_TOKEN
      });

      const user2Response = await apiHelper.get("/api/machines", {
        bearerToken: process.env.TEST_USER_2_TOKEN
      });

      expect(user1Response.status).toBe(200);
      expect(user2Response.status).toBe(200);

      // Each user should only see their own machines
      const user1Machines = user1Response.body.machines;
      const user2Machines = user2Response.body.machines;

      // If both users have machines, they should be different
      if (user1Machines.length > 0 && user2Machines.length > 0) {
        const user1MachineIds = user1Machines.map(m => m.machine_id);
        const user2MachineIds = user2Machines.map(m => m.machine_id);

        // No overlap expected in test environment
        const overlap = user1MachineIds.filter(id => user2MachineIds.includes(id));
        expect(overlap.length).toBe(0);
      }
    });

    test("should order machines by last_seen desc", async () => {
      const response = await apiHelper.get("/api/machines", {
        bearerToken: process.env.TEST_USER_1_TOKEN
      });

      expect(response.status).toBe(200);

      if (response.body.machines.length > 1) {
        const machines = response.body.machines;

        for (let i = 0; i < machines.length - 1; i++) {
          const current = new Date(machines[i].last_seen);
          const next = new Date(machines[i + 1].last_seen);
          expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
        }
      }
    });

    test("should include usage statistics", async () => {
      const response = await apiHelper.get("/api/machines", {
        bearerToken: process.env.TEST_USER_1_TOKEN
      });

      expect(response.status).toBe(200);

      if (response.body.machines.length > 0) {
        const machine = response.body.machines[0];

        // All numeric fields should be non-negative
        expect(machine.total_sessions).toBeGreaterThanOrEqual(0);
        expect(machine.total_blocks).toBeGreaterThanOrEqual(0);
        expect(machine.total_cost).toBeGreaterThanOrEqual(0);

        // Date fields should be valid dates
        expect(new Date(machine.first_seen).getTime()).not.toBeNaN();
        expect(new Date(machine.last_seen).getTime()).not.toBeNaN();

        // last_seen should be >= first_seen
        const firstSeen = new Date(machine.first_seen);
        const lastSeen = new Date(machine.last_seen);
        expect(lastSeen.getTime()).toBeGreaterThanOrEqual(firstSeen.getTime());
      }
    });
  });
});
