import { loadDailyUsageData, loadSessionData, loadSessionBlockData } from 'ccusage/data-loader';
import { hostname } from 'os';
import { Database } from '@sqlitecloud/drivers';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the package root
dotenv.config({ path: join(__dirname, '..', '.env') });

function getMachineId() {
  return process.env.MACHINE_ID || hostname();
}

function loadUserConfig() {
  try {
    const configPath = join(os.homedir(), '.promptpulse', 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config;
    }
  } catch (error) {
    console.error('Error loading user config:', error.message);
  }
  return null;
}

export async function collect(options = {}) {
  const granularity = options.granularity || 'all';
  const validGranularities = ['daily', 'session', 'blocks', 'all'];
  
  if (!validGranularities.includes(granularity)) {
    console.error(`❌ Error: Invalid granularity '${granularity}'`);
    console.error(`   Valid options: ${validGranularities.join(', ')}`);
    process.exit(1);
  }
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL environment variable is not set');
    console.error('   Please set DATABASE_URL in your environment or .env file');
    process.exit(1);
  }

  // Load user configuration
  const userConfig = loadUserConfig();
  if (!userConfig || !userConfig.userId) {
    console.error('❌ Error: User configuration not found');
    console.error('   Please run: promptpulse user init');
    process.exit(1);
  }

  const MACHINE_ID = getMachineId();
  const USER_ID = userConfig.userId;
  let db;

  try {
    console.log(`🔄 Loading Claude Code usage data (granularity: ${granularity})...`);
    
    // Connect to database first
    console.log('🔗 Connecting to database...');
    db = new Database(DATABASE_URL);
    
    let totalRecordsProcessed = 0;
    
    // Collect daily data
    if (granularity === 'daily' || granularity === 'all') {
      console.log('\n📅 Processing daily data...');
      const dailyData = await loadDailyUsageData({
        mode: 'calculate',
        offline: false
      });

      if (dailyData.length > 0) {
        console.log(`   Found ${dailyData.length} days of usage data`);
        
        for (const day of dailyData) {
          await db.sql`
            INSERT OR REPLACE INTO usage_data (
              machine_id, user_id, date, input_tokens, output_tokens, 
              cache_creation_tokens, cache_read_tokens, total_tokens,
              total_cost, models_used, model_breakdowns
            ) VALUES (
              ${MACHINE_ID},
              ${USER_ID},
              ${day.date},
              ${day.inputTokens},
              ${day.outputTokens},
              ${day.cacheCreationTokens},
              ${day.cacheReadTokens},
              ${day.inputTokens + day.outputTokens + day.cacheCreationTokens + day.cacheReadTokens},
              ${day.totalCost},
              ${JSON.stringify(day.modelsUsed)},
              ${JSON.stringify(day.modelBreakdowns)}
            )
          `;
          totalRecordsProcessed++;
        }
        console.log(`   ✅ Processed ${dailyData.length} daily records`);
      } else {
        console.log('   ℹ️  No daily data found');
      }
    }
    
    // Collect session data
    if (granularity === 'session' || granularity === 'all') {
      console.log('\n💬 Processing session data...');
      const sessionData = await loadSessionData({
        mode: 'calculate',
        offline: false
      });

      if (sessionData.sessions && sessionData.sessions.length > 0) {
        console.log(`   Found ${sessionData.sessions.length} sessions`);
        
        for (const session of sessionData.sessions) {
          // Extract project path from session ID (format: -home-user-projects-name)
          const projectPath = session.sessionId?.replace(/^-/, '/').replace(/-/g, '/') || null;
          
          await db.sql`
            INSERT OR REPLACE INTO usage_sessions (
              machine_id, user_id, session_id, project_path, start_time, end_time,
              duration_minutes, input_tokens, output_tokens, 
              cache_creation_tokens, cache_read_tokens, total_tokens,
              total_cost, models_used, model_breakdowns
            ) VALUES (
              ${MACHINE_ID},
              ${USER_ID},
              ${session.sessionId},
              ${projectPath},
              ${session.startTime},
              ${session.endTime},
              ${session.duration ? Math.round(session.duration / 60000) : null},
              ${session.inputTokens || 0},
              ${session.outputTokens || 0},
              ${session.cacheCreationTokens || 0},
              ${session.cacheReadTokens || 0},
              ${(session.inputTokens || 0) + (session.outputTokens || 0) + (session.cacheCreationTokens || 0) + (session.cacheReadTokens || 0)},
              ${session.totalCost || 0},
              ${JSON.stringify(session.modelsUsed || [])},
              ${JSON.stringify(session.modelBreakdowns || {})}
            )
          `;
          totalRecordsProcessed++;
        }
        console.log(`   ✅ Processed ${sessionData.sessions.length} session records`);
      } else {
        console.log('   ℹ️  No session data found');
      }
    }
    
    // Collect block data
    if (granularity === 'blocks' || granularity === 'all') {
      console.log('\n📦 Processing block data...');
      const blockData = await loadSessionBlockData({
        mode: 'calculate',
        offline: false
      });

      if (blockData.blocks && blockData.blocks.length > 0) {
        console.log(`   Found ${blockData.blocks.length} blocks`);
        
        for (const block of blockData.blocks) {
          await db.sql`
            INSERT OR REPLACE INTO usage_blocks (
              machine_id, user_id, block_id, start_time, end_time, actual_end_time,
              is_active, entry_count, input_tokens, output_tokens, 
              cache_creation_tokens, cache_read_tokens, total_tokens,
              total_cost, models_used
            ) VALUES (
              ${MACHINE_ID},
              ${USER_ID},
              ${block.id},
              ${block.startTime},
              ${block.endTime},
              ${block.actualEndTime},
              ${block.isActive ? 1 : 0},
              ${block.entries || 0},
              ${block.tokenCounts?.inputTokens || 0},
              ${block.tokenCounts?.outputTokens || 0},
              ${block.tokenCounts?.cacheCreationInputTokens || 0},
              ${block.tokenCounts?.cacheReadInputTokens || 0},
              ${block.totalTokens || 0},
              ${block.costUSD || 0},
              ${JSON.stringify(block.models || [])}
            )
          `;
          totalRecordsProcessed++;
        }
        console.log(`   ✅ Processed ${blockData.blocks.length} block records`);
      } else {
        console.log('   ℹ️  No block data found');
      }
    }

    if (totalRecordsProcessed === 0) {
      console.log('\nℹ️  No usage data found.');
      console.log('   Make sure you have used Claude Code and have data in ~/.claude/projects/');
      return;
    }

    console.log('\n✅ Upload successful!');
    console.log(`📊 Total records processed: ${totalRecordsProcessed}`);
    console.log(`🖥️  Machine ID: ${MACHINE_ID}`);

  } catch (error) {
    console.error('❌ Error collecting usage data:', error.message);
    process.exit(1);
  } finally {
    if (db) {
      await db.close();
    }
  }
}