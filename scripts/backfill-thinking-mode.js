/**
 * Script to backfill thinking mode data for existing sessions
 */

import { loadSessionData } from 'ccusage/data-loader';
import { enhanceWithThinkingData } from '../lib/thinking-detection.js';
import { initializeDbManager, getDbManager } from '../lib/db-manager.js';
import { hostname } from 'os';

const MACHINE_ID = process.env.MACHINE_ID || hostname();

async function backfillThinkingMode() {
  console.log('🔄 Starting thinking mode backfill...');
  
  try {
    // Initialize database manager
    await initializeDbManager(process.env.DATABASE_URL);
    const dbManager = getDbManager();
    const db = await dbManager.getConnection();
    
    // Get all sessions that don't have thinking mode data
    const sessions = await db.all(`
      SELECT session_id, total_tokens, thinking_mode_detected 
      FROM usage_sessions 
      WHERE thinking_mode_detected = 0 OR thinking_mode_detected IS NULL
      ORDER BY start_time DESC
      LIMIT 100
    `);
    
    console.log(`Found ${sessions.length} sessions to backfill`);
    
    if (sessions.length === 0) {
      console.log('✅ No sessions need backfilling');
      return;
    }
    
    let updatedCount = 0;
    let thinkingSessionsFound = 0;
    
    for (const session of sessions) {
      try {
        // Create a mock record to enhance
        const mockRecord = {
          session_id: session.session_id,
          total_tokens: session.total_tokens || 0
        };
        
        // Enhance with thinking data
        const enhanced = enhanceWithThinkingData(mockRecord, session.session_id);
        
        // Update the database
        await db.run(`
          UPDATE usage_sessions 
          SET thinking_mode_detected = ?, 
              thinking_tokens = ?, 
              thinking_percentage = ?
          WHERE session_id = ?
        `, [
          enhanced.thinking_mode_detected ? 1 : 0,
          enhanced.thinking_tokens || 0,
          enhanced.thinking_percentage || 0,
          session.session_id
        ]);
        
        updatedCount++;
        
        if (enhanced.thinking_mode_detected) {
          thinkingSessionsFound++;
          console.log(`📖 Session ${session.session_id}: ${(enhanced.thinking_percentage * 100).toFixed(1)}% thinking content`);
        }
        
      } catch (error) {
        console.warn(`⚠️  Failed to process session ${session.session_id}: ${error.message}`);
      }
    }
    
    console.log(`✅ Updated ${updatedCount} sessions`);
    console.log(`📊 Found thinking mode in ${thinkingSessionsFound} sessions`);
    
    // Also update usage_data and usage_blocks tables
    console.log('\n🔄 Updating usage_data table...');
    await db.run(`
      UPDATE usage_data 
      SET thinking_mode_detected = 0,
          thinking_tokens = 0,
          thinking_percentage = 0
      WHERE thinking_mode_detected IS NULL
    `);
    
    console.log('🔄 Updating usage_blocks table...');
    await db.run(`
      UPDATE usage_blocks 
      SET thinking_mode_detected = 0,
          thinking_tokens = 0,
          thinking_percentage = 0
      WHERE thinking_mode_detected IS NULL
    `);
    
    console.log('✅ Backfill completed successfully');
    
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    throw error;
  }
}

backfillThinkingMode().catch(console.error);