import testDb from "./utils/test-db.js";

async function globalSetup() {
  console.log("Running global test setup...");

  try {
    // Set up the test database
    await testDb.setup();
    console.log("Test database setup complete");

    // Store test user info for use in tests
    const testUsers = {
      user1: testDb.getTestUser(0),
      user2: testDb.getTestUser(1),
      user3: testDb.getTestUser(2),
    };

    // Make test data available to tests via environment variables
    console.log("🔧 Setting up test environment variables...");

    process.env.TEST_USER_1_TOKEN = testUsers.user1.bearer_token;
    process.env.TEST_USER_1_ID = testUsers.user1.id;
    process.env.TEST_USER_2_TOKEN = testUsers.user2.bearer_token;
    process.env.TEST_USER_2_ID = testUsers.user2.id;
    process.env.TEST_USER_3_TOKEN = testUsers.user3.bearer_token;
    process.env.TEST_USER_3_ID = testUsers.user3.id;

    console.log("📊 Environment variables set:");
    console.log(`  TEST_USER_1_TOKEN: ${process.env.TEST_USER_1_TOKEN ? "Set" : "Missing"} (${process.env.TEST_USER_1_TOKEN?.substring(0, 20)}...)`);
    console.log(`  TEST_USER_1_ID: ${process.env.TEST_USER_1_ID || "Missing"}`);
    console.log(`  TEST_USER_2_TOKEN: ${process.env.TEST_USER_2_TOKEN ? "Set" : "Missing"} (${process.env.TEST_USER_2_TOKEN?.substring(0, 20)}...)`);
    console.log(`  TEST_USER_2_ID: ${process.env.TEST_USER_2_ID || "Missing"}`);
    console.log(`  TEST_USER_3_TOKEN: ${process.env.TEST_USER_3_TOKEN ? "Set" : "Missing"} (${process.env.TEST_USER_3_TOKEN?.substring(0, 20)}...)`);
    console.log(`  TEST_USER_3_ID: ${process.env.TEST_USER_3_ID || "Missing"}`);

    return async () => {
      console.log("Running global test teardown...");
      await testDb.cleanup();
      await testDb.close();
      console.log("Test cleanup complete");
    };
  } catch (error) {
    console.error("Global setup failed:", error);
    throw error;
  }
}

export default globalSetup;
