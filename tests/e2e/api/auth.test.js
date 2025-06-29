import { test, expect } from '@playwright/test';
import apiHelper from '../utils/api-helper.js';

test.describe('Authentication API', () => {
  test('should validate API key successfully', async () => {
    const response = await apiHelper.get('/api/auth/validate', {
      apiKey: process.env.TEST_USER_1_API_KEY
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('user');
    expect(response.body.user).toMatchObject({
      id: process.env.TEST_USER_1_ID,
      email: 'test1@example.com',
      username: 'testuser1',
      full_name: 'Test User 1'
    });
  });

  test('should reject request without API key', async () => {
    const response = await apiHelper.get('/api/auth/validate');

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error', 'API key required');
  });

  test('should reject request with invalid API key', async () => {
    const response = await apiHelper.get('/api/auth/validate', {
      apiKey: 'invalid-api-key'
    });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error', 'Invalid API key');
  });

  test('should validate different users with their respective API keys', async () => {
    // Test User 1
    const response1 = await apiHelper.get('/api/auth/validate', {
      apiKey: process.env.TEST_USER_1_API_KEY
    });
    expect(response1.status).toBe(200);
    expect(response1.body.user.username).toBe('testuser1');

    // Test User 2
    const response2 = await apiHelper.get('/api/auth/validate', {
      apiKey: process.env.TEST_USER_2_API_KEY
    });
    expect(response2.status).toBe(200);
    expect(response2.body.user.username).toBe('testuser2');
  });

  test('should look up user by username (public endpoint)', async () => {
    const response = await apiHelper.get('/api/users/by-username/testuser1');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('user');
    expect(response.body.user).toMatchObject({
      id: process.env.TEST_USER_1_ID,
      username: 'testuser1',
      email: 'test1@example.com'
    });
  });

  test('should return 404 for non-existent username', async () => {
    const response = await apiHelper.get('/api/users/by-username/nonexistentuser');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error', 'User not found');
  });

  test('should handle URL-encoded usernames', async () => {
    const response = await apiHelper.get('/api/users/by-username/test%20user%201');

    expect(response.status).toBe(404); // User doesn't exist with spaces
  });

  test('protected endpoints should enforce authentication', async () => {
    const protectedEndpoints = [
      '/api/users',
      '/api/usage/aggregate',
      '/api/machines',
      '/api/usage/sessions',
      '/api/usage/projects',
      '/api/user/leaderboard-settings',
      '/api/teams'
    ];

    for (const endpoint of protectedEndpoints) {
      const response = await apiHelper.get(endpoint);
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'API key required');
    }
  });
});