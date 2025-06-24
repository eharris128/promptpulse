import { getUserByApiKey, getUserByUsername } from './auth.js';
import { createUserInteractive, initializeDefaultUser } from './user-management.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Login function for existing users with API keys, or interactive account creation
 * @param {string} apiKey - API key for existing account (optional for interactive creation)
 */
export async function smartLogin(apiKey) {
  try {
    if (!apiKey) {
      // No argument provided - interactive account creation
      console.log('Welcome to PromptPulse!');
      console.log('');
      console.log('Let\'s create your account and get you started.');
      console.log('');
      await initializeDefaultUser();
      return;
    }

    // Check if the argument is an API key (starts with pk_)
    if (apiKey.startsWith('pk_')) {
      // Existing user with API key
      await loginWithApiKey(apiKey);
      return;
    }

    // Invalid input - not an API key
    console.error('Error: Invalid API key format');
    console.log('');
    console.log('API keys start with "pk_" followed by a long string of characters.');
    console.log('');
    console.log('How to use login:');
    console.log('  • For existing users: promptpulse login <your-api-key>');
    console.log('  • For new users: promptpulse login (interactive setup)');
    console.log('');
    console.log('Where to find your API key:');
    console.log('  • Check your account creation terminal output');
    console.log('  • Look in your saved passwords/notes');
    console.log('  • Visit the dashboard: https://www.promptpulse.dev');
    console.log('  • Check saved config: promptpulse user config show');
    console.log('');
    console.log('Lost your API key? Create a new account with a different email/username.');
    process.exit(1);

  } catch (error) {
    console.error('Login failed:', error.message);
    console.log('');
    console.log('Troubleshooting:');
    console.log('  • Make sure your API key starts with "pk_"');
    console.log('  • Check for typos in the API key');
    console.log('  • Verify your internet connection');
    console.log('  • Try interactive setup: promptpulse login');
    console.log('');
    console.log('Need help?');
    console.log('  • View your config: promptpulse user config show');
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
  const configPath = path.join(os.homedir(), '.promptpulse', 'config.json');
  
  try {
    if (!fs.existsSync(configPath)) {
      console.log('You are not logged in.');
      return;
    }

    // Read current config to show username
    let currentUser = 'user';
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      currentUser = config.username || 'user';
    } catch (error) {
      // Ignore error, we'll still delete the file
    }

    // Delete the config file
    fs.unlinkSync(configPath);
    
    console.log(`Logged out successfully!`);
    console.log('');
    console.log('To login again:');
    console.log('  • With API key: promptpulse login <api-key>');
    console.log('  • Create new account: promptpulse login');
    
  } catch (error) {
    console.error('Error during logout:', error.message);
    process.exit(1);
  }
}

/**
 * Show current authentication status
 */
export async function whoami() {
  const configPath = path.join(os.homedir(), '.promptpulse', 'config.json');
  
  if (!fs.existsSync(configPath)) {
    console.log('Error: No user configured');
    console.log('');
    console.log('To get started:');
    console.log('  • Create account: promptpulse login');
    console.log('  • Login existing: promptpulse login <api-key>');
    return;
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    if (!config.apiKey) {
      console.log('Error: No API key configured');
      console.log('Login with: promptpulse login <api-key>');
      return;
    }

    // Verify API key is still valid
    const user = await getUserByApiKey(config.apiKey);
    if (!user) {
      console.log('Error: API key is no longer valid');
      console.log('Please login again: promptpulse login <api-key>');
      return;
    }

    console.log(`Logged in as: ${user.username}${user.email ? ` (${user.email})` : ''}`);
    console.log(`User ID: ${user.id}`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}