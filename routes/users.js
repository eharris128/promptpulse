import express from 'express';
import { authenticateApiKey, createUser, listUsers } from '../lib/server-auth.js';
import { logError } from '../lib/logger.js';

const router = express.Router();

// Create user endpoint
router.post('/api/users', async (req, res) => {
  const { email, username } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const user = await createUser({ email, username });
    res.json({ 
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        apiKey: user.api_key
      }
    });
  } catch (error) {
    logError(error, { context: 'create_user' });
    res.status(400).json({ error: error.message });
  }
});

// List users endpoint
router.get('/api/users', authenticateApiKey, async (req, res) => {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (error) {
    logError(error, { context: 'list_users' });
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;