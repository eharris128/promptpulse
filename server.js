import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import KSUID from "ksuid";
import rateLimit from "express-rate-limit";
import session from "express-session";
import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { authenticateUser, listUsers, getUserByAuth0Id, getUserByEmail, createUserFromAuth0, linkAuth0ToExistingUser } from "./lib/server-auth.js";
import { initializeDbManager } from "./lib/db-manager.js";
import { logger, requestLogger, logDatabaseQuery, logError, log } from "./lib/logger.js";
import emailService from "./lib/email-service.js";
import reportGenerator from "./lib/report-generator.js";
import {
  detectSqlInjectionMiddleware,
  sanitizeAllInputs,
  securityHeaders,
  CommonValidators
} from "./lib/validation-middleware.js";

const app = express();
const PORT = process.env.PORT || 3000;

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Trust proxy for Railway deployment (fixes X-Forwarded-For header validation)
app.set("trust proxy", 1);

// CORS configuration for production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // In production, only allow specific domains
    const allowedOrigins = [
      "https://exciting-patience-production.up.railway.app",
      "https://www.promptpulse.dev",
      "https://promptpulse.dev",
      "http://localhost:3001",
      "http://localhost:3000"
    ];


    // Add custom domain from environment variable
    if (process.env.PROMPTPULSE_DASHBOARD_URL) {
      allowedOrigins.push(process.env.PROMPTPULSE_DASHBOARD_URL);
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Add request logging middleware first
app.use(requestLogger());

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" })); // Limit payload size for cost protection

// Configure express-session for Auth0 session management
app.use(session({
  secret: process.env.AUTH0_SECRET || "your-secret-key",
  name: "promptpulse.sid", // Explicit session name
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production" && process.env.FORCE_HTTPS !== "false", // Allow disabling for local testing
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: "lax", // Important for Auth0 redirects
    domain: process.env.COOKIE_DOMAIN || undefined, // Allow setting custom domain
    path: "/" // Explicit path
  }
}));

// Rate limiting for cost protection
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all requests
app.use(limiter);

// More strict rate limiting for batch uploads (cost protection)
const batchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Only 5 batch uploads per minute per IP
  message: {
    error: "Batch upload rate limit exceeded. Please wait before uploading again.",
    retryAfter: "1 minute"
  }
});

// Apply to batch endpoints
app.use("/api/usage/*/batch", batchLimiter);

// Apply security middleware
app.use(securityHeaders);
app.use(detectSqlInjectionMiddleware);
app.use(sanitizeAllInputs);

// Initialize Auth0 client for session validation
const auth0 = new Auth0Client({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  secret: process.env.AUTH0_SECRET,
  appBaseUrl: process.env.APP_BASE_URL
});

// Session validation middleware for Express API
app.use((req, res, next) => {
  // Check if user is authenticated via express-session
  if (req.session && req.session.isAuthenticated && req.session.user) {
    req.user = req.session.user;
  }
  next();
});

// Auth0 authentication routes for web app
app.get("/auth/login", (req, res) => {
  logger.info("🔐 AUTH LOGIN REQUEST", {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    origin: req.get("Origin"),
    referer: req.get("Referer"),
    returnTo: req.query.returnTo,
    allHeaders: req.headers,
    timestamp: new Date().toISOString()
  });

  const returnTo = req.query.returnTo || process.env.APP_BASE_URL;
  const authUrl = `https://${process.env.AUTH0_DOMAIN}/authorize?` +
    `response_type=code&` +
    `client_id=${process.env.AUTH0_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(`${process.env.APP_BASE_URL  }/auth/callback`)}&` +
    `scope=openid%20profile%20email&` +
    `state=${encodeURIComponent(returnTo)}`;

  logger.info("🔐 AUTH LOGIN REDIRECT", { authUrl, returnTo });
  res.redirect(authUrl);
});

app.get("/auth/logout", async (req, res) => {
  logger.info("🚪 AUTH LOGOUT REQUEST", {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    origin: req.get("Origin"),
    referer: req.get("Referer"),
    hasSession: !!req.user,
    timestamp: new Date().toISOString()
  });

  try {
    const logoutUrl = `https://${process.env.AUTH0_DOMAIN}/v2/logout?` +
      `client_id=${process.env.AUTH0_CLIENT_ID}&` +
      `returnTo=${encodeURIComponent(process.env.APP_BASE_URL)}`;

    // Clear session if it exists
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          logger.warn("🚪 AUTH SESSION CLEAR FAILED", err);
        } else {
          logger.info("🚪 AUTH SESSION CLEARED");
        }
      });
    }

    logger.info("🚪 AUTH LOGOUT REDIRECT", { logoutUrl });
    res.redirect(logoutUrl);
  } catch (error) {
    logger.error("🚪 AUTH LOGOUT ERROR", error);
    res.redirect(process.env.APP_BASE_URL);
  }
});

app.get("/auth/callback", async (req, res) => {
  logger.info("🔄 AUTH CALLBACK REQUEST", {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    origin: req.get("Origin"),
    referer: req.get("Referer"),
    hasCode: !!req.query.code,
    state: req.query.state,
    queryParams: req.query,
    timestamp: new Date().toISOString()
  });

  try {
    const { code, state } = req.query;

    if (!code) {
      logger.error("🔄 AUTH CALLBACK ERROR: No authorization code");
      return res.status(400).send("Authorization code missing");
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.APP_BASE_URL  }/auth/callback`
      })
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      logger.error("🔄 AUTH CALLBACK TOKEN EXCHANGE FAILED", tokens);
      return res.status(400).send("Authentication failed");
    }

    logger.info("🔄 AUTH CALLBACK TOKEN EXCHANGE SUCCESS");

    // Get user info
    const userResponse = await fetch(`https://${process.env.AUTH0_DOMAIN}/userinfo`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });

    const userInfo = await userResponse.json();

    if (!userResponse.ok) {
      logger.error("🔄 AUTH CALLBACK USER INFO FAILED", userInfo);
      return res.status(400).send("Failed to get user information");
    }

    logger.info("🔄 AUTH CALLBACK USER INFO SUCCESS", { email: userInfo.email, sub: userInfo.sub });

    // Ensure user exists in database
    let dbUser = await getUserByAuth0Id(userInfo.sub);

    if (!dbUser) {
      // Try to find by email (for existing users without Auth0 ID)
      dbUser = await getUserByEmail(userInfo.email);

      if (dbUser) {
        // Link existing user to Auth0
        logger.info("🔗 AUTH CALLBACK LINKING EXISTING USER", {
          userId: dbUser.id,
          email: userInfo.email,
          auth0Id: userInfo.sub
        });
        await linkAuth0ToExistingUser(dbUser.id, userInfo.sub);
        // Refresh user data to get updated Auth0 ID
        dbUser = await getUserByAuth0Id(userInfo.sub);
      } else {
        // Create new user
        logger.info("🆕 AUTH CALLBACK CREATING NEW USER", {
          email: userInfo.email,
          auth0Id: userInfo.sub
        });
        dbUser = await createUserFromAuth0(userInfo);
      }
    }

    logger.info("🔄 AUTH CALLBACK DATABASE USER READY", {
      userId: dbUser.id,
      email: dbUser.email,
      auth0Id: dbUser.auth0_id
    });

    // Create session manually using express-session
    req.session.user = userInfo;
    req.session.accessToken = tokens.access_token;
    req.session.refreshToken = tokens.refresh_token;
    req.session.idToken = tokens.id_token;
    req.session.isAuthenticated = true;

    logger.info("🔄 AUTH CALLBACK SESSION CREATED");

    // Redirect to return URL or home
    const returnTo = state || process.env.APP_BASE_URL;
    logger.info("🔄 AUTH CALLBACK REDIRECT", { returnTo });
    res.redirect(returnTo);

  } catch (error) {
    logger.error("🔄 AUTH CALLBACK ERROR", error);
    res.status(500).send("Authentication error");
  }
});

app.get("/auth/profile", async (req, res) => {
  logger.info("👤 AUTH PROFILE REQUEST", {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    origin: req.get("Origin"),
    referer: req.get("Referer"),
    hasUser: !!req.user,
    timestamp: new Date().toISOString()
  });

  try {
    if (!req.session || !req.session.isAuthenticated || !req.session.user) {
      logger.warn("👤 AUTH PROFILE UNAUTHORIZED - No session or user");
      return res.status(401).json({ error: "Not authenticated" });
    }

    logger.info("👤 AUTH PROFILE SUCCESS", { email: req.session.user.email, sub: req.session.user.sub });
    res.json(req.session.user);
  } catch (error) {
    logger.error("👤 AUTH PROFILE ERROR", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// Logged out page for CLI logout redirect
app.get("/logged-out", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Logged Out - PromptPulse</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
          color: #ffffff;
          margin: 0;
          padding: 0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          text-align: center;
          max-width: 500px;
          padding: 40px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
        }
        .icon {
          font-size: 64px;
          margin-bottom: 24px;
          display: block;
        }
        h1 {
          font-size: 28px;
          margin-bottom: 16px;
          font-weight: 600;
        }
        p {
          font-size: 16px;
          line-height: 1.5;
          margin-bottom: 24px;
          opacity: 0.8;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background: #3b82f6;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 500;
          transition: background 0.2s;
        }
        .button:hover {
          background: #2563eb;
        }
        .secondary {
          margin-top: 16px;
          font-size: 14px;
          opacity: 0.6;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <span class="icon">✅</span>
        <h1>Successfully Logged Out</h1>
        <p>You have been logged out from the PromptPulse CLI.</p>
        <p>You can safely close this browser tab.</p>
        <a href="/" class="button">Continue to Web Dashboard</a>
        <div class="secondary">
          To use the CLI again, run <code>promptpulse login</code>
        </div>
      </div>
    </body>
    </html>
  `);
});

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  logger.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

// Security utilities for SQL injection prevention
const buildSecureWhereClause = (conditions) => {
  if (!conditions || conditions.length === 0) {
    return { clause: "", params: [] };
  }

  const placeholders = conditions.map(() => "?").join(" AND ");
  const clause = `WHERE ${conditions.map(c => c.condition).join(" AND ")}`;
  const params = conditions.map(c => c.value);

  return { clause, params };
};

const validateSqlIdentifier = (identifier) => {
  // Only allow alphanumeric characters, underscores, and hyphens
  if (!/^[a-zA-Z0-9_-]+$/.test(identifier)) {
    throw new Error(`Invalid identifier: ${identifier}`);
  }
  return identifier;
};

// Initialize database manager immediately
const dbManager = initializeDbManager(DATABASE_URL, {
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS) || 10,
  idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
  retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS) || 3,
  retryDelay: parseInt(process.env.DB_RETRY_DELAY) || 1000
});

// Health check endpoint
app.get("/health", async (req, res) => {
  const queryContext = logDatabaseQuery("health_check", null);

  try {
    await dbManager.executeQuery(async (db) => {
      return await db.sql`SELECT 1 as health_check`;
    }, queryContext);

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.2",
      database: "connected"
    });

    log.performance("health_check", Date.now() - queryContext.startTime);
  } catch (error) {
    logError(error, { context: "health_check", queryContext });
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: "Database connection failed"
    });
  }
});

// Database health check endpoint
app.get("/api/health/db", async (req, res) => {
  try {
    const healthStatus = await dbManager.healthCheck();
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: healthStatus
    });
  } catch (error) {
    logError(error, { context: "db_health_check" });
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Database metrics endpoint
app.get("/api/metrics", async (req, res) => {
  try {
    const metrics = dbManager.getMetrics();
    res.json({
      timestamp: new Date().toISOString(),
      database: metrics,
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid
      }
    });
  } catch (error) {
    logError(error, { context: "metrics" });
    res.status(500).json({ error: "Failed to get metrics" });
  }
});

// TODO - likely deprecate
// Authentication validation endpoint
app.get("/api/auth/validate", authenticateUser, async (req, res) => {
  // If we get here, the API key is valid (middleware already validated)
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      username: req.user.username
    }
  });
});

// Username lookup endpoint (public - returns limited user info)
app.get("/api/users/by-username/:username", async (req, res) => {
  const { username: rawUsername } = req.params;
  const username = decodeURIComponent(rawUsername);
  const queryContext = logDatabaseQuery("lookup_user_by_username", null);

  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  try {
    logger.debug("Looking up username", { username, rawUsername: req.params.username });

    const user = await dbManager.executeQuery(async (db) => {
      return await db.sql`SELECT * FROM users WHERE username = ${username} LIMIT 1`;
    }, { ...queryContext, operation: "find_user_by_username" });

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: {
        id: user[0].id,
        username: user[0].username,
        email: user[0].email,
        created_at: user[0].created_at
      }
    });

    log.performance("lookup_user_by_username", Date.now() - queryContext.startTime, { username });

  } catch (error) {
    logError(error, { context: "lookup_user_by_username", username, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

// TODO - likely deprecate
// API key validation endpoint
app.get("/api/auth/validate", authenticateUser, async (req, res) => {
  try {
    // If we reach here, authentication was successful
    res.json({
      message: "API key is valid",
      user: {
        id: req.user.id,
        email: req.user.email,
        username: req.user.username,
        created_at: req.user.created_at
      }
    });
  } catch (error) {
    console.error("Error in auth validation:", error);
    res.status(500).json({ error: "Validation failed" });
  }
});

app.get("/api/users", authenticateUser, async (req, res) => {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (error) {
    console.error("Error listing users:", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/usage", authenticateUser, async (req, res) => {
  const { machineId, data } = req.body;
  const userId = req.user.id;

  if (!machineId || !data) {
    return res.status(400).json({ error: "Missing machineId or data" });
  }

  try {
    await dbManager.executeQuery(async (db) => {
      for (const dayData of data) {
        await db.sql`
          INSERT OR REPLACE INTO usage_data (
            machine_id, user_id, date, input_tokens, output_tokens, 
            cache_creation_tokens, cache_read_tokens, total_tokens,
            total_cost, models_used, model_breakdowns
          ) VALUES (
            ${machineId},
            ${userId},
            ${dayData.date},
            ${dayData.inputTokens},
            ${dayData.outputTokens},
            ${dayData.cacheCreationTokens},
            ${dayData.cacheReadTokens},
            ${dayData.totalTokens},
            ${dayData.totalCost},
            ${JSON.stringify(dayData.modelsUsed)},
            ${JSON.stringify(dayData.modelBreakdowns)}
          )
        `;
      }
    }, { operation: "upload_usage_data", user_id: userId, machine_id: machineId });

    res.json({
      message: "Usage data uploaded successfully",
      recordsProcessed: data.length
    });

  } catch (error) {
    console.error("Error inserting data:", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/usage/aggregate", authenticateUser, CommonValidators.usageQuery, async (req, res) => {
  const { since, until, machineId } = req.query;
  const userId = req.user.id;
  const queryContext = logDatabaseQuery("usage_aggregate", userId);

  log.apiCall("/api/usage/aggregate", "GET", userId);
  logger.debug("Aggregate API called", {
    userId,
    queryParams: { since, until, machineId },
    requestId: req.requestId
  });

  try {

    const results = await dbManager.executeQuery(async (db) => {
      // Build queries based on conditions
      let daily;
      if (machineId && since && until) {
        daily = await db.sql`
          SELECT 
            machine_id,
            date,
            SUM(input_tokens) as input_tokens,
            SUM(output_tokens) as output_tokens,
            SUM(cache_creation_tokens) as cache_creation_tokens,
            SUM(cache_read_tokens) as cache_read_tokens,
            SUM(total_tokens) as total_tokens,
            SUM(total_cost) as total_cost,
            GROUP_CONCAT(models_used, '|') as models_used_concat
          FROM usage_data
          WHERE user_id = ${userId} AND machine_id = ${machineId} AND date >= ${since} AND date <= ${until}
          GROUP BY machine_id, date 
          ORDER BY date DESC, machine_id
        `;
      } else if (machineId && since) {
        daily = await db.sql`
          SELECT 
            machine_id,
            date,
            SUM(input_tokens) as input_tokens,
            SUM(output_tokens) as output_tokens,
            SUM(cache_creation_tokens) as cache_creation_tokens,
            SUM(cache_read_tokens) as cache_read_tokens,
            SUM(total_tokens) as total_tokens,
            SUM(total_cost) as total_cost,
            GROUP_CONCAT(models_used, '|') as models_used_concat
          FROM usage_data
          WHERE user_id = ${userId} AND machine_id = ${machineId} AND date >= ${since}
          GROUP BY machine_id, date 
          ORDER BY date DESC, machine_id
        `;
      } else if (since && until) {
        daily = await db.sql`
          SELECT 
            machine_id,
            date,
            SUM(input_tokens) as input_tokens,
            SUM(output_tokens) as output_tokens,
            SUM(cache_creation_tokens) as cache_creation_tokens,
            SUM(cache_read_tokens) as cache_read_tokens,
            SUM(total_tokens) as total_tokens,
            SUM(total_cost) as total_cost,
            GROUP_CONCAT(models_used, '|') as models_used_concat
          FROM usage_data
          WHERE user_id = ${userId} AND date >= ${since} AND date <= ${until}
          GROUP BY machine_id, date 
          ORDER BY date DESC, machine_id
        `;
      } else if (since) {
        daily = await db.sql`
          SELECT 
            machine_id,
            date,
            SUM(input_tokens) as input_tokens,
            SUM(output_tokens) as output_tokens,
            SUM(cache_creation_tokens) as cache_creation_tokens,
            SUM(cache_read_tokens) as cache_read_tokens,
            SUM(total_tokens) as total_tokens,
            SUM(total_cost) as total_cost,
            GROUP_CONCAT(models_used, '|') as models_used_concat
          FROM usage_data
          WHERE user_id = ${userId} AND date >= ${since}
          GROUP BY machine_id, date 
          ORDER BY date DESC, machine_id
        `;
      } else if (machineId) {
        daily = await db.sql`
          SELECT 
            machine_id,
            date,
            SUM(input_tokens) as input_tokens,
            SUM(output_tokens) as output_tokens,
            SUM(cache_creation_tokens) as cache_creation_tokens,
            SUM(cache_read_tokens) as cache_read_tokens,
            SUM(total_tokens) as total_tokens,
            SUM(total_cost) as total_cost,
            GROUP_CONCAT(models_used, '|') as models_used_concat
          FROM usage_data
          WHERE user_id = ${userId} AND machine_id = ${machineId}
          GROUP BY machine_id, date 
          ORDER BY date DESC, machine_id
        `;
      } else {
        daily = await db.sql`
          SELECT 
            machine_id,
            date,
            SUM(input_tokens) as input_tokens,
            SUM(output_tokens) as output_tokens,
            SUM(cache_creation_tokens) as cache_creation_tokens,
            SUM(cache_read_tokens) as cache_read_tokens,
            SUM(total_tokens) as total_tokens,
            SUM(total_cost) as total_cost,
            GROUP_CONCAT(models_used, '|') as models_used_concat
          FROM usage_data
          WHERE user_id = ${userId}
          GROUP BY machine_id, date 
          ORDER BY date DESC, machine_id
        `;
      }

      // Similar approach for totals query
      let totalsArray;
      if (machineId && since && until) {
        totalsArray = await db.sql`
          SELECT 
            COUNT(DISTINCT machine_id) as total_machines,
            SUM(input_tokens) as total_input_tokens,
            SUM(output_tokens) as total_output_tokens,
            SUM(cache_creation_tokens) as total_cache_creation_tokens,
            SUM(cache_read_tokens) as total_cache_read_tokens,
            SUM(total_tokens) as total_tokens,
            SUM(total_cost) as total_cost
          FROM usage_data
          WHERE user_id = ${userId} AND machine_id = ${machineId} AND date >= ${since} AND date <= ${until}
        `;
      } else if (machineId && since) {
        totalsArray = await db.sql`
          SELECT 
            COUNT(DISTINCT machine_id) as total_machines,
            SUM(input_tokens) as total_input_tokens,
            SUM(output_tokens) as total_output_tokens,
            SUM(cache_creation_tokens) as total_cache_creation_tokens,
            SUM(cache_read_tokens) as total_cache_read_tokens,
            SUM(total_tokens) as total_tokens,
            SUM(total_cost) as total_cost
          FROM usage_data
          WHERE user_id = ${userId} AND machine_id = ${machineId} AND date >= ${since}
        `;
      } else if (since && until) {
        totalsArray = await db.sql`
          SELECT 
            COUNT(DISTINCT machine_id) as total_machines,
            SUM(input_tokens) as total_input_tokens,
            SUM(output_tokens) as total_output_tokens,
            SUM(cache_creation_tokens) as total_cache_creation_tokens,
            SUM(cache_read_tokens) as total_cache_read_tokens,
            SUM(total_tokens) as total_tokens,
            SUM(total_cost) as total_cost
          FROM usage_data
          WHERE user_id = ${userId} AND date >= ${since} AND date <= ${until}
        `;
      } else if (since) {
        totalsArray = await db.sql`
          SELECT 
            COUNT(DISTINCT machine_id) as total_machines,
            SUM(input_tokens) as total_input_tokens,
            SUM(output_tokens) as total_output_tokens,
            SUM(cache_creation_tokens) as total_cache_creation_tokens,
            SUM(cache_read_tokens) as total_cache_read_tokens,
            SUM(total_tokens) as total_tokens,
            SUM(total_cost) as total_cost
          FROM usage_data
          WHERE user_id = ${userId} AND date >= ${since}
        `;
      } else if (machineId) {
        totalsArray = await db.sql`
          SELECT 
            COUNT(DISTINCT machine_id) as total_machines,
            SUM(input_tokens) as total_input_tokens,
            SUM(output_tokens) as total_output_tokens,
            SUM(cache_creation_tokens) as total_cache_creation_tokens,
            SUM(cache_read_tokens) as total_cache_read_tokens,
            SUM(total_tokens) as total_tokens,
            SUM(total_cost) as total_cost
          FROM usage_data
          WHERE user_id = ${userId} AND machine_id = ${machineId}
        `;
      } else {
        totalsArray = await db.sql`
          SELECT 
            COUNT(DISTINCT machine_id) as total_machines,
            SUM(input_tokens) as total_input_tokens,
            SUM(output_tokens) as total_output_tokens,
            SUM(cache_creation_tokens) as total_cache_creation_tokens,
            SUM(cache_read_tokens) as total_cache_read_tokens,
            SUM(total_tokens) as total_tokens,
            SUM(total_cost) as total_cost,
            SUM(thinking_tokens) as total_thinking_tokens,
            COUNT(CASE WHEN thinking_mode_detected = 1 THEN 1 END) as thinking_sessions_count,
            AVG(CASE WHEN thinking_mode_detected = 1 THEN thinking_percentage ELSE NULL END) as average_thinking_percentage
          FROM usage_data
          WHERE user_id = ${userId}
        `;
      }

      const totals = totalsArray[0] || {};

      // Ensure thinking mode fields have default values
      totals.total_thinking_tokens = totals.total_thinking_tokens || 0;
      totals.thinking_sessions_count = totals.thinking_sessions_count || 0;
      totals.average_thinking_percentage = totals.average_thinking_percentage || 0;

      // Ensure daily is always an array
      const dailyResults = Array.isArray(daily) ? daily : [];

      // Process models_used field
      dailyResults.forEach(row => {
        if (row.models_used_concat) {
          // Split by pipe, parse each JSON array, flatten, and deduplicate
          const allModels = row.models_used_concat.split("|")
            .map(jsonStr => {
              try {
                return JSON.parse(jsonStr);
              } catch (e) {
                return [];
              }
            })
            .flat();

          // Deduplicate models
          row.models_used = [...new Set(allModels)];
        } else {
          row.models_used = [];
        }
        // Remove the concat field
        delete row.models_used_concat;
      });

      // Debug logging
      const debugCount = await db.sql`SELECT COUNT(*) as count FROM usage_data WHERE user_id = ${userId}`;
      logger.debug("Usage data debug info", {
        userId,
        userRecordCount: debugCount[0]?.count,
        dailyResultsCount: dailyResults.length,
        dailyIsArray: Array.isArray(daily),
        totalsType: typeof totals,
        requestId: req.requestId,
        queryType: "tagged_template_literals"
      });

      return { daily: dailyResults, totals: totals || {} };
    }, { ...queryContext, operation: "aggregate_usage_data" });

    logger.debug("Aggregate API results", {
      userId,
      dailyResultsCount: results.daily?.length || 0,
      dailyIsArray: Array.isArray(results.daily),
      totals: results.totals,
      requestId: req.requestId
    });

    res.json({
      daily: results.daily,
      totals: results.totals || {}
    });

    log.performance("aggregate_usage_data", Date.now() - queryContext.startTime, { userId });

  } catch (error) {
    logError(error, { context: "aggregate_usage_data", userId, queryContext });
    log.apiError("/api/usage/aggregate", error, 500);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/machines", authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const queryContext = logDatabaseQuery("fetch_machines", userId);

  try {
    const machines = await dbManager.executeQuery(async (db) => {
      return await db.sql`
        SELECT 
          machine_id,
          COUNT(*) as days_tracked,
          MIN(date) as first_date,
          MAX(date) as last_date,
          SUM(total_cost) as total_cost
        FROM usage_data 
        WHERE user_id = ${userId}
        GROUP BY machine_id
        ORDER BY last_date DESC
      `;
    }, { ...queryContext, operation: "fetch_user_machines" });

    res.json(machines);
    log.performance("fetch_machines", Date.now() - queryContext.startTime, { userId, machineCount: machines.length });
  } catch (error) {
    logError(error, { context: "fetch_machines", userId, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});


// Session data endpoints
app.get("/api/usage/sessions", authenticateUser, CommonValidators.usageQuery, async (req, res) => {
  const { machineId, projectPath, since, until, limit = 50 } = req.query;
  const userId = req.user.id;
  const queryContext = logDatabaseQuery("fetch_sessions", userId);

  try {
    const sessions = await dbManager.executeQuery(async (db) => {
      // Validate and sanitize limit parameter
      const sanitizedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 1000);

      // Build query based on conditions
      let result;
      if (machineId && projectPath && since && until) {
        result = await db.sql`
          SELECT * FROM usage_sessions 
          WHERE user_id = ${userId} AND machine_id = ${machineId} 
            AND project_path LIKE ${`%${  projectPath  }%`}
            AND start_time >= ${since} AND start_time <= ${until}
          ORDER BY start_time DESC 
          LIMIT ${sanitizedLimit}
        `;
      } else if (machineId && projectPath && since) {
        result = await db.sql`
          SELECT * FROM usage_sessions 
          WHERE user_id = ${userId} AND machine_id = ${machineId} 
            AND project_path LIKE ${`%${  projectPath  }%`}
            AND start_time >= ${since}
          ORDER BY start_time DESC 
          LIMIT ${sanitizedLimit}
        `;
      } else if (machineId && projectPath) {
        result = await db.sql`
          SELECT * FROM usage_sessions 
          WHERE user_id = ${userId} AND machine_id = ${machineId} 
            AND project_path LIKE ${`%${  projectPath  }%`}
          ORDER BY start_time DESC 
          LIMIT ${sanitizedLimit}
        `;
      } else if (machineId && since && until) {
        result = await db.sql`
          SELECT * FROM usage_sessions 
          WHERE user_id = ${userId} AND machine_id = ${machineId} 
            AND start_time >= ${since} AND start_time <= ${until}
          ORDER BY start_time DESC 
          LIMIT ${sanitizedLimit}
        `;
      } else if (machineId && since) {
        result = await db.sql`
          SELECT * FROM usage_sessions 
          WHERE user_id = ${userId} AND machine_id = ${machineId} 
            AND start_time >= ${since}
          ORDER BY start_time DESC 
          LIMIT ${sanitizedLimit}
        `;
      } else if (projectPath && since && until) {
        result = await db.sql`
          SELECT * FROM usage_sessions 
          WHERE user_id = ${userId} 
            AND project_path LIKE ${`%${  projectPath  }%`}
            AND start_time >= ${since} AND start_time <= ${until}
          ORDER BY start_time DESC 
          LIMIT ${sanitizedLimit}
        `;
      } else if (projectPath && since) {
        result = await db.sql`
          SELECT * FROM usage_sessions 
          WHERE user_id = ${userId} 
            AND project_path LIKE ${`%${  projectPath  }%`}
            AND start_time >= ${since}
          ORDER BY start_time DESC 
          LIMIT ${sanitizedLimit}
        `;
      } else if (since && until) {
        result = await db.sql`
          SELECT * FROM usage_sessions 
          WHERE user_id = ${userId} 
            AND start_time >= ${since} AND start_time <= ${until}
          ORDER BY start_time DESC 
          LIMIT ${sanitizedLimit}
        `;
      } else if (machineId) {
        result = await db.sql`
          SELECT * FROM usage_sessions 
          WHERE user_id = ${userId} AND machine_id = ${machineId}
          ORDER BY start_time DESC 
          LIMIT ${sanitizedLimit}
        `;
      } else if (projectPath) {
        result = await db.sql`
          SELECT * FROM usage_sessions 
          WHERE user_id = ${userId} 
            AND project_path LIKE ${`%${  projectPath  }%`}
          ORDER BY start_time DESC 
          LIMIT ${sanitizedLimit}
        `;
      } else if (since) {
        result = await db.sql`
          SELECT * FROM usage_sessions 
          WHERE user_id = ${userId} AND start_time >= ${since}
          ORDER BY start_time DESC 
          LIMIT ${sanitizedLimit}
        `;
      } else {
        result = await db.sql`
          SELECT * FROM usage_sessions 
          WHERE user_id = ${userId}
          ORDER BY start_time DESC 
          LIMIT ${sanitizedLimit}
        `;
      }

      return result;
    }, { ...queryContext, operation: "fetch_user_sessions" });

    // Parse JSON fields
    sessions.forEach(session => {
      if (session.models_used) session.models_used = JSON.parse(session.models_used);
      if (session.model_breakdowns) session.model_breakdowns = JSON.parse(session.model_breakdowns);
    });

    res.json(sessions);
    log.performance("fetch_sessions", Date.now() - queryContext.startTime, { userId, sessionCount: sessions.length });
  } catch (error) {
    logError(error, { context: "fetch_sessions", userId, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

// Projects data endpoint
app.get("/api/usage/projects", authenticateUser, CommonValidators.usageQuery, async (req, res) => {
  const { since, limit = 10 } = req.query;
  const userId = req.user.id;
  const queryContext = logDatabaseQuery("fetch_projects", userId);

  try {
    const projects = await dbManager.executeQuery(async (db) => {
      // Default to last 30 days if no since parameter provided
      const sinceDate = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const limitValue = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

      // Debug: Log the parameters being used
      logger.debug("Projects query parameters", {
        userId,
        sinceDate,
        limitValue,
        originalSince: since,
        currentTime: new Date().toISOString()
      });

      // Use tagged template literal for SQLite Cloud
      const results = await db.sql`
        SELECT 
          project_path,
          COUNT(*) as session_count,
          SUM(total_cost) as total_cost,
          SUM(total_tokens) as total_tokens,
          SUM(input_tokens) as input_tokens,
          SUM(output_tokens) as output_tokens,
          SUM(cache_creation_tokens) as cache_creation_tokens,
          SUM(cache_read_tokens) as cache_read_tokens,
          AVG(duration_minutes) as avg_duration,
          MAX(start_time) as last_activity
        FROM usage_sessions
        WHERE user_id = ${userId} AND project_path IS NOT NULL AND start_time >= ${sinceDate}
        GROUP BY project_path 
        ORDER BY total_tokens DESC
        LIMIT ${limitValue}
      `;

      // Debug: Log the raw results
      logger.debug("Projects query raw results", {
        userId,
        resultCount: results.length,
        results: results.map(r => ({
          project_path: r.project_path,
          session_count: r.session_count,
          total_tokens: r.total_tokens,
          last_activity: r.last_activity
        }))
      });

      // Also check total sessions for comparison
      const totals = await db.sql`
        SELECT COUNT(*) as total_sessions, COUNT(DISTINCT project_path) as unique_projects
        FROM usage_sessions
        WHERE user_id = ${userId} AND project_path IS NOT NULL AND start_time >= ${sinceDate}
      `;

      logger.debug("Projects debug totals", {
        userId,
        totalSessions: totals[0]?.total_sessions,
        uniqueProjects: totals[0]?.unique_projects,
        queryTimeWindow: sinceDate
      });

      return results;
    }, { ...queryContext, operation: "fetch_user_projects" });

    // Add project name derivation with safety check and enhanced flattening
    const projectsWithNames = Array.isArray(projects) ? projects.map(project => {
      // Extract project name from path with better normalization
      let projectName = project.project_path;
      let normalizedPath = project.project_path;

      if (projectName) {
        // Normalize path separators and clean up the path
        normalizedPath = projectName.replace(/\\/g, "/").toLowerCase();

        // Extract project name from path (e.g., /home/user/projects/my-app -> my-app)
        const parts = projectName.split(/[/\\]/);
        projectName = parts[parts.length - 1] || parts[parts.length - 2] || "Unknown";

        // Clean up common project name patterns
        if (projectName.startsWith("projects-")) {
          projectName = projectName.substring(9); // Remove 'projects-' prefix
        }
      }

      // Enhanced project metadata
      const enhancedProject = {
        ...project,
        project_name: projectName,
        normalized_path: normalizedPath,
        avg_duration: project.avg_duration ? Math.round(project.avg_duration) : null,
        // Calculate additional metrics
        avg_cost_per_session: project.session_count > 0 ? (project.total_cost / project.session_count) : 0,
        avg_tokens_per_session: project.session_count > 0 ? Math.round(project.total_tokens / project.session_count) : 0,
        // Add activity indicators
        is_recent: project.last_activity && new Date(project.last_activity) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        activity_level: project.session_count >= 5 ? "high" : project.session_count >= 2 ? "medium" : "low"
      };

      return enhancedProject;
    }) : [];

    // Log final results for debugging
    logger.debug("Projects with enhanced flattening", {
      userId,
      finalProjectCount: projectsWithNames.length,
      projectNames: projectsWithNames.map(p => ({
        name: p.project_name,
        sessions: p.session_count,
        tokens: p.total_tokens,
        activity_level: p.activity_level
      }))
    });

    res.json(projectsWithNames);
    log.performance("fetch_projects", Date.now() - queryContext.startTime, {
      userId, projectCount: projectsWithNames.length
    });
  } catch (error) {
    logError(error, { context: "fetch_projects", userId, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

// Enhanced flattened project overview endpoint
app.get("/api/usage/projects/flattened", authenticateUser, CommonValidators.usageQuery, async (req, res) => {
  const { since, limit = 20 } = req.query;
  const userId = req.user.id;
  const queryContext = logDatabaseQuery("fetch_flattened_projects", userId);

  try {
    const flattenedProjects = await dbManager.executeQuery(async (db) => {
      // Default to last 30 days if no since parameter provided
      const sinceDate = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const limitValue = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

      // Get comprehensive project data with better flattening
      return await db.sql`
        SELECT 
          project_path,
          COUNT(DISTINCT session_id) as total_sessions,
          COUNT(DISTINCT DATE(start_time)) as active_days,
          MIN(start_time) as first_session,
          MAX(start_time) as last_session,
          SUM(total_cost) as total_cost,
          SUM(total_tokens) as total_tokens,
          SUM(input_tokens) as total_input_tokens,
          SUM(output_tokens) as total_output_tokens,
          SUM(cache_creation_tokens) as total_cache_creation_tokens,
          SUM(cache_read_tokens) as total_cache_read_tokens,
          AVG(duration_minutes) as avg_session_duration,
          SUM(duration_minutes) as total_duration_minutes,
          -- Calculate session frequency
          ROUND(
            CAST(COUNT(DISTINCT session_id) AS FLOAT) / 
            MAX(1, (JULIANDAY(MAX(start_time)) - JULIANDAY(MIN(start_time)) + 1)), 2
          ) as sessions_per_day
        FROM usage_sessions
        WHERE user_id = ${userId} AND project_path IS NOT NULL AND start_time >= ${sinceDate}
        GROUP BY project_path 
        ORDER BY total_tokens DESC
        LIMIT ${limitValue}
      `;
    }, { ...queryContext, operation: "fetch_flattened_projects" });

    // Process and enhance the flattened data
    const enhancedProjects = flattenedProjects.map(project => {
      // Clean project name
      let projectName = project.project_path;
      if (projectName) {
        const parts = projectName.split(/[/\\]/);
        projectName = parts[parts.length - 1] || parts[parts.length - 2] || "Unknown";

        // Remove common prefixes for cleaner names
        if (projectName.startsWith("projects-")) {
          projectName = projectName.substring(9);
        }
      }

      // Calculate project timeline
      const firstSession = new Date(project.first_session);
      const lastSession = new Date(project.last_session);
      const projectAgeInDays = Math.max(1, Math.ceil((lastSession - firstSession) / (1000 * 60 * 60 * 24)));

      return {
        project_name: projectName,
        project_path: project.project_path,

        // Flattened session data
        summary: {
          total_sessions: project.total_sessions,
          active_days: project.active_days,
          project_age_days: projectAgeInDays,
          sessions_per_day: project.sessions_per_day || 0
        },

        // Aggregated usage metrics
        usage: {
          total_tokens: project.total_tokens,
          total_input_tokens: project.total_input_tokens,
          total_output_tokens: project.total_output_tokens,
          total_cache_creation_tokens: project.total_cache_creation_tokens,
          total_cache_read_tokens: project.total_cache_read_tokens,
          total_cost: project.total_cost,
          avg_tokens_per_session: project.total_sessions > 0 ? Math.round(project.total_tokens / project.total_sessions) : 0,
          avg_cost_per_session: project.total_sessions > 0 ? parseFloat((project.total_cost / project.total_sessions).toFixed(4)) : 0
        },

        // Time analytics
        time: {
          first_session: project.first_session,
          last_session: project.last_session,
          total_duration_minutes: Math.round(project.total_duration_minutes || 0),
          avg_session_duration: Math.round(project.avg_session_duration || 0),
          is_recent_activity: new Date(project.last_session) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        },

        // Activity classification
        activity_level: project.total_sessions >= 10 ? "very_high" :
                       project.total_sessions >= 5 ? "high" :
                       project.total_sessions >= 2 ? "medium" : "low",

        // Calculated engagement score (tokens per day)
        engagement_score: projectAgeInDays > 0 ? Math.round(project.total_tokens / projectAgeInDays) : 0
      };
    });

    res.json({
      projects: enhancedProjects,
      metadata: {
        time_window_days: 30,
        total_projects: enhancedProjects.length,
        query_timestamp: new Date().toISOString()
      }
    });

    log.performance("fetch_flattened_projects", Date.now() - queryContext.startTime, {
      userId, projectCount: enhancedProjects.length
    });

  } catch (error) {
    logError(error, { context: "fetch_flattened_projects", userId, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

// Block data endpoints
app.get("/api/usage/blocks", authenticateUser, CommonValidators.usageQuery, async (req, res) => {
  const { machineId, since, until, activeOnly } = req.query;
  const userId = req.user.id;

  try {
    const blocks = await dbManager.executeQuery(async (db) => {
      // Build query based on conditions
      let result;
      if (machineId && since && until && activeOnly === "true") {
        result = await db.sql`
          SELECT * FROM usage_blocks 
          WHERE user_id = ${userId} AND machine_id = ${machineId} 
            AND start_time >= ${since} AND start_time <= ${until}
            AND is_active = 1
          ORDER BY start_time DESC
        `;
      } else if (machineId && since && until) {
        result = await db.sql`
          SELECT * FROM usage_blocks 
          WHERE user_id = ${userId} AND machine_id = ${machineId} 
            AND start_time >= ${since} AND start_time <= ${until}
          ORDER BY start_time DESC
        `;
      } else if (machineId && since && activeOnly === "true") {
        result = await db.sql`
          SELECT * FROM usage_blocks 
          WHERE user_id = ${userId} AND machine_id = ${machineId} 
            AND start_time >= ${since} AND is_active = 1
          ORDER BY start_time DESC
        `;
      } else if (machineId && since) {
        result = await db.sql`
          SELECT * FROM usage_blocks 
          WHERE user_id = ${userId} AND machine_id = ${machineId} 
            AND start_time >= ${since}
          ORDER BY start_time DESC
        `;
      } else if (since && until && activeOnly === "true") {
        result = await db.sql`
          SELECT * FROM usage_blocks 
          WHERE user_id = ${userId} 
            AND start_time >= ${since} AND start_time <= ${until}
            AND is_active = 1
          ORDER BY start_time DESC
        `;
      } else if (since && until) {
        result = await db.sql`
          SELECT * FROM usage_blocks 
          WHERE user_id = ${userId} 
            AND start_time >= ${since} AND start_time <= ${until}
          ORDER BY start_time DESC
        `;
      } else if (machineId && activeOnly === "true") {
        result = await db.sql`
          SELECT * FROM usage_blocks 
          WHERE user_id = ${userId} AND machine_id = ${machineId} 
            AND is_active = 1
          ORDER BY start_time DESC
        `;
      } else if (since && activeOnly === "true") {
        result = await db.sql`
          SELECT * FROM usage_blocks 
          WHERE user_id = ${userId} AND start_time >= ${since} 
            AND is_active = 1
          ORDER BY start_time DESC
        `;
      } else if (machineId) {
        result = await db.sql`
          SELECT * FROM usage_blocks 
          WHERE user_id = ${userId} AND machine_id = ${machineId}
          ORDER BY start_time DESC
        `;
      } else if (since) {
        result = await db.sql`
          SELECT * FROM usage_blocks 
          WHERE user_id = ${userId} AND start_time >= ${since}
          ORDER BY start_time DESC
        `;
      } else if (activeOnly === "true") {
        result = await db.sql`
          SELECT * FROM usage_blocks 
          WHERE user_id = ${userId} AND is_active = 1
          ORDER BY start_time DESC
        `;
      } else {
        result = await db.sql`
          SELECT * FROM usage_blocks 
          WHERE user_id = ${userId}
          ORDER BY start_time DESC
        `;
      }

      return result;
    }, { operation: "fetch_usage_blocks", user_id: userId });

    // Parse JSON fields
    blocks.forEach(block => {
      if (block.models_used) block.models_used = JSON.parse(block.models_used);
    });

    res.json(blocks);
  } catch (error) {
    console.error("Error fetching blocks:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// Batch upload endpoints for CLI
app.post("/api/usage/daily/batch", authenticateUser, async (req, res) => {
  const { records } = req.body;
  const userId = req.user.id;
  const queryContext = logDatabaseQuery("upload_daily_batch", userId);

  // Debug logging for user ID mismatch issue
  logger.info("🔍 Daily batch upload debug", {
    authenticatedUserId: req.user.id,
    authenticatedUserAuth0Id: req.user.auth0_id,
    recordCount: records?.length,
    firstRecordUserId: records?.[0]?.user_id,
    userIdMatch: records?.[0]?.user_id === req.user.id,
    auth0IdMatch: records?.[0]?.user_id === req.user.auth0_id
  });

  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ error: "Records array is required" });
  }

  try {
    let processedCount = 0;
    let skippedCount = 0;

    await dbManager.executeQuery(async (db) => {
      for (const record of records) {
        // Validate user_id matches authenticated user (check both KSUID and Auth0 ID)
        if (record.user_id !== userId && record.user_id !== req.user.auth0_id) {
          logger.warn("🚫 Skipping record with mismatched user_id", {
            recordUserId: record.user_id,
            authenticatedUserId: userId,
            authenticatedAuth0Id: req.user.auth0_id
          });
          skippedCount++;
          continue; // Skip records not belonging to this user
        }

        await db.sql`
          INSERT OR REPLACE INTO usage_data (
            machine_id, user_id, date, input_tokens, output_tokens, 
            cache_creation_tokens, cache_read_tokens, total_tokens,
            total_cost, models_used, model_breakdowns,
            thinking_mode_detected, thinking_tokens, thinking_percentage
          ) VALUES (
            ${record.machine_id},
            ${userId},
            ${record.date},
            ${record.input_tokens},
            ${record.output_tokens},
            ${record.cache_creation_tokens},
            ${record.cache_read_tokens},
            ${record.total_tokens},
            ${record.total_cost},
            ${JSON.stringify(record.models_used)},
            ${JSON.stringify(record.model_breakdowns)},
            ${(record.thinking_mode_detected || false) ? 1 : 0},
            ${record.thinking_tokens || 0},
            ${record.thinking_percentage || 0}
          )
        `;

        // Log to upload history for deduplication
        await db.sql`
          INSERT OR IGNORE INTO upload_history (
            user_id, machine_id, upload_type, identifier
          ) VALUES (
            ${userId},
            ${record.machine_id},
            'daily',
            ${record.date}
          )
        `;

        processedCount++;
      }
    }, { ...queryContext, operation: "batch_upload_daily_data" });

    res.json({
      message: "Daily data uploaded successfully",
      processed: processedCount,
      skipped: skippedCount,
      total: records.length
    });

    log.performance("upload_daily_batch", Date.now() - queryContext.startTime, {
      userId, processed: processedCount, total: records.length
    });

  } catch (error) {
    logError(error, { context: "upload_daily_batch", userId, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/usage/sessions/batch", authenticateUser, async (req, res) => {
  const { records } = req.body;
  const userId = req.user.id;
  const queryContext = logDatabaseQuery("upload_sessions_batch", userId);

  // Debug logging for user ID mismatch issue
  logger.info("🔍 Sessions batch upload debug", {
    authenticatedUserId: req.user.id,
    authenticatedUserAuth0Id: req.user.auth0_id,
    recordCount: records?.length,
    firstRecordUserId: records?.[0]?.user_id,
    userIdMatch: records?.[0]?.user_id === req.user.id,
    auth0IdMatch: records?.[0]?.user_id === req.user.auth0_id
  });

  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ error: "Records array is required" });
  }

  try {
    let processedCount = 0;
    let skippedCount = 0;

    await dbManager.executeQuery(async (db) => {
      for (const record of records) {
        // Validate user_id matches authenticated user (check both KSUID and Auth0 ID)
        if (record.user_id !== userId && record.user_id !== req.user.auth0_id) {
          skippedCount++;
          continue; // Skip records not belonging to this user
        }

        await db.sql`
          INSERT OR REPLACE INTO usage_sessions (
            machine_id, user_id, session_id, project_path, start_time, end_time,
            duration_minutes, input_tokens, output_tokens, 
            cache_creation_tokens, cache_read_tokens, total_tokens,
            total_cost, models_used, model_breakdowns,
            thinking_mode_detected, thinking_tokens, thinking_percentage
          ) VALUES (
            ${record.machine_id},
            ${userId},
            ${record.session_id},
            ${record.project_path},
            ${record.start_time},
            ${record.end_time},
            ${record.duration_minutes},
            ${record.input_tokens},
            ${record.output_tokens},
            ${record.cache_creation_tokens},
            ${record.cache_read_tokens},
            ${record.total_tokens},
            ${record.total_cost},
            ${JSON.stringify(record.models_used)},
            ${JSON.stringify(record.model_breakdowns)},
            ${(record.thinking_mode_detected || false) ? 1 : 0},
            ${record.thinking_tokens || 0},
            ${record.thinking_percentage || 0}
          )
        `;

        // Log to upload history for deduplication
        await db.sql`
          INSERT OR IGNORE INTO upload_history (
            user_id, machine_id, upload_type, identifier
          ) VALUES (
            ${userId},
            ${record.machine_id},
            'session',
            ${record.session_id}
          )
        `;

        processedCount++;
      }
    }, { ...queryContext, operation: "batch_upload_session_data" });

    res.json({
      message: "Session data uploaded successfully",
      processed: processedCount,
      skipped: skippedCount,
      total: records.length
    });

    log.performance("upload_sessions_batch", Date.now() - queryContext.startTime, {
      userId, processed: processedCount, total: records.length
    });

  } catch (error) {
    logError(error, {
      context: "upload_sessions_batch",
      userId,
      queryContext,
      sampleRecord: records[0],
      recordCount: records.length
    });
    console.error("Session batch upload error:", error);
    res.status(500).json({ error: "Database error", details: error.message });
  }
});

app.post("/api/usage/blocks/batch", authenticateUser, async (req, res) => {
  const { records } = req.body;
  const userId = req.user.id;
  const queryContext = logDatabaseQuery("upload_blocks_batch", userId);

  // Debug logging for user ID mismatch issue
  logger.info("🔍 Blocks batch upload debug", {
    authenticatedUserId: req.user.id,
    authenticatedUserAuth0Id: req.user.auth0_id,
    recordCount: records?.length,
    firstRecordUserId: records?.[0]?.user_id,
    userIdMatch: records?.[0]?.user_id === req.user.id,
    auth0IdMatch: records?.[0]?.user_id === req.user.auth0_id
  });

  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ error: "Records array is required" });
  }

  try {
    let processedCount = 0;
    let skippedCount = 0;

    await dbManager.executeQuery(async (db) => {
      for (const record of records) {
        // Validate user_id matches authenticated user (check both KSUID and Auth0 ID)
        if (record.user_id !== userId && record.user_id !== req.user.auth0_id) {
          skippedCount++;
          continue; // Skip records not belonging to this user
        }

        // Validate data types to prevent serialization errors
        if (typeof record.entry_count !== "number" && record.entry_count !== null && record.entry_count !== undefined) {
          logger.warn("Invalid entry_count type in block record", {
            blockId: record.block_id,
            entryCountType: typeof record.entry_count,
            entryCountValue: record.entry_count
          });
          record.entry_count = Array.isArray(record.entry_count) ? record.entry_count.length : 0;
        }

        await db.sql`
          INSERT OR REPLACE INTO usage_blocks (
            machine_id, user_id, block_id, start_time, end_time, actual_end_time,
            is_active, entry_count, input_tokens, output_tokens, 
            cache_creation_tokens, cache_read_tokens, total_tokens,
            total_cost, models_used,
            thinking_mode_detected, thinking_tokens, thinking_percentage
          ) VALUES (
            ${record.machine_id},
            ${userId},
            ${record.block_id},
            ${record.start_time},
            ${record.end_time},
            ${record.actual_end_time},
            ${record.is_active},
            ${record.entry_count},
            ${record.input_tokens},
            ${record.output_tokens},
            ${record.cache_creation_tokens},
            ${record.cache_read_tokens},
            ${record.total_tokens},
            ${record.total_cost},
            ${JSON.stringify(record.models_used || [])},
            ${(record.thinking_mode_detected || false) ? 1 : 0},
            ${record.thinking_tokens || 0},
            ${record.thinking_percentage || 0}
          )
        `;

        // Log to upload history for deduplication
        await db.sql`
          INSERT OR IGNORE INTO upload_history (
            user_id, machine_id, upload_type, identifier
          ) VALUES (
            ${userId},
            ${record.machine_id},
            'block',
            ${record.block_id}
          )
        `;

        processedCount++;
      }
    }, { ...queryContext, operation: "batch_upload_block_data" });

    res.json({
      message: "Block data uploaded successfully",
      processed: processedCount,
      skipped: skippedCount,
      total: records.length
    });

    log.performance("upload_blocks_batch", Date.now() - queryContext.startTime, {
      userId, processed: processedCount, total: records.length
    });

  } catch (error) {
    logError(error, {
      context: "upload_blocks_batch",
      userId,
      queryContext,
      sampleRecord: records[0],
      recordCount: records.length
    });
    console.error("Block batch upload error:", error);
    res.status(500).json({ error: "Database error", details: error.message });
  }
});

// Upload history check endpoint for client-side deduplication
app.post("/api/upload-history/check", authenticateUser, async (req, res) => {
  const { machine_id, records } = req.body;
  const userId = req.user.id;
  const queryContext = logDatabaseQuery("check_upload_history", userId);

  if (!machine_id || !records || !Array.isArray(records)) {
    return res.status(400).json({ error: "machine_id and records array are required" });
  }

  try {
    const existingUploads = await dbManager.executeQuery(async (db) => {
      const results = {};

      // Check each upload type separately for efficiency
      const uploadTypes = ["daily", "session", "block"];

      for (const uploadType of uploadTypes) {
        const typeRecords = records.filter(r => r.upload_type === uploadType);
        if (typeRecords.length === 0) continue;

        const identifiers = typeRecords.map(r => r.identifier);

        // Use parameterized query to check existing uploads
        if (identifiers.length === 1) {
          const existingIds = await db.sql`
            SELECT identifier 
            FROM upload_history 
            WHERE user_id = ${userId} AND machine_id = ${machine_id} AND upload_type = ${uploadType} 
            AND identifier = ${identifiers[0]}
          `;
          results[uploadType] = existingIds.map(row => row.identifier);
        } else {
          // For multiple identifiers, use multiple queries to avoid IN clause parameter binding issues
          const existingIds = [];
          for (const identifier of identifiers) {
            const result = await db.sql`
              SELECT identifier 
              FROM upload_history 
              WHERE user_id = ${userId} AND machine_id = ${machine_id} AND upload_type = ${uploadType} 
              AND identifier = ${identifier}
            `;
            existingIds.push(...result);
          }
          results[uploadType] = existingIds.map(row => row.identifier);
        }
      }

      return results;
    }, { ...queryContext, operation: "check_upload_history" });

    res.json(existingUploads);

    log.performance("check_upload_history", Date.now() - queryContext.startTime, {
      userId, machine_id, recordCount: records.length
    });

  } catch (error) {
    logError(error, { context: "check_upload_history", userId, machine_id, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

// Analytics endpoint - usage patterns
app.get("/api/usage/analytics/patterns", authenticateUser, async (req, res) => {
  const { machineId, period = "day" } = req.query;
  const userId = req.user.id;

  try {
    const patterns = await dbManager.executeQuery(async (db) => {
      let groupBy, dateFormat;

      switch (period) {
        case "hour":
          groupBy = "strftime('%H', start_time)";
          dateFormat = "hour";
          break;
        case "day":
          groupBy = "strftime('%w', start_time)";
          dateFormat = "day_of_week";
          break;
        case "week":
          groupBy = "strftime('%W', start_time)";
          dateFormat = "week";
          break;
        default:
          groupBy = "date(start_time)";
          dateFormat = "date";
      }

      // Build query safely with parameterized queries
      let whereConditions = ["user_id = ?"];
      let params = [userId];

      if (machineId) {
        whereConditions.push("machine_id = ?");
        params.push(machineId);
      }

      const query = `
        SELECT 
          ${groupBy} as period,
          COUNT(*) as session_count,
          SUM(total_tokens) as total_tokens,
          SUM(total_cost) as total_cost,
          AVG(duration_minutes) as avg_duration_minutes
        FROM usage_sessions
        WHERE ${whereConditions.join(" AND ")}
        GROUP BY ${groupBy} 
        ORDER BY period
      `;

      return await db.prepare(query).bind(...params).all();
    }, { operation: "fetch_usage_patterns", user_id: userId });

    res.json({ period, patterns });
  } catch (error) {
    console.error("Error fetching patterns:", error);
    res.status(500).json({ error: "Database error" });
  }
});


// Leaderboard endpoints
app.get("/api/leaderboard/:period", authenticateUser, CommonValidators.leaderboardParams, async (req, res) => {
  const { period } = req.params; // 'daily' or 'weekly'
  const userId = req.user.id;
  const queryContext = logDatabaseQuery("fetch_leaderboard", userId);

  try {
    let daysBack;
    if (period === "daily") {
      // Show data from the last 2 days to be more inclusive
      daysBack = 1;
    } else if (period === "weekly") {
      daysBack = 7;
    } else {
      return res.status(400).json({ error: "Invalid period. Use daily or weekly." });
    }

    const leaderboardData = await dbManager.executeQuery(async (db) => {
      // Get leaderboard data for users who opted in using tagged template literal
      return await db.sql`
        SELECT 
          u.id as user_id,
          u.username,
          u.display_name,
          SUM(ud.total_tokens) as total_tokens,
          SUM(ud.total_cost) as total_cost,
          ROUND(AVG(ud.total_tokens), 0) as daily_average,
          ROW_NUMBER() OVER (ORDER BY SUM(ud.total_tokens) DESC) as rank
        FROM users u
        JOIN usage_data ud ON u.id = ud.user_id
        WHERE u.leaderboard_enabled = 1 AND date >= date('now', '-' || ${daysBack} || ' days')
        GROUP BY u.id, u.username, u.display_name
        ORDER BY total_tokens DESC
        LIMIT 100
      `;
    }, { ...queryContext, operation: "fetch_leaderboard_data", period });

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

    log.performance("fetch_leaderboard", Date.now() - queryContext.startTime, {
      userId, period, participantCount: totalParticipants
    });

  } catch (error) {
    logError(error, { context: "fetch_leaderboard", userId, period, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/user/leaderboard-settings", authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const queryContext = logDatabaseQuery("get_leaderboard_settings", userId);

  try {
    const user = await dbManager.executeQuery(async (db) => {
      return await db.sql`
        SELECT leaderboard_enabled, display_name, team_leaderboard_enabled, team_display_name 
        FROM users 
        WHERE id = ${userId}
      `;
    }, { ...queryContext, operation: "get_user_leaderboard_settings" });

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      leaderboard_enabled: Boolean(user[0].leaderboard_enabled),
      display_name: user[0].display_name,
      team_leaderboard_enabled: Boolean(user[0].team_leaderboard_enabled),
      team_display_name: user[0].team_display_name
    });

    log.performance("get_leaderboard_settings", Date.now() - queryContext.startTime, { userId });

  } catch (error) {
    logError(error, { context: "get_leaderboard_settings", userId, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

function sanitizeDisplayName(input) {
  if (!input || typeof input !== "string") return null;

  let sanitized = input.trim().slice(0, 50);

  sanitized = sanitized.replace(/<[^>]*>/g, "");
  sanitized = sanitized.replace(/[<>'"&]/g, "");

  return sanitized || null;
}

app.put("/api/user/leaderboard-settings", authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const { leaderboard_enabled, display_name, team_leaderboard_enabled, team_display_name } = req.body;
  const queryContext = logDatabaseQuery("update_leaderboard_settings", userId);

  const sanitizedDisplayName = sanitizeDisplayName(display_name);
  const sanitizedTeamDisplayName = sanitizeDisplayName(team_display_name);

  try {
    await dbManager.executeQuery(async (db) => {
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
    }, { ...queryContext, operation: "update_user_leaderboard_settings" });

    res.json({
      message: "Leaderboard settings updated successfully",
      leaderboard_enabled: Boolean(leaderboard_enabled),
      display_name: sanitizedDisplayName,
      team_leaderboard_enabled: Boolean(team_leaderboard_enabled),
      team_display_name: sanitizedTeamDisplayName
    });

    log.performance("update_leaderboard_settings", Date.now() - queryContext.startTime, {
      userId, leaderboard_enabled, display_name: !!sanitizedDisplayName
    });

  } catch (error) {
    logError(error, { context: "update_leaderboard_settings", userId, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

// Email preferences endpoints
app.get("/api/user/email-preferences", authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const queryContext = logDatabaseQuery("get_email_preferences", userId);

  try {
    const preferences = await dbManager.executeQuery(async (db) => {
      // Get user email and preferences
      const userResult = await db.sql`
        SELECT email, timezone FROM users WHERE id = ${userId}
      `;

      const preferencesResult = await db.sql`
        SELECT * FROM user_email_preferences WHERE user_id = ${userId}
      `;

      return { user: userResult[0], preferences: preferencesResult[0] };
    }, { ...queryContext, operation: "get_user_email_preferences" });

    if (!preferences.user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Default values if no preferences exist yet
    const defaultPrefs = {
      daily_digest: true,
      weekly_summary: true,
      leaderboard_updates: true,
      team_invitations: true,
      security_alerts: true,
      email_frequency: "daily",
      timezone_for_emails: preferences.user.timezone || "UTC"
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

    log.performance("get_email_preferences", Date.now() - queryContext.startTime, { userId });

  } catch (error) {
    logError(error, { context: "get_email_preferences", userId, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

app.put("/api/user/email-preferences", authenticateUser, async (req, res) => {
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
  const queryContext = logDatabaseQuery("update_email_preferences", userId);

  // Validate inputs
  const validFrequencies = ["immediate", "daily", "weekly", "none"];
  if (email_frequency && !validFrequencies.includes(email_frequency)) {
    return res.status(400).json({ error: "Invalid email frequency. Must be immediate, daily, weekly, or none." });
  }

  try {
    await dbManager.executeQuery(async (db) => {
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
          ${email_frequency || "daily"},
          ${timezone_for_emails || "UTC"}
        )
      `;
    }, { ...queryContext, operation: "update_user_email_preferences" });

    res.json({
      message: "Email preferences updated successfully",
      daily_digest: daily_digest !== undefined ? Boolean(daily_digest) : true,
      weekly_summary: weekly_summary !== undefined ? Boolean(weekly_summary) : true,
      leaderboard_updates: leaderboard_updates !== undefined ? Boolean(leaderboard_updates) : true,
      team_invitations: team_invitations !== undefined ? Boolean(team_invitations) : true,
      security_alerts: security_alerts !== undefined ? Boolean(security_alerts) : true,
      email_frequency: email_frequency || "daily",
      timezone_for_emails: timezone_for_emails || "UTC"
    });

    log.performance("update_email_preferences", Date.now() - queryContext.startTime, {
      userId, email_frequency: email_frequency || "daily"
    });

  } catch (error) {
    logError(error, { context: "update_email_preferences", userId, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

app.put("/api/user/email", authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const { email } = req.body;
  const queryContext = logDatabaseQuery("update_user_email", userId);

  // Validate email
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email is required" });
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  try {
    await dbManager.executeQuery(async (db) => {
      // Check if email is already in use by another user
      const existingUser = await db.sql`
        SELECT id FROM users 
        WHERE email = ${email} AND id != ${userId}
        LIMIT 1
      `;

      if (existingUser.length > 0) {
        throw new Error("Email already in use");
      }

      // Update user's email
      return await db.sql`
        UPDATE users 
        SET email = ${email}
        WHERE id = ${userId}
      `;
    }, { ...queryContext, operation: "update_user_email" });

    res.json({
      message: "Email updated successfully",
      email: email
    });

    log.performance("update_user_email", Date.now() - queryContext.startTime, { userId });

  } catch (error) {
    if (error.message === "Email already in use") {
      return res.status(409).json({ error: "Email already in use" });
    }
    logError(error, { context: "update_user_email", userId, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/user/test-email", authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const queryContext = logDatabaseQuery("send_test_email", userId);

  try {
    // Get user info
    const user = await dbManager.executeQuery(async (db) => {
      return await db.sql`
        SELECT email, username, display_name FROM users WHERE id = ${userId}
      `;
    }, { ...queryContext, operation: "get_user_for_test_email" });

    if (!user[0] || !user[0].email) {
      return res.status(400).json({
        error: "No email address found for your account. Please add an email address to your profile first."
      });
    }

    if (!emailService.isEnabled()) {
      return res.status(503).json({
        error: "Email service is not configured. Please contact support."
      });
    }

    // Send test email
    const result = await emailService.sendTestEmail(user[0].email, user[0].username);

    // Log the email send attempt
    await dbManager.executeQuery(async (db) => {
      return await db.sql`
        INSERT INTO email_send_log (
          user_id, email_type, email_address, status, error_message, resend_email_id
        ) VALUES (
          ${userId}, 'test', ${user[0].email}, ${result.success ? "sent" : "failed"}, 
          ${result.error || null}, ${result.emailId || null}
        )
      `;
    }, { operation: "log_test_email_send" });

    if (result.success) {
      res.json({
        message: "Test email sent successfully!",
        email: user[0].email
      });
    } else {
      res.status(500).json({
        error: "Failed to send test email. Please try again later.",
        details: result.error
      });
    }

    log.performance("send_test_email", Date.now() - queryContext.startTime, {
      userId, success: result.success
    });

  } catch (error) {
    logError(error, { context: "send_test_email", userId, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/user/plan-settings", authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const queryContext = logDatabaseQuery("get_plan_settings", userId);

  try {
    const user = await dbManager.executeQuery(async (db) => {
      return await db.sql`
        SELECT claude_plan FROM users WHERE id = ${userId}
      `;
    }, { ...queryContext, operation: "get_user_plan_settings" });

    if (!user[0]) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      claude_plan: user[0].claude_plan || "max_100"
    });

    log.performance("get_plan_settings", Date.now() - queryContext.startTime, { userId });

  } catch (error) {
    logError(error, { context: "get_plan_settings", userId, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

app.put("/api/user/plan-settings", authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const { claude_plan } = req.body;
  const queryContext = logDatabaseQuery("update_plan_settings", userId);

  // Validate plan
  const validPlans = ["pro_17", "max_100", "max_200"];
  if (!claude_plan || !validPlans.includes(claude_plan)) {
    return res.status(400).json({
      error: "Invalid Claude plan. Must be one of: pro_17, max_100, max_200"
    });
  }

  try {
    await dbManager.executeQuery(async (db) => {
      return await db.sql`
        UPDATE users 
        SET claude_plan = ${claude_plan}
        WHERE id = ${userId}
      `;
    }, { ...queryContext, operation: "update_user_plan_settings" });

    res.json({
      message: "Plan settings updated successfully",
      claude_plan: claude_plan
    });

    log.performance("update_plan_settings", Date.now() - queryContext.startTime, {
      userId, claude_plan
    });

  } catch (error) {
    logError(error, { context: "update_plan_settings", userId, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

// Team management endpoints

app.get("/api/teams", authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const queryContext = logDatabaseQuery("get_user_teams", userId);

  try {
    const teams = await dbManager.executeQuery(async (db) => {
      return await db.sql`
        SELECT t.*, tm.role, tm.joined_at,
               (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count
        FROM teams t
        JOIN team_members tm ON t.id = tm.team_id
        WHERE tm.user_id = ${userId} AND t.is_active = 1
        ORDER BY tm.joined_at DESC
      `;
    }, { ...queryContext, operation: "get_user_teams" });

    res.json(teams);

    log.performance("get_user_teams", Date.now() - queryContext.startTime, { userId });

  } catch (error) {
    logError(error, { context: "get_user_teams", userId, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/teams", authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const { name, description } = req.body;
  const queryContext = logDatabaseQuery("create_team", userId);

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "Team name is required" });
  }

  if (name.length > 100) {
    return res.status(400).json({ error: "Team name must be 100 characters or less" });
  }

  try {
    const result = await dbManager.executeQuery(async (db) => {
      // Generate KSUID for team and unique invite code
      const teamId = KSUID.randomSync().string;
      const inviteCode = crypto.randomBytes(8).toString("hex");

      // Create team
      await db.sql`
        INSERT INTO teams (id, name, description, owner_id, is_public, max_members, is_active, invite_code)
        VALUES (${teamId}, ${name.trim()}, ${description?.trim() || null}, ${userId}, 0, 50, 1, ${inviteCode})
      `;

      // Add creator as owner
      await db.sql`
        INSERT INTO team_members (team_id, user_id, role, status)
        VALUES (${teamId}, ${userId}, 'owner', 'active')
      `;

      // Return created team with member count
      const team = await db.sql`
        SELECT t.*, 1 as member_count
        FROM teams t
        WHERE t.id = ${teamId}
      `;

      return team[0];
    }, { ...queryContext, operation: "create_team" });

    res.status(201).json(result);

    log.performance("create_team", Date.now() - queryContext.startTime, {
      userId, teamName: name
    });

  } catch (error) {
    logError(error, { context: "create_team", userId, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});


app.get("/api/teams/:teamId/members", authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const teamId = req.params.teamId;
  const queryContext = logDatabaseQuery("get_team_members", userId);

  try {
    const members = await dbManager.executeQuery(async (db) => {
      // Check if user is a member of this team
      const membership = await db.sql`
        SELECT role FROM team_members 
        WHERE team_id = ${teamId} AND user_id = ${userId}
      `;

      if (!membership[0]) {
        throw new Error("Not authorized");
      }

      // Get team members
      return await db.sql`
        SELECT tm.*, u.username, COALESCE(u.team_display_name, u.display_name, u.username) as display_name, u.email
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ${teamId}
        ORDER BY tm.role DESC, tm.joined_at ASC
      `;
    }, { ...queryContext, operation: "get_team_members" });

    res.json(members);

    log.performance("get_team_members", Date.now() - queryContext.startTime, {
      userId, teamId
    });

  } catch (error) {
    if (error.message === "Not authorized") {
      return res.status(403).json({ error: "Not authorized to view team members" });
    }
    logError(error, { context: "get_team_members", userId, teamId, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/teams/:teamId/leaderboard/:period", authenticateUser, async (req, res) => {
  const { teamId, period } = req.params; // teamId and 'daily' or 'weekly'
  const userId = req.user.id;
  const queryContext = logDatabaseQuery("fetch_team_leaderboard", userId);

  try {
    // Validate period
    if (period !== "daily" && period !== "weekly") {
      return res.status(400).json({ error: "Invalid period. Use daily or weekly." });
    }

    let dateFilter = "";
    if (period === "daily") {
      // Show data from the last 2 days to be more inclusive
      dateFilter = "date >= date('now', '-1 day')";
    } else if (period === "weekly") {
      dateFilter = "date >= date('now', '-7 days')";
    }

    const leaderboardData = await dbManager.executeQuery(async (db) => {
      // Check if user is a member of this team
      const membership = await db.sql`
        SELECT role FROM team_members 
        WHERE team_id = ${teamId} AND user_id = ${userId}
      `;

      if (!membership[0]) {
        throw new Error("Not authorized");
      }

      // Get team leaderboard data - only for team members who have team_leaderboard_enabled
      if (period === "daily") {
        return await db.sql`
          SELECT 
            u.id as user_id,
            u.username,
            COALESCE(u.team_display_name, u.display_name, u.username) as display_name,
            SUM(ud.total_tokens) as total_tokens,
            SUM(ud.total_cost) as total_cost,
            ROUND(AVG(ud.total_tokens), 0) as daily_average,
            ROW_NUMBER() OVER (ORDER BY SUM(ud.total_tokens) DESC) as rank
          FROM users u
          JOIN team_members tm ON u.id = tm.user_id
          JOIN usage_data ud ON u.id = ud.user_id
          WHERE tm.team_id = ${teamId} AND u.team_leaderboard_enabled = 1 AND ud.date >= date('now', '-1 day')
          GROUP BY u.id, u.username, u.team_display_name, u.display_name
          ORDER BY total_tokens DESC
        `;
      } else {
        return await db.sql`
          SELECT 
            u.id as user_id,
            u.username,
            COALESCE(u.team_display_name, u.display_name, u.username) as display_name,
            SUM(ud.total_tokens) as total_tokens,
            SUM(ud.total_cost) as total_cost,
            ROUND(AVG(ud.total_tokens), 0) as daily_average,
            ROW_NUMBER() OVER (ORDER BY SUM(ud.total_tokens) DESC) as rank
          FROM users u
          JOIN team_members tm ON u.id = tm.user_id
          JOIN usage_data ud ON u.id = ud.user_id
          WHERE tm.team_id = ${teamId} AND u.team_leaderboard_enabled = 1 AND ud.date >= date('now', '-7 days')
          GROUP BY u.id, u.username, u.team_display_name, u.display_name
          ORDER BY total_tokens DESC
        `;
      }
    }, { ...queryContext, operation: "fetch_team_leaderboard_data", teamId, period });

    const totalParticipants = leaderboardData.length;

    // Add percentiles and mark current user
    const entriesWithPercentiles = leaderboardData.map((entry, index) => ({
      ...entry,
      percentile: Math.round(((totalParticipants - index) / totalParticipants) * 100),
      is_current_user: entry.user_id === userId
    }));

    // Find current user's rank
    const userRank = entriesWithPercentiles.find(entry => entry.user_id === userId)?.rank;

    res.json({
      period,
      entries: entriesWithPercentiles,
      user_rank: userRank,
      total_participants: totalParticipants,
      team_id: teamId
    });

    log.performance("fetch_team_leaderboard", Date.now() - queryContext.startTime, {
      userId, teamId, period, participantCount: totalParticipants
    });

  } catch (error) {
    if (error.message === "Not authorized") {
      return res.status(403).json({ error: "Not authorized to view team leaderboard" });
    }
    logError(error, { context: "fetch_team_leaderboard", userId, teamId, period, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

// Get team preview by invite code (no auth required)
app.get("/api/teams/join/:inviteCode/preview", async (req, res) => {
  const inviteCode = req.params.inviteCode;
  const queryContext = logDatabaseQuery("preview_team_invite", "anonymous");

  try {
    const team = await dbManager.executeQuery(async (db) => {
      const result = await db.sql`
        SELECT name
        FROM teams 
        WHERE invite_code = ${inviteCode} AND is_active = 1
      `;

      if (!result[0]) {
        throw new Error("Invalid invite code");
      }

      return result[0];
    }, { ...queryContext, operation: "preview_team_invite" });

    res.json({ teamName: team.name });

    log.performance("preview_team_invite", Date.now() - queryContext.startTime, {
      inviteCode: `${inviteCode.substring(0, 4)  }...`
    });

  } catch (error) {
    if (error.message === "Invalid invite code") {
      return res.status(404).json({ error: "Invalid or expired invitation" });
    }
    logError(error, { context: "preview_team_invite", inviteCode, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/teams/join/:inviteCode", authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const inviteCode = req.params.inviteCode;
  const queryContext = logDatabaseQuery("join_team", userId);

  try {
    const result = await dbManager.executeQuery(async (db) => {
      // Find team by invite code
      const team = await db.sql`
        SELECT id, name, max_members, owner_id
        FROM teams 
        WHERE invite_code = ${inviteCode} AND is_active = 1
      `;

      if (!team[0]) {
        throw new Error("Invalid invite code");
      }

      const teamId = team[0].id;

      // Check if already a member
      const existingMember = await db.sql`
        SELECT id FROM team_members
        WHERE team_id = ${teamId} AND user_id = ${userId}
      `;

      if (existingMember.length > 0) {
        throw new Error("Already a member");
      }

      // Check team capacity
      const memberCount = await db.sql`
        SELECT COUNT(*) as count FROM team_members WHERE team_id = ${teamId}
      `;

      if (memberCount[0].count >= team[0].max_members) {
        throw new Error("Team is full");
      }

      // Add user to team as regular member
      await db.sql`
        INSERT INTO team_members (team_id, user_id, role, status, invited_by)
        VALUES (${teamId}, ${userId}, 'member', 'active', ${team[0].owner_id})
      `;

      return { teamName: team[0].name };
    }, { ...queryContext, operation: "join_team" });

    res.json({
      message: `Successfully joined ${result.teamName}!`,
      teamName: result.teamName
    });

    log.performance("join_team", Date.now() - queryContext.startTime, { userId });

  } catch (error) {
    if (error.message === "Invalid invite code") {
      return res.status(404).json({ error: "Invalid invite code" });
    }
    if (error.message === "Already a member") {
      return res.status(409).json({ error: "You are already a member of this team" });
    }
    if (error.message === "Team is full") {
      return res.status(409).json({ error: "Team has reached maximum member capacity" });
    }
    logError(error, { context: "join_team", userId, inviteCode, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

// Update team name (admin only)
app.put("/api/teams/:teamId", authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const teamId = req.params.teamId;
  const { name, description } = req.body;
  const queryContext = logDatabaseQuery("update_team", userId);

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "Team name is required" });
  }

  if (name.length > 100) {
    return res.status(400).json({ error: "Team name must be 100 characters or less" });
  }

  if (description && description.length > 200) {
    return res.status(400).json({ error: "Team description must be 200 characters or less" });
  }

  try {
    await dbManager.executeQuery(async (db) => {
      // Check if user is admin or owner of this team
      const membership = await db.sql`
        SELECT role FROM team_members 
        WHERE team_id = ${teamId} AND user_id = ${userId}
      `;

      if (!membership[0] || (membership[0].role !== "admin" && membership[0].role !== "owner")) {
        throw new Error("Not authorized");
      }

      // Update team name and description
      await db.sql`
        UPDATE teams 
        SET name = ${name.trim()}, description = ${description?.trim() || null}
        WHERE id = ${teamId} AND is_active = 1
      `;
    }, { ...queryContext, operation: "update_team" });

    res.json({ message: "Team updated successfully" });

    log.performance("update_team", Date.now() - queryContext.startTime, {
      userId, teamId
    });

  } catch (error) {
    if (error.message === "Not authorized") {
      return res.status(403).json({ error: "Only team admins can update team details" });
    }
    logError(error, { context: "update_team", userId, teamId, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

// Leave team
app.delete("/api/teams/:teamId/members/me", authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const teamId = req.params.teamId;
  const queryContext = logDatabaseQuery("leave_team", userId);

  try {
    const result = await dbManager.executeQuery(async (db) => {
      // Check if user is member of this team
      const membership = await db.sql`
        SELECT role FROM team_members 
        WHERE team_id = ${teamId} AND user_id = ${userId}
      `;

      if (!membership[0]) {
        throw new Error("Not a member");
      }

      // If user is admin, check if they're the only admin
      if (membership[0].role === "admin") {
        const adminCount = await db.sql`
          SELECT COUNT(*) as count FROM team_members 
          WHERE team_id = ${teamId} AND role = 'admin'
        `;

        if (adminCount[0].count === 1) {
          // Check if there are other members to promote
          const totalMembers = await db.sql`
            SELECT COUNT(*) as count FROM team_members 
            WHERE team_id = ${teamId}
          `;

          if (totalMembers[0].count > 1) {
            throw new Error("Promote another admin first");
          }
          // If solo member, allow leaving (will effectively delete team)
        }
      }

      // Remove user from team
      await db.sql`
        DELETE FROM team_members 
        WHERE team_id = ${teamId} AND user_id = ${userId}
      `;

      return { success: true };
    }, { ...queryContext, operation: "leave_team" });

    res.json({ message: "Successfully left team" });

    log.performance("leave_team", Date.now() - queryContext.startTime, {
      userId, teamId
    });

  } catch (error) {
    if (error.message === "Not a member") {
      return res.status(404).json({ error: "You are not a member of this team" });
    }
    if (error.message === "Promote another admin first") {
      return res.status(409).json({
        error: "You are the only admin. Promote another member to admin first or remove all members."
      });
    }
    logError(error, { context: "leave_team", userId, teamId, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

// Remove team member (admin or owner only)
app.delete("/api/teams/:teamId/members/:targetUserId", authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const teamId = req.params.teamId;
  const targetUserId = req.params.targetUserId;
  const queryContext = logDatabaseQuery("remove_team_member", userId);

  if (userId === targetUserId) {
    return res.status(400).json({ error: "Use the leave team endpoint to remove yourself" });
  }

  try {
    await dbManager.executeQuery(async (db) => {
      // Check if user is admin or owner of this team
      const membership = await db.sql`
        SELECT role FROM team_members 
        WHERE team_id = ${teamId} AND user_id = ${userId}
      `;

      if (!membership[0] || (membership[0].role !== "admin" && membership[0].role !== "owner")) {
        throw new Error("Not authorized");
      }

      // Check if target user is member of this team
      const targetMembership = await db.sql`
        SELECT role FROM team_members 
        WHERE team_id = ${teamId} AND user_id = ${targetUserId}
      `;

      if (!targetMembership[0]) {
        throw new Error("User not found");
      }

      // Remove target user from team
      await db.sql`
        DELETE FROM team_members 
        WHERE team_id = ${teamId} AND user_id = ${targetUserId}
      `;
    }, { ...queryContext, operation: "remove_team_member" });

    res.json({ message: "Member removed from team successfully" });

    log.performance("remove_team_member", Date.now() - queryContext.startTime, {
      userId, teamId, targetUserId
    });

  } catch (error) {
    if (error.message === "Not authorized") {
      return res.status(403).json({ error: "Only team admins can remove members" });
    }
    if (error.message === "User not found") {
      return res.status(404).json({ error: "User is not a member of this team" });
    }
    logError(error, { context: "remove_team_member", userId, teamId, targetUserId, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

// Promote member to admin (admin or owner only)
app.put("/api/teams/:teamId/members/:targetUserId/promote", authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const teamId = req.params.teamId;
  const targetUserId = req.params.targetUserId;
  const queryContext = logDatabaseQuery("promote_team_member", userId);

  try {
    await dbManager.executeQuery(async (db) => {
      // Check if user is admin or owner of this team
      const membership = await db.sql`
        SELECT role FROM team_members 
        WHERE team_id = ${teamId} AND user_id = ${userId}
      `;

      if (!membership[0] || (membership[0].role !== "admin" && membership[0].role !== "owner")) {
        throw new Error("Not authorized");
      }

      // Check if target user is member of this team
      const targetMembership = await db.sql`
        SELECT role FROM team_members 
        WHERE team_id = ${teamId} AND user_id = ${targetUserId}
      `;

      if (!targetMembership[0]) {
        throw new Error("User not found");
      }

      if (targetMembership[0].role === "admin") {
        throw new Error("Already admin");
      }

      // Promote target user to admin
      await db.sql`
        UPDATE team_members 
        SET role = 'admin'
        WHERE team_id = ${teamId} AND user_id = ${targetUserId}
      `;
    }, { ...queryContext, operation: "promote_team_member" });

    res.json({ message: "Member promoted to admin successfully" });

    log.performance("promote_team_member", Date.now() - queryContext.startTime, {
      userId, teamId, targetUserId
    });

  } catch (error) {
    if (error.message === "Not authorized") {
      return res.status(403).json({ error: "Only team admins can promote members" });
    }
    if (error.message === "User not found") {
      return res.status(404).json({ error: "User is not a member of this team" });
    }
    if (error.message === "Already admin") {
      return res.status(409).json({ error: "User is already an admin" });
    }
    logError(error, { context: "promote_team_member", userId, teamId, targetUserId, queryContext });
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/usage/analytics/costs", authenticateUser, async (req, res) => {
  const { machineId, groupBy = "day" } = req.query;
  const userId = req.user.id;

  try {
    const costs = await dbManager.executeQuery(async (db) => {
      let query;
      let params = [userId];

      // Build WHERE conditions safely
      let whereConditions = ["user_id = ?"];
      if (machineId) {
        whereConditions.push("machine_id = ?");
        params.push(machineId);
      }

      switch (groupBy) {
        case "session":
          query = `
            SELECT 
              session_id,
              project_path,
              start_time,
              duration_minutes,
              total_cost,
              total_tokens
            FROM usage_sessions
            WHERE ${whereConditions.join(" AND ")}
            ORDER BY total_cost DESC 
            LIMIT 100
          `;
          break;

        case "project":
          const projectWhereConditions = [...whereConditions, "project_path IS NOT NULL"];
          query = `
            SELECT 
              project_path,
              COUNT(*) as session_count,
              SUM(total_cost) as total_cost,
              SUM(total_tokens) as total_tokens,
              AVG(duration_minutes) as avg_duration
            FROM usage_sessions
            WHERE ${projectWhereConditions.join(" AND ")}
            GROUP BY project_path 
            ORDER BY total_cost DESC
          `;
          break;

        default: // day
          query = `
            SELECT 
              date(start_time) as date,
              COUNT(*) as session_count,
              SUM(total_cost) as total_cost,
              SUM(total_tokens) as total_tokens
            FROM usage_sessions
            WHERE ${whereConditions.join(" AND ")}
            GROUP BY date(start_time) 
            ORDER BY date DESC
          `;
      }

      return await db.prepare(query).bind(...params).all();
    }, { operation: "fetch_cost_analytics", user_id: userId });

    res.json({ groupBy, costs });
  } catch (error) {
    console.error("Error fetching costs:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// Serve Next.js static files (for Railway deployment)
if (process.env.NODE_ENV === "production") {
  // Serve static files from Next.js export
  app.use(express.static(path.join(__dirname, "client", "out"), {
    maxAge: "1d", // Cache static assets
    etag: true,
    index: false // Don't auto-serve index.html from subdirectories
  }));

  // For all other routes, serve the Next.js app
  app.get("*", (req, res, next) => {
    // Skip API routes and auth routes
    if (req.path.startsWith("/api/") || req.path.startsWith("/auth/")) {
      return next();
    }

    // For team join routes, serve the main index.html (client-side routing will handle it)
    const indexPath = path.join(__dirname, "client", "out", "index.html");
    res.sendFile(indexPath, (err) => {
      if (err) {
        logger.error("Error serving Next.js app", { error: err.message, path: req.path });
        res.status(404).send("Page not found");
      }
    });
  });
}

async function initializeServer() {
  try {
    logger.info("Database manager initialized", {
      maxConnections: dbManager.options.maxConnections,
      idleTimeout: dbManager.options.idleTimeout,
      retryAttempts: dbManager.options.retryAttempts
    });

    // Log email service status
    const emailDomain = process.env.EMAIL_FROM_DOMAIN || "mail.promptpulse.dev";
    logger.info("Email service status", {
      enabled: emailService.isEnabled(),
      resendApiKeyConfigured: !!process.env.RESEND_API_KEY,
      emailDomain: emailDomain,
      fromAddress: `PromptPulse <noreply@${emailDomain}>`
    });

    app.listen(PORT, () => {
      logger.info(`PromptPulse server started`, {
        port: PORT,
        environment: process.env.NODE_ENV || "development",
        logLevel: logger.level,
        emailServiceEnabled: emailService.isEnabled()
      });
    });
  } catch (error) {
    logger.error("Failed to initialize server", { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

initializeServer();

// Graceful shutdown handling
process.on("SIGINT", async () => {
  logger.info("Received SIGINT, shutting down gracefully");

  if (dbManager) {
    await dbManager.shutdown();
    logger.info("Database manager shut down");
  }

  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM, shutting down gracefully");

  if (dbManager) {
    await dbManager.shutdown();
    logger.info("Database manager shut down");
  }

  process.exit(0);
});
