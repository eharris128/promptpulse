import { loginWithPKCE, checkAuthStatus, logout as logoutPKCE } from "./auth-pkce.js";
import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline";

/**
 * Check if user is already logged in and get confirmation if they want to switch
 * @returns {Promise<boolean>} true if should proceed with login, false if should abort
 */
async function checkExistingLogin() {
  const configPath = path.join(os.homedir(), ".promptpulse", "config.json");

  if (!fs.existsSync(configPath)) {
    return true; // No existing config, safe to proceed
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    // Check if user already has OAuth authentication
    if (!config.auth0_id) {
      return true; // No OAuth config, safe to proceed
    }

    console.log(`You are already logged in as: ${config.username || "unknown user"}`);
    console.log("");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question("Do you want to switch accounts? This will overwrite your current login. (y/N): ", (answer) => {
        rl.close();
        const shouldProceed = answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
        if (!shouldProceed) {
          console.log("Login cancelled. Your current account remains active.");
        }
        resolve(shouldProceed);
      });
    });

  } catch (error) {
    // If config is corrupted, safe to proceed
    return true;
  }
}

/**
 * Login using OAuth authentication
 */
export async function smartLogin() {
  try {
    // Check if user is already logged in and get confirmation
    const shouldProceed = await checkExistingLogin();
    if (!shouldProceed) {
      return;
    }

    // Modern OAuth PKCE login flow
    console.log("🔐 Starting secure OAuth authentication...");
    console.log("");

    const userInfo = await loginWithPKCE();

    console.log("");
    console.log("✅ Authentication successful!");
    console.log("");
    console.log(`Welcome: ${userInfo.name || userInfo.nickname}`);
    console.log(`Email: ${userInfo.email || "N/A"}`);
    console.log(`Auth0 ID: ${userInfo.sub}`);
    console.log("Authentication: Authorization Code + PKCE Flow");
    console.log("");
    console.log("You can now use PromptPulse commands:");
    console.log("  • promptpulse collect     # Upload usage data");
    console.log("  • promptpulse dashboard   # Open web dashboard");
    console.log("  • promptpulse whoami      # Check login status");

    process.exit(0);

  } catch (error) {
    console.error("Login failed:", error.message);
    console.log("");
    console.log("Troubleshooting:");
    console.log("  • Check your internet connection");
    console.log("  • Make sure you completed browser authentication");
    console.log("  • Try again: promptpulse login");
    console.log("");
    console.log("Need help?");
    console.log("  • Dashboard: https://www.promptpulse.dev");
    process.exit(1);
  }
}

// API key login removed - OAuth only authentication

/**
 * Clear authentication and log out
 */
export async function logout() {
  const configPath = path.join(os.homedir(), ".promptpulse", "config.json");

  try {
    if (!fs.existsSync(configPath)) {
      console.log("You are not logged in.");
      return;
    }

    // Read current config to show username
    let currentUser = "user";
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      currentUser = config.username || "user";
    } catch (error) {
      // Ignore error, we'll still delete the file
    }

    await logoutPKCE();

    console.log("✅ Logged out successfully!");
    console.log("");
    console.log("To login again:");
    console.log("  • promptpulse login");

  } catch (error) {
    console.error("Error during logout:", error.message);
    process.exit(1);
  }
}

/**
 * Show current authentication status
 */
export async function whoami() {
  try {
    const status = await checkAuthStatus();

    if (status.authenticated) {
      const config = status.config;
      const isExpired = config.expires_at && config.expires_at <= Date.now();

      console.log(`✅ Authenticated as: ${config.username}${config.email ? ` (${config.email})` : ""}`);
      console.log(`Auth0 ID: ${config.auth0_id}`);
      console.log(`Authentication: ${config.auth_method === "oauth_pkce" ? "Authorization Code + PKCE Flow" : "Device Authorization Flow"}`);
      console.log(`Token status: ${isExpired ? "Expired (will auto-refresh)" : "Valid"}`);

    } else {
      console.log("❌ Not authenticated");
      console.log("");
      console.log("To get started:");
      console.log("  • Login: promptpulse login");
    }

  } catch (error) {
    console.error("❌ Error checking authentication:", error.message);
    console.log("");
    console.log("Try logging in again:");
    console.log("  • promptpulse login");
  }
}
