import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Database } from '@sqlitecloud/drivers';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { initializeDbManager } from '../../../lib/db-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment
dotenv.config({ path: path.join(__dirname, '../../../.env.test') });

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
    console.log('Setting up test database...');
    
    // Check if DATABASE_URL is configured properly
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('your-test-host')) {
      console.warn('⚠️  DATABASE_URL not configured in .env.test');
      console.warn('   Using mock setup for development. Please configure a real test database for full testing.');
      
      // Skip database setup but create mock test users
      this.testUsers = [
        { id: 'test-user-1', api_key: 'test-api-key-1', username: 'testuser1', email: 'test1@example.com' },
        { id: 'test-user-2', api_key: 'test-api-key-2', username: 'testuser2', email: 'test2@example.com' },
        { id: 'test-user-3', api_key: 'test-api-key-3', username: 'leaderboarduser', email: 'leaderboard@example.com' }
      ];
      return;
    }
    
    // Run proper migrations using the project's migration runner
    try {
      console.log('Running database migrations...');
      await this.runMigrations();
      console.log('✅ Migrations applied successfully');
    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }

    // Create test users
    await this.createTestUsers();
  }

  async runMigrations() {
    // Use the project's migration runner for consistency
    const migrationsScript = path.join(__dirname, '../../../scripts/run-goose-migrations.js');
    
    try {
      // First, clear any existing data
      await this.clearDatabase();
      
      // Run migrations using Node.js script (works with SQLite Cloud)
      execSync(`node "${migrationsScript}"`, {
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'test' }
      });
    } catch (error) {
      throw new Error(`Migration execution failed: ${error.message}`);
    }
  }

  async clearDatabase() {
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
      await db.sql`PRAGMA foreign_keys = OFF`;
    } catch (error) {
      console.warn('Could not disable foreign keys:', error.message);
    }
    
    // Drop all tables to ensure clean slate
    for (const table of tables) {
      try {
        await db.sql`DROP TABLE IF EXISTS ${table.name}`;
        console.log(`Dropped table: ${table.name}`);
      } catch (error) {
        console.warn(`Warning: Could not drop table ${table.name}:`, error.message);
      }
    }
    
    // Re-enable foreign keys
    try {
      await db.sql`PRAGMA foreign_keys = ON`;
    } catch (error) {
      console.warn('Could not re-enable foreign keys:', error.message);
    }
  }

  async setupTablesManually(db) {
    // Create essential tables for testing
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        api_key_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS user_leaderboard_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL REFERENCES users(id),
        is_public BOOLEAN DEFAULT false,
        display_name TEXT,
        is_team_visible BOOLEAN DEFAULT false,
        team_display_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS user_email_preferences (
        user_id TEXT PRIMARY KEY REFERENCES users(id),
        weekly_report BOOLEAN DEFAULT true,
        monthly_report BOOLEAN DEFAULT true,
        achievement_notifications BOOLEAN DEFAULT true,
        team_updates BOOLEAN DEFAULT true,
        product_updates BOOLEAN DEFAULT false,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS usage_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        machine_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        project_path TEXT,
        model TEXT NOT NULL,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        cache_write_tokens INTEGER DEFAULT 0,
        cache_read_tokens INTEGER DEFAULT 0,
        total_cost REAL DEFAULT 0,
        timestamp TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS daily_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        machine_id TEXT NOT NULL,
        date TEXT NOT NULL,
        total_sessions INTEGER DEFAULT 0,
        total_blocks INTEGER DEFAULT 0,
        total_input_tokens INTEGER DEFAULT 0,
        total_output_tokens INTEGER DEFAULT 0,
        total_cache_write_tokens INTEGER DEFAULT 0,
        total_cache_read_tokens INTEGER DEFAULT 0,
        total_cost REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        invite_code TEXT UNIQUE NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS team_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id TEXT NOT NULL REFERENCES teams(id),
        user_id TEXT NOT NULL REFERENCES users(id),
        role TEXT NOT NULL DEFAULT 'member',
        joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(team_id, user_id)
      )`
    ];

    for (const sql of tables) {
      await db.sql(sql);
    }
    
    console.log('Test tables created successfully');
  }

  async createTestUsers() {
    // Skip if using mock setup
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('your-test-host')) {
      return;
    }
    
    const db = await this.connect();
    
    // Create main test user
    const mainUser = {
      id: 'test-user-1',
      username: 'testuser1',
      email: 'test1@example.com',
      api_key: 'test-api-key-1',
      api_key_hash: await bcrypt.hash('test-api-key-1', 10),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Create secondary test user for team tests
    const secondUser = {
      id: 'test-user-2',
      username: 'testuser2',
      email: 'test2@example.com',
      api_key: 'test-api-key-2',
      api_key_hash: await bcrypt.hash('test-api-key-2', 10),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Create user for leaderboard tests (with opt-in)
    const leaderboardUser = {
      id: 'test-user-3',
      username: 'leaderboarduser',
      email: 'leaderboard@example.com',
      api_key: 'test-api-key-3',
      api_key_hash: await bcrypt.hash('test-api-key-3', 10),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Insert users with conflict handling
    for (const user of [mainUser, secondUser, leaderboardUser]) {
      try {
        await db.sql`
          INSERT OR REPLACE INTO users (id, username, email, api_key_hash, created_at, updated_at)
          VALUES (${user.id}, ${user.username}, ${user.email}, 
                  ${user.api_key_hash}, ${user.created_at}, ${user.updated_at})
        `;
        this.testUsers.push(user);
        console.log(`Created test user: ${user.username} (${user.id})`);
      } catch (error) {
        console.warn(`Warning: Could not create user ${user.id}:`, error.message);
        // Still add to testUsers array for consistency
        this.testUsers.push(user);
      }
    }

    // Set up leaderboard settings for the third user (with conflict handling)
    try {
      await db.sql`
        INSERT OR REPLACE INTO user_leaderboard_settings (user_id, is_public, display_name, is_team_visible, team_display_name)
        VALUES (${leaderboardUser.id}, true, 'LeaderboardDisplay', true, 'TeamLeaderboard')
      `;
    } catch (error) {
      console.warn('Warning: Could not create leaderboard settings:', error.message);
    }

    // Add some test usage data
    await this.seedUsageData();
  }

  async seedUsageData() {
    const db = await this.connect();
    const now = new Date();
    
    // Add usage data for main test user
    const usageData = {
      user_id: 'test-user-1',
      machine_id: 'test-machine-1',
      session_id: 'test-session-1',
      project_path: '/test/project',
      model: 'claude-3-opus-20240229',
      input_tokens: 1000,
      output_tokens: 500,
      cache_write_tokens: 100,
      cache_read_tokens: 50,
      total_cost: 0.025,
      timestamp: now.toISOString(),
      created_at: now.toISOString()
    };

    await db.sql`
      INSERT INTO usage_data (
        user_id, machine_id, session_id, project_path, model,
        input_tokens, output_tokens, cache_write_tokens, cache_read_tokens,
        total_cost, timestamp, created_at
      ) VALUES (
        ${usageData.user_id}, ${usageData.machine_id}, ${usageData.session_id}, 
        ${usageData.project_path}, ${usageData.model}, ${usageData.input_tokens}, 
        ${usageData.output_tokens}, ${usageData.cache_write_tokens}, 
        ${usageData.cache_read_tokens}, ${usageData.total_cost}, 
        ${usageData.timestamp}, ${usageData.created_at}
      )
    `;

    // Add daily aggregate data
    await db.sql`
      INSERT INTO daily_usage (
        user_id, machine_id, date, total_sessions, total_blocks,
        total_input_tokens, total_output_tokens, total_cache_write_tokens,
        total_cache_read_tokens, total_cost, created_at, updated_at
      ) VALUES (
        'test-user-1', 'test-machine-1', ${now.toISOString().split('T')[0]},
        1, 5, 1000, 500, 100, 50, 0.025, ${now.toISOString()}, ${now.toISOString()}
      )
    `;
  }

  async cleanup() {
    // Skip if using mock setup
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('your-test-host')) {
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
      await db.sql`PRAGMA foreign_keys = OFF`;
    } catch (error) {
      console.warn('Could not disable foreign keys:', error.message);
    }

    // Clean all data from tables (keep schema intact)
    for (const table of tables) {
      try {
        await db.sql`DELETE FROM ${table.name}`;
        console.log(`Cleaned table: ${table.name}`);
      } catch (error) {
        console.warn(`Warning: Could not clean table ${table.name}:`, error.message);
      }
    }

    // Re-enable foreign key constraints
    try {
      await db.sql`PRAGMA foreign_keys = ON`;
    } catch (error) {
      console.warn('Could not re-enable foreign keys:', error.message);
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
}

export default new TestDatabase();