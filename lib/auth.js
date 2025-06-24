import crypto from 'crypto';
import { getApiUrl } from './config.js';

export function generateApiKey() {
  return 'pk_' + crypto.randomBytes(32).toString('hex');
}

export async function createUser(userData) {
  try {
    const response = await fetch(getApiUrl('/users'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create user');
    }

    const result = await response.json();
    return result.user;
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      throw new Error('User with this email or username already exists');
    }
    throw error;
  }
}

export async function getUserByApiKey(apiKey) {
  try {
    const response = await fetch(getApiUrl('/auth/validate'), {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        return null; // Invalid API key
      }
      throw new Error('Failed to validate API key');
    }

    const userData = await response.json();
    return userData.user;
  } catch (error) {
    console.error('Error validating API key:', error);
    throw error;
  }
}

export async function getUserByUsername(username) {
  try {
    const response = await fetch(getApiUrl(`/users/by-username/${encodeURIComponent(username)}`));

    if (!response.ok) {
      if (response.status === 404) {
        return null; // User not found
      }
      throw new Error('Failed to lookup username');
    }

    const userData = await response.json();
    return userData.user;
  } catch (error) {
    console.error('Error looking up username:', error);
    throw error;
  }
}

export async function listUsers() {
  // This function is no longer available for CLI users
  throw new Error('User listing is only available through the admin interface');
}

// Middleware for Express (server-side only)
export async function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  try {
    const user = await getUserByApiKey(apiKey);
    if (!user) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}