import { getUserByApiKey, getUserByUsername } from './auth.js';
import { createUserInteractive, initializeDefaultUser } from './user-management.js';
import { loginWithOAuth, whoamiOAuth, logoutOAuth } from './auth-oauth.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';

/**
 * Check if user is already logged in and get confirmation if they want to switch
 * @returns {Promise<boolean>} true if should proceed with login, false if should abort
 */
async function checkExistingLogin() {
  const configPath = path.join(os.homedir(), '.promptpulse', 'config.json');
  
  if (!fs.existsSync(configPath)) {
    return true; // No existing config, safe to proceed
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    if (!config.apiKey) {
      return true; // Invalid config, safe to proceed
    }

    // Try to validate the existing API key
    let currentUser;
    try {
      currentUser = await getUserByApiKey(config.apiKey);
    } catch (error) {
      // If we can't validate (network error, etc.), still show warning
      currentUser = { username: config.username || 'unknown user' };
    }

    console.log(`You are already logged in as: ${currentUser.username || 'unknown user'}`);
    console.log('');
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('Do you want to switch accounts? This will overwrite your current login. (y/N): ', (answer) => {
        rl.close();
        const shouldProceed = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
        if (!shouldProceed) {
          console.log('Login cancelled. Your current account remains active.');
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
 * Modern login function using OAuth Device Flow
 * @param {string} legacyApiKey - Optional legacy API key for backward compatibility
 */
export async function smartLogin(legacyApiKey) {
  try {
    // Check if user is already logged in and get confirmation
    const shouldProceed = await checkExistingLogin();
    if (!shouldProceed) {
      return;
    }

    // If a legacy API key is provided, show migration message
    if (legacyApiKey && legacyApiKey.startsWith('pk_')) {
      console.log('🔄 API Key authentication is being deprecated for security.');
      console.log('');
      console.log('We\'re upgrading to secure OAuth authentication.');
      console.log('This eliminates security vulnerabilities and provides a better experience.');
      console.log('');
      
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const shouldMigrate = await new Promise((resolve) => {
        rl.question('Would you like to switch to secure OAuth authentication? (Y/n): ', (answer) => {
          rl.close();
          resolve(answer.toLowerCase() !== 'n' && answer.toLowerCase() !== 'no');
        });
      });

      if (!shouldMigrate) {
        console.log('');
        console.log('⚠️  Continuing with legacy API key authentication...');
        await loginWithApiKey(legacyApiKey);
        return;
      }
    }

    // Modern OAuth login flow
    await loginWithOAuth();

  } catch (error) {
    console.error('Login failed:', error.message);
    console.log('');
    console.log('Troubleshooting:');
    console.log('  • Check your internet connection');
    console.log('  • Make sure you completed browser authentication');
    console.log('  • Try again: promptpulse login');
    console.log('');
    console.log('Need help?');
    console.log('  • Dashboard: https://www.promptpulse.dev');
    process.exit(1);
  }
}

/**
 * Login with an existing API key
 * @param {string} apiKey - The API key to authenticate with
 */
async function loginWithApiKey(apiKey) {
  if (!apiKey) {
    console.error('Error: API key is required');
    process.exit(1);
  }

  try {
    console.log('Validating API key...');
    
    // Validate API key by checking if user exists
    const user = await getUserByApiKey(apiKey);
    if (!user) {
      console.error('Error: Invalid API key');
      console.log('');
      console.log('Tips:');
      console.log('  • Make sure you copied the full API key (starts with "pk_")');
      console.log('  • API keys are case-sensitive');
      console.log('  • If you don\'t have an API key, create an account with: promptpulse login');
      process.exit(1);
    }
    
    // Save configuration
    const configPath = path.join(os.homedir(), '.promptpulse', 'config.json');
    const configDir = path.dirname(configPath);

    // Create config directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const config = {
      apiKey: apiKey,
      userId: user.id,
      username: user.username,
      email: user.email
    };
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log('Login successful!');
    console.log('');
    console.log(`Welcome back: ${user.username}${user.email ? ` (${user.email})` : ''}`);
    console.log(`User ID: ${user.id}`);
    console.log('');
    console.log('You can now use PromptPulse commands:');
    console.log('  • promptpulse collect     # Upload usage data');
    console.log('  • promptpulse dashboard   # Open web dashboard');
    console.log('  • promptpulse whoami      # Check login status');
    
  } catch (error) {
    console.error('Login failed:', error.message);
    console.log('');
    console.log('Troubleshooting:');
    console.log('  • Check your internet connection');
    console.log('  • Verify the API key is correct');
    console.log('  • Try again in a few moments');
    process.exit(1);
  }
}

/**
 * Clear authentication and log out
 */
export async function logout() {
  await logoutOAuth();
}

/**
 * Show current authentication status
 */
export async function whoami() {
  await whoamiOAuth();
}