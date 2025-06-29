/**
 * Simple script to force reprocessing of sessions with thinking mode detection
 * This deletes upload history to allow sessions to be re-uploaded with thinking data
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

function clearUploadHistory() {
  const logDir = path.join(os.homedir(), '.promptpulse');
  const logFile = path.join(logDir, 'uploads.log');
  
  if (fs.existsSync(logFile)) {
    console.log('🔄 Clearing upload history to force reprocessing...');
    
    // Read current log and filter out session uploads
    const logContent = fs.readFileSync(logFile, 'utf-8');
    const lines = logContent.split('\n').filter(line => line.trim());
    
    // Keep non-session uploads
    const filteredLines = lines.filter(line => {
      try {
        const entry = JSON.parse(line);
        return entry.upload_type !== 'session';
      } catch {
        return true; // Keep malformed lines
      }
    });
    
    // Write back filtered log
    fs.writeFileSync(logFile, filteredLines.join('\n') + '\n');
    
    console.log(`✅ Removed ${lines.length - filteredLines.length} session upload records`);
    console.log('📋 Now run: promptpulse collect --granularity session');
    console.log('   This will reprocess all sessions with thinking mode detection');
  } else {
    console.log('⚠️  No upload log found, sessions will be reprocessed on next collect');
  }
}

clearUploadHistory();