import { loadDailyUsageData, loadSessionData, loadSessionBlockData } from 'ccusage/data-loader';
import { hostname } from 'os';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getApiUrl } from './config.js';
import environmentalService from './environmental-service.js';
import { aggregateEnvironmentalData } from './environmental-utils.js';

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

/**
 * Enrich usage records with environmental data
 * @param {Array} records - Usage records
 * @param {string} type - Type of records (daily, session, block)
 * @returns {Promise<Array>} Records with environmental data
 */
async function enrichWithEnvironmentalData(records, type) {
  if (!environmentalService.isEnabled()) {
    console.log(`   Environmental tracking disabled, skipping ${type} environmental calculations`);
    return records;
  }

  console.log(`   Calculating environmental impact for ${records.length} ${type} records...`);
  
  const enrichedRecords = [];
  for (const record of records) {
    try {
      // Determine the model used - use most common model from breakdowns or default
      let model = 'claude-3-5-sonnet-20241022'; // Default model
      if (record.model_breakdowns && typeof record.model_breakdowns === 'object') {
        const models = Object.keys(record.model_breakdowns);
        if (models.length > 0) {
          // Use the model with the most tokens
          model = models.reduce((a, b) => 
            (record.model_breakdowns[a]?.totalTokens || 0) > (record.model_breakdowns[b]?.totalTokens || 0) ? a : b
          );
        }
      } else if (record.models_used && record.models_used.length > 0) {
        model = record.models_used[0];
      }

      const usageData = {
        model: model,
        input_tokens: record.input_tokens || 0,
        output_tokens: record.output_tokens || 0,
        timestamp: record.start_time || record.date || new Date().toISOString(),
        location: 'us-west-1' // Default location, could be configurable
      };

      const environmental = await environmentalService.calculateImpact(usageData);
      
      enrichedRecords.push({
        ...record,
        // Add environmental fields
        energy_wh: environmental?.energy_wh || null,
        co2_emissions_g: environmental?.co2_emissions_g || null,
        carbon_intensity_g_kwh: environmental?.carbon_intensity_g_kwh || null,
        tree_equivalent: environmental?.tree_equivalent || null,
        environmental_source: environmental?.source || null
      });
    } catch (error) {
      console.warn(`   Warning: Failed to calculate environmental impact for ${type} record:`, error.message);
      // Add record without environmental data
      enrichedRecords.push({
        ...record,
        energy_wh: null,
        co2_emissions_g: null,
        carbon_intensity_g_kwh: null,
        tree_equivalent: null,
        environmental_source: null
      });
    }
  }

  const successCount = enrichedRecords.filter(r => r.environmental_source).length;
  console.log(`   Environmental calculations completed: ${successCount}/${records.length} successful`);
  
  return enrichedRecords;
}

export async function collect(options = {}) {
  const granularity = options.granularity || 'all';
  const validGranularities = ['daily', 'session', 'blocks', 'all'];
  
  if (!validGranularities.includes(granularity)) {
    console.error(`Error: Invalid granularity '${granularity}'`);
    console.error(`   Valid options: ${validGranularities.join(', ')}`);
    process.exit(1);
  }

  // Load user configuration
  const userConfig = loadUserConfig();
  if (!userConfig || !userConfig.userId || !userConfig.apiKey) {
    console.error('Error: User configuration not found or incomplete');
    console.error('   Please run: promptpulse login');
    process.exit(1);
  }

  const MACHINE_ID = getMachineId();
  const USER_ID = userConfig.userId;
  const API_KEY = userConfig.apiKey;

  try {
    console.log(`Loading Claude Code usage data (granularity: ${granularity})...`);
    console.log('');
    console.log('Privacy Notice: PromptPulse only collects usage statistics.');
    console.log('Your prompts and conversation content are NEVER uploaded or stored.');
    console.log('');
    
    let totalRecordsProcessed = 0;
    
    // Collect daily data
    if (granularity === 'daily' || granularity === 'all') {
      console.log('\nProcessing daily data...');
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

        // Enrich with environmental data
        const enrichedDailyRecords = await enrichWithEnvironmentalData(dailyRecords, 'daily');

        console.log('   Uploading daily data...');
        await uploadData('/usage/daily/batch', { records: enrichedDailyRecords }, API_KEY);
        totalRecordsProcessed += dailyRecords.length;
        console.log(`   Uploaded ${dailyRecords.length} daily records`);
      } else {
        console.log('   No daily data found');
      }
    }
    
    // Collect session data
    if (granularity === 'session' || granularity === 'all') {
      console.log('\nProcessing session data...');
      const sessionData = await loadSessionData({
        mode: 'calculate',
        offline: false
      });

      if (sessionData && sessionData.length > 0) {
        console.log(`   Found ${sessionData.length} sessions`);
        
        // Prepare batch upload
        const sessionRecords = sessionData.map(session => {
          // Create timestamps from lastActivity date
          const activityDate = session.lastActivity ? new Date(session.lastActivity + 'T12:00:00Z') : new Date();
          const startTime = activityDate.toISOString();
          const endTime = activityDate.toISOString(); // Same as start since we don't have duration info
          
          // Extract project path from sessionId 
          let projectPath = null;
          if (session.sessionId && session.sessionId.startsWith('-')) {
            projectPath = session.sessionId.replace(/^-/, '/').replace(/-/g, '/');
          }
          
          return {
            machine_id: MACHINE_ID,
            user_id: USER_ID,
            session_id: session.sessionId,
            project_path: projectPath,
            start_time: startTime,
            end_time: endTime,
            duration_minutes: null, // ccusage doesn't provide duration info
            input_tokens: session.inputTokens || 0,
            output_tokens: session.outputTokens || 0,
            cache_creation_tokens: session.cacheCreationTokens || 0,
            cache_read_tokens: session.cacheReadTokens || 0,
            total_tokens: (session.inputTokens || 0) + (session.outputTokens || 0) + (session.cacheCreationTokens || 0) + (session.cacheReadTokens || 0),
            total_cost: session.totalCost || 0,
            models_used: session.modelsUsed || [],
            model_breakdowns: session.modelBreakdowns || {}
          };
        });

        // Enrich with environmental data
        const enrichedSessionRecords = await enrichWithEnvironmentalData(sessionRecords, 'session');

        console.log('   Uploading session data...');
        await uploadData('/usage/sessions/batch', { records: enrichedSessionRecords }, API_KEY);
        totalRecordsProcessed += sessionRecords.length;
        console.log(`   Uploaded ${sessionRecords.length} session records`);
      } else {
        console.log('   No session data found');
      }
    }
    
    // Collect block data
    if (granularity === 'blocks' || granularity === 'all') {
      console.log('\nProcessing block data...');
      const blockData = await loadSessionBlockData({
        mode: 'calculate',
        offline: false
      });

      if (blockData && blockData.length > 0) {
        console.log(`   Found ${blockData.length} blocks`);
        
        // Prepare batch upload
        const blockRecords = blockData.map(block => ({
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

        // Enrich with environmental data
        const enrichedBlockRecords = await enrichWithEnvironmentalData(blockRecords, 'block');

        console.log('   Uploading block data...');
        await uploadData('/usage/blocks/batch', { records: enrichedBlockRecords }, API_KEY);
        totalRecordsProcessed += blockRecords.length;
        console.log(`   Uploaded ${blockRecords.length} block records`);
      } else {
        console.log('   No block data found');
      }
    }

    if (totalRecordsProcessed === 0) {
      console.log('\nNo usage data found.');
      console.log('   Make sure you have used Claude Code and have data in ~/.claude/projects/');
      return;
    }

    console.log('\nUpload successful!');
    console.log(`Total records processed: ${totalRecordsProcessed}`);
    console.log(`Machine ID: ${MACHINE_ID}`);
    
    // Display environmental impact summary if tracking is enabled
    if (environmentalService.isEnabled()) {
      console.log('\n🌱 Environmental Impact Summary:');
      if (environmentalService.getCacheStats().size > 0) {
        console.log(`   Environmental calculations: ${environmentalService.getCacheStats().size} cached results`);
        console.log('   Your usage data now includes carbon footprint tracking!');
        console.log('   View your environmental impact in the PromptPulse dashboard.');
      } else {
        console.log('   Environmental tracking enabled but no calculations performed.');
        console.log('   Environmental data will be calculated for future usage.');
      }
    }

  } catch (error) {
    console.error('Error collecting usage data:', error.message);
    if (error.message.includes('API request failed')) {
      console.error('   Please check your internet connection and try again.');
      console.error('   If the problem persists, the PromptPulse service may be temporarily unavailable.');
    }
    process.exit(1);
  }
}