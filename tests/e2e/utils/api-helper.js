import { request } from '@playwright/test';

export class APIHelper {
  constructor(baseURL = process.env.API_BASE_URL || 'http://localhost:3000') {
    this.baseURL = baseURL;
  }

  async createContext(apiKey = null) {
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    return await request.newContext({
      baseURL: this.baseURL,
      extraHTTPHeaders: headers,
    });
  }

  async get(endpoint, { apiKey = null, params = {} } = {}) {
    const context = await this.createContext(apiKey);
    try {
      const response = await context.get(endpoint, { params });
      return {
        status: response.status(),
        body: await response.json().catch(() => null),
        headers: response.headers(),
      };
    } catch (error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
        throw new Error('⚠️  Test server not running. Please configure DATABASE_URL in .env.test and ensure server starts properly.');
      }
      throw error;
    } finally {
      await context.dispose();
    }
  }

  async post(endpoint, { apiKey = null, data = {} } = {}) {
    const context = await this.createContext(apiKey);
    try {
      const response = await context.post(endpoint, { data });
      return {
        status: response.status(),
        body: await response.json().catch(() => null),
        headers: response.headers(),
      };
    } catch (error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
        throw new Error('⚠️  Test server not running. Please configure DATABASE_URL in .env.test and ensure server starts properly.');
      }
      throw error;
    } finally {
      await context.dispose();
    }
  }

  async put(endpoint, { apiKey = null, data = {} } = {}) {
    const context = await this.createContext(apiKey);
    try {
      const response = await context.put(endpoint, { data });
      return {
        status: response.status(),
        body: await response.json().catch(() => null),
        headers: response.headers(),
      };
    } catch (error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
        throw new Error('⚠️  Test server not running. Please configure DATABASE_URL in .env.test and ensure server starts properly.');
      }
      throw error;
    } finally {
      await context.dispose();
    }
  }

  async delete(endpoint, { apiKey = null } = {}) {
    const context = await this.createContext(apiKey);
    try {
      const response = await context.delete(endpoint);
      return {
        status: response.status(),
        body: await response.json().catch(() => null),
        headers: response.headers(),
      };
    } catch (error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
        throw new Error('⚠️  Test server not running. Please configure DATABASE_URL in .env.test and ensure server starts properly.');
      }
      throw error;
    } finally {
      await context.dispose();
    }
  }

  // Helper to validate common response patterns
  validateSuccessResponse(response, expectedStatus = 200) {
    if (response.status !== expectedStatus) {
      throw new Error(`Expected status ${expectedStatus}, got ${response.status}: ${JSON.stringify(response.body)}`);
    }
    return response.body;
  }

  validateErrorResponse(response, expectedStatus, expectedError) {
    if (response.status !== expectedStatus) {
      throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
    }
    if (response.body?.error !== expectedError) {
      throw new Error(`Expected error "${expectedError}", got "${response.body?.error}"`);
    }
    return response.body;
  }
}

export default new APIHelper();