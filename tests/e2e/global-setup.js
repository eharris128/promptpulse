import testDb from './utils/test-db.js';

async function globalSetup() {
  console.log('Running global test setup...');
  
  try {
    // Set up the test database
    await testDb.setup();
    console.log('Test database setup complete');
    
    // Store test user info for use in tests
    const testUsers = {
      user1: testDb.getTestUser(0),
      user2: testDb.getTestUser(1),
      user3: testDb.getTestUser(2),
    };
    
    // Make test data available to tests via environment variables
    process.env.TEST_USER_1_API_KEY = testUsers.user1.api_key;
    process.env.TEST_USER_1_ID = testUsers.user1.id;
    process.env.TEST_USER_2_API_KEY = testUsers.user2.api_key;
    process.env.TEST_USER_2_ID = testUsers.user2.id;
    process.env.TEST_USER_3_API_KEY = testUsers.user3.api_key;
    process.env.TEST_USER_3_ID = testUsers.user3.id;
    
    return async () => {
      console.log('Running global test teardown...');
      await testDb.cleanup();
      await testDb.close();
      console.log('Test cleanup complete');
    };
  } catch (error) {
    console.error('Global setup failed:', error);
    throw error;
  }
}

export default globalSetup;