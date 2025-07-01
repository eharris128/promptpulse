import { loadDailyUsageData, loadSessionData, loadSessionBlockData } from 'ccusage/data-loader';
import { hostname } from 'os';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getApiUrl } from './config.js';
import { showCollectionPrivacyNotice } from './privacy-notices.js';
import { enhanceWithThinkingData, analyzeProjectThinking, estimateThinkingTokens, analyzeSessionThinking } from './thinking-detection.js';
import { getValidAccessToken } from './auth-oauth.js';

function getMachineId() {
  return process.env.MACHINE_ID || hostname();
}

function sanitizeProjectPath(fullPath) {
  if (!fullPath) return null;
  
  // Get privacy setting from config (default to 'basename' for privacy)
  const privacySetting = process.env.PROJECT_PATH_PRIVACY || 'basename';
  
  switch (privacySetting) {
    case 'full':
      // Keep full path (original behavior)
      return fullPath;
    case 'basename':
      // Use only the project folder name (most private)
      const parts = fullPath.split('/').filter(p => p);
      return parts.length > 0 ? `/${parts[parts.length - 1]}` : fullPath;
    case 'hash':
      // Hash the full path for analytics while maintaining privacy
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(fullPath).digest('hex').substring(0, 8);
    case 'none':
      // Don't collect project paths at all
      return null;
    default:
      // Default to basename for privacy
      const defaultParts = fullPath.split('/').filter(p => p);
      return defaultParts.length > 0 ? `/${defaultParts[defaultParts.length - 1]}` : fullPath;
  }
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

// Get appropriate authentication headers (OAuth Bearer token or legacy API key)
async function getAuthHeaders() {
  const config = loadUserConfig();
  
  if (!config) {
    throw new Error('No authentication found. Please run: promptpulse login');
  }
  
  // Modern OAuth authentication (Device Flow)
  if (config.auth_method === 'oauth_device') {
    const accessToken = await getValidAccessToken();
    return {
      'Authorization': `Bearer ${accessToken}`
    };
  }
  
  // Legacy API key authentication (deprecated)
  if (config.apiKey) {
    console.warn('⚠️  Using legacy API key authentication. Consider upgrading: promptpulse login');
    return {
      'X-API-Key': config.apiKey
    };
  }
  
  throw new Error('Invalid authentication configuration. Please run: promptpulse login');
}

function logUpload(machineId, uploadType, recordCount, status, details = null) {
  try {
    const promptpulseDir = path.join(os.homedir(), '.promptpulse');
    if (!fs.existsSync(promptpulseDir)) {
      fs.mkdirSync(promptpulseDir, { recursive: true });
    }
    
    const logPath = path.join(promptpulseDir, 'upload.log');
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      machineId,
      uploadType,
      recordCount,
      status,
      details
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(logPath, logLine);
  } catch (error) {
    // Don't fail the upload if logging fails
    console.warn('   ⚠️  Failed to write upload log:', error.message);
  }
}

async function uploadData(endpoint, data) {
  const authHeaders = await getAuthHeaders();
  
  const response = await fetch(getApiUrl(endpoint), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

async function checkUploadHistory(machineId, records) {
  try {
    const authHeaders = await getAuthHeaders();
    
    const response = await fetch(getApiUrl('/upload-history/check'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify({
        machine_id: machineId,
        records: records
      })
    });

    if (!response.ok) {
      // If upload history check fails, log warning but continue with upload
      console.warn('   ⚠️  Upload history check failed, proceeding with full upload');
      return {};
    }

    return response.json();
  } catch (error) {
    // If upload history check fails, log warning but continue with upload
    console.warn('   ⚠️  Upload history check failed, proceeding with full upload');
    return {};
  }
}

function filterUploadedRecords(records, uploadType, existingUploads) {
  if (!existingUploads[uploadType] || existingUploads[uploadType].length === 0) {
    return records;
  }

  const existingIds = new Set(existingUploads[uploadType]);
  let identifier;
  
  return records.filter(record => {
    switch (uploadType) {
      case 'daily':
        identifier = record.date;
        break;
      case 'session':
        identifier = record.session_id;
        break;
      case 'block':
        identifier = record.block_id;
        break;
      default:
        return true;
    }
    
    return !existingIds.has(identifier);
  });
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
  if (!userConfig) {
    console.error('Error: User configuration not found');
    console.error('   Please run: promptpulse login');
    process.exit(1);
  }

  // Validate authentication method
  const isOAuthDevice = userConfig.auth_method === 'oauth_device';
  const isApiKey = userConfig.apiKey;
  
  if (!isOAuthDevice && !isApiKey) {
    console.error('Error: Invalid authentication configuration');
    console.error('   Please run: promptpulse login');
    process.exit(1);
  }

  const MACHINE_ID = getMachineId();
  // For Device Flow auth, use auth0_id as user identifier; for legacy auth, use userId
  const USER_ID = userConfig.auth0_id || userConfig.userId;
  // Authentication is now handled by getAuthHeaders() function

  try {
    console.log(`Loading Claude Code usage data (granularity: ${granularity})...`);
    console.log('');
    showCollectionPrivacyNotice();
    
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
        
        // Prepare batch upload with thinking mode analysis for daily data
        console.log('   Analyzing daily thinking mode usage...');
        const dailyRecords = await Promise.all(dailyData.map(async (day) => {
          // Try to find sessions for this day to aggregate thinking mode data
          let thinkingDetected = false;
          let estimatedThinkingTokens = 0;
          let thinkingPercentage = 0;
          
          try {
            // Get all JSONL files for the day
            const claudeDir = path.join(os.homedir(), '.claude', 'projects');
            const projectDirs = fs.existsSync(claudeDir) ? 
              fs.readdirSync(claudeDir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => path.join(claudeDir, dirent.name)) : [];
            
            let dayThinkingStats = {
              hasThinking: false,
              totalThinkingTokens: 0,
              totalTokens: 0
            };
            
            // Check each project directory for sessions on this day
            for (const projectDir of projectDirs) {
              const files = fs.existsSync(projectDir) ? fs.readdirSync(projectDir) : [];
              const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
              
              for (const file of jsonlFiles) {
                const filePath = path.join(projectDir, file);
                const stats = fs.statSync(filePath);
                const fileDate = stats.mtime.toISOString().split('T')[0];
                
                // If file was modified on this day, analyze it
                if (fileDate === day.date) {
                  const analysis = analyzeSessionThinking(filePath);
                  if (analysis && analysis.hasThinking) {
                    dayThinkingStats.hasThinking = true;
                    // Estimate thinking tokens based on content ratio
                    const sessionThinkingTokens = Math.round(day.inputTokens * analysis.thinkingPercentage);
                    dayThinkingStats.totalThinkingTokens += sessionThinkingTokens;
                  }
                }
              }
            }
            
            if (dayThinkingStats.hasThinking) {
              thinkingDetected = true;
              estimatedThinkingTokens = dayThinkingStats.totalThinkingTokens;
              const totalTokens = day.inputTokens + day.outputTokens + day.cacheCreationTokens + day.cacheReadTokens;
              thinkingPercentage = totalTokens > 0 ? estimatedThinkingTokens / totalTokens : 0;
            }
          } catch (error) {
            console.warn(`   Warning: Could not analyze thinking mode for ${day.date}: ${error.message}`);
          }
          
          const baseRecord = {
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
            model_breakdowns: day.modelBreakdowns,
            // Include aggregated thinking mode data
            thinking_mode_detected: thinkingDetected,
            thinking_tokens: estimatedThinkingTokens,
            thinking_percentage: thinkingPercentage
          };
          
          return baseRecord;
        }));

        // Check upload history to avoid duplicate uploads
        console.log('   Checking upload history...');
        const historyCheck = dailyRecords.map(record => ({
          upload_type: 'daily',
          identifier: record.date
        }));
        
        const existingUploads = await checkUploadHistory(MACHINE_ID, historyCheck);
        const newDailyRecords = filterUploadedRecords(dailyRecords, 'daily', existingUploads);
        
        if (newDailyRecords.length === 0) {
          console.log('   All daily records already uploaded, skipping');
          logUpload(MACHINE_ID, 'daily', 0, 'skipped', 'All records already uploaded');
        } else {
          console.log(`   Found ${dailyRecords.length - newDailyRecords.length} already uploaded, uploading ${newDailyRecords.length} new records`);
          await uploadData('/usage/daily/batch', { records: newDailyRecords });
          totalRecordsProcessed += newDailyRecords.length;
          console.log(`   Uploaded ${newDailyRecords.length} daily records`);
          logUpload(MACHINE_ID, 'daily', newDailyRecords.length, 'success', `Uploaded ${newDailyRecords.length} new records, ${dailyRecords.length - newDailyRecords.length} already existed`);
        }
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
        
        // Filter out sessions with zero tokens
        const filteredSessionData = sessionData.filter(session => {
          const totalTokens = (session.inputTokens || 0) + (session.outputTokens || 0) + 
                             (session.cacheCreationTokens || 0) + (session.cacheReadTokens || 0);
          return totalTokens > 0;
        });
        
        console.log(`   Filtered to ${filteredSessionData.length} sessions with usage`);
        
        // Prepare batch upload with thinking mode detection
        console.log('   Analyzing thinking mode usage...');
        const sessionRecords = filteredSessionData.map(session => {
          // Create timestamps from lastActivity date
          const activityDate = session.lastActivity ? new Date(session.lastActivity + 'T12:00:00Z') : new Date();
          const startTime = activityDate.toISOString();
          const endTime = activityDate.toISOString(); // Same as start since we don't have duration info
          
          // Extract and sanitize project path from sessionId 
          let projectPath = null;
          if (session.sessionId && session.sessionId.startsWith('-')) {
            const fullPath = session.sessionId.replace(/^-/, '/').replace(/-/g, '/');
            projectPath = sanitizeProjectPath(fullPath);
          }
          
          const baseRecord = {
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
          
          // Enhance with thinking mode data
          return enhanceWithThinkingData(baseRecord, session.sessionId);
        });

        // Check upload history to avoid duplicate uploads
        console.log('   Checking upload history...');
        const historyCheck = sessionRecords.map(record => ({
          upload_type: 'session',
          identifier: record.session_id
        }));
        
        const existingUploads = await checkUploadHistory(MACHINE_ID, historyCheck);
        const newSessionRecords = filterUploadedRecords(sessionRecords, 'session', existingUploads);
        
        if (newSessionRecords.length === 0) {
          console.log('   All session records already uploaded, skipping');
          logUpload(MACHINE_ID, 'session', 0, 'skipped', 'All records already uploaded');
        } else {
          console.log(`   Found ${sessionRecords.length - newSessionRecords.length} already uploaded, uploading ${newSessionRecords.length} new records`);
          
          // Show thinking mode statistics for uploaded sessions
          const thinkingSessions = newSessionRecords.filter(record => record.thinking_mode_detected);
          if (thinkingSessions.length > 0) {
            console.log(`   📖 Detected thinking mode in ${thinkingSessions.length}/${newSessionRecords.length} sessions`);
            const avgThinkingPercentage = thinkingSessions.reduce((sum, record) => sum + record.thinking_percentage, 0) / thinkingSessions.length;
            console.log(`   📊 Average thinking percentage: ${(avgThinkingPercentage * 100).toFixed(1)}%`);
          }
          
          await uploadData('/usage/sessions/batch', { records: newSessionRecords });
          totalRecordsProcessed += newSessionRecords.length;
          console.log(`   Uploaded ${newSessionRecords.length} session records`);
          logUpload(MACHINE_ID, 'session', newSessionRecords.length, 'success', `Uploaded ${newSessionRecords.length} new records, ${sessionRecords.length - newSessionRecords.length} already existed`);
        }
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
        
        // Filter out blocks with zero tokens
        const filteredBlockData = blockData.filter(block => {
          const totalTokens = (block.tokenCounts?.inputTokens || 0) + 
                             (block.tokenCounts?.outputTokens || 0) + 
                             (block.tokenCounts?.cacheCreationInputTokens || 0) + 
                             (block.tokenCounts?.cacheReadInputTokens || 0);
          return totalTokens > 0;
        });
        
        console.log(`   Filtered to ${filteredBlockData.length} blocks with usage`);
        
        // Prepare batch upload with thinking mode support for blocks
        console.log('   Analyzing block thinking mode usage...');
        const blockRecords = filteredBlockData.map(block => ({
          machine_id: MACHINE_ID,
          user_id: USER_ID,
          block_id: block.id,
          start_time: block.startTime,
          end_time: block.endTime,
          actual_end_time: block.actualEndTime,
          is_active: block.isActive ? 1 : 0,
          entry_count: Array.isArray(block.entries) ? block.entries.length : (block.entries || 0),
          input_tokens: block.tokenCounts?.inputTokens || 0,
          output_tokens: block.tokenCounts?.outputTokens || 0,
          cache_creation_tokens: block.tokenCounts?.cacheCreationInputTokens || 0,
          cache_read_tokens: block.tokenCounts?.cacheReadInputTokens || 0,
          total_tokens: (block.tokenCounts?.inputTokens || 0) + (block.tokenCounts?.outputTokens || 0) + (block.tokenCounts?.cacheCreationInputTokens || 0) + (block.tokenCounts?.cacheReadInputTokens || 0),
          total_cost: block.costUSD || 0,
          models_used: block.models || [],
          // For block data, we'll set conservative defaults since blocks aggregate multiple sessions
          thinking_mode_detected: false,
          thinking_tokens: 0,
          thinking_percentage: 0
        }));

        // Check upload history to avoid duplicate uploads
        console.log('   Checking upload history...');
        const historyCheck = blockRecords.map(record => ({
          upload_type: 'block',
          identifier: record.block_id
        }));
        
        const existingUploads = await checkUploadHistory(MACHINE_ID, historyCheck);
        const newBlockRecords = filterUploadedRecords(blockRecords, 'block', existingUploads);
        
        if (newBlockRecords.length === 0) {
          console.log('   All block records already uploaded, skipping');
          logUpload(MACHINE_ID, 'block', 0, 'skipped', 'All records already uploaded');
        } else {
          console.log(`   Found ${blockRecords.length - newBlockRecords.length} already uploaded, uploading ${newBlockRecords.length} new records`);
          await uploadData('/usage/blocks/batch', { records: newBlockRecords });
          totalRecordsProcessed += newBlockRecords.length;
          console.log(`   Uploaded ${newBlockRecords.length} block records`);
          logUpload(MACHINE_ID, 'block', newBlockRecords.length, 'success', `Uploaded ${newBlockRecords.length} new records, ${blockRecords.length - newBlockRecords.length} already existed`);
        }
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
    

  } catch (error) {
    console.error('Error collecting usage data:', error.message);
    logUpload(MACHINE_ID, 'error', 0, 'failed', error.message);
    if (error.message.includes('API request failed')) {
      console.error('   Please check your internet connection and try again.');
      console.error('   If the problem persists, the PromptPulse service may be temporarily unavailable.');
    }
    process.exit(1);
  }
}