# E2E API Testing

This directory contains comprehensive end-to-end tests for all API endpoints using Playwright. These tests are designed to validate the API contract and enable safe refactoring of the server codebase.

## Quick Start

```bash
# Install dependencies (if not already done)
npm install

# Set up test environment
cp .env.test.example .env.test
# Edit .env.test with your test database credentials

# Run all tests
npm test

# Run with UI
npm run test:e2e:ui

# Run in debug mode
npm run test:e2e:debug
```

## Test Structure

```
tests/e2e/
├── api/                    # API endpoint tests
│   ├── auth.test.js       # Authentication & authorization
│   ├── health.test.js     # Health checks & metrics
│   ├── users.test.js      # User management
│   ├── usage.test.js      # Usage data & analytics
│   ├── teams.test.js      # Team management
│   ├── leaderboard.test.js # Public leaderboards
│   └── machines.test.js   # Machine tracking
├── utils/                 # Test utilities
│   ├── api-helper.js      # HTTP request helper
│   └── test-db.js         # Database setup/teardown
├── fixtures/              # Test data fixtures
└── global-setup.js        # Global test setup
```

## Test Coverage

### Authentication (auth.test.js)
- API key validation
- User lookup by username
- Authentication middleware enforcement
- User data isolation

### Health & Metrics (health.test.js)
- Server health endpoint
- Database connectivity checks
- System metrics collection
- Response time validation

### User Management (users.test.js)
- User creation and validation
- Email and username uniqueness
- User settings (leaderboard, email preferences)
- Email address updates

### Usage Data (usage.test.js)
- Single usage data submission
- Batch upload endpoints (daily, sessions, blocks)
- Usage aggregation and filtering
- Analytics and cost reporting
- Upload history and deduplication

### Team Management (teams.test.js)
- Team creation and updates
- Member invitations and joining
- Role management (owner/admin/member)
- Team leaderboards
- Member removal and leaving

### Leaderboards (leaderboard.test.js)
- Public leaderboard periods (today/week/month/all)
- Privacy controls and opt-in/out
- Display name usage
- Data filtering by date ranges

### Machines (machines.test.js)
- Machine listing and statistics
- User data isolation
- Sorting and date validation

## Test Environment

### Database Setup
- Uses separate test database to avoid development data corruption
- Automatically applies migrations using Goose
- Seeds test data with known users and usage records
- Cleans up after each test run

### Test Users
The test suite creates three test users:
- **User 1**: `testuser1` with API key `test-api-key-1`
- **User 2**: `testuser2` with API key `test-api-key-2`
- **User 3**: `leaderboarduser` with API key `test-api-key-3` (leaderboard opt-in)

### Configuration
Environment variables in `.env.test`:
- `DATABASE_URL`: Test database connection
- `NODE_ENV=test`: Test environment flag
- `LOG_LEVEL=error`: Minimal logging during tests
- `API_BASE_URL`: Test server base URL

## Writing New Tests

### Test File Structure
```javascript
import { test, expect } from '@playwright/test';
import apiHelper from '../utils/api-helper.js';

test.describe('Feature Name API', () => {
  test.describe('Endpoint Group', () => {
    test('should do something', async () => {
      const response = await apiHelper.get('/api/endpoint', {
        apiKey: process.env.TEST_USER_1_API_KEY
      });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('expectedField');
    });
  });
});
```

### Common Patterns
1. **Authentication Testing**: Always test both authenticated and unauthenticated requests
2. **Data Isolation**: Verify users can only access their own data
3. **Input Validation**: Test required fields, format validation, and edge cases
4. **Error Handling**: Verify appropriate error codes and messages
5. **Response Structure**: Validate response schema and data types

### API Helper Usage
```javascript
// GET request with authentication
const response = await apiHelper.get('/api/endpoint', {
  apiKey: process.env.TEST_USER_1_API_KEY,
  params: { filter: 'value' }
});

// POST request with data
const response = await apiHelper.post('/api/endpoint', {
  apiKey: process.env.TEST_USER_1_API_KEY,
  data: { field: 'value' }
});

// PUT and DELETE requests
const putResponse = await apiHelper.put('/api/endpoint', { apiKey, data });
const deleteResponse = await apiHelper.delete('/api/endpoint', { apiKey });
```

## Continuous Integration

The test suite is designed to run in CI environments:
- Single worker mode prevents database conflicts
- Automatic server startup/shutdown
- Comprehensive error reporting
- HTML test reports generated

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify `.env.test` DATABASE_URL is correct
   - Ensure test database exists and is accessible
   - Check database permissions

2. **Test Failures After Server Changes**
   - Review test output for specific endpoint failures
   - Verify API response structure hasn't changed
   - Update tests if API contract intentionally changed

3. **Authentication Failures**
   - Confirm test users are created properly
   - Check API key format and generation
   - Verify authentication middleware

### Debugging
```bash
# Run specific test file
npx playwright test auth.test.js

# Run with debug output
npm run test:e2e:debug

# View last test report
npx playwright show-report
```

## Refactoring Support

This test suite enables safe refactoring of `server.js`:

1. **Baseline Validation**: Run tests before refactoring to establish baseline
2. **Incremental Changes**: Move endpoints to modular files one at a time
3. **Continuous Validation**: Run tests after each change to catch regressions
4. **API Contract Preservation**: Tests ensure external API behavior remains unchanged

The comprehensive coverage means you can confidently restructure the internal server code while maintaining the existing API contract.