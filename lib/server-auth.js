import crypto from 'crypto';
import { Database } from '@sqlitecloud/drivers';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the package root
dotenv.config({ path: join(__dirname, '..', '.env') });

export function generateApiKey() {
  return 'pk_' + crypto.randomBytes(32).toString('hex');
}

export async function createUser(userData) {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const db = new Database(DATABASE_URL);
  
  try {
    const apiKey = generateApiKey();
    
    const result = await db.sql`
      INSERT INTO users (email, username, api_key, full_name)
      VALUES (${userData.email}, ${userData.username}, ${apiKey}, ${userData.fullName || null})
      RETURNING id, email, username, api_key, full_name, created_at
    `;
    
    return result[0];
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      throw new Error('User with this email or username already exists');
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
    const users = await db.sql`
      SELECT id, email, username, full_name, created_at
      FROM users
      WHERE api_key = ${apiKey}
    `;
    
    return users.length > 0 ? users[0] : null;
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
      SELECT id, email, username, full_name, created_at
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