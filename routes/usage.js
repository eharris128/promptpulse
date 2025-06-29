import express from 'express';
import { authenticateApiKey } from '../lib/server-auth.js';
import { CommonValidators } from '../lib/validation-middleware.js';
import { logDatabaseQuery, logError, log } from '../lib/logger.js';

const router = express.Router();

// Upload daily usage data for a specific machine
router.post('/api/usage', authenticateApiKey, async (req, res) => {
  const { machineId, data } = req.body;
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('upload_usage_data', userId);
  
  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'Data must be a non-empty array' });
  }
  
  if (!machineId) {
    return res.status(400).json({ error: 'Machine ID is required' });
  }
  
  try {
    let insertedCount = 0;
    let updatedCount = 0;
    
    await req.dbManager.executeQuery(async (db) => {
      for (const usage of data) {
        const { date, total_tokens, total_cost, sessions_count } = usage;
        
        // Check if record already exists
        const existing = await db.sql`
          SELECT id FROM usage_data 
          WHERE user_id = ${userId} AND machine_id = ${machineId} AND date = ${date}
        `;
        
        if (existing.length > 0) {
          // Update existing record
          await db.sql`
            UPDATE usage_data 
            SET total_tokens = ${total_tokens}, total_cost = ${total_cost}, sessions_count = ${sessions_count}
            WHERE user_id = ${userId} AND machine_id = ${machineId} AND date = ${date}
          `;
          updatedCount++;
        } else {
          // Insert new record
          await db.sql`
            INSERT INTO usage_data (user_id, machine_id, date, total_tokens, total_cost, sessions_count)
            VALUES (${userId}, ${machineId}, ${date}, ${total_tokens}, ${total_cost}, ${sessions_count})
          `;
          insertedCount++;
        }
      }
    }, { ...queryContext, operation: 'insert_or_replace_usage_data' });
    
    res.json({
      message: `Successfully processed ${data.length} usage records`,
      inserted: insertedCount,
      updated: updatedCount
    });
    
    log.performance('upload_usage_data', Date.now() - queryContext.startTime, { 
      userId, machineId, recordCount: data.length, inserted: insertedCount, updated: updatedCount 
    });
    
  } catch (error) {
    logError(error, { context: 'upload_usage_data', userId, machineId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Get aggregated usage statistics
router.get('/api/usage/aggregate', authenticateApiKey, CommonValidators.usageQuery, async (req, res) => {
  const { machineId, startDate, endDate } = req.query;
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('get_usage_aggregate', userId);
  
  try {
    const result = await req.dbManager.executeQuery(async (db) => {
      let query = `
        SELECT 
          SUM(input_tokens) as total_input_tokens,
          SUM(output_tokens) as total_output_tokens,
          SUM(cache_creation_tokens) as total_cache_creation_tokens,
          SUM(cache_read_tokens) as total_cache_read_tokens,
          SUM(total_tokens) as total_tokens,
          SUM(total_cost) as total_cost,
          SUM(sessions_count) as total_sessions,
          COUNT(DISTINCT machine_id) as total_machines,
          COUNT(*) as days_active,
          MIN(date) as first_date,
          MAX(date) as last_date
        FROM usage_data 
        WHERE user_id = ?
      `;
      
      const params = [userId];
      
      if (machineId) {
        query += ' AND machine_id = ?';
        params.push(machineId);
      }
      
      if (startDate) {
        query += ' AND date >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        query += ' AND date <= ?';
        params.push(endDate);
      }
      
      return await db.prepare(query).bind(...params).all();
    }, { ...queryContext, operation: 'aggregate_usage_data' });
    
    const aggregate = result[0] || {
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cache_creation_tokens: 0,
      total_cache_read_tokens: 0,
      total_tokens: 0,
      total_cost: 0,
      total_sessions: 0,
      total_machines: 0,
      days_active: 0,
      first_date: null,
      last_date: null
    };
    
    // Return structure matching AggregateData type
    res.json({ 
      daily: [], // TODO: Add daily data if needed by frontend
      totals: {
        total_machines: aggregate.total_machines || 0,
        total_input_tokens: aggregate.total_input_tokens || 0,
        total_output_tokens: aggregate.total_output_tokens || 0,
        total_cache_creation_tokens: aggregate.total_cache_creation_tokens || 0,
        total_cache_read_tokens: aggregate.total_cache_read_tokens || 0,
        total_tokens: aggregate.total_tokens || 0,
        total_cost: aggregate.total_cost || 0
      }
    });
    
    log.performance('get_usage_aggregate', Date.now() - queryContext.startTime, { 
      userId, machineId, dateRange: { startDate, endDate } 
    });
  } catch (error) {
    logError(error, { context: 'get_usage_aggregate', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Get usage sessions with filtering
router.get('/api/usage/sessions', authenticateApiKey, CommonValidators.usageQuery, async (req, res) => {
  const { 
    machineId, 
    projectPath, 
    startDate, 
    endDate, 
    limit = 100 
  } = req.query;
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('get_usage_sessions', userId);
  
  // Validate limit
  const maxLimit = Math.min(parseInt(limit) || 100, 1000);
  
  try {
    const sessions = await req.dbManager.executeQuery(async (db) => {
      let query = `
        SELECT 
          session_id,
          machine_id,
          project_path,
          start_time,
          end_time,
          duration_minutes,
          total_tokens,
          total_cost,
          input_tokens,
          output_tokens,
          model_name
        FROM usage_sessions 
        WHERE user_id = ?
      `;
      
      const params = [userId];
      
      if (machineId) {
        query += ' AND machine_id = ?';
        params.push(machineId);
      }
      
      if (projectPath) {
        query += ' AND project_path = ?';
        params.push(projectPath);
      }
      
      if (startDate) {
        query += ' AND start_time >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        query += ' AND start_time <= ?';
        params.push(endDate);
      }
      
      query += ' ORDER BY start_time DESC LIMIT ?';
      params.push(maxLimit);
      
      return await db.prepare(query).bind(...params).all();
    }, { ...queryContext, operation: 'fetch_usage_sessions' });
    
    res.json({ sessions, count: sessions.length });
    
    log.performance('get_usage_sessions', Date.now() - queryContext.startTime, { 
      userId, machineId, projectPath, sessionCount: sessions.length 
    });
    
  } catch (error) {
    logError(error, { context: 'get_usage_sessions', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Get project-level usage statistics
router.get('/api/usage/projects', authenticateApiKey, CommonValidators.usageQuery, async (req, res) => {
  const { machineId, startDate, endDate } = req.query;
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('get_usage_projects', userId);
  
  try {
    const projects = await req.dbManager.executeQuery(async (db) => {
      let query = `
        SELECT 
          project_path,
          COUNT(*) as session_count,
          SUM(total_tokens) as total_tokens,
          SUM(total_cost) as total_cost,
          SUM(duration_minutes) as total_duration_minutes,
          AVG(duration_minutes) as avg_duration_minutes,
          MIN(start_time) as first_session,
          MAX(start_time) as last_session
        FROM usage_sessions 
        WHERE user_id = ? AND project_path IS NOT NULL
      `;
      
      const params = [userId];
      
      if (machineId) {
        query += ' AND machine_id = ?';
        params.push(machineId);
      }
      
      if (startDate) {
        query += ' AND start_time >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        query += ' AND start_time <= ?';
        params.push(endDate);
      }
      
      query += ' GROUP BY project_path ORDER BY total_cost DESC';
      
      return await db.prepare(query).bind(...params).all();
    }, { ...queryContext, operation: 'fetch_project_usage' });
    
    res.json({ projects, count: projects.length });
    
    log.performance('get_usage_projects', Date.now() - queryContext.startTime, { 
      userId, machineId, projectCount: projects.length 
    });
    
  } catch (error) {
    logError(error, { context: 'get_usage_projects', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Get flattened project data
router.get('/api/usage/projects/flattened', authenticateApiKey, CommonValidators.usageQuery, async (req, res) => {
  const { machineId, startDate, endDate } = req.query;
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('get_usage_projects_flattened', userId);
  
  try {
    const sessions = await req.dbManager.executeQuery(async (db) => {
      let query = `
        SELECT 
          session_id,
          machine_id,
          project_path,
          start_time,
          total_tokens,
          total_cost,
          duration_minutes
        FROM usage_sessions 
        WHERE user_id = ? AND project_path IS NOT NULL
      `;
      
      const params = [userId];
      
      if (machineId) {
        query += ' AND machine_id = ?';
        params.push(machineId);
      }
      
      if (startDate) {
        query += ' AND start_time >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        query += ' AND start_time <= ?';
        params.push(endDate);
      }
      
      query += ' ORDER BY start_time DESC';
      
      return await db.prepare(query).bind(...params).all();
    }, { ...queryContext, operation: 'fetch_flattened_project_data' });
    
    res.json({ sessions, count: sessions.length });
    
    log.performance('get_usage_projects_flattened', Date.now() - queryContext.startTime, { 
      userId, machineId, sessionCount: sessions.length 
    });
    
  } catch (error) {
    logError(error, { context: 'get_usage_projects_flattened', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Get usage block data
router.get('/api/usage/blocks', authenticateApiKey, CommonValidators.usageQuery, async (req, res) => {
  const { 
    machineId, 
    startDate, 
    endDate, 
    activeOnly = false 
  } = req.query;
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('get_usage_blocks', userId);
  
  try {
    const blocks = await req.dbManager.executeQuery(async (db) => {
      let query = `
        SELECT 
          block_id,
          session_id,
          machine_id,
          start_time,
          end_time,
          total_tokens as tokens_used,
          total_cost as cost,
          model_name,
          data_type,
          is_active
        FROM usage_blocks 
        WHERE user_id = ?
      `;
      
      const params = [userId];
      
      if (machineId) {
        query += ' AND machine_id = ?';
        params.push(machineId);
      }
      
      if (startDate) {
        query += ' AND start_time >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        query += ' AND start_time <= ?';
        params.push(endDate);
      }
      
      if (activeOnly === 'true') {
        query += ' AND is_active = 1';
      }
      
      query += ' ORDER BY start_time DESC LIMIT 1000';
      
      return await db.prepare(query).bind(...params).all();
    }, { ...queryContext, operation: 'fetch_usage_blocks' });
    
    res.json({ blocks, count: blocks.length });
    
    log.performance('get_usage_blocks', Date.now() - queryContext.startTime, { 
      userId, machineId, blockCount: blocks.length 
    });
    
  } catch (error) {
    logError(error, { context: 'get_usage_blocks', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Batch upload daily usage data
router.post('/api/usage/daily/batch', authenticateApiKey, async (req, res) => {
  const { machineId, data } = req.body;
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('batch_upload_daily', userId);
  
  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'Data must be a non-empty array' });
  }
  
  if (!machineId) {
    return res.status(400).json({ error: 'Machine ID is required' });
  }
  
  try {
    let processedCount = 0;
    let skippedCount = 0;
    
    await req.dbManager.executeQuery(async (db) => {
      for (const usage of data) {
        const { 
          date, 
          input_tokens, 
          output_tokens, 
          cache_creation_tokens, 
          cache_read_tokens, 
          total_tokens, 
          total_cost, 
          sessions_count, 
          models_used, 
          model_breakdowns 
        } = usage;
        
        // Check if already uploaded
        const existing = await db.sql`
          SELECT id FROM upload_history 
          WHERE user_id = ${userId} AND machine_id = ${machineId} AND upload_type = 'daily' AND identifier = ${date}
        `;
        
        if (existing.length > 0) {
          skippedCount++;
          continue;
        }
        
        // Insert usage data
        await db.sql`
          INSERT OR REPLACE INTO usage_data (
            user_id, machine_id, date, 
            input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, total_tokens, 
            total_cost, sessions_count, models_used, model_breakdowns
          ) VALUES (
            ${userId}, ${machineId}, ${date}, 
            ${input_tokens || 0}, ${output_tokens || 0}, ${cache_creation_tokens || 0}, ${cache_read_tokens || 0}, ${total_tokens || 0}, 
            ${total_cost || 0}, ${sessions_count || 0}, ${JSON.stringify(models_used || [])}, ${JSON.stringify(model_breakdowns || {})}
          )
        `;
        
        // Record upload
        await db.sql`
          INSERT INTO upload_history (user_id, machine_id, upload_type, identifier, uploaded_at)
          VALUES (${userId}, ${machineId}, 'daily', ${date}, CURRENT_TIMESTAMP)
        `;
        
        processedCount++;
      }
    }, { ...queryContext, operation: 'batch_insert_daily_usage' });
    
    res.json({
      message: `Batch upload completed`,
      processed: processedCount,
      skipped: skippedCount,
      total: data.length
    });
    
    log.performance('batch_upload_daily', Date.now() - queryContext.startTime, { 
      userId, machineId, processed: processedCount, skipped: skippedCount 
    });
    
  } catch (error) {
    logError(error, { context: 'batch_upload_daily', userId, machineId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Batch upload session data
router.post('/api/usage/sessions/batch', authenticateApiKey, async (req, res) => {
  const { machineId, data } = req.body;
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('batch_upload_sessions', userId);
  
  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'Data must be a non-empty array' });
  }
  
  if (!machineId) {
    return res.status(400).json({ error: 'Machine ID is required' });
  }
  
  try {
    let processedCount = 0;
    let skippedCount = 0;
    
    await req.dbManager.executeQuery(async (db) => {
      for (const session of data) {
        const { 
          session_id, 
          project_path, 
          start_time, 
          end_time, 
          duration_minutes,
          input_tokens,
          output_tokens, 
          cache_creation_tokens,
          cache_read_tokens,
          total_tokens, 
          total_cost, 
          models_used,
          model_breakdowns
        } = session;
        
        // Check if already uploaded
        const existing = await db.sql`
          SELECT id FROM upload_history 
          WHERE user_id = ${userId} AND machine_id = ${machineId} AND upload_type = 'session' AND identifier = ${session_id}
        `;
        
        if (existing.length > 0) {
          skippedCount++;
          continue;
        }
        
        // Insert session data
        await db.sql`
          INSERT OR REPLACE INTO usage_sessions (
            user_id, machine_id, session_id, project_path, start_time, end_time,
            duration_minutes, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, 
            total_tokens, total_cost, models_used, model_breakdowns
          ) VALUES (
            ${userId}, ${machineId}, ${session_id}, ${project_path}, ${start_time}, ${end_time},
            ${duration_minutes}, ${input_tokens || 0}, ${output_tokens || 0}, ${cache_creation_tokens || 0}, ${cache_read_tokens || 0}, 
            ${total_tokens || 0}, ${total_cost || 0}, ${JSON.stringify(models_used || [])}, ${JSON.stringify(model_breakdowns || {})}
          )
        `;
        
        // Record upload
        await db.sql`
          INSERT INTO upload_history (user_id, machine_id, upload_type, identifier, uploaded_at)
          VALUES (${userId}, ${machineId}, 'session', ${session_id}, CURRENT_TIMESTAMP)
        `;
        
        processedCount++;
      }
    }, { ...queryContext, operation: 'batch_insert_session_data' });
    
    res.json({
      message: `Batch session upload completed`,
      processed: processedCount,
      skipped: skippedCount,
      total: data.length
    });
    
    log.performance('batch_upload_sessions', Date.now() - queryContext.startTime, { 
      userId, machineId, processed: processedCount, skipped: skippedCount 
    });
    
  } catch (error) {
    logError(error, { context: 'batch_upload_sessions', userId, machineId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Batch upload block data
router.post('/api/usage/blocks/batch', authenticateApiKey, async (req, res) => {
  const { machineId, data } = req.body;
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('batch_upload_blocks', userId);
  
  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'Data must be a non-empty array' });
  }
  
  if (!machineId) {
    return res.status(400).json({ error: 'Machine ID is required' });
  }
  
  // Validate data types
  const validDataTypes = ['prompt', 'response', 'system', 'tool_use', 'tool_result'];
  for (const block of data) {
    if (block.data_type && !validDataTypes.includes(block.data_type)) {
      return res.status(400).json({ 
        error: `Invalid data_type: ${block.data_type}. Must be one of: ${validDataTypes.join(', ')}` 
      });
    }
  }
  
  try {
    let processedCount = 0;
    let skippedCount = 0;
    
    await req.dbManager.executeQuery(async (db) => {
      for (const block of data) {
        const { 
          block_id, 
          start_time, 
          end_time, 
          actual_end_time,
          is_active,
          entry_count,
          input_tokens,
          output_tokens,
          cache_creation_tokens,
          cache_read_tokens,
          total_tokens, 
          total_cost,
          models_used
        } = block;
        
        // Check if already uploaded
        const existing = await db.sql`
          SELECT id FROM upload_history 
          WHERE user_id = ${userId} AND machine_id = ${machineId} AND upload_type = 'block' AND identifier = ${block_id}
        `;
        
        if (existing.length > 0) {
          skippedCount++;
          continue;
        }
        
        // Insert block data
        await db.sql`
          INSERT OR REPLACE INTO usage_blocks (
            user_id, machine_id, block_id, start_time, end_time, actual_end_time,
            is_active, entry_count, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens,
            total_tokens, total_cost, models_used
          ) VALUES (
            ${userId}, ${machineId}, ${block_id}, ${start_time}, ${end_time}, ${actual_end_time},
            ${is_active ? 1 : 0}, ${entry_count || 0}, ${input_tokens || 0}, ${output_tokens || 0}, ${cache_creation_tokens || 0}, ${cache_read_tokens || 0},
            ${total_tokens || 0}, ${total_cost || 0}, ${JSON.stringify(models_used || [])}
          )
        `;
        
        // Record upload
        await db.sql`
          INSERT INTO upload_history (user_id, machine_id, upload_type, identifier, uploaded_at)
          VALUES (${userId}, ${machineId}, 'block', ${block_id}, CURRENT_TIMESTAMP)
        `;
        
        processedCount++;
      }
    }, { ...queryContext, operation: 'batch_insert_block_data' });
    
    res.json({
      message: `Batch block upload completed`,
      processed: processedCount,
      skipped: skippedCount,
      total: data.length
    });
    
    log.performance('batch_upload_blocks', Date.now() - queryContext.startTime, { 
      userId, machineId, processed: processedCount, skipped: skippedCount 
    });
    
  } catch (error) {
    logError(error, { context: 'batch_upload_blocks', userId, machineId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Check upload history for deduplication
router.post('/api/upload-history/check', authenticateApiKey, async (req, res) => {
  const { machine_id, records } = req.body;
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('check_upload_history', userId);
  
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'Records must be a non-empty array' });
  }
  
  if (!machine_id) {
    return res.status(400).json({ error: 'Machine ID is required' });
  }
  
  try {
    const existing = await req.dbManager.executeQuery(async (db) => {
      // Check for each record type
      const checks = await Promise.all(records.map(async (record) => {
        const result = await db.sql`
          SELECT identifier FROM upload_history 
          WHERE user_id = ${userId} AND machine_id = ${machine_id} 
            AND upload_type = ${record.upload_type} AND identifier = ${record.identifier}
        `;
        return {
          upload_type: record.upload_type,
          identifier: record.identifier,
          exists: result.length > 0
        };
      }));
      
      return checks;
    }, { ...queryContext, operation: 'check_existing_uploads' });
    
    // Transform to match expected format: group by upload_type
    const resultByType = {};
    
    // Group existing uploads by type
    existing.forEach(check => {
      if (check.exists) {
        if (!resultByType[check.upload_type]) {
          resultByType[check.upload_type] = [];
        }
        resultByType[check.upload_type].push(check.identifier);
      }
    });
    
    res.json(resultByType);
    
    const totalExisting = Object.values(resultByType).reduce((sum, arr) => sum + arr.length, 0);
    log.performance('check_upload_history', Date.now() - queryContext.startTime, { 
      userId, machineId: machine_id, recordCount: records.length, existingCount: totalExisting 
    });
    
  } catch (error) {
    logError(error, { context: 'check_upload_history', userId, machineId: machine_id, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;