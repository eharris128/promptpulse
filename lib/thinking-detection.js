/**
 * Thinking mode detection utilities for Claude Code JSONL data
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Check if a message content contains thinking mode blocks
 * @param {Array|Object} content - Message content array or object
 * @returns {Object} Thinking mode analysis
 */
export function analyzeThinkingMode(content) {
  if (!content) {
    return {
      hasThinking: false,
      thinkingBlocks: 0,
      textBlocks: 0,
      thinkingLength: 0,
      totalLength: 0
    };
  }

  // Handle single content object or array
  const contentArray = Array.isArray(content) ? content : [content];
  
  let thinkingBlocks = 0;
  let textBlocks = 0;
  let thinkingLength = 0;
  let totalLength = 0;

  for (const block of contentArray) {
    if (block && typeof block === 'object') {
      if (block.type === 'thinking' && block.thinking) {
        thinkingBlocks++;
        thinkingLength += block.thinking.length || 0;
        totalLength += block.thinking.length || 0;
      } else if (block.type === 'text' && block.text) {
        textBlocks++;
        totalLength += block.text.length || 0;
      }
    }
  }

  return {
    hasThinking: thinkingBlocks > 0,
    thinkingBlocks,
    textBlocks,
    thinkingLength,
    totalLength,
    thinkingPercentage: totalLength > 0 ? (thinkingLength / totalLength) : 0
  };
}

/**
 * Parse a JSONL file and extract thinking mode usage
 * @param {string} filePath - Path to JSONL file
 * @returns {Object} Thinking analysis for the session
 */
export function analyzeSessionThinking(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    let totalThinkingBlocks = 0;
    let totalTextBlocks = 0;
    let totalThinkingLength = 0;
    let totalContentLength = 0;
    let hasAnyThinking = false;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        
        // Look for assistant messages with content
        if (entry.type === 'assistant' && entry.message && entry.message.content) {
          const analysis = analyzeThinkingMode(entry.message.content);
          
          if (analysis.hasThinking) {
            hasAnyThinking = true;
          }
          
          totalThinkingBlocks += analysis.thinkingBlocks;
          totalTextBlocks += analysis.textBlocks;
          totalThinkingLength += analysis.thinkingLength;
          totalContentLength += analysis.totalLength;
        }
      } catch (parseError) {
        // Skip invalid JSON lines
        continue;
      }
    }

    return {
      hasThinking: hasAnyThinking,
      totalThinkingBlocks,
      totalTextBlocks,
      totalThinkingLength,
      totalContentLength,
      thinkingPercentage: totalContentLength > 0 ? (totalThinkingLength / totalContentLength) : 0
    };
  } catch (error) {
    console.warn(`Warning: Could not analyze thinking mode for ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Get all JSONL files for a project and analyze thinking mode usage
 * @param {string} projectPath - The project path (used to find JSONL files)
 * @returns {Object} Aggregated thinking analysis for all sessions
 */
export function analyzeProjectThinking(projectPath) {
  try {
    const claudeDir = path.join(os.homedir(), '.claude', 'projects');
    
    // Convert project path to directory name format
    const projectDirName = projectPath.replace(/\//g, '-').replace(/^-/, '');
    const projectDir = path.join(claudeDir, projectDirName);
    
    if (!fs.existsSync(projectDir)) {
      return null;
    }

    const jsonlFiles = fs.readdirSync(projectDir)
      .filter(file => file.endsWith('.jsonl'))
      .map(file => path.join(projectDir, file));

    let aggregateData = {
      hasThinking: false,
      totalSessions: 0,
      sessionsWithThinking: 0,
      totalThinkingBlocks: 0,
      totalTextBlocks: 0,
      totalThinkingLength: 0,
      totalContentLength: 0,
      averageThinkingPercentage: 0
    };

    for (const filePath of jsonlFiles) {
      const sessionAnalysis = analyzeSessionThinking(filePath);
      
      if (sessionAnalysis) {
        aggregateData.totalSessions++;
        
        if (sessionAnalysis.hasThinking) {
          aggregateData.hasThinking = true;
          aggregateData.sessionsWithThinking++;
        }
        
        aggregateData.totalThinkingBlocks += sessionAnalysis.totalThinkingBlocks;
        aggregateData.totalTextBlocks += sessionAnalysis.totalTextBlocks;
        aggregateData.totalThinkingLength += sessionAnalysis.totalThinkingLength;
        aggregateData.totalContentLength += sessionAnalysis.totalContentLength;
      }
    }

    // Calculate average thinking percentage
    if (aggregateData.totalContentLength > 0) {
      aggregateData.averageThinkingPercentage = aggregateData.totalThinkingLength / aggregateData.totalContentLength;
    }

    return aggregateData;
  } catch (error) {
    console.warn(`Warning: Could not analyze project thinking for ${projectPath}: ${error.message}`);
    return null;
  }
}

/**
 * Estimate thinking tokens from thinking analysis
 * This is an approximation since we don't have exact token counts for thinking content
 * @param {Object} thinkingAnalysis - Result from analyzeThinkingMode or similar
 * @param {number} totalTokens - Total tokens for the session/period
 * @returns {number} Estimated thinking tokens
 */
export function estimateThinkingTokens(thinkingAnalysis, totalTokens) {
  if (!thinkingAnalysis || !thinkingAnalysis.hasThinking || !totalTokens) {
    return 0;
  }

  // Use character length ratio as approximation for token ratio
  // This is rough but better than no estimate
  const thinkingRatio = thinkingAnalysis.thinkingPercentage || 0;
  return Math.round(totalTokens * thinkingRatio);
}

/**
 * Enhance usage record with thinking mode data
 * @param {Object} usageRecord - Usage record from ccusage
 * @param {string} sessionId - Session ID to look up JSONL file
 * @returns {Object} Enhanced usage record with thinking data
 */
export function enhanceWithThinkingData(usageRecord, sessionId) {
  if (!sessionId) {
    return {
      ...usageRecord,
      thinking_mode_detected: false,
      thinking_tokens: 0,
      thinking_percentage: 0
    };
  }

  // Find the JSONL file for this session
  const claudeDir = path.join(os.homedir(), '.claude', 'projects');
  let sessionFile = null;

  try {
    // Search all project directories for the session file
    const projectDirs = fs.readdirSync(claudeDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => path.join(claudeDir, dirent.name));

    for (const projectDir of projectDirs) {
      const potentialFile = path.join(projectDir, `${sessionId}.jsonl`);
      if (fs.existsSync(potentialFile)) {
        sessionFile = potentialFile;
        break;
      }
    }

    if (!sessionFile) {
      return {
        ...usageRecord,
        thinking_mode_detected: false,
        thinking_tokens: 0,
        thinking_percentage: 0
      };
    }

    const analysis = analyzeSessionThinking(sessionFile);
    
    if (!analysis) {
      return {
        ...usageRecord,
        thinking_mode_detected: false,
        thinking_tokens: 0,
        thinking_percentage: 0
      };
    }

    const totalTokens = usageRecord.total_tokens || usageRecord.totalTokens || 0;
    const estimatedThinkingTokens = estimateThinkingTokens(analysis, totalTokens);

    return {
      ...usageRecord,
      thinking_mode_detected: analysis.hasThinking,
      thinking_tokens: estimatedThinkingTokens,
      thinking_percentage: analysis.thinkingPercentage
    };
  } catch (error) {
    console.warn(`Warning: Could not enhance record with thinking data: ${error.message}`);
    return {
      ...usageRecord,
      thinking_mode_detected: false,
      thinking_tokens: 0,
      thinking_percentage: 0
    };
  }
}