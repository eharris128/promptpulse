import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Database } from '@sqlitecloud/drivers';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import KSUID from 'ksuid';

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

// Middleware for Express
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