import { createUser, listUsers, getUserByApiKey } from './auth.js';
import { initializeDefaultUser, createUserInteractive, showUsers } from './user-management.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function userCommand(action, args) {
  try {
    // Fix for commander.js passing string instead of array
    if (typeof args === 'string') {
      args = [args];
    } else if (!Array.isArray(args)) {
      args = [];
    }
    
    switch (action) {
      case 'init':
        await initializeDefaultUser();
        break;
        
      case 'create':
        if (args.length === 0) {
          console.log('Usage: promptpulse user create <email> <username>');
          console.log('       promptpulse user create <username>');
          console.log('Example: promptpulse user create john@example.com john');
          console.log('         promptpulse user create john');
          process.exit(1);
        }
        
        if (args.length === 1) {
          // Single argument - treat as username
          await createUserInteractive({ username: args[0] });
        } else if (args.length === 2) {
          // Two arguments - email and username
          const [email, username] = args;
          await createUserInteractive({ email, username });
        } else {
          console.log('Too many arguments. Usage: promptpulse user create <email> <username> or promptpulse user create <username>');
          process.exit(1);
        }
        break;
        
      case 'login':
        const apiKey = args[0];
        if (!apiKey) {
          console.log('Usage: promptpulse user login <api-key>');
          console.log('Example: promptpulse user login pk_abc123...');
          console.log('');
          console.log('To get your API key:');
          console.log('  1. Run "promptpulse user create <username>" on your first machine');
          console.log('  2. Copy the API key shown during account creation');
          console.log('  3. Use that key to login on other machines');
          process.exit(1);
        }
        await loginWithApiKey(apiKey);
        break;
        
      case 'list':
        await showUsers();
        break;
        
      case 'config':
        const [configAction, key, value] = args;
        
        switch (configAction) {
          case 'set':
            await setConfig(key, value);
            break;
          case 'get':
            await getConfig(key);
            break;
          case 'show':
            await showConfig();
            break;
          default:
            console.log('Config usage:');
            console.log('  promptpulse user config set api-key <key>    # Set API key');
            console.log('  promptpulse user config get api-key         # Get API key');
            console.log('  promptpulse user config show                # Show all config');
        }
        break;
        
      case 'whoami':
        await whoami();
        break;
        
      default:
        console.log('User management commands:');
        console.log('  promptpulse user init                        # Initialize default user');
        console.log('  promptpulse user create <email> <username>   # Create new user with email');
        console.log('  promptpulse user create <username>           # Create new user (email optional)');
        console.log('  promptpulse user login <api-key>             # Login with existing API key');
        console.log('  promptpulse user list                        # List all users');
        console.log('  promptpulse user config show                 # Show current config');
        console.log('  promptpulse user whoami                      # Show current user');
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function setConfig(key, value) {
  if (!key || !value) {
    console.log('Usage: promptpulse user config set <key> <value>');
    return;
  }

  const configPath = path.join(os.homedir(), '.promptpulse', 'config.json');
  const configDir = path.dirname(configPath);

  // Create config directory if it doesn't exist
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  let config = {};
  
  // Load existing config
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      console.log('Warning: Could not parse existing config, creating new one');
    }
  }

  // Special handling for API key
  if (key === 'api-key') {
    // Validate API key by checking if user exists
    try {
      const user = await getUserByApiKey(value);
      if (!user) {
        console.error('❌ Invalid API key');
        console.log('');
        console.log('💡 Tips:');
        console.log('  • Make sure you copied the full API key (starts with "pk_")');
        console.log('  • API keys are case-sensitive');
        console.log('  • Try using the login command: promptpulse user login <api-key>');
        console.log('  • If you don\'t have an API key, create an account with: promptpulse user create <username>');
        process.exit(1);
      }
      
      config.apiKey = value;
      config.userId = user.id;
      config.username = user.username;
      config.email = user.email;
      
      console.log('✅ API key set successfully');
      console.log(`   User: ${user.username}${user.email ? ` (${user.email})` : ''}`);
    } catch (error) {
      console.error('❌ Error validating API key:', error.message);
      console.log('');
      console.log('🔧 Troubleshooting:');
      console.log('  • Check your internet connection');
      console.log('  • Verify the API key is correct');
      console.log('  • Try the login command instead: promptpulse login <api-key>');
      process.exit(1);
    }
  } else {
    // Convert kebab-case to camelCase
    const camelKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    config[camelKey] = value;
    console.log(`✅ Set ${key}: ${value}`);
  }

  // Save config
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`Configuration saved to: ${configPath}`);
}

async function getConfig(key) {
  if (!key) {
    console.log('Usage: promptpulse user config get <key>');
    return;
  }

  const configPath = path.join(os.homedir(), '.promptpulse', 'config.json');
  
  if (!fs.existsSync(configPath)) {
    console.log('No configuration found. Run: promptpulse user init');
    return;
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Convert kebab-case to camelCase
    const camelKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    
    if (config[camelKey] !== undefined) {
      console.log(config[camelKey]);
    } else {
      console.log(`Key '${key}' not found in configuration`);
    }
  } catch (error) {
    console.error('❌ Error reading configuration:', error.message);
  }
}

async function showConfig() {
  const configPath = path.join(os.homedir(), '.promptpulse', 'config.json');
  
  if (!fs.existsSync(configPath)) {
    console.log('No configuration found. Run: promptpulse user init');
    return;
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    console.log('Current configuration:');
    console.log('');
    console.log(`  User ID: ${config.userId || 'Not set'}`);
    console.log(`  Username: ${config.username || 'Not set'}`);
    if (config.email) {
      console.log(`  Email: ${config.email}`);
    }
    console.log(`  API Key: ${config.apiKey ? '***' + config.apiKey.slice(-8) : 'Not set'}`);
    console.log('');
    console.log(`Configuration file: ${configPath}`);
  } catch (error) {
    console.error('❌ Error reading configuration:', error.message);
  }
}

async function loginWithApiKey(apiKey) {
  if (!apiKey) {
    console.error('❌ API key is required');
    process.exit(1);
  }

  try {
    console.log('🔑 Validating API key...');
    
    // Validate API key by checking if user exists
    const user = await getUserByApiKey(apiKey);
    if (!user) {
      console.error('❌ Invalid API key');
      console.log('');
      console.log('💡 Tips:');
      console.log('  • Make sure you copied the full API key (starts with "pk_")');
      console.log('  • API keys are case-sensitive');
      console.log('  • If you don\'t have an API key, create an account with: promptpulse user create <username>');
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
    
    console.log('✅ Login successful!');
    console.log('');
    console.log(`👤 Welcome back: ${user.username}${user.email ? ` (${user.email})` : ''}`);
    console.log(`🆔 User ID: ${user.id}`);
    console.log('');
    console.log('🚀 You can now use PromptPulse commands:');
    console.log('  • promptpulse collect     # Upload usage data');
    console.log('  • promptpulse dashboard   # Open web dashboard');
    console.log('  • promptpulse user whoami # Check login status');
    
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('  • Check your internet connection');
    console.log('  • Verify the API key is correct');
    console.log('  • Try again in a few moments');
    process.exit(1);
  }
}

async function whoami() {
  const configPath = path.join(os.homedir(), '.promptpulse', 'config.json');
  
  if (!fs.existsSync(configPath)) {
    console.log('❌ No user configured');
    console.log('');
    console.log('🚀 To get started:');
    console.log('  • First machine: promptpulse user create <username>');
    console.log('  • Additional machines: promptpulse login <api-key>');
    return;
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    if (!config.apiKey) {
      console.log('❌ No API key configured');
      console.log('🔑 Login with: promptpulse login <api-key>');
      return;
    }

    // Verify API key is still valid
    const user = await getUserByApiKey(config.apiKey);
    if (!user) {
      console.log('❌ API key is no longer valid');
      console.log('');
      console.log('🔑 Please login again:');
      console.log('  promptpulse login <api-key>');
      return;
    }

    console.log(`Logged in as: ${user.username}${user.email ? ` (${user.email})` : ''}`);
    console.log(`User ID: ${user.id}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}