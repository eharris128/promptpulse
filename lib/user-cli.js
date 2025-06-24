import { createUser, listUsers, getUserByApiKey } from './auth.js';
import { initializeDefaultUser, createUserInteractive, showUsers } from './user-management.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function userCommand(action, args) {
  try {
    switch (action) {
      case 'init':
        await initializeDefaultUser();
        break;
        
      case 'create':
        const [email, username, fullName] = args;
        if (!email || !username) {
          console.log('Usage: promptpulse user create <email> <username> [fullName]');
          console.log('Example: promptpulse user create john@example.com john "John Doe"');
          process.exit(1);
        }
        await createUserInteractive({ email, username, fullName });
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
        console.log('  promptpulse user create <email> <username>   # Create new user');
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

async function whoami() {
  const configPath = path.join(os.homedir(), '.promptpulse', 'config.json');
  
  if (!fs.existsSync(configPath)) {
    console.log('No user configured. Run: promptpulse user init');
    return;
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    if (!config.apiKey) {
      console.log('No API key configured. Run: promptpulse user config set api-key <key>');
      return;
    }

    // Verify API key is still valid
    const user = await getUserByApiKey(config.apiKey);
    if (!user) {
      console.log('❌ API key is no longer valid');
      return;
    }

    console.log(`Logged in as: ${user.username}${user.email ? ` (${user.email})` : ''}`);
    console.log(`User ID: ${user.id}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}