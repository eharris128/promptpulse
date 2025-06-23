import { loadDailyUsageData, loadSessionData, loadSessionBlockData } from 'ccusage/data-loader';
import { hostname } from 'os';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getApiUrl } from './config.js';

function getMachineId() {
  return process.env.MACHINE_ID || hostname();
}

function loadUserConfig() {
  try {
    const configPath = path.join(os.homedir(), '.promptpulse', 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config;
    }
  } catch (error) {
    console.error('Error loading user config:', error.message);
  }
  return null;
}

async function uploadData(endpoint, data, apiKey) {
  const response = await fetch(getApiUrl(endpoint), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export async function collect(options = {}) {
  const granularity = options.granularity || 'all';
  const validGranularities = ['daily', 'session', 'blocks', 'all'];
  
  if (!validGranularities.includes(granularity)) {
    console.error(`❌ Error: Invalid granularity '${granularity}'`);
    console.error(`   Valid options: ${validGranularities.join(', ')}`);
    process.exit(1);
  }

  // Load user configuration
  const userConfig = loadUserConfig();
  if (!userConfig || !userConfig.userId || !userConfig.apiKey) {
    console.error('❌ Error: User configuration not found or incomplete');
    console.error('   Please run: promptpulse user init');
    process.exit(1);
  }

  const MACHINE_ID = getMachineId();
  const USER_ID = userConfig.userId;
  const API_KEY = userConfig.apiKey;

  try {
    console.log(`🔄 Loading Claude Code usage data (granularity: ${granularity})...`);
    
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
        
        // Prepare batch upload
        const dailyRecords = dailyData.map(day => ({
          machine_id: MACHINE_ID,
          user_id: USER_ID,
          date: day.date,
          input_tokens: day.inputTokens,
          output_tokens: day.outputTokens,
          cache_creation_tokens: day.cacheCreationTokens,
          cache_read_tokens: day.cacheReadTokens,
          total_tokens: day.inputTokens + day.outputTokens + day.cacheCreationTokens + day.cacheReadTokens,
          total_cost: day.totalCost,
          models_used: day.modelsUsed,
          model_breakdowns: day.modelBreakdowns
        }));

        console.log('   📤 Uploading daily data...');
        await uploadData('/usage/daily/batch', { records: dailyRecords }, API_KEY);
        totalRecordsProcessed += dailyRecords.length;
        console.log(`   ✅ Uploaded ${dailyRecords.length} daily records`);
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
        
        // Prepare batch upload
        const sessionRecords = sessionData.sessions.map(session => ({
          machine_id: MACHINE_ID,
          user_id: USER_ID,
          session_id: session.sessionId,
          project_path: session.sessionId?.replace(/^-/, '/').replace(/-/g, '/') || null,
          start_time: session.startTime,
          end_time: session.endTime,
          duration_minutes: session.duration ? Math.round(session.duration / 60000) : null,
          input_tokens: session.inputTokens || 0,
          output_tokens: session.outputTokens || 0,
          cache_creation_tokens: session.cacheCreationTokens || 0,
          cache_read_tokens: session.cacheReadTokens || 0,
          total_tokens: (session.inputTokens || 0) + (session.outputTokens || 0) + (session.cacheCreationTokens || 0) + (session.cacheReadTokens || 0),
          total_cost: session.totalCost || 0,
          models_used: session.modelsUsed || [],
          model_breakdowns: session.modelBreakdowns || {}
        }));

        console.log('   📤 Uploading session data...');
        await uploadData('/usage/sessions/batch', { records: sessionRecords }, API_KEY);
        totalRecordsProcessed += sessionRecords.length;
        console.log(`   ✅ Uploaded ${sessionRecords.length} session records`);
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
        
        // Prepare batch upload
        const blockRecords = blockData.blocks.map(block => ({
          machine_id: MACHINE_ID,
          user_id: USER_ID,
          block_id: block.id,
          start_time: block.startTime,
          end_time: block.endTime,
          actual_end_time: block.actualEndTime,
          is_active: block.isActive ? 1 : 0,
          entry_count: block.entries || 0,
          input_tokens: block.tokenCounts?.inputTokens || 0,
          output_tokens: block.tokenCounts?.outputTokens || 0,
          cache_creation_tokens: block.tokenCounts?.cacheCreationInputTokens || 0,
          cache_read_tokens: block.tokenCounts?.cacheReadInputTokens || 0,
          total_tokens: block.totalTokens || 0,
          total_cost: block.costUSD || 0,
          models_used: block.models || []
        }));

        console.log('   📤 Uploading block data...');
        await uploadData('/usage/blocks/batch', { records: blockRecords }, API_KEY);
        totalRecordsProcessed += blockRecords.length;
        console.log(`   ✅ Uploaded ${blockRecords.length} block records`);
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
    if (error.message.includes('API request failed')) {
      console.error('   Please check your internet connection and try again.');
      console.error('   If the problem persists, the PromptPulse service may be temporarily unavailable.');
    }
    process.exit(1);
  }
}