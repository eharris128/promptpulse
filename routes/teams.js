import express from 'express';
import KSUID from 'ksuid';
import crypto from 'crypto';
import { authenticateApiKey } from '../lib/server-auth.js';
import { logDatabaseQuery, logError, log } from '../lib/logger.js';

const router = express.Router();

// Get all teams for the authenticated user
router.get('/api/teams', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('get_user_teams', userId);
  
  try {
    const teams = await req.dbManager.executeQuery(async (db) => {
      return await db.sql`
        SELECT 
          t.id,
          t.name,
          t.description,
          t.created_at,
          tm.role,
          tm.joined_at,
          (
            SELECT COUNT(*) 
            FROM team_members tm2 
            WHERE tm2.team_id = t.id
          ) as member_count,
          t.invite_code
        FROM teams t
        JOIN team_members tm ON t.id = tm.team_id
        WHERE tm.user_id = ${userId}
        ORDER BY tm.joined_at DESC
      `;
    }, { ...queryContext, operation: 'get_user_teams' });
    
    res.json({ teams });
    
    log.performance('get_user_teams', Date.now() - queryContext.startTime, { 
      userId, teamCount: teams.length 
    });
    
  } catch (error) {
    logError(error, { context: 'get_user_teams', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Create a new team
router.post('/api/teams', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const { name, description } = req.body;
  const queryContext = logDatabaseQuery('create_team', userId);
  
  // Validate team name
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Team name is required' });
  }
  
  if (name.length > 100) {
    return res.status(400).json({ error: 'Team name must be 100 characters or less' });
  }
  
  // Validate description if provided
  if (description && (typeof description !== 'string' || description.length > 200)) {
    return res.status(400).json({ error: 'Team description must be 200 characters or less' });
  }
  
  const trimmedName = name.trim();
  const trimmedDescription = description ? description.trim() : null;
  
  try {
    const teamId = KSUID.randomSync().string;
    const inviteCode = crypto.randomBytes(8).toString('hex');
    
    await req.dbManager.executeQuery(async (db) => {
      // Create the team
      await db.sql`
        INSERT INTO teams (id, name, description, created_by, invite_code, created_at)
        VALUES (${teamId}, ${trimmedName}, ${trimmedDescription}, ${userId}, ${inviteCode}, CURRENT_TIMESTAMP)
      `;
      
      // Add creator as owner
      await db.sql`
        INSERT INTO team_members (team_id, user_id, role, joined_at)
        VALUES (${teamId}, ${userId}, 'owner', CURRENT_TIMESTAMP)
      `;
      
      return { teamId, inviteCode };
    }, { ...queryContext, operation: 'create_team_and_add_owner' });
    
    res.status(201).json({
      message: 'Team created successfully',
      team: {
        id: teamId,
        name: trimmedName,
        description: trimmedDescription,
        invite_code: inviteCode,
        member_count: 1,
        role: 'owner'
      }
    });
    
    log.performance('create_team', Date.now() - queryContext.startTime, { 
      userId, teamId, teamName: trimmedName 
    });
    
  } catch (error) {
    logError(error, { context: 'create_team', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Get team members
router.get('/api/teams/:teamId/members', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const { teamId } = req.params;
  const queryContext = logDatabaseQuery('get_team_members', userId);
  
  try {
    // Check if user is a member of this team
    const membership = await req.dbManager.executeQuery(async (db) => {
      return await db.sql`
        SELECT role FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId}
      `;
    }, { ...queryContext, operation: 'check_team_membership' });
    
    if (membership.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }
    
    // Get all team members
    const members = await req.dbManager.executeQuery(async (db) => {
      return await db.sql`
        SELECT 
          tm.user_id,
          tm.role,
          tm.joined_at,
          u.username,
          u.team_display_name
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ${teamId}
        ORDER BY 
          CASE tm.role 
            WHEN 'owner' THEN 1 
            WHEN 'admin' THEN 2 
            WHEN 'member' THEN 3 
          END,
          tm.joined_at ASC
      `;
    }, { ...queryContext, operation: 'get_team_members' });
    
    res.json({ members });
    
    log.performance('get_team_members', Date.now() - queryContext.startTime, { 
      userId, teamId, memberCount: members.length 
    });
    
  } catch (error) {
    logError(error, { context: 'get_team_members', userId, teamId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Get team leaderboard
router.get('/api/teams/:teamId/leaderboard/:period', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const { teamId, period } = req.params;
  const queryContext = logDatabaseQuery('get_team_leaderboard', userId);
  
  try {
    // Check if user is a member of this team
    const membership = await req.dbManager.executeQuery(async (db) => {
      return await db.sql`
        SELECT role FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId}
      `;
    }, { ...queryContext, operation: 'check_team_membership_for_leaderboard' });
    
    if (membership.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }
    
    let daysBack;
    if (period === 'daily') {
      daysBack = 1;
    } else if (period === 'weekly') {
      daysBack = 7;
    } else {
      return res.status(400).json({ error: 'Invalid period. Use daily or weekly.' });
    }
    
    const leaderboardData = await req.dbManager.executeQuery(async (db) => {
      return await db.sql`
        SELECT 
          u.id as user_id,
          u.username,
          u.team_display_name,
          SUM(ud.total_tokens) as total_tokens,
          SUM(ud.total_cost) as total_cost,
          ROUND(AVG(ud.total_tokens), 0) as daily_average,
          ROW_NUMBER() OVER (ORDER BY SUM(ud.total_tokens) DESC) as rank
        FROM users u
        JOIN team_members tm ON u.id = tm.user_id
        JOIN usage_data ud ON u.id = ud.user_id
        WHERE tm.team_id = ${teamId} 
          AND u.team_leaderboard_enabled = 1 
          AND ud.date >= date('now', '-' || ${daysBack} || ' days')
        GROUP BY u.id, u.username, u.team_display_name
        ORDER BY total_tokens DESC
        LIMIT 100
      `;
    }, { ...queryContext, operation: 'get_team_leaderboard_data' });
    
    const totalParticipants = leaderboardData.length;
    
    // Add percentiles
    const entriesWithPercentiles = leaderboardData.map((entry, index) => ({
      ...entry,
      percentile: Math.round(((totalParticipants - index) / totalParticipants) * 100)
    }));
    
    // Find current user's rank
    const userRank = entriesWithPercentiles.find(entry => entry.user_id === userId)?.rank;
    
    res.json({
      period,
      entries: entriesWithPercentiles,
      user_rank: userRank,
      total_participants: totalParticipants
    });
    
    log.performance('get_team_leaderboard', Date.now() - queryContext.startTime, { 
      userId, teamId, period, participantCount: totalParticipants 
    });
    
  } catch (error) {
    logError(error, { context: 'get_team_leaderboard', userId, teamId, period, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Preview team by invite code (public endpoint)
router.get('/api/teams/join/:inviteCode/preview', async (req, res) => {
  const { inviteCode } = req.params;
  const queryContext = logDatabaseQuery('preview_team_invite', null);
  
  try {
    const team = await req.dbManager.executeQuery(async (db) => {
      return await db.sql`
        SELECT name FROM teams WHERE invite_code = ${inviteCode}
      `;
    }, { ...queryContext, operation: 'get_team_by_invite_code' });
    
    if (team.length === 0) {
      return res.status(404).json({ error: 'Invalid invite code' });
    }
    
    res.json({ team_name: team[0].name });
    
    log.performance('preview_team_invite', Date.now() - queryContext.startTime, { 
      inviteCode, teamName: team[0].name 
    });
    
  } catch (error) {
    logError(error, { context: 'preview_team_invite', inviteCode, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Join team by invite code
router.post('/api/teams/join/:inviteCode', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const { inviteCode } = req.params;
  const queryContext = logDatabaseQuery('join_team', userId);
  
  try {
    const result = await req.dbManager.executeQuery(async (db) => {
      // Get team info
      const team = await db.sql`
        SELECT id, name FROM teams WHERE invite_code = ${inviteCode}
      `;
      
      if (team.length === 0) {
        throw new Error('Invalid invite code');
      }
      
      const teamId = team[0].id;
      const teamName = team[0].name;
      
      // Check if user is already a member
      const existingMembership = await db.sql`
        SELECT id FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId}
      `;
      
      if (existingMembership.length > 0) {
        throw new Error('Already a member');
      }
      
      // Check team capacity (limit to 50 members)
      const memberCount = await db.sql`
        SELECT COUNT(*) as count FROM team_members WHERE team_id = ${teamId}
      `;
      
      if (memberCount[0].count >= 50) {
        throw new Error('Team is full');
      }
      
      // Add user to team
      await db.sql`
        INSERT INTO team_members (team_id, user_id, role, joined_at)
        VALUES (${teamId}, ${userId}, 'member', CURRENT_TIMESTAMP)
      `;
      
      return { teamId, teamName };
    }, { ...queryContext, operation: 'join_team_by_invite' });
    
    res.json({
      message: `Successfully joined team "${result.teamName}"`,
      team_id: result.teamId,
      team_name: result.teamName
    });
    
    log.performance('join_team', Date.now() - queryContext.startTime, { 
      userId, teamId: result.teamId, inviteCode 
    });
    
  } catch (error) {
    if (error.message === 'Invalid invite code') {
      return res.status(404).json({ error: 'Invalid invite code' });
    } else if (error.message === 'Already a member') {
      return res.status(409).json({ error: 'You are already a member of this team' });
    } else if (error.message === 'Team is full') {
      return res.status(409).json({ error: 'This team has reached its maximum capacity of 50 members' });
    }
    
    logError(error, { context: 'join_team', userId, inviteCode, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Update team information
router.put('/api/teams/:teamId', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const { teamId } = req.params;
  const { name, description } = req.body;
  const queryContext = logDatabaseQuery('update_team', userId);
  
  // Validate team name
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Team name is required' });
  }
  
  if (name.length > 100) {
    return res.status(400).json({ error: 'Team name must be 100 characters or less' });
  }
  
  // Validate description if provided
  if (description && (typeof description !== 'string' || description.length > 200)) {
    return res.status(400).json({ error: 'Team description must be 200 characters or less' });
  }
  
  const trimmedName = name.trim();
  const trimmedDescription = description ? description.trim() : null;
  
  try {
    // Check if user is admin or owner
    const membership = await req.dbManager.executeQuery(async (db) => {
      return await db.sql`
        SELECT role FROM team_members 
        WHERE team_id = ${teamId} AND user_id = ${userId}
      `;
    }, { ...queryContext, operation: 'check_team_admin_permissions' });
    
    if (membership.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }
    
    if (!['admin', 'owner'].includes(membership[0].role)) {
      return res.status(403).json({ error: 'Only team admins and owners can update team information' });
    }
    
    await req.dbManager.executeQuery(async (db) => {
      return await db.sql`
        UPDATE teams 
        SET name = ${trimmedName}, description = ${trimmedDescription}
        WHERE id = ${teamId}
      `;
    }, { ...queryContext, operation: 'update_team_info' });
    
    res.json({ message: 'Team updated successfully' });
    
    log.performance('update_team', Date.now() - queryContext.startTime, { 
      userId, teamId, teamName: trimmedName 
    });
    
  } catch (error) {
    logError(error, { context: 'update_team', userId, teamId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Leave team (self-removal)
router.delete('/api/teams/:teamId/members/me', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const { teamId } = req.params;
  const queryContext = logDatabaseQuery('leave_team', userId);
  
  try {
    const result = await req.dbManager.executeQuery(async (db) => {
      // Get user's role and team info
      const userMembership = await db.sql`
        SELECT tm.role, t.name as team_name
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        WHERE tm.team_id = ${teamId} AND tm.user_id = ${userId}
      `;
      
      if (userMembership.length === 0) {
        throw new Error('Not a member');
      }
      
      const userRole = userMembership[0].role;
      const teamName = userMembership[0].team_name;
      
      // If user is an admin, check if they're the only admin
      if (userRole === 'admin') {
        const adminCount = await db.sql`
          SELECT COUNT(*) as count FROM team_members 
          WHERE team_id = ${teamId} AND role IN ('admin', 'owner')
        `;
        
        if (adminCount[0].count <= 1) {
          throw new Error('Cannot leave as only admin');
        }
      }
      
      // Remove user from team
      await db.sql`
        DELETE FROM team_members 
        WHERE team_id = ${teamId} AND user_id = ${userId}
      `;
      
      return { teamName };
    }, { ...queryContext, operation: 'leave_team' });
    
    res.json({ message: `Successfully left team "${result.teamName}"` });
    
    log.performance('leave_team', Date.now() - queryContext.startTime, { 
      userId, teamId 
    });
    
  } catch (error) {
    if (error.message === 'Not a member') {
      return res.status(404).json({ error: 'You are not a member of this team' });
    } else if (error.message === 'Cannot leave as only admin') {
      return res.status(409).json({ 
        error: 'You cannot leave the team as you are the only admin. Please promote another member to admin first or transfer ownership.' 
      });
    }
    
    logError(error, { context: 'leave_team', userId, teamId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Remove team member (admin action)
router.delete('/api/teams/:teamId/members/:targetUserId', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const { teamId, targetUserId } = req.params;
  const queryContext = logDatabaseQuery('remove_team_member', userId);
  
  // Prevent self-removal (should use leave endpoint)
  if (userId === targetUserId) {
    return res.status(400).json({ 
      error: 'Cannot remove yourself. Use the leave team endpoint instead.' 
    });
  }
  
  try {
    const result = await req.dbManager.executeQuery(async (db) => {
      // Check if requester is admin or owner
      const requesterMembership = await db.sql`
        SELECT role FROM team_members 
        WHERE team_id = ${teamId} AND user_id = ${userId}
      `;
      
      if (requesterMembership.length === 0) {
        throw new Error('Not a member');
      }
      
      if (!['admin', 'owner'].includes(requesterMembership[0].role)) {
        throw new Error('Not authorized');
      }
      
      // Get target user's membership info
      const targetMembership = await db.sql`
        SELECT tm.role, u.username
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ${teamId} AND tm.user_id = ${targetUserId}
      `;
      
      if (targetMembership.length === 0) {
        throw new Error('Target not a member');
      }
      
      const targetUsername = targetMembership[0].username;
      
      // Remove the member
      await db.sql`
        DELETE FROM team_members 
        WHERE team_id = ${teamId} AND user_id = ${targetUserId}
      `;
      
      return { targetUsername };
    }, { ...queryContext, operation: 'remove_team_member' });
    
    res.json({ 
      message: `Successfully removed ${result.targetUsername} from the team` 
    });
    
    log.performance('remove_team_member', Date.now() - queryContext.startTime, { 
      userId, teamId, targetUserId 
    });
    
  } catch (error) {
    if (error.message === 'Not a member') {
      return res.status(404).json({ error: 'You are not a member of this team' });
    } else if (error.message === 'Not authorized') {
      return res.status(403).json({ error: 'Only team admins and owners can remove members' });
    } else if (error.message === 'Target not a member') {
      return res.status(404).json({ error: 'User is not a member of this team' });
    }
    
    logError(error, { context: 'remove_team_member', userId, teamId, targetUserId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Promote team member to admin
router.put('/api/teams/:teamId/members/:targetUserId/promote', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const { teamId, targetUserId } = req.params;
  const queryContext = logDatabaseQuery('promote_team_member', userId);
  
  try {
    const result = await req.dbManager.executeQuery(async (db) => {
      // Check if requester is admin or owner
      const requesterMembership = await db.sql`
        SELECT role FROM team_members 
        WHERE team_id = ${teamId} AND user_id = ${userId}
      `;
      
      if (requesterMembership.length === 0) {
        throw new Error('Not a member');
      }
      
      if (!['admin', 'owner'].includes(requesterMembership[0].role)) {
        throw new Error('Not authorized');
      }
      
      // Get target user's membership info
      const targetMembership = await db.sql`
        SELECT tm.role, u.username
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ${teamId} AND tm.user_id = ${targetUserId}
      `;
      
      if (targetMembership.length === 0) {
        throw new Error('Target not a member');
      }
      
      if (targetMembership[0].role === 'admin') {
        throw new Error('Already admin');
      }
      
      const targetUsername = targetMembership[0].username;
      
      // Promote the member
      await db.sql`
        UPDATE team_members 
        SET role = 'admin'
        WHERE team_id = ${teamId} AND user_id = ${targetUserId}
      `;
      
      return { targetUsername };
    }, { ...queryContext, operation: 'promote_team_member' });
    
    res.json({ 
      message: `Successfully promoted ${result.targetUsername} to team admin` 
    });
    
    log.performance('promote_team_member', Date.now() - queryContext.startTime, { 
      userId, teamId, targetUserId 
    });
    
  } catch (error) {
    if (error.message === 'Not a member') {
      return res.status(404).json({ error: 'You are not a member of this team' });
    } else if (error.message === 'Not authorized') {
      return res.status(403).json({ error: 'Only team admins and owners can promote members' });
    } else if (error.message === 'Target not a member') {
      return res.status(404).json({ error: 'User is not a member of this team' });
    } else if (error.message === 'Already admin') {
      return res.status(409).json({ error: 'User is already a team admin' });
    }
    
    logError(error, { context: 'promote_team_member', userId, teamId, targetUserId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;