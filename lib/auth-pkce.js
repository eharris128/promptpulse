import fetch from "node-fetch";
import open from "open";
import express from "express";
import { promises as fs } from "fs";
import fsSync from "fs";
import crypto from "crypto";
import path from "path";
import os from "os";

// Auth0 configuration
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || "dev-ar3xnr65khxqdivp.us.auth0.com";
const CLI_CLIENT_ID = process.env.AUTH0_DEVICE_CLIENT_ID || "kbXHEmNlyrldFQ8cJ411l9JFjrkpilTQ";
const REDIRECT_URI = "http://localhost:3001/callback";

// Generate PKCE challenge
function generateRandomString(length = 43) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function saveTokens(tokens, userInfo) {
  const configPath = path.join(os.homedir(), ".promptpulse", "config.json");
  const configDir = path.dirname(configPath);

  // Create config directory if it doesn't exist
  if (!fsSync.existsSync(configDir)) {
    await fs.mkdir(configDir, { recursive: true });
  }

  const config = {
    // OAuth tokens
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    id_token: tokens.id_token,
    token_type: tokens.token_type || "Bearer",
    expires_at: Date.now() + (tokens.expires_in * 1000),

    // User identity info
    auth0_id: userInfo.sub,
    username: userInfo.nickname || userInfo.name,
    email: userInfo.email,

    // Auth method
    auth_method: "oauth_pkce"
  };

  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

async function loadTokens() {
  const configPath = path.join(os.homedir(), ".promptpulse", "config.json");
  try {
    const data = await fs.readFile(configPath, "utf8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function refreshAccessToken(refreshToken) {
  const response = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: CLI_CLIENT_ID,
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    throw new Error("Failed to refresh token");
  }

  return response.json();
}

function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

async function getUserInfo(accessToken) {
  const response = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error("Failed to fetch user info");
  }

  return response.json();
}

export async function loginWithPKCE() {
  return new Promise(async (resolve, reject) => {
    const app = express();
    const server = app.listen(3001);

    // PKCE setup
    const codeVerifier = generateRandomString();
    const codeChallenge = await sha256(codeVerifier);

    // Build authorization URL
    const authUrl = new URL(`https://${AUTH0_DOMAIN}/authorize`);
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("client_id", CLI_CLIENT_ID);
    authUrl.searchParams.append("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.append("scope", "openid profile email offline_access");
    authUrl.searchParams.append("code_challenge", codeChallenge);
    authUrl.searchParams.append("code_challenge_method", "S256");

    // Handle callback
    app.get("/callback", async (req, res) => {
      try {
        const { code } = req.query;

        if (!code) {
          throw new Error("No authorization code received");
        }

        // Exchange code for tokens
        const tokenResponse = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "authorization_code",
            client_id: CLI_CLIENT_ID,
            code,
            redirect_uri: REDIRECT_URI,
            code_verifier: codeVerifier
          })
        });

        const tokens = await tokenResponse.json();

        if (!tokenResponse.ok) {
          throw new Error(tokens.error_description || "Token exchange failed");
        }

        const userInfo = await getUserInfo(tokens.access_token);

        await saveTokens(tokens, userInfo);

        res.send(`
          <html>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h1>✅ Authentication Successful!</h1>
              <p>Welcome ${userInfo.name}!</p>
              <p>You can close this window and return to your terminal.</p>
              <p>This window will close in 3 seconds.</p>
              <script>setTimeout(() => window.close(), 3000);</script>
            </body>
          </html>
        `);

        server.close();
        resolve(userInfo);
      } catch (error) {
        res.send(`
          <html>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h1>❌ Authentication Failed</h1>
              <p>${error.message}</p>
              <p>You can close this window and try again.</p>
            </body>
          </html>
        `);
        server.close();
        reject(error);
      }
    });

    // Open browser
    console.log("🌐 Opening browser for authentication...");
    await open(authUrl.toString());

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("Authentication timeout"));
    }, 300000);
  });
}

export async function getValidAccessToken() {
  const tokens = await loadTokens();

  if (!tokens) {
    throw new Error("Not authenticated. Please run: promptpulse login");
  }

  if (tokens.auth_method !== "oauth_pkce") {
    // Allow fallback to device flow tokens for transition
    if (tokens.auth_method !== "oauth_device") {
      throw new Error("Please re-authenticate: promptpulse login");
    }
  }

  try {
    let accessToken = tokens.access_token;

    // Refresh if expired
    if (isTokenExpired(accessToken) && tokens.refresh_token) {
      const newTokens = await refreshAccessToken(tokens.refresh_token);
      await saveTokens({ ...tokens, ...newTokens }, {
        sub: tokens.auth0_id,
        name: tokens.username,
        email: tokens.email,
        nickname: tokens.username
      });
      accessToken = newTokens.access_token;
    }

    return accessToken;
  } catch (error) {
    throw new Error("Token refresh failed. Please run: promptpulse login");
  }
}

export async function checkAuthStatus() {
  const tokens = await loadTokens();

  if (!tokens) {
    return { authenticated: false };
  }

  try {
    let accessToken = tokens.access_token;

    // Refresh if expired
    if (isTokenExpired(accessToken) && tokens.refresh_token) {
      const newTokens = await refreshAccessToken(tokens.refresh_token);
      await saveTokens({ ...tokens, ...newTokens }, {
        sub: tokens.auth0_id,
        name: tokens.username,
        email: tokens.email,
        nickname: tokens.username
      });
      accessToken = newTokens.access_token;
    }

    const user = await getUserInfo(accessToken);
    return { authenticated: true, user, config: tokens };
  } catch {
    return { authenticated: false };
  }
}

export async function logout(options = {}) {
  const configPath = path.join(os.homedir(), ".promptpulse", "config.json");
  const { clearBrowser = true } = options;
  
  try {
    // Clear browser session if requested
    if (clearBrowser) {
      try {
        // Import config to get the correct base URL
        const { SERVICE_CONFIG } = await import("./config.js");
        const baseUrl = SERVICE_CONFIG.API_ENDPOINT;
        const returnUrl = `${baseUrl}/logged-out`;
        
        const logoutUrl = `https://${AUTH0_DOMAIN}/v2/logout?returnTo=${encodeURIComponent(returnUrl)}&client_id=${CLI_CLIENT_ID}`;
        await open(logoutUrl);
        console.log("🌐 Clearing browser session...");
      } catch (error) {
        // If browser opening fails, continue with CLI logout
        console.log("⚠️  Could not open browser to clear session, but CLI logout will continue");
      }
    } else {
      console.log("📋 Clearing CLI session only (browser session preserved)");
    }
    
    // Clear CLI tokens
    await fs.unlink(configPath);
  } catch {
    // File might not exist, but that's okay
  }
}
