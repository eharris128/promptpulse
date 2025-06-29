import { test, expect } from '@playwright/test';
import apiHelper from '../utils/api-helper.js';
import crypto from 'crypto';

test.describe('User Management API', () => {
  test.describe('GET /api/users', () => {
    test('should return current user info', async () => {
      const response = await apiHelper.get('/api/users', {
        apiKey: process.env.TEST_USER_1_API_KEY
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toMatchObject({
        id: process.env.TEST_USER_1_ID,
        username: 'testuser1',
        email: 'test1@example.com',
        full_name: 'Test User 1'
      });
    });

    test('should require authentication', async () => {
      const response = await apiHelper.get('/api/users');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'API key required');
    });

    test('different users should see their own data', async () => {
      // User 1
      const response1 = await apiHelper.get('/api/users', {
        apiKey: process.env.TEST_USER_1_API_KEY
      });
      expect(response1.body.user.username).toBe('testuser1');

      // User 2
      const response2 = await apiHelper.get('/api/users', {
        apiKey: process.env.TEST_USER_2_API_KEY
      });
      expect(response2.body.user.username).toBe('testuser2');
    });
  });

  test.describe('POST /api/users', () => {
    test('should create a new user', async () => {
      const newUser = {
        username: `testuser_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        full_name: 'New Test User'
      };

      const response = await apiHelper.post('/api/users', { data: newUser });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('apiKey');
      
      // Verify user properties
      expect(response.body.user).toMatchObject({
        username: newUser.username,
        email: newUser.email,
        full_name: newUser.full_name
      });
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('created_at');
      
      // API key should be a valid format
      expect(response.body.apiKey).toBeTruthy();
      expect(response.body.apiKey.length).toBeGreaterThan(20);
    });

    test('should reject duplicate usernames', async () => {
      const duplicateUser = {
        username: 'testuser1', // Already exists
        email: 'newemail@example.com',
        full_name: 'Duplicate User'
      };

      const response = await apiHelper.post('/api/users', { data: duplicateUser });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already exists');
    });

    test('should reject duplicate emails', async () => {
      const duplicateUser = {
        username: 'newusername',
        email: 'test1@example.com', // Already exists
        full_name: 'Duplicate Email User'
      };

      const response = await apiHelper.post('/api/users', { data: duplicateUser });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already in use');
    });

    test('should validate required fields', async () => {
      const testCases = [
        { email: 'test@example.com', full_name: 'Test' }, // Missing username
        { username: 'testuser', full_name: 'Test' }, // Missing email
        { username: 'testuser', email: 'test@example.com' }, // Missing full_name
      ];

      for (const testCase of testCases) {
        const response = await apiHelper.post('/api/users', { data: testCase });
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      }
    });

    test('should validate email format', async () => {
      const invalidEmails = ['notanemail', 'test@', '@example.com', 'test@.com'];

      for (const email of invalidEmails) {
        const response = await apiHelper.post('/api/users', {
          data: {
            username: `user_${Date.now()}`,
            email,
            full_name: 'Test User'
          }
        });
        
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error.toLowerCase()).toContain('email');
      }
    });
  });

  test.describe('User Settings Endpoints', () => {
    test.describe('Leaderboard Settings', () => {
      test('GET /api/user/leaderboard-settings should return settings', async () => {
        const response = await apiHelper.get('/api/user/leaderboard-settings', {
          apiKey: process.env.TEST_USER_3_API_KEY
        });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('settings');
        expect(response.body.settings).toMatchObject({
          is_public: true,
          display_name: 'LeaderboardDisplay',
          is_team_visible: true,
          team_display_name: 'TeamLeaderboard'
        });
      });

      test('PUT /api/user/leaderboard-settings should update settings', async () => {
        const newSettings = {
          is_public: false,
          display_name: 'UpdatedDisplay',
          is_team_visible: true,
          team_display_name: 'UpdatedTeamDisplay'
        };

        const response = await apiHelper.put('/api/user/leaderboard-settings', {
          apiKey: process.env.TEST_USER_1_API_KEY,
          data: newSettings
        });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('settings');
        expect(response.body.settings).toMatchObject(newSettings);
      });

      test('should require authentication for leaderboard settings', async () => {
        const response = await apiHelper.get('/api/user/leaderboard-settings');
        expect(response.status).toBe(401);
      });
    });

    test.describe('Email Preferences', () => {
      test('GET /api/user/email-preferences should return preferences', async () => {
        const response = await apiHelper.get('/api/user/email-preferences', {
          apiKey: process.env.TEST_USER_1_API_KEY
        });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('preferences');
        expect(response.body.preferences).toHaveProperty('weekly_report');
        expect(response.body.preferences).toHaveProperty('monthly_report');
        expect(response.body.preferences).toHaveProperty('achievement_notifications');
        expect(response.body.preferences).toHaveProperty('team_updates');
        expect(response.body.preferences).toHaveProperty('product_updates');
      });

      test('PUT /api/user/email-preferences should update preferences', async () => {
        const newPreferences = {
          weekly_report: true,
          monthly_report: false,
          achievement_notifications: true,
          team_updates: false,
          product_updates: true
        };

        const response = await apiHelper.put('/api/user/email-preferences', {
          apiKey: process.env.TEST_USER_1_API_KEY,
          data: newPreferences
        });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('preferences');
        expect(response.body.preferences).toMatchObject(newPreferences);
      });
    });

    test.describe('Email Update', () => {
      test('PUT /api/user/email should update email address', async () => {
        const newEmail = `updated_${Date.now()}@example.com`;

        const response = await apiHelper.put('/api/user/email', {
          apiKey: process.env.TEST_USER_2_API_KEY,
          data: { email: newEmail }
        });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('user');
        expect(response.body.user.email).toBe(newEmail);
      });

      test('should reject invalid email format', async () => {
        const response = await apiHelper.put('/api/user/email', {
          apiKey: process.env.TEST_USER_1_API_KEY,
          data: { email: 'invalid-email' }
        });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      });

      test('should reject duplicate email', async () => {
        const response = await apiHelper.put('/api/user/email', {
          apiKey: process.env.TEST_USER_2_API_KEY,
          data: { email: 'test1@example.com' } // Already used by user1
        });

        expect(response.status).toBe(409);
        expect(response.body).toHaveProperty('error');
      });
    });
  });
});