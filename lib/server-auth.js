import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Database } from '@sqlitecloud/drivers';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import KSUID from 'ksuid';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the package root
dotenv.config({ path: join(__dirname, '..', '.env') });

export function generateApiKey() {
  const plaintext = 'pk_' + crypto.randomBytes(32).toString('hex');
  return plaintext;
}

export async function hashApiKey(apiKey) {
  const saltRounds = 12;
  return await bcrypt.hash(apiKey, saltRounds);
}

export async function verifyApiKey(plaintext, hash) {
  return await bcrypt.compare(plaintext, hash);
}

export async function createUser(userData) {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const db = new Database(DATABASE_URL);
  
  try {
    const apiKey = generateApiKey();
    const apiKeyHash = await hashApiKey(apiKey);
    const ksuid = KSUID.randomSync().string;
    
    const result = await db.sql`
      INSERT INTO users (id, email, username, api_key_hash)
      VALUES (${ksuid}, ${userData.email || null}, ${userData.username}, ${apiKeyHash})
      RETURNING id, email, username, created_at
    `;
    
    // Return the plaintext API key only in the response (not stored in DB)
    const userWithApiKey = {
      ...result[0],
      api_key: apiKey
    };
    
    return userWithApiKey;
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      throw new Error('User with this username already exists');
    }
    throw error;
  } finally {
    await db.close();
  }
}

export async function getUserByApiKey(apiKey) {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const db = new Database(DATABASE_URL);
  
  try {
    // Get all users with hashed API keys
    const allUsers = await db.sql`
      SELECT id, email, username, created_at, api_key_hash
      FROM users
      WHERE api_key_hash IS NOT NULL
    `;
    
    // Check each user's hashed API key
    for (const user of allUsers) {
      if (await verifyApiKey(apiKey, user.api_key_hash)) {
        // Remove sensitive data from response
        const { api_key_hash, ...userResponse } = user;
        return userResponse;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching user by API key:', error);
    throw error;
  } finally {
    await db.close();
  }
}

export async function getUserByAuth0Id(auth0Id) {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const db = new Database(DATABASE_URL);
  
  try {
    const users = await db.sql`
      SELECT id, email, username, created_at, auth0_id
      FROM users
      WHERE auth0_id = ${auth0Id}
    `;
    
    if (users.length > 0) {
      const { ...userResponse } = users[0];
      return userResponse;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching user by Auth0 ID:', error);
    throw error;
  } finally {
    await db.close();
  }
}

export async function createUserFromAuth0(auth0User) {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const db = new Database(DATABASE_URL);
  
  try {
    const ksuid = KSUID.randomSync().string;
    
    // Generate a placeholder API key hash for Auth0 users to satisfy NOT NULL constraint
    // This key is never used since Auth0 users authenticate via sessions
    const placeholderApiKey = 'auth0_user_' + crypto.randomBytes(16).toString('hex');
    const placeholderApiKeyHash = await hashApiKey(placeholderApiKey);
    
    const result = await db.sql`
      INSERT INTO users (id, email, username, auth0_id, api_key_hash)
      VALUES (${ksuid}, ${auth0User.email || null}, ${auth0User.nickname || auth0User.name}, ${auth0User.sub}, ${placeholderApiKeyHash})
      RETURNING id, email, username, created_at, auth0_id
    `;
    
    return result[0];
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      throw new Error('User with this Auth0 ID already exists');
    }
    throw error;
  } finally {
    await db.close();
  }
}

export async function listUsers() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const db = new Database(DATABASE_URL);
  
  try {
    const users = await db.sql`
      SELECT id, email, username, created_at
      FROM users
      ORDER BY created_at DESC
    `;
    
    return users;
  } catch (error) {
    console.error('Error listing users:', error);
    throw error;
  } finally {
    await db.close();
  }
}

// Middleware for Express - supports both Auth0 session and Bearer token authentication
export async function authenticateUser(req, res, next) {
  try {
    // Check for Bearer token first (CLI usage)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        // Validate the Bearer token with Auth0
        const userInfo = await validateAuth0Token(token);
        
        // Try to find existing user by Auth0 ID
        let user = await getUserByAuth0Id(userInfo.sub);
        
        // If user doesn't exist, create them
        if (!user) {
          user = await createUserFromAuth0(userInfo);
        }
        
        // Attach user to request
        req.user = user;
        return next();
        
      } catch (tokenError) {
        console.error('Bearer token validation failed:', tokenError);
        // Provide more specific error messages
        if (tokenError.message.includes('expired')) {
          return res.status(401).json({ error: 'Token has expired. Please login again with: promptpulse login' });
        } else if (tokenError.message.includes('Invalid token format')) {
          return res.status(401).json({ error: 'Invalid token format. Please login again with: promptpulse login' });
        } else if (tokenError.message.includes('Invalid client ID')) {
          return res.status(401).json({ error: 'Invalid client credentials. Please login again with: promptpulse login' });
        } else {
          return res.status(401).json({ error: 'Authentication failed. Please login again with: promptpulse login' });
        }
      }
    }
    
    // Check for Auth0 session (Web UI usage)
    const auth0User = req.user || req.session?.user;
    
    if (auth0User && auth0User.sub) {
      // Try to find existing user by Auth0 ID
      let user = await getUserByAuth0Id(auth0User.sub);
      
      // If user doesn't exist, create them
      if (!user) {
        user = await createUserFromAuth0(auth0User);
      }
      
      // Attach user to request
      req.user = user;
      return next();
    }
    
    // Legacy API key support (deprecated)
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
      try {
        const user = await getUserByApiKey(apiKey);
        if (user) {
          req.user = user;
          return next();
        }
      } catch (error) {
        console.error('API key authentication error:', error);
      }
    }
    
    // No valid authentication found
    return res.status(401).json({ 
      error: 'Authentication required. Please login with: promptpulse login' 
    });
    
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Authentication failed.' });
  }
}

// Validate Auth0 Bearer token (user tokens only)
async function validateAuth0Token(token) {
  const fetch = await import('node-fetch').then(m => m.default);
  
  try {
    // Use the userinfo endpoint to validate user tokens
    const userinfoResponse = await fetch(`https://${process.env.AUTH0_DOMAIN}/userinfo`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });

    if (userinfoResponse.ok) {
      return await userinfoResponse.json();
    } else {
      const errorText = await userinfoResponse.text();
      throw new Error(`Token validation failed: ${userinfoResponse.status} - ${errorText}`);
    }
  } catch (error) {
    console.error('Token validation error:', error);
    throw error;
  }
}

// Legacy middleware name for backward compatibility
export const authenticateApiKey = authenticateUser;