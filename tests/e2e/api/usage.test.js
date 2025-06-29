import { test, expect } from '@playwright/test';
import apiHelper from '../utils/api-helper.js';

test.describe('Usage Data API', () => {
  const sampleUsageData = {
    machine_id: 'test-machine-e2e',
    session_id: 'test-session-e2e',
    project_path: '/test/e2e/project',
    model: 'claude-3-opus-20240229',
    input_tokens: 2000,
    output_tokens: 1000,
    cache_write_tokens: 200,
    cache_read_tokens: 100,
    total_cost: 0.05,
    timestamp: new Date().toISOString()
  };

  test.describe('POST /api/usage', () => {
    test('should accept single usage data entry', async () => {
      const response = await apiHelper.post('/api/usage', {
        apiKey: process.env.TEST_USER_1_API_KEY,
        data: sampleUsageData
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Usage data recorded successfully');
      expect(response.body).toHaveProperty('id');
    });

    test('should validate required fields', async () => {
      const requiredFields = ['machine_id', 'session_id', 'project_path', 'model', 'timestamp'];
      
      for (const field of requiredFields) {
        const incompleteData = { ...sampleUsageData };
        delete incompleteData[field];
        
        const response = await apiHelper.post('/api/usage', {
          apiKey: process.env.TEST_USER_1_API_KEY,
          data: incompleteData
        });
        
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      }
    });

    test('should accept zero values for token fields', async () => {
      const dataWithZeros = {
        ...sampleUsageData,
        input_tokens: 0,
        output_tokens: 0,
        cache_write_tokens: 0,
        cache_read_tokens: 0,
        total_cost: 0
      };

      const response = await apiHelper.post('/api/usage', {
        apiKey: process.env.TEST_USER_1_API_KEY,
        data: dataWithZeros
      });

      expect(response.status).toBe(201);
    });

    test('should require authentication', async () => {
      const response = await apiHelper.post('/api/usage', {
        data: sampleUsageData
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'API key required');
    });
  });

  test.describe('GET /api/usage/aggregate', () => {
    test('should return aggregated usage data', async () => {
      const response = await apiHelper.get('/api/usage/aggregate', {
        apiKey: process.env.TEST_USER_1_API_KEY
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('usage');
      expect(response.body.usage).toBeInstanceOf(Array);
      
      if (response.body.usage.length > 0) {
        const entry = response.body.usage[0];
        expect(entry).toHaveProperty('date');
        expect(entry).toHaveProperty('total_sessions');
        expect(entry).toHaveProperty('total_blocks');
        expect(entry).toHaveProperty('total_input_tokens');
        expect(entry).toHaveProperty('total_output_tokens');
        expect(entry).toHaveProperty('total_cost');
      }
    });

    test('should filter by date range', async () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const response = await apiHelper.get('/api/usage/aggregate', {
        apiKey: process.env.TEST_USER_1_API_KEY,
        params: {
          startDate: weekAgo.toISOString(),
          endDate: now.toISOString()
        }
      });

      expect(response.status).toBe(200);
      expect(response.body.usage).toBeInstanceOf(Array);
    });

    test('should filter by machine ID', async () => {
      const response = await apiHelper.get('/api/usage/aggregate', {
        apiKey: process.env.TEST_USER_1_API_KEY,
        params: {
          machine_id: 'test-machine-1'
        }
      });

      expect(response.status).toBe(200);
      expect(response.body.usage).toBeInstanceOf(Array);
    });

    test('should filter by project path', async () => {
      const response = await apiHelper.get('/api/usage/aggregate', {
        apiKey: process.env.TEST_USER_1_API_KEY,
        params: {
          project_path: '/test/project'
        }
      });

      expect(response.status).toBe(200);
      expect(response.body.usage).toBeInstanceOf(Array);
    });
  });

  test.describe('GET /api/usage/sessions', () => {
    test('should return session data', async () => {
      const response = await apiHelper.get('/api/usage/sessions', {
        apiKey: process.env.TEST_USER_1_API_KEY
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sessions');
      expect(response.body.sessions).toBeInstanceOf(Array);
      
      if (response.body.sessions.length > 0) {
        const session = response.body.sessions[0];
        expect(session).toHaveProperty('session_id');
        expect(session).toHaveProperty('machine_id');
        expect(session).toHaveProperty('project_path');
        expect(session).toHaveProperty('start_time');
        expect(session).toHaveProperty('total_blocks');
        expect(session).toHaveProperty('total_cost');
      }
    });

    test('should paginate results', async () => {
      const response = await apiHelper.get('/api/usage/sessions', {
        apiKey: process.env.TEST_USER_1_API_KEY,
        params: {
          limit: 5,
          offset: 0
        }
      });

      expect(response.status).toBe(200);
      expect(response.body.sessions.length).toBeLessThanOrEqual(5);
    });
  });

  test.describe('GET /api/usage/projects', () => {
    test('should return project-based usage data', async () => {
      const response = await apiHelper.get('/api/usage/projects', {
        apiKey: process.env.TEST_USER_1_API_KEY
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('projects');
      expect(response.body.projects).toBeInstanceOf(Array);
      
      if (response.body.projects.length > 0) {
        const project = response.body.projects[0];
        expect(project).toHaveProperty('project_path');
        expect(project).toHaveProperty('total_sessions');
        expect(project).toHaveProperty('total_blocks');
        expect(project).toHaveProperty('total_cost');
        expect(project).toHaveProperty('last_used');
      }
    });
  });

  test.describe('GET /api/usage/blocks', () => {
    test('should return individual billing blocks', async () => {
      const response = await apiHelper.get('/api/usage/blocks', {
        apiKey: process.env.TEST_USER_1_API_KEY
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('blocks');
      expect(response.body.blocks).toBeInstanceOf(Array);
    });

    test('should filter by session ID', async () => {
      const response = await apiHelper.get('/api/usage/blocks', {
        apiKey: process.env.TEST_USER_1_API_KEY,
        params: {
          session_id: 'test-session-1'
        }
      });

      expect(response.status).toBe(200);
      expect(response.body.blocks).toBeInstanceOf(Array);
    });
  });

  test.describe('Batch Upload Endpoints', () => {
    test('POST /api/usage/daily/batch should accept daily usage batch', async () => {
      const batchData = {
        entries: [
          {
            machine_id: 'batch-machine-1',
            date: new Date().toISOString().split('T')[0],
            total_sessions: 10,
            total_blocks: 50,
            total_input_tokens: 10000,
            total_output_tokens: 5000,
            total_cache_write_tokens: 1000,
            total_cache_read_tokens: 500,
            total_cost: 0.25
          }
        ]
      };

      const response = await apiHelper.post('/api/usage/daily/batch', {
        apiKey: process.env.TEST_USER_1_API_KEY,
        data: batchData
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('processed', 1);
    });

    test('POST /api/usage/sessions/batch should accept session batch', async () => {
      const batchData = {
        entries: [
          {
            machine_id: 'batch-machine-1',
            session_id: `batch-session-${Date.now()}`,
            project_path: '/batch/test/project',
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            total_blocks: 10,
            total_input_tokens: 2000,
            total_output_tokens: 1000,
            total_cache_write_tokens: 200,
            total_cache_read_tokens: 100,
            total_cost: 0.05,
            models_used: ['claude-3-opus-20240229']
          }
        ]
      };

      const response = await apiHelper.post('/api/usage/sessions/batch', {
        apiKey: process.env.TEST_USER_1_API_KEY,
        data: batchData
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('processed', 1);
    });

    test('POST /api/usage/blocks/batch should accept blocks batch', async () => {
      const batchData = {
        entries: [
          {
            machine_id: 'batch-machine-1',
            session_id: 'batch-session-1',
            project_path: '/batch/test/project',
            model: 'claude-3-opus-20240229',
            input_tokens: 500,
            output_tokens: 250,
            cache_write_tokens: 50,
            cache_read_tokens: 25,
            total_cost: 0.0125,
            timestamp: new Date().toISOString()
          }
        ]
      };

      const response = await apiHelper.post('/api/usage/blocks/batch', {
        apiKey: process.env.TEST_USER_1_API_KEY,
        data: batchData
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('processed', 1);
    });

    test('batch endpoints should validate data', async () => {
      const invalidBatch = {
        entries: [
          { invalid: 'data' }
        ]
      };

      const response = await apiHelper.post('/api/usage/daily/batch', {
        apiKey: process.env.TEST_USER_1_API_KEY,
        data: invalidBatch
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('batch endpoints should handle empty batches', async () => {
      const emptyBatch = { entries: [] };

      const response = await apiHelper.post('/api/usage/daily/batch', {
        apiKey: process.env.TEST_USER_1_API_KEY,
        data: emptyBatch
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('processed', 0);
    });
  });

  test.describe('Analytics Endpoints', () => {
    test('GET /api/usage/analytics/patterns should return usage patterns', async () => {
      const response = await apiHelper.get('/api/usage/analytics/patterns', {
        apiKey: process.env.TEST_USER_1_API_KEY
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('patterns');
      expect(response.body.patterns).toHaveProperty('hourly_distribution');
      expect(response.body.patterns).toHaveProperty('daily_distribution');
      expect(response.body.patterns).toHaveProperty('model_usage');
      expect(response.body.patterns).toHaveProperty('project_activity');
    });

    test('GET /api/usage/analytics/costs should return cost analytics', async () => {
      const response = await apiHelper.get('/api/usage/analytics/costs', {
        apiKey: process.env.TEST_USER_1_API_KEY
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('cost_analytics');
      expect(response.body.cost_analytics).toHaveProperty('total_cost');
      expect(response.body.cost_analytics).toHaveProperty('daily_average');
      expect(response.body.cost_analytics).toHaveProperty('cost_by_model');
      expect(response.body.cost_analytics).toHaveProperty('cost_by_project');
      expect(response.body.cost_analytics).toHaveProperty('cost_trend');
    });
  });

  test.describe('Upload History', () => {
    test('POST /api/upload-history/check should check for duplicates', async () => {
      const checkData = {
        machine_id: 'test-machine-1',
        session_ids: ['test-session-1', 'new-session-123'],
        data_hashes: ['hash1', 'hash2']
      };

      const response = await apiHelper.post('/api/upload-history/check', {
        apiKey: process.env.TEST_USER_1_API_KEY,
        data: checkData
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('already_uploaded');
      expect(response.body.already_uploaded).toHaveProperty('session_ids');
      expect(response.body.already_uploaded).toHaveProperty('data_hashes');
      expect(response.body.already_uploaded.session_ids).toBeInstanceOf(Array);
      expect(response.body.already_uploaded.data_hashes).toBeInstanceOf(Array);
    });
  });
});