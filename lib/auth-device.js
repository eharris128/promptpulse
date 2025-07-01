import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || 'dev-ar3xnr65khxqdivp.us.auth0.com';
const AUTH0_DEVICE_CLIENT_ID = process.env.AUTH0_DEVICE_CLIENT_ID || 'kbXHEmNlyrldFQ8cJ411l9JFjrkpilTQ';
const AUTH0_DEVICE_CLIENT_SECRET = process.env.AUTH0_DEVICE_CLIENT_SECRET || 'rPWpVakCQzwM5G2fbFxYlPo5MOwKunpzn0xbGnwBc8hbfD9VXHxXajX1jmk_Jj5k';

/**
 * Implement OAuth 2.0 Device Authorization Flow for CLI authentication
 * This allows users to authenticate through their browser while using CLI
 */

/**
 * Request device code from Auth0
 * @returns {Promise<{device_code: string, user_code: string, verification_uri: string, expires_in: number, interval: number}>}
 */
async function requestDeviceCode() {
  const response = await fetch(`https://${AUTH0_DOMAIN}/oauth/device/code`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: AUTH0_DEVICE_CLIENT_ID,
      scope: 'openid profile email offline_access'
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Device code request failed: ${error.error_description || error.error || response.statusText}`);
  }

  return await response.json();
}

/**
 * Poll for access token using device code
 * @param {string} deviceCode - The device code from the previous step
 * @param {number} interval - Polling interval in seconds
 * @returns {Promise<{access_token: string, refresh_token: string, id_token: string, token_type: string, expires_in: number}>}
 */
async function pollForToken(deviceCode, interval) {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const response = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            device_code: deviceCode,
            client_id: AUTH0_DEVICE_CLIENT_ID,
            client_secret: AUTH0_DEVICE_CLIENT_SECRET
          })
        });

        const result = await response.json();

        if (response.ok) {
          // Success - we got the tokens
          resolve(result);
        } else if (result.error === 'authorization_pending') {
          // User hasn't authorized yet, continue polling
          setTimeout(poll, interval * 1000);
        } else if (result.error === 'slow_down') {
          // Polling too fast, increase interval
          setTimeout(poll, (interval + 5) * 1000);
        } else {
          // Other error - fail
          reject(new Error(`Token request failed: ${result.error_description || result.error}`));
        }
      } catch (error) {
        reject(error);
      }
    };

    poll();
  });
}

/**
 * Get user info from Auth0 using access token
 * @param {string} accessToken - The access token
 * @returns {Promise<{sub: string, name: string, email: string, nickname: string}>}
 */
async function getUserInfo(accessToken) {
  const response = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get user info: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Save tokens and user info to config
 * @param {object} tokens - Token response from Auth0
 * @param {object} userInfo - User info from Auth0
 */
function saveTokens(tokens, userInfo) {
  const configPath = path.join(os.homedir(), '.promptpulse', 'config.json');
  const configDir = path.dirname(configPath);

  // Create config directory if it doesn't exist
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const config = {
    // OAuth tokens
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    id_token: tokens.id_token,
    token_type: tokens.token_type || 'Bearer',
    expires_at: Date.now() + (tokens.expires_in * 1000),
    
    // User identity info
    auth0_id: userInfo.sub,
    username: userInfo.nickname || userInfo.name,
    email: userInfo.email,
    
    // Auth method
    auth_method: 'oauth_device'
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Open browser to verification URL
 * @param {string} verificationUri - The URL to open
 */
function openBrowser(verificationUri) {
  const platform = os.platform();
  let command;

  switch (platform) {
    case 'darwin':
      command = `open "${verificationUri}"`;
      break;
    case 'win32':
      command = `start "${verificationUri}"`;
      break;
    default:
      command = `xdg-open "${verificationUri}"`;
  }

  exec(command, (error) => {
    if (error) {
      console.warn('⚠️  Could not open browser automatically. Please open the URL manually.');
    }
  });
}

/**
 * Check if current token is valid and refresh if needed
 * @returns {Promise<string>} Valid access token
 */
export async function getValidAccessToken() {
  const configPath = path.join(os.homedir(), '.promptpulse', 'config.json');
  
  if (!fs.existsSync(configPath)) {
    throw new Error('Not authenticated. Please run: promptpulse login');
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  if (config.auth_method !== 'oauth_device') {
    throw new Error('Please re-authenticate with Device Flow: promptpulse login');
  }

  // Check if token is still valid (with 5 minute buffer)
  if (config.expires_at && config.expires_at > Date.now() + (5 * 60 * 1000)) {
    return config.access_token;
  }

  // Token expired, try to refresh
  if (config.refresh_token) {
    console.log('Refreshing access token...');
    
    try {
      const response = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: config.refresh_token,
          client_id: AUTH0_DEVICE_CLIENT_ID,
          client_secret: AUTH0_DEVICE_CLIENT_SECRET
        })
      });

      if (response.ok) {
        const tokens = await response.json();
        
        // Update config with new tokens
        config.access_token = tokens.access_token;
        config.expires_at = Date.now() + (tokens.expires_in * 1000);
        if (tokens.refresh_token) {
          config.refresh_token = tokens.refresh_token;
        }
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return tokens.access_token;
      }
    } catch (error) {
      console.warn('⚠️  Token refresh failed, please login again');
    }
  }

  throw new Error('Token expired and refresh failed. Please run: promptpulse login');
}

/**
 * Main Device Authorization Flow for CLI
 */
export async function loginWithDeviceFlow() {
  try {
    console.log('🔐 Starting secure OAuth authentication...');
    console.log('');

    // Step 1: Request device code
    console.log('Requesting device authorization...');
    const deviceAuth = await requestDeviceCode();
    
    console.log('✅ Device code received!');
    console.log('');
    console.log('📱 Please complete authentication in your browser:');
    console.log('');
    console.log(`   Visit: ${deviceAuth.verification_uri}`);
    console.log(`   Confirm code: ${deviceAuth.user_code}`);
    console.log('');
    console.log('🌐 Opening browser automatically...');
    
    // Step 2: Open browser
    openBrowser(deviceAuth.verification_uri_complete || deviceAuth.verification_uri);
    
    console.log('');
    console.log('⏳ Waiting for authorization... (you must now sign in or sign up in your browser)');
    console.log('   ↳ Complete the auth flow in your browser :)');
    
    // Step 3: Poll for tokens
    const tokens = await pollForToken(deviceAuth.device_code, deviceAuth.interval);
    
    // Step 4: Get user info
    const userInfo = await getUserInfo(tokens.access_token);
    
    // Step 5: Save tokens
    saveTokens(tokens, userInfo);
    
    console.log('');
    console.log('✅ Authentication successful!');
    console.log('');
    console.log(`Welcome: ${userInfo.name || userInfo.nickname}`);
    console.log(`Email: ${userInfo.email || 'N/A'}`);
    console.log(`Auth0 ID: ${userInfo.sub}`);
    console.log('Authentication: Device Authorization Flow');
    console.log('');
    console.log('You can now use PromptPulse commands:');
    console.log('  • promptpulse collect     # Upload usage data');
    console.log('  • promptpulse dashboard   # Open web dashboard');
    console.log('  • promptpulse whoami      # Check login status');
    
  } catch (error) {
    console.error('❌ Device authentication failed:', error.message);
    console.log('');
    console.log('Troubleshooting:');
    console.log('  • Check your internet connection');
    console.log('  • Make sure you completed the browser authorization');
    console.log('  • Verify the device code hasn\'t expired');
    console.log('  • Try again: promptpulse login');
    process.exit(1);
  }
}

/**
 * Show current OAuth authentication status
 */
export async function whoamiDevice() {
  const configPath = path.join(os.homedir(), '.promptpulse', 'config.json');
  
  if (!fs.existsSync(configPath)) {
    console.log('❌ Not authenticated');
    console.log('');
    console.log('To get started:');
    console.log('  • Login: promptpulse login');
    return;
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    if (config.auth_method === 'oauth_device') {
      // Device Flow OAuth authentication
      const isExpired = config.expires_at && config.expires_at <= Date.now();
      
      console.log(`✅ Authenticated as: ${config.username}${config.email ? ` (${config.email})` : ''}`);
      console.log(`Auth0 ID: ${config.auth0_id}`);
      console.log(`Authentication: Device Authorization Flow`);
      console.log(`Token status: ${isExpired ? 'Expired (will auto-refresh)' : 'Valid'}`);
      
    } else {
      console.log('⚠️  Using legacy authentication method');
      console.log('');
      console.log('To switch to Device Flow:');
      console.log('  • promptpulse login');
    }
    
  } catch (error) {
    console.error('❌ Error reading authentication:', error.message);
    console.log('');
    console.log('Try logging in again:');
    console.log('  • promptpulse login');
  }
}

/**
 * Clear Device Flow authentication
 */
export async function logoutDevice() {
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
    
    console.log('✅ Logged out successfully!');
    console.log('');
    console.log('To login again:');
    console.log('  • promptpulse login');
    
  } catch (error) {
    console.error('Error during logout:', error.message);
    process.exit(1);
  }
}