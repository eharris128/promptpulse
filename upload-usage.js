#!/usr/bin/env node

import { loadDailyUsageData } from 'ccusage/data-loader';
import { createHash } from 'crypto';
import { hostname } from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to get machine ID
function getMachineId() {
  // Use environment variable if set, otherwise use hostname
  return process.env.MACHINE_ID || hostname();
}

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const MACHINE_ID = getMachineId();

async function uploadUsageData() {
  try {
    console.log('Loading Claude Code usage data...');
    
    // Load daily usage data using ccusage
    const dailyData = await loadDailyUsageData({
      mode: 'calculate', // Calculate costs from tokens
      offline: false     // Use online pricing data
    });

    if (dailyData.length === 0) {
      console.log('No usage data found. Make sure you have used Claude Code and have data in ~/.claude/projects/');
      return;
    }

    console.log(`Found ${dailyData.length} days of usage data`);

    // Format data for our API
    const formattedData = dailyData.map(day => ({
      date: day.date, // Format: YYYY-MM-DD
      inputTokens: day.inputTokens,
      outputTokens: day.outputTokens,
      cacheCreationTokens: day.cacheCreationTokens,
      cacheReadTokens: day.cacheReadTokens,
      totalTokens: day.inputTokens + day.outputTokens + day.cacheCreationTokens + day.cacheReadTokens,
      totalCost: day.totalCost,
      modelsUsed: day.modelsUsed,
      modelBreakdowns: day.modelBreakdowns
    }));

    // Upload to server
    console.log(`Uploading data for machine: ${MACHINE_ID}`);
    
    const response = await fetch(`${SERVER_URL}/api/usage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        machineId: MACHINE_ID,
        data: formattedData
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Upload successful!');
    console.log(`📊 Processed ${result.recordsProcessed} records`);
    console.log(`🖥️  Machine ID: ${MACHINE_ID}`);
    
    // Show summary
    const totalCost = formattedData.reduce((sum, day) => sum + day.totalCost, 0);
    const totalTokens = formattedData.reduce((sum, day) => sum + day.totalTokens, 0);
    
    console.log('\n📈 Summary:');
    console.log(`   Total days: ${formattedData.length}`);
    console.log(`   Total tokens: ${totalTokens.toLocaleString()}`);
    console.log(`   Total cost: $${totalCost.toFixed(2)}`);

  } catch (error) {
    console.error('❌ Error uploading usage data:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  uploadUsageData();
}

export { uploadUsageData, MACHINE_ID };