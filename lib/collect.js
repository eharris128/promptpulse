import { loadDailyUsageData } from 'ccusage/data-loader';
import { hostname } from 'os';
import { Database } from '@sqlitecloud/drivers';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the package root
dotenv.config({ path: join(__dirname, '..', '.env') });

function getMachineId() {
  return process.env.MACHINE_ID || hostname();
}

export async function collect() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL environment variable is not set');
    console.error('   Please set DATABASE_URL in your environment or .env file');
    process.exit(1);
  }

  const MACHINE_ID = getMachineId();
  let db;

  try {
    console.log('🔄 Loading Claude Code usage data...');
    
    // Load daily usage data using ccusage
    const dailyData = await loadDailyUsageData({
      mode: 'calculate',
      offline: false
    });

    if (dailyData.length === 0) {
      console.log('ℹ️  No usage data found.');
      console.log('   Make sure you have used Claude Code and have data in ~/.claude/projects/');
      return;
    }

    console.log(`📊 Found ${dailyData.length} days of usage data`);

    // Format data for database
    const formattedData = dailyData.map(day => ({
      date: day.date,
      inputTokens: day.inputTokens,
      outputTokens: day.outputTokens,
      cacheCreationTokens: day.cacheCreationTokens,
      cacheReadTokens: day.cacheReadTokens,
      totalTokens: day.inputTokens + day.outputTokens + day.cacheCreationTokens + day.cacheReadTokens,
      totalCost: day.totalCost,
      modelsUsed: day.modelsUsed,
      modelBreakdowns: day.modelBreakdowns
    }));

    // Connect to database
    console.log('🔗 Connecting to database...');
    db = new Database(DATABASE_URL);

    // Upload data
    console.log(`📤 Uploading data for machine: ${MACHINE_ID}`);
    
    let recordsProcessed = 0;
    for (const dayData of formattedData) {
      await db.sql`
        INSERT OR REPLACE INTO usage_data (
          machine_id, date, input_tokens, output_tokens, 
          cache_creation_tokens, cache_read_tokens, total_tokens,
          total_cost, models_used, model_breakdowns
        ) VALUES (
          ${MACHINE_ID},
          ${dayData.date},
          ${dayData.inputTokens},
          ${dayData.outputTokens},
          ${dayData.cacheCreationTokens},
          ${dayData.cacheReadTokens},
          ${dayData.totalTokens},
          ${dayData.totalCost},
          ${JSON.stringify(dayData.modelsUsed)},
          ${JSON.stringify(dayData.modelBreakdowns)}
        )
      `;
      recordsProcessed++;
    }

    console.log('✅ Upload successful!');
    console.log(`📊 Processed ${recordsProcessed} records`);
    console.log(`🖥️  Machine ID: ${MACHINE_ID}`);
    
    // Show summary
    const totalCost = formattedData.reduce((sum, day) => sum + day.totalCost, 0);
    const totalTokens = formattedData.reduce((sum, day) => sum + day.totalTokens, 0);
    
    console.log('\n📈 Summary:');
    console.log(`   Total days: ${formattedData.length}`);
    console.log(`   Total tokens: ${totalTokens.toLocaleString()}`);
    console.log(`   Total cost: $${totalCost.toFixed(2)}`);

  } catch (error) {
    console.error('❌ Error collecting usage data:', error.message);
    process.exit(1);
  } finally {
    if (db) {
      await db.close();
    }
  }
}