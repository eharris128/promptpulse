import { test, expect } from "@playwright/test";
import apiHelper from "../utils/api-helper.js";

test.describe("Teams Management API", () => {
  let createdTeamId;
  let inviteCode;

  test.describe("POST /api/teams - Create Team", () => {
    test("should create a new team", async () => {
      const teamData = {
        name: `Test Team ${Date.now()}`,
        description: "E2E Test Team Description"
      };

      const response = await apiHelper.post("/api/teams", {
        apiKey: process.env.TEST_USER_1_API_KEY,
        data: teamData
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("team");
      expect(response.body.team).toMatchObject({
        name: teamData.name,
        description: teamData.description
      });
      expect(response.body.team).toHaveProperty("id");
      expect(response.body.team).toHaveProperty("invite_code");
      expect(response.body.team).toHaveProperty("created_at");

      // Store for use in other tests
      createdTeamId = response.body.team.id;
      inviteCode = response.body.team.invite_code;
    });

    test("should validate required fields", async () => {
      const response = await apiHelper.post("/api/teams", {
        apiKey: process.env.TEST_USER_1_API_KEY,
        data: { description: "No name provided" }
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    test("should require authentication", async () => {
      const response = await apiHelper.post("/api/teams", {
        data: { name: "Test Team" }
      });

      expect(response.status).toBe(401);
    });
  });

  test.describe("GET /api/teams - List Teams", () => {
    test("should list user teams", async () => {
      const response = await apiHelper.get("/api/teams", {
        apiKey: process.env.TEST_USER_1_API_KEY
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("teams");
      expect(response.body.teams).toBeInstanceOf(Array);

      // Should include the team we just created
      const ourTeam = response.body.teams.find(t => t.id === createdTeamId);
      expect(ourTeam).toBeTruthy();
      expect(ourTeam).toHaveProperty("role", "owner");
    });

    test("different users should see different teams", async () => {
      const response = await apiHelper.get("/api/teams", {
        apiKey: process.env.TEST_USER_2_API_KEY
      });

      expect(response.status).toBe(200);
      expect(response.body.teams).toBeInstanceOf(Array);

      // User 2 shouldn't see User 1's team
      const otherTeam = response.body.teams.find(t => t.id === createdTeamId);
      expect(otherTeam).toBeFalsy();
    });
  });

  test.describe("GET /api/teams/:teamId/members - Team Members", () => {
    test("should list team members", async () => {
      const response = await apiHelper.get(`/api/teams/${createdTeamId}/members`, {
        apiKey: process.env.TEST_USER_1_API_KEY
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("members");
      expect(response.body.members).toBeInstanceOf(Array);
      expect(response.body.members.length).toBe(1); // Just the owner

      const owner = response.body.members[0];
      expect(owner).toHaveProperty("user_id", process.env.TEST_USER_1_ID);
      expect(owner).toHaveProperty("role", "owner");
      expect(owner).toHaveProperty("username", "testuser1");
    });

    test("non-members cannot view team members", async () => {
      const response = await apiHelper.get(`/api/teams/${createdTeamId}/members`, {
        apiKey: process.env.TEST_USER_2_API_KEY
      });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty("error");
    });
  });

  test.describe("Team Invitations", () => {
    test("GET /api/teams/join/:inviteCode/preview should show team info", async () => {
      const response = await apiHelper.get(`/api/teams/join/${inviteCode}/preview`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("team");
      expect(response.body.team).toHaveProperty("name");
      expect(response.body.team).toHaveProperty("description");
      expect(response.body.team).toHaveProperty("member_count", 1);
      // Should not expose sensitive data
      expect(response.body.team).not.toHaveProperty("invite_code");
    });

    test("POST /api/teams/join/:inviteCode should allow joining team", async () => {
      const response = await apiHelper.post(`/api/teams/join/${inviteCode}`, {
        apiKey: process.env.TEST_USER_2_API_KEY
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("team");
      expect(response.body).toHaveProperty("role", "member");
    });

    test("should not allow joining same team twice", async () => {
      const response = await apiHelper.post(`/api/teams/join/${inviteCode}`, {
        apiKey: process.env.TEST_USER_2_API_KEY
      });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("already a member");
    });

    test("should handle invalid invite codes", async () => {
      const response = await apiHelper.post("/api/teams/join/INVALID_CODE", {
        apiKey: process.env.TEST_USER_3_API_KEY
      });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error");
    });
  });

  test.describe("PUT /api/teams/:teamId - Update Team", () => {
    test("owner should be able to update team", async () => {
      const updateData = {
        name: "Updated Team Name",
        description: "Updated description"
      };

      const response = await apiHelper.put(`/api/teams/${createdTeamId}`, {
        apiKey: process.env.TEST_USER_1_API_KEY,
        data: updateData
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("team");
      expect(response.body.team).toMatchObject(updateData);
    });

    test("members should not be able to update team", async () => {
      const response = await apiHelper.put(`/api/teams/${createdTeamId}`, {
        apiKey: process.env.TEST_USER_2_API_KEY,
        data: { name: "Unauthorized Update" }
      });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty("error");
    });
  });

  test.describe("Team Member Management", () => {
    test("DELETE /api/teams/:teamId/members/me - Leave team", async () => {
      // User 2 leaves the team
      const response = await apiHelper.delete(`/api/teams/${createdTeamId}/members/me`, {
        apiKey: process.env.TEST_USER_2_API_KEY
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message");

      // Verify they're no longer a member
      const teamsResponse = await apiHelper.get("/api/teams", {
        apiKey: process.env.TEST_USER_2_API_KEY
      });
      const isStillMember = teamsResponse.body.teams.some(t => t.id === createdTeamId);
      expect(isStillMember).toBe(false);
    });

    test("owner cannot leave their own team", async () => {
      const response = await apiHelper.delete(`/api/teams/${createdTeamId}/members/me`, {
        apiKey: process.env.TEST_USER_1_API_KEY
      });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Owner cannot leave");
    });

    test("DELETE /api/teams/:teamId/members/:userId - Remove member", async () => {
      // First, have user 3 join the team
      await apiHelper.post(`/api/teams/join/${inviteCode}`, {
        apiKey: process.env.TEST_USER_3_API_KEY
      });

      // Owner removes user 3
      const response = await apiHelper.delete(
        `/api/teams/${createdTeamId}/members/${process.env.TEST_USER_3_ID}`,
        { apiKey: process.env.TEST_USER_1_API_KEY }
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message");
    });

    test("members cannot remove other members", async () => {
      // User 2 rejoins
      await apiHelper.post(`/api/teams/join/${inviteCode}`, {
        apiKey: process.env.TEST_USER_2_API_KEY
      });

      // User 2 tries to remove user 1 (owner)
      const response = await apiHelper.delete(
        `/api/teams/${createdTeamId}/members/${process.env.TEST_USER_1_ID}`,
        { apiKey: process.env.TEST_USER_2_API_KEY }
      );

      expect(response.status).toBe(403);
    });
  });

  test.describe("Team Leaderboard", () => {
    test("GET /api/teams/:teamId/leaderboard/:period should return team rankings", async () => {
      const periods = ["today", "week", "month", "all"];

      for (const period of periods) {
        const response = await apiHelper.get(
          `/api/teams/${createdTeamId}/leaderboard/${period}`,
          { apiKey: process.env.TEST_USER_1_API_KEY }
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("leaderboard");
        expect(response.body.leaderboard).toBeInstanceOf(Array);

        if (response.body.leaderboard.length > 0) {
          const entry = response.body.leaderboard[0];
          expect(entry).toHaveProperty("rank");
          expect(entry).toHaveProperty("user_id");
          expect(entry).toHaveProperty("display_name");
          expect(entry).toHaveProperty("total_cost");
          expect(entry).toHaveProperty("total_sessions");
          expect(entry).toHaveProperty("total_blocks");
        }
      }
    });

    test("non-members cannot view team leaderboard", async () => {
      const response = await apiHelper.get(
        `/api/teams/${createdTeamId}/leaderboard/week`,
        { apiKey: process.env.TEST_USER_3_API_KEY }
      );

      expect(response.status).toBe(403);
    });

    test("should validate period parameter", async () => {
      const response = await apiHelper.get(
        `/api/teams/${createdTeamId}/leaderboard/invalid-period`,
        { apiKey: process.env.TEST_USER_1_API_KEY }
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });
  });

  test.describe("Role Management", () => {
    test("PUT /api/teams/:teamId/members/:userId/promote should promote member", async () => {
      // Owner promotes User 2 to admin
      const response = await apiHelper.put(
        `/api/teams/${createdTeamId}/members/${process.env.TEST_USER_2_ID}/promote`,
        {
          apiKey: process.env.TEST_USER_1_API_KEY,
          data: { new_role: "admin" }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("updated_role", "admin");
    });

    test("only owners can promote members", async () => {
      // User 3 joins again
      await apiHelper.post(`/api/teams/join/${inviteCode}`, {
        apiKey: process.env.TEST_USER_3_API_KEY
      });

      // Admin (User 2) tries to promote User 3
      const response = await apiHelper.put(
        `/api/teams/${createdTeamId}/members/${process.env.TEST_USER_3_ID}/promote`,
        {
          apiKey: process.env.TEST_USER_2_API_KEY,
          data: { new_role: "admin" }
        }
      );

      expect(response.status).toBe(403);
    });

    test("cannot promote to invalid role", async () => {
      const response = await apiHelper.put(
        `/api/teams/${createdTeamId}/members/${process.env.TEST_USER_2_ID}/promote`,
        {
          apiKey: process.env.TEST_USER_1_API_KEY,
          data: { new_role: "superuser" } // Invalid role
        }
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });
  });
});
