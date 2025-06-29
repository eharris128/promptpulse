import express from 'express';
import { authenticateApiKey } from '../lib/server-auth.js';
import { logDatabaseQuery, logError, log } from '../lib/logger.js';
import emailService from '../lib/email-service.js';

const router = express.Router();

// Utility function for sanitizing display names
function sanitizeDisplayName(input) {
  if (!input || typeof input !== 'string') return null;
  
  let sanitized = input.trim().slice(0, 50);
  
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  sanitized = sanitized.replace(/[<>'"&]/g, '');
  
  return sanitized || null;
}

// Get leaderboard settings
router.get('/api/user/leaderboard-settings', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('get_leaderboard_settings', userId);
  
  try {
    const user = await req.dbManager.executeQuery(async (db) => {
      return await db.sql`
        SELECT leaderboard_enabled, display_name, team_leaderboard_enabled, team_display_name 
        FROM users 
        WHERE id = ${userId}
      `;
    }, { ...queryContext, operation: 'get_user_leaderboard_settings' });
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      leaderboard_enabled: Boolean(user[0].leaderboard_enabled),
      display_name: user[0].display_name,
      team_leaderboard_enabled: Boolean(user[0].team_leaderboard_enabled),
      team_display_name: user[0].team_display_name
    });
    
    log.performance('get_leaderboard_settings', Date.now() - queryContext.startTime, { userId });
    
  } catch (error) {
    logError(error, { context: 'get_leaderboard_settings', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Update leaderboard settings
router.put('/api/user/leaderboard-settings', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const { leaderboard_enabled, display_name, team_leaderboard_enabled, team_display_name } = req.body;
  const queryContext = logDatabaseQuery('update_leaderboard_settings', userId);
  
  const sanitizedDisplayName = sanitizeDisplayName(display_name);
  const sanitizedTeamDisplayName = sanitizeDisplayName(team_display_name);
  
  try {
    await req.dbManager.executeQuery(async (db) => {
      return await db.sql`
        UPDATE users 
        SET 
          leaderboard_enabled = ${leaderboard_enabled ? 1 : 0},
          display_name = ${sanitizedDisplayName},
          team_leaderboard_enabled = ${team_leaderboard_enabled ? 1 : 0},
          team_display_name = ${sanitizedTeamDisplayName},
          leaderboard_updated_at = CURRENT_TIMESTAMP
        WHERE id = ${userId}
      `;
    }, { ...queryContext, operation: 'update_user_leaderboard_settings' });
    
    res.json({ 
      message: 'Leaderboard settings updated successfully',
      leaderboard_enabled: Boolean(leaderboard_enabled),
      display_name: sanitizedDisplayName,
      team_leaderboard_enabled: Boolean(team_leaderboard_enabled),
      team_display_name: sanitizedTeamDisplayName
    });
    
    log.performance('update_leaderboard_settings', Date.now() - queryContext.startTime, { 
      userId, leaderboard_enabled, display_name: !!sanitizedDisplayName 
    });
    
  } catch (error) {
    logError(error, { context: 'update_leaderboard_settings', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Get email preferences
router.get('/api/user/email-preferences', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('get_email_preferences', userId);
  
  try {
    const preferences = await req.dbManager.executeQuery(async (db) => {
      // Get user email and preferences
      const userResult = await db.sql`
        SELECT email, timezone FROM users WHERE id = ${userId}
      `;
      
      const preferencesResult = await db.sql`
        SELECT * FROM user_email_preferences WHERE user_id = ${userId}
      `;
      
      return { user: userResult[0], preferences: preferencesResult[0] };
    }, { ...queryContext, operation: 'get_user_email_preferences' });
    
    if (!preferences.user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Default values if no preferences exist yet
    const defaultPrefs = {
      daily_digest: true,
      weekly_summary: true,
      leaderboard_updates: true,
      team_invitations: true,
      security_alerts: true,
      email_frequency: 'daily',
      timezone_for_emails: preferences.user.timezone || 'UTC'
    };
    
    const userPrefs = preferences.preferences ? {
      daily_digest: Boolean(preferences.preferences.daily_digest),
      weekly_summary: Boolean(preferences.preferences.weekly_summary),
      leaderboard_updates: Boolean(preferences.preferences.leaderboard_updates),
      team_invitations: Boolean(preferences.preferences.team_invitations),
      security_alerts: Boolean(preferences.preferences.security_alerts),
      email_frequency: preferences.preferences.email_frequency,
      timezone_for_emails: preferences.preferences.timezone_for_emails
    } : defaultPrefs;
    
    res.json({
      email: preferences.user.email,
      ...userPrefs
    });
    
    log.performance('get_email_preferences', Date.now() - queryContext.startTime, { userId });
    
  } catch (error) {
    logError(error, { context: 'get_email_preferences', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Update email preferences
router.put('/api/user/email-preferences', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const { 
    daily_digest, 
    weekly_summary, 
    leaderboard_updates, 
    team_invitations, 
    security_alerts, 
    email_frequency, 
    timezone_for_emails 
  } = req.body;
  const queryContext = logDatabaseQuery('update_email_preferences', userId);
  
  // Validate inputs
  const validFrequencies = ['immediate', 'daily', 'weekly', 'none'];
  if (email_frequency && !validFrequencies.includes(email_frequency)) {
    return res.status(400).json({ error: 'Invalid email frequency. Must be immediate, daily, weekly, or none.' });
  }
  
  try {
    await req.dbManager.executeQuery(async (db) => {
      // Insert or update preferences
      return await db.sql`
        INSERT OR REPLACE INTO user_email_preferences (
          user_id, daily_digest, weekly_summary, leaderboard_updates, 
          team_invitations, security_alerts, email_frequency, timezone_for_emails
        ) VALUES (
          ${userId},
          ${daily_digest !== undefined ? (daily_digest ? 1 : 0) : 1},
          ${weekly_summary !== undefined ? (weekly_summary ? 1 : 0) : 1},
          ${leaderboard_updates !== undefined ? (leaderboard_updates ? 1 : 0) : 1},
          ${team_invitations !== undefined ? (team_invitations ? 1 : 0) : 1},
          ${security_alerts !== undefined ? (security_alerts ? 1 : 0) : 1},
          ${email_frequency || 'daily'},
          ${timezone_for_emails || 'UTC'}
        )
      `;
    }, { ...queryContext, operation: 'update_user_email_preferences' });
    
    res.json({ 
      message: 'Email preferences updated successfully',
      daily_digest: daily_digest !== undefined ? Boolean(daily_digest) : true,
      weekly_summary: weekly_summary !== undefined ? Boolean(weekly_summary) : true,
      leaderboard_updates: leaderboard_updates !== undefined ? Boolean(leaderboard_updates) : true,
      team_invitations: team_invitations !== undefined ? Boolean(team_invitations) : true,
      security_alerts: security_alerts !== undefined ? Boolean(security_alerts) : true,
      email_frequency: email_frequency || 'daily',
      timezone_for_emails: timezone_for_emails || 'UTC'
    });
    
    log.performance('update_email_preferences', Date.now() - queryContext.startTime, { 
      userId, email_frequency: email_frequency || 'daily' 
    });
    
  } catch (error) {
    logError(error, { context: 'update_email_preferences', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Update user email
router.put('/api/user/email', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const { email } = req.body;
  const queryContext = logDatabaseQuery('update_user_email', userId);
  
  // Validate email
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  try {
    await req.dbManager.executeQuery(async (db) => {
      // Check if email is already in use by another user
      const existingUser = await db.sql`
        SELECT id FROM users 
        WHERE email = ${email} AND id != ${userId}
        LIMIT 1
      `;
      
      if (existingUser.length > 0) {
        throw new Error('Email already in use');
      }
      
      // Update user's email
      return await db.sql`
        UPDATE users 
        SET email = ${email}
        WHERE id = ${userId}
      `;
    }, { ...queryContext, operation: 'update_user_email' });
    
    res.json({ 
      message: 'Email updated successfully',
      email: email
    });
    
    log.performance('update_user_email', Date.now() - queryContext.startTime, { userId });
    
  } catch (error) {
    if (error.message === 'Email already in use') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    logError(error, { context: 'update_user_email', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Send test email
router.post('/api/user/test-email', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('send_test_email', userId);
  
  try {
    // Get user info
    const user = await req.dbManager.executeQuery(async (db) => {
      return await db.sql`
        SELECT email, username, display_name FROM users WHERE id = ${userId}
      `;
    }, { ...queryContext, operation: 'get_user_for_test_email' });
    
    if (!user[0] || !user[0].email) {
      return res.status(400).json({ 
        error: 'No email address found for your account. Please add an email address to your profile first.' 
      });
    }
    
    if (!emailService.isEnabled()) {
      return res.status(503).json({ 
        error: 'Email service is not configured. Please contact support.' 
      });
    }
    
    // Send test email
    const result = await emailService.sendTestEmail(user[0].email, user[0].username);
    
    // Log the email send attempt
    await req.dbManager.executeQuery(async (db) => {
      return await db.sql`
        INSERT INTO email_send_log (
          user_id, email_type, email_address, status, error_message, resend_email_id
        ) VALUES (
          ${userId}, 'test', ${user[0].email}, ${result.success ? 'sent' : 'failed'}, 
          ${result.error || null}, ${result.emailId || null}
        )
      `;
    }, { operation: 'log_test_email_send' });
    
    if (result.success) {
      res.json({ 
        message: 'Test email sent successfully!',
        email: user[0].email
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to send test email. Please try again later.',
        details: result.error
      });
    }
    
    log.performance('send_test_email', Date.now() - queryContext.startTime, { 
      userId, success: result.success 
    });
    
  } catch (error) {
    logError(error, { context: 'send_test_email', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Get plan settings
router.get('/api/user/plan-settings', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('get_plan_settings', userId);
  
  try {
    const user = await req.dbManager.executeQuery(async (db) => {
      return await db.sql`
        SELECT claude_plan FROM users WHERE id = ${userId}
      `;
    }, { ...queryContext, operation: 'get_user_plan_settings' });
    
    if (!user[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      claude_plan: user[0].claude_plan || 'max_100'
    });
    
    log.performance('get_plan_settings', Date.now() - queryContext.startTime, { userId });
    
  } catch (error) {
    logError(error, { context: 'get_plan_settings', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Update plan settings
router.put('/api/user/plan-settings', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const { claude_plan } = req.body;
  const queryContext = logDatabaseQuery('update_plan_settings', userId);
  
  // Validate plan
  const validPlans = ['pro_17', 'max_100', 'max_200'];
  if (!claude_plan || !validPlans.includes(claude_plan)) {
    return res.status(400).json({ 
      error: 'Invalid Claude plan. Must be one of: pro_17, max_100, max_200' 
    });
  }
  
  try {
    await req.dbManager.executeQuery(async (db) => {
      return await db.sql`
        UPDATE users 
        SET claude_plan = ${claude_plan}
        WHERE id = ${userId}
      `;
    }, { ...queryContext, operation: 'update_user_plan_settings' });
    
    res.json({ 
      message: 'Plan settings updated successfully',
      claude_plan: claude_plan
    });
    
    log.performance('update_plan_settings', Date.now() - queryContext.startTime, { 
      userId, claude_plan 
    });
    
  } catch (error) {
    logError(error, { context: 'update_plan_settings', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;