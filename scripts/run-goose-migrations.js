#!/usr/bin/env node

/**
 * Run Goose Migrations on SQLite Cloud
 * 
 * This script applies Goose-formatted migrations to SQLite Cloud database
 * since Goose CLI doesn't natively support SQLite Cloud connection strings.
 */

import { initializeDbManager, getDbManager } from '../lib/db-manager.js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class GooseMigrationRunner {
  constructor() {
    this.dbManager = null;
  }

  async run() {
    console.log('🦆 Starting Goose migrations on SQLite Cloud...\n');
    
    // Initialize database manager
    this.dbManager = await initializeDbManager(process.env.DATABASE_URL);
    const db = await this.dbManager.getConnection();
    
    try {
      // Create goose version tracking table
      await this.createVersionTable(db);
      
      // Get migration files
      const migrationsDir = join(__dirname, '..', 'goose_migrations');
      const migrationFiles = readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();
      
      console.log(`Found ${migrationFiles.length} migration files\n`);
      
      // Apply each migration
      for (const file of migrationFiles) {
        const version = this.extractVersion(file);
        
        // Check if already applied
        const applied = await this.isApplied(db, version);
        if (applied) {
          console.log(`✓ ${file} (already applied)`);
          continue;
        }
        
        // Read and parse migration file
        const filePath = join(migrationsDir, file);
        const content = readFileSync(filePath, 'utf8');
        const upSQL = this.extractUpMigration(content);
        
        if (!upSQL) {
          console.error(`❌ No '-- +goose Up' section found in ${file}`);
          continue;
        }
        
        // Apply migration
        console.log(`⏳ Applying ${file}...`);
        
        try {
          // Start transaction
          await db.sql`BEGIN TRANSACTION`;
          
          // Execute migration SQL
          const statements = this.splitStatements(upSQL);
          for (const statement of statements) {
            if (statement.trim()) {
              await db.sql(statement);
            }
          }
          
          // Record version
          await db.sql`
            INSERT INTO goose_db_version (version_id, is_applied, tstamp)
            VALUES (${version}, 1, datetime('now'))
          `;
          
          // Commit transaction
          await db.sql`COMMIT`;
          
          console.log(`✅ Applied ${file}`);
        } catch (error) {
          await db.sql`ROLLBACK`;
          console.error(`❌ Failed to apply ${file}:`, error.message);
          throw error;
        }
      }
      
      console.log('\n✨ All migrations completed successfully!');
      
      // Show final status
      await this.showStatus(db);
      
    } finally {
      await this.dbManager.releaseConnection(db);
      await this.dbManager.shutdown();
    }
  }

  async createVersionTable(db) {
    // Create Goose's standard version tracking table
    await db.sql`
      CREATE TABLE IF NOT EXISTS goose_db_version (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version_id INTEGER NOT NULL,
        is_applied INTEGER NOT NULL,
        tstamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
  }

  async isApplied(db, version) {
    const result = await db.sql`
      SELECT 1 FROM goose_db_version 
      WHERE version_id = ${version} AND is_applied = 1
      LIMIT 1
    `;
    return result.length > 0;
  }

  extractVersion(filename) {
    // Extract version number from filename (e.g., 20240101000001 from 20240101000001_create_users.sql)
    const match = filename.match(/^(\d+)_/);
    return match ? parseInt(match[1]) : 0;
  }

  extractUpMigration(content) {
    // Extract content between -- +goose Up and -- +goose Down
    const upMatch = content.match(/-- \+goose Up\s*\n([\s\S]*?)(?=-- \+goose Down|$)/);
    return upMatch ? upMatch[1].trim() : null;
  }

  splitStatements(sql) {
    // Split SQL into individual statements
    // Handle CREATE TRIGGER specially as it contains semicolons
    const statements = [];
    let current = '';
    let inTrigger = false;
    
    const lines = sql.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim().toUpperCase();
      
      if (trimmed.startsWith('CREATE TRIGGER')) {
        inTrigger = true;
      }
      
      current += line + '\n';
      
      if (inTrigger && trimmed === 'END;') {
        statements.push(current.trim());
        current = '';
        inTrigger = false;
      } else if (!inTrigger && line.trim().endsWith(';')) {
        statements.push(current.trim());
        current = '';
      }
    }
    
    if (current.trim()) {
      statements.push(current.trim());
    }
    
    return statements;
  }

  async showStatus(db) {
    console.log('\n📊 Migration Status:');
    
    const versions = await db.sql`
      SELECT version_id, tstamp 
      FROM goose_db_version 
      WHERE is_applied = 1 
      ORDER BY version_id
    `;
    
    console.log('\nApplied migrations:');
    for (const v of versions) {
      console.log(`  Version ${v.version_id} - ${v.tstamp}`);
    }
    
    // List tables created
    const tables = await db.sql`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'goose_db_version'
      ORDER BY name
    `;
    
    console.log('\n📋 Tables created:');
    for (const t of tables) {
      console.log(`  - ${t.name}`);
    }
  }
}

// Main execution
async function main() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment variables');
    process.exit(1);
  }
  
  if (!connectionString.includes('sqlitecloud://')) {
    console.error('❌ This script is designed for SQLite Cloud connections');
    console.error('   For local SQLite files, use: goose -dir goose_migrations sqlite3 <file> up');
    process.exit(1);
  }
  
  // Special handling for test environment
  if (process.env.NODE_ENV === 'test') {
    console.log('🧪 Running migrations in TEST environment');
  }
  
  // Check if status command was requested
  if (process.argv[2] === 'status') {
    const runner = new GooseMigrationRunner();
    const dbManager = await initializeDbManager(connectionString);
    const db = await dbManager.getConnection();
    
    try {
      await runner.createVersionTable(db);
      await runner.showStatus(db);
    } finally {
      await dbManager.releaseConnection(db);
      await dbManager.shutdown();
    }
    
    process.exit(0);
  }
  
  const runner = new GooseMigrationRunner();
  
  try {
    await runner.run();
    process.exit(0); // Explicitly exit after success
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();