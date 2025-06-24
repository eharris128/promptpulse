#!/usr/bin/env node

import { hostname } from 'os';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getApiUrl } from './config.js';

async function createUserViaAPI(userData) {
  const response = await fetch(getApiUrl('/users'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userData)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to create user');
  }

  const result = await response.json();
  return result.user;
}

export async function createUserInteractive(userData) {
  try {
    const user = await createUserViaAPI(userData);
    console.log('User created successfully!');
    console.log('');
    console.log('User Details:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   API Key: ${user.apiKey}`);
    console.log('');
    console.log('Save your API key securely - you will need it for CLI configuration and dashboard access!');
    console.log('');
    console.log('Your CLI has been automatically configured with this API key.');
    console.log('You can verify your setup with:');
    console.log('   promptpulse whoami');
    console.log('');
    return user;
  } catch (error) {
    console.error('Error creating user:', error.message);
    process.exit(1);
  }
}

export async function showUsers() {
  console.log('User listing is only available through the admin interface.');
  console.log('   To check your current user, run: promptpulse user whoami');
}

export async function initializeDefaultUser() {
  try {
    console.log('Setting up your PromptPulse account...\n');
    
    // Generate a privacy-friendly username with random identifier
    const randomId = Math.random().toString(36).substring(2, 10);
    const defaultUsername = `user-${randomId}`;
    
    const defaultUser = {
      username: defaultUsername
    };
    
    console.log('Creating account with:');
    console.log(`   Username: ${defaultUser.username}`);
    console.log('');
    
    const user = await createUserViaAPI(defaultUser);
    
    console.log('Account created successfully!');
    console.log(`   API Key: ${user.apiKey}`);
    console.log('');
    console.log('This API key has been automatically saved for CLI usage.');
    
    // Save API key to a local config file
    const configDir = path.join(os.homedir(), '.promptpulse');
    const configFile = path.join(configDir, 'config.json');
    
    // Create config directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Save config
    const config = {
      apiKey: user.apiKey,
      userId: user.id,
      username: user.username,
      email: user.email || null
    };
    
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    
    console.log(`Configuration saved to: ${configFile}`);
    console.log('');
    console.log('Privacy Notice: PromptPulse only collects usage statistics (tokens, costs, timestamps).');
    console.log('Your prompts and conversation content are NEVER uploaded or stored.');
    console.log('');
    console.log('Next steps:');
    console.log('- Run: promptpulse collect (to upload usage data)');
    console.log('- View your dashboard at: https://www.promptpulse.dev');
    console.log('');
    
    return user;
  } catch (error) {
    console.error('Error initializing user:', error.message);
    if (error.message.includes('fetch')) {
      console.error('');
      console.error('Unable to connect to PromptPulse service.');
      console.error('Please check your internet connection and try again.');
    }
    process.exit(1);
  }
}

// CLI interface when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  switch (command) {
    case 'create':
      const email = process.argv[3];
      const username = process.argv[4];
      
      if (!email || !username) {
        console.log('Usage: node lib/user-management.js create <email> <username>');
        process.exit(1);
      }
      
      await createUserInteractive({ email, username });
      break;
      
    case 'list':
      await showUsers();
      break;
      
    case 'init':
      await initializeDefaultUser();
      break;
      
    default:
      console.log('Usage:');
      console.log('  node lib/user-management.js init                         # Initialize default user');
      console.log('  node lib/user-management.js create <email> <username>   # Create new user');
      console.log('  node lib/user-management.js list                        # List all users');
      break;
  }
}