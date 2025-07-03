import { Database } from "@sqlitecloud/drivers";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import KSUID from "ksuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the package root
dotenv.config({ path: join(__dirname, "..", ".env") });

// API key functions removed - OAuth only authentication

// Manual user creation is deprecated - users are created via OAuth flow only

// API key authentication removed - OAuth only

export async function getUserByAuth0Id(auth0Id) {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
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
    console.error("Error fetching user by Auth0 ID:", error);
    throw error;
  } finally {
    await db.close();
  }
}

export async function createUserFromAuth0(auth0User) {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const db = new Database(DATABASE_URL);

  try {
    const ksuid = KSUID.randomSync().string;

    const result = await db.sql`
      INSERT INTO users (id, email, username, auth0_id)
      VALUES (${ksuid}, ${auth0User.email}, ${auth0User.nickname || auth0User.name || auth0User.email}, ${auth0User.sub})
      RETURNING id, email, username, created_at, auth0_id
    `;

    return result[0];
  } catch (error) {
    if (error.message.includes("UNIQUE constraint failed")) {
      throw new Error("User with this Auth0 ID already exists");
    }
    throw error;
  } finally {
    await db.close();
  }
}

export async function listUsers() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
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
    console.error("Error listing users:", error);
    throw error;
  } finally {
    await db.close();
  }
}

export async function getUserByEmail(email) {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const db = new Database(DATABASE_URL);

  try {
    const users = await db.sql`
      SELECT id, email, username, created_at, auth0_id
      FROM users
      WHERE email = ${email} AND is_deleted = 0
      LIMIT 1
    `;

    if (users.length > 0) {
      return users[0];
    }

    return null;
  } catch (error) {
    console.error("Error fetching user by email:", error);
    throw error;
  } finally {
    await db.close();
  }
}

export async function linkAuth0ToExistingUser(userId, auth0Id) {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const db = new Database(DATABASE_URL);

  try {
    const result = await db.sql`
      UPDATE users 
      SET auth0_id = ${auth0Id}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${userId}
      RETURNING id, email, username, created_at, auth0_id
    `;

    if (result.length > 0) {
      console.log(`Successfully linked Auth0 ID ${auth0Id} to user ${userId}`);
      return result[0];
    } else {
      throw new Error("User not found or update failed");
    }
  } catch (error) {
    console.error("Error linking Auth0 ID to existing user:", error);
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
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);

      try {
        // Validate the Bearer token with Auth0
        const userInfo = await validateAuth0Token(token);

        // Try to find existing user by Auth0 ID first
        let user = await getUserByAuth0Id(userInfo.sub);

        // If no user found by Auth0 ID, check if user exists by email (web→CLI linking)
        if (!user && userInfo.email) {
          console.log(`No user found with Auth0 ID ${userInfo.sub}, checking by email: ${userInfo.email}`);
          const existingUser = await getUserByEmail(userInfo.email);

          if (existingUser) {
            // User exists but doesn't have Auth0 ID - link them
            console.log(`Found existing user ${existingUser.id} by email, linking Auth0 ID`);
            user = await linkAuth0ToExistingUser(existingUser.id, userInfo.sub);
          }
        }

        // If still no user found, create new user
        if (!user) {
          console.log(`Creating new user for Auth0 ID ${userInfo.sub}`);
          user = await createUserFromAuth0(userInfo);
        }

        // Attach user to request
        req.user = user;
        return next();

      } catch (tokenError) {
        // Add more detailed logging for debugging, especially in test environment
        if (process.env.NODE_ENV === "test") {
          console.error("Bearer token validation failed in test environment:", {
            error: tokenError.message,
            tokenLength: token.length,
            tokenPrefix: token.substring(0, 20) + "...",
            env: process.env.NODE_ENV
          });
        } else {
          console.error("Bearer token validation failed:", tokenError.message);
        }
        
        // Provide more specific error messages
        if (tokenError.message.includes("expired")) {
          return res.status(401).json({ error: "Token has expired. Please login again with: promptpulse login" });
        } else if (tokenError.message.includes("Invalid token format") || tokenError.message.includes("jwt malformed")) {
          return res.status(401).json({ error: "Invalid token format. Please login again with: promptpulse login" });
        } else if (tokenError.message.includes("Invalid client ID")) {
          return res.status(401).json({ error: "Invalid client credentials. Please login again with: promptpulse login" });
        } else {
          return res.status(401).json({ error: "Authentication failed. Please login again with: promptpulse login" });
        }
      }
    }

    // Check for Auth0 session (Web UI usage)
    const auth0User = req.user || req.session?.user;

    if (auth0User && auth0User.sub) {
      // Try to find existing user by Auth0 ID first
      let user = await getUserByAuth0Id(auth0User.sub);

      // If no user found by Auth0 ID, check if user exists by email (linking scenario)
      if (!user && auth0User.email) {
        console.log(`No user found with Auth0 ID ${auth0User.sub}, checking by email: ${auth0User.email}`);
        const existingUser = await getUserByEmail(auth0User.email);

        if (existingUser) {
          // User exists but doesn't have Auth0 ID - link them
          console.log(`Found existing user ${existingUser.id} by email, linking Auth0 ID`);
          user = await linkAuth0ToExistingUser(existingUser.id, auth0User.sub);
        }
      }

      // If still no user found, create new user
      if (!user) {
        console.log(`Creating new user for Auth0 ID ${auth0User.sub}`);
        user = await createUserFromAuth0(auth0User);
      }

      // Attach user to request
      req.user = user;
      return next();
    }

    // No valid authentication found
    return res.status(401).json({
      error: "Authentication required. Please login with: promptpulse login"
    });

  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({ error: "Authentication failed." });
  }
}

// Validate Auth0 Bearer token (user tokens only)
async function validateAuth0Token(token) {
  // Test environment: use mock validation
  if (process.env.NODE_ENV === "test") {
    const jwt = await import("jsonwebtoken").then(m => m.default);
    try {
      const decoded = jwt.verify(token, "test-oauth-secret-for-jwt-signing");
      return {
        sub: decoded.sub,
        email: decoded.email,
        nickname: decoded.nickname,
        email_verified: decoded.email_verified
      };
    } catch (error) {
      throw new Error(`Invalid token format: ${error.message}`);
    }
  }

  const fetch = await import("node-fetch").then(m => m.default);

  try {
    // Use the userinfo endpoint to validate user tokens
    const userinfoResponse = await fetch(`https://${process.env.AUTH0_DOMAIN}/userinfo`, {
      headers: {
        "Authorization": `Bearer ${token}`,
      }
    });

    if (userinfoResponse.ok) {
      return await userinfoResponse.json();
    } else {
      const errorText = await userinfoResponse.text();
      throw new Error(`Token validation failed: ${userinfoResponse.status} - ${errorText}`);
    }
  } catch (error) {
    console.error("Token validation error:", error);
    throw error;
  }
}

// OAuth-only authentication - API keys removed
