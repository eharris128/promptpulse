import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { Database } from "@sqlitecloud/drivers";
import oauthHelper from "./oauth-helper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment
dotenv.config({ path: path.join(__dirname, "../../../.env.test") });

class TestDatabase {
  constructor() {
    this.db = null;
    this.testUsers = [];
  }

  async connect() {
    if (!this.db) {
      this.db = new Database(process.env.DATABASE_URL);
    }
    return this.db;
  }

  async setup() {
    console.log("Setting up test database...");

    // Check if DATABASE_URL is configured properly
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("your-test-host")) {
      console.warn("⚠️  DATABASE_URL not configured in .env.test");
      console.warn("   Using mock setup for development. Please configure a real test database for full testing.");

      // Skip database setup but create mock test users for OAuth
      this.testUsers = [
        {
          id: "test-user-1",
          username: "testuser1",
          email: "test1@example.com",
          auth0_id: "auth0|test-user-1",
          bearer_token: oauthHelper.generateMockToken({
            sub: "auth0|test-user-1",
            email: "test1@example.com",
            nickname: "testuser1"
          })
        },
        {
          id: "test-user-2",
          username: "testuser2",
          email: "test2@example.com",
          auth0_id: "auth0|test-user-2",
          bearer_token: oauthHelper.generateMockToken({
            sub: "auth0|test-user-2",
            email: "test2@example.com",
            nickname: "testuser2"
          })
        },
        {
          id: "test-user-3",
          username: "leaderboarduser",
          email: "leaderboard@example.com",
          auth0_id: "auth0|test-user-3",
          bearer_token: oauthHelper.generateMockToken({
            sub: "auth0|test-user-3",
            email: "leaderboard@example.com",
            nickname: "leaderboarduser"
          })
        }
      ];
      return;
    }

    // Run proper migrations using the project's migration runner
    try {
      console.log("Running database migrations...");
      await this.runMigrations();
      console.log("✅ Migrations applied successfully");
    } catch (error) {
      console.error("❌ Migration failed:", error.message);
      throw error;
    }

    // Verify schema is correct before proceeding
    await this.verifySchema();

    // Create test users with the correct OAuth schema
    await this.createTestUsers();
  }

  async runMigrations() {
    // Use the project's migration runner for consistency
    const migrationsScript = path.join(__dirname, "../../../scripts/run-goose-migrations.js");

    try {
      // DON'T drop tables before migrations - just run migrations to ensure tables exist
      // Goose will handle creating tables if they don't exist

      // Run migrations using Node.js script (works with SQLite Cloud)
      execSync(`node "${migrationsScript}"`, {
        stdio: "inherit",
        env: { ...process.env, NODE_ENV: "test" }
      });

      // After migrations, clean data from tables (but keep schema)
      await this.cleanAllData();
    } catch (error) {
      throw new Error(`Migration execution failed: ${error.message}`);
    }
  }

  async cleanAllData() {
    const db = await this.connect();

    // Get all tables except sqlite system tables and goose version table
    const tables = await db.sql`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      AND name NOT LIKE 'sqlite_%' 
      AND name != 'goose_db_version'
      ORDER BY name
    `;

    // Disable foreign keys for cleanup
    try {
      await db.exec("PRAGMA foreign_keys = OFF");
    } catch (error) {
      console.warn("Could not disable foreign keys:", error.message);
    }

    // Clean all data from tables in proper order to handle foreign key dependencies
    // Order matters: clean child tables before parent tables
    const cleanupOrder = [
      "email_send_log",
      "team_invitations",
      "team_members",
      "user_email_preferences",
      "upload_history",
      "usage_blocks",
      "usage_sessions",
      "usage_data",
      "teams",
      "users"
    ];

    // Clean tables in dependency order
    for (const tableName of cleanupOrder) {
      const table = tables.find(t => t.name === tableName);
      if (table) {
        try {
          // Use exec() with string concatenation to avoid parameter interpolation issues
          await db.exec(`DELETE FROM "${table.name}"`);
          console.log(`Cleaned data from table: ${table.name}`);
        } catch (error) {
          console.warn(`Warning: Could not clean table ${table.name}:`, error.message);
        }
      }
    }

    // Re-enable foreign keys
    try {
      await db.exec("PRAGMA foreign_keys = ON");
    } catch (error) {
      console.warn("Could not re-enable foreign keys:", error.message);
    }
  }

  async verifySchema() {
    console.log("🔍 Verifying database schema...");
    const db = await this.connect();

    try {
      // Check that users table has correct OAuth schema
      const columns = await db.sql`PRAGMA table_info(users)`;
      const hasAuth0Id = columns.some(col => col.name === "auth0_id");
      const hasApiKeyHash = columns.some(col => col.name === "api_key_hash");

      if (!hasAuth0Id) {
        throw new Error("❌ Users table missing auth0_id column - OAuth schema not applied");
      }

      if (hasApiKeyHash) {
        throw new Error("❌ Users table still has api_key_hash column - old schema detected");
      }

      console.log("✅ Schema verification passed - OAuth schema is correct");

    } catch (error) {
      console.error("❌ Schema verification failed:", error.message);
      throw error;
    }
  }

  async createTestUsers() {
    // Skip if using mock setup
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("your-test-host")) {
      return;
    }

    const db = await this.connect();

    // Define test users with OAuth schema
    const testUserDefinitions = [
      {
        id: "test-user-1",
        username: "testuser1",
        email: "test1@example.com",
        auth0_id: "auth0|test-user-1"
      },
      {
        id: "test-user-2",
        username: "testuser2",
        email: "test2@example.com",
        auth0_id: "auth0|test-user-2"
      },
      {
        id: "test-user-3",
        username: "leaderboarduser",
        email: "leaderboard@example.com",
        auth0_id: "auth0|test-user-3"
      }
    ];

    console.log("🔧 Creating test users with OAuth authentication...");

    // Create and insert test users
    for (const userDef of testUserDefinitions) {
      try {
        // Generate OAuth token
        const bearerToken = oauthHelper.generateMockToken({
          sub: userDef.auth0_id,
          email: userDef.email,
          nickname: userDef.username
        });

        // Create complete user object
        const user = {
          ...userDef,
          bearer_token: bearerToken,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Insert into database
        await db.sql`
          INSERT OR REPLACE INTO users (id, username, email, auth0_id, created_at, updated_at)
          VALUES (${user.id}, ${user.username}, ${user.email}, 
                  ${user.auth0_id}, ${user.created_at}, ${user.updated_at})
        `;

        // Add to test users array
        this.testUsers.push(user);
        console.log(`✅ Created user: ${user.username} (${user.id})`);

      } catch (error) {
        console.error(`❌ Failed to create user ${userDef.username}:`, error.message);
        throw new Error(`User creation failed for ${userDef.username}: ${error.message}`);
      }
    }

    // Configure leaderboard settings for test user 3
    const leaderboardUser = this.testUsers.find(u => u.username === "leaderboarduser");
    if (leaderboardUser) {
      try {
        await db.sql`
          UPDATE users 
          SET leaderboard_enabled = 1, 
              team_leaderboard_enabled = 1,
              display_name = 'LeaderboardDisplay',
              team_display_name = 'TeamLeaderboard',
              leaderboard_updated_at = CURRENT_TIMESTAMP
          WHERE id = ${leaderboardUser.id}
        `;
        console.log(`✅ Leaderboard settings configured for: ${leaderboardUser.username}`);
      } catch (error) {
        console.warn("Warning: Could not update leaderboard settings:", error.message);
      }
    }

    console.log(`✅ Successfully created ${this.testUsers.length} test users with OAuth authentication`);

    // Add some test usage data
    await this.seedUsageData();
  }

  async seedUsageData() {
    const db = await this.connect();
    const now = new Date();
    const today = now.toISOString().split("T")[0]; // YYYY-MM-DD format

    try {
      // Add daily aggregate data to usage_data table
      const dailyUsageData = {
        user_id: "test-user-1",
        machine_id: "test-machine-1",
        date: today,
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_tokens: 100,
        cache_read_tokens: 50,
        total_tokens: 1650,
        total_cost: 0.025,
        models_used: JSON.stringify(["claude-3-opus-20240229"]),
        model_breakdowns: JSON.stringify({
          "claude-3-opus-20240229": {
            input_tokens: 1000,
            output_tokens: 500,
            cache_creation_tokens: 100,
            cache_read_tokens: 50,
            total_cost: 0.025
          }
        }),
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      };

      await db.sql`
        INSERT OR REPLACE INTO usage_data (
          user_id, machine_id, date, input_tokens, output_tokens, 
          cache_creation_tokens, cache_read_tokens, total_tokens, total_cost,
          models_used, model_breakdowns, created_at, updated_at
        ) VALUES (
          ${dailyUsageData.user_id}, ${dailyUsageData.machine_id}, ${dailyUsageData.date},
          ${dailyUsageData.input_tokens}, ${dailyUsageData.output_tokens},
          ${dailyUsageData.cache_creation_tokens}, ${dailyUsageData.cache_read_tokens},
          ${dailyUsageData.total_tokens}, ${dailyUsageData.total_cost},
          ${dailyUsageData.models_used}, ${dailyUsageData.model_breakdowns},
          ${dailyUsageData.created_at}, ${dailyUsageData.updated_at}
        )
      `;

      // Add session-level data to usage_sessions table
      const sessionData = {
        user_id: "test-user-1",
        machine_id: "test-machine-1",
        session_id: "test-session-1",
        project_path: "/test/project",
        start_time: new Date(now.getTime() - 3600000).toISOString(), // 1 hour ago
        end_time: now.toISOString(),
        duration_minutes: 60,
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_tokens: 100,
        cache_read_tokens: 50,
        total_tokens: 1650,
        total_cost: 0.025,
        models_used: JSON.stringify(["claude-3-opus-20240229"]),
        model_breakdowns: JSON.stringify({
          "claude-3-opus-20240229": {
            input_tokens: 1000,
            output_tokens: 500,
            cache_creation_tokens: 100,
            cache_read_tokens: 50,
            total_cost: 0.025
          }
        }),
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      };

      await db.sql`
        INSERT OR REPLACE INTO usage_sessions (
          user_id, machine_id, session_id, project_path, start_time, end_time,
          duration_minutes, input_tokens, output_tokens, cache_creation_tokens,
          cache_read_tokens, total_tokens, total_cost, models_used, model_breakdowns,
          created_at, updated_at
        ) VALUES (
          ${sessionData.user_id}, ${sessionData.machine_id}, ${sessionData.session_id},
          ${sessionData.project_path}, ${sessionData.start_time}, ${sessionData.end_time},
          ${sessionData.duration_minutes}, ${sessionData.input_tokens}, ${sessionData.output_tokens},
          ${sessionData.cache_creation_tokens}, ${sessionData.cache_read_tokens},
          ${sessionData.total_tokens}, ${sessionData.total_cost}, ${sessionData.models_used},
          ${sessionData.model_breakdowns}, ${sessionData.created_at}, ${sessionData.updated_at}
        )
      `;

      console.log("✅ Test usage data seeded successfully");
    } catch (error) {
      console.warn("Warning: Could not seed usage data:", error.message);
    }
  }

  async cleanup() {
    // Skip if using mock setup
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("your-test-host")) {
      return;
    }

    const db = await this.connect();

    // Get all tables except sqlite system tables and goose version table
    const tables = await db.sql`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      AND name NOT LIKE 'sqlite_%' 
      AND name != 'goose_db_version'
      ORDER BY name
    `;

    // First, try to disable foreign key constraints
    try {
      await db.exec("PRAGMA foreign_keys = OFF");
    } catch (error) {
      console.warn("Could not disable foreign keys:", error.message);
    }

    // Clean all data from tables in proper order to handle foreign key dependencies
    // Order matters: clean child tables before parent tables
    const cleanupOrder = [
      "email_send_log",
      "team_invitations",
      "team_members",
      "user_email_preferences",
      "upload_history",
      "usage_blocks",
      "usage_sessions",
      "usage_data",
      "teams",
      "users"
    ];

    // Clean tables in dependency order
    for (const tableName of cleanupOrder) {
      const table = tables.find(t => t.name === tableName);
      if (table) {
        try {
          // Use exec() with string concatenation for DDL/DML operations to avoid parameter interpolation issues
          await db.exec(`DELETE FROM "${table.name}"`);
          console.log(`Cleaned table: ${table.name}`);
        } catch (error) {
          console.warn(`Warning: Could not clean table ${table.name}:`, error.message);
        }
      }
    }

    // Clean any remaining tables not in the cleanup order
    for (const table of tables) {
      if (!cleanupOrder.includes(table.name)) {
        try {
          await db.exec(`DELETE FROM "${table.name}"`);
          console.log(`Cleaned remaining table: ${table.name}`);
        } catch (error) {
          console.warn(`Warning: Could not clean table ${table.name}:`, error.message);
        }
      }
    }

    // Re-enable foreign key constraints
    try {
      await db.exec("PRAGMA foreign_keys = ON");
    } catch (error) {
      console.warn("Could not re-enable foreign keys:", error.message);
    }

    // Clear the test users array
    this.testUsers = [];
  }

  async close() {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  getTestUser(index = 0) {
    return this.testUsers[index];
  }

  getTestUserToken(index = 0) {
    return this.testUsers[index]?.bearer_token;
  }
}

export default new TestDatabase();
