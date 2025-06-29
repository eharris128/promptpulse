import { test, expect } from '@playwright/test';
import apiHelper from '../utils/api-helper.js';

test.describe('Leaderboard API', () => {
  test.describe('GET /api/leaderboard/:period', () => {
    const periods = ['today', 'week', 'month', 'all'];

    test.beforeAll(async () => {
      // Ensure test user has leaderboard visibility enabled
      await apiHelper.put('/api/user/leaderboard-settings', {
        apiKey: process.env.TEST_USER_3_API_KEY,
        data: {
          is_public: true,
          display_name: 'LeaderboardTestUser',
          is_team_visible: true,
          team_display_name: 'TeamTestUser'
        }
      });
    });

    for (const period of periods) {
      test(`should return ${period} leaderboard`, async () => {
        const response = await apiHelper.get(`/api/leaderboard/${period}`, {
          apiKey: process.env.TEST_USER_1_API_KEY
        });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('leaderboard');
        expect(response.body.leaderboard).toBeInstanceOf(Array);
        
        if (response.body.leaderboard.length > 0) {
          const entry = response.body.leaderboard[0];
          expect(entry).toHaveProperty('rank');
          expect(entry).toHaveProperty('display_name');
          expect(entry).toHaveProperty('total_cost');
          expect(entry).toHaveProperty('total_sessions');
          expect(entry).toHaveProperty('total_blocks');
          
          // Verify ranking order (should be sorted by total_cost desc)
          if (response.body.leaderboard.length > 1) {
            const first = response.body.leaderboard[0];
            const second = response.body.leaderboard[1];
            expect(first.total_cost).toBeGreaterThanOrEqual(second.total_cost);
          }
        }
      });
    }

    test('should require authentication', async () => {
      const response = await apiHelper.get('/api/leaderboard/week');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'API key required');
    });

    test('should validate period parameter', async () => {
      const response = await apiHelper.get('/api/leaderboard/invalid-period', {
        apiKey: process.env.TEST_USER_1_API_KEY
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should only show users who opted into public leaderboard', async () => {
      // First, opt user 1 out of leaderboard
      await apiHelper.put('/api/user/leaderboard-settings', {
        apiKey: process.env.TEST_USER_1_API_KEY,
        data: { is_public: false }
      });

      const response = await apiHelper.get('/api/leaderboard/all', {
        apiKey: process.env.TEST_USER_1_API_KEY
      });

      expect(response.status).toBe(200);
      
      // User 1 should not appear in the leaderboard
      const user1Entry = response.body.leaderboard.find(entry => 
        entry.user_id === process.env.TEST_USER_1_ID
      );
      expect(user1Entry).toBeFalsy();

      // But user 3 (who opted in) might appear
      const user3Entry = response.body.leaderboard.find(entry => 
        entry.user_id === process.env.TEST_USER_3_ID
      );
      // Note: user3Entry might not exist if they have no usage data
    });

    test('should use display names not real names', async () => {
      const response = await apiHelper.get('/api/leaderboard/all', {
        apiKey: process.env.TEST_USER_3_API_KEY
      });

      expect(response.status).toBe(200);
      
      if (response.body.leaderboard.length > 0) {
        // Should not contain real user names
        const containsRealName = response.body.leaderboard.some(entry =>
          entry.display_name === 'Test User 1' || 
          entry.display_name === 'Test User 2' ||
          entry.display_name === 'Test User 3'
        );
        expect(containsRealName).toBe(false);
      }
    });

    test('should respect date filters for periods', async () => {
      // Today's leaderboard should only include today's data
      const todayResponse = await apiHelper.get('/api/leaderboard/today', {
        apiKey: process.env.TEST_USER_3_API_KEY
      });

      // Week's leaderboard should include last 7 days
      const weekResponse = await apiHelper.get('/api/leaderboard/week', {
        apiKey: process.env.TEST_USER_3_API_KEY
      });

      expect(todayResponse.status).toBe(200);
      expect(weekResponse.status).toBe(200);

      // Week should have same or more entries than today
      expect(weekResponse.body.leaderboard.length)
        .toBeGreaterThanOrEqual(todayResponse.body.leaderboard.length);
    });
  });
});