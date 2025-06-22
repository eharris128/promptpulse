#!/usr/bin/env node

import { createUser, listUsers, getUserByApiKey } from './auth.js';
import { hostname } from 'os';

export async function createUserInteractive(userData) {
  try {
    const user = await createUser(userData);
    console.log('✅ User created successfully!');
    console.log('');
    console.log('User Details:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Full Name: ${user.full_name || 'Not set'}`);
    console.log(`   API Key: ${user.api_key}`);
    console.log('');
    console.log('⚠️  Save your API key securely - you will need it for CLI configuration and dashboard access!');
    console.log('');
    console.log('To configure your CLI, run:');
    console.log(`   promptpulse config set api-key ${user.api_key}`);
    console.log('');
    return user;
  } catch (error) {
    console.error('❌ Error creating user:', error.message);
    process.exit(1);
  }
}

export async function showUsers() {
  try {
    const users = await listUsers();
    
    if (users.length === 0) {
      console.log('No users found. Create your first user with:');
      console.log('  node lib/user-management.js create');
      return;
    }
    
    console.log(`Found ${users.length} user(s):\n`);
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (@${user.username})`);
      console.log(`   Full Name: ${user.full_name || 'Not set'}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleDateString()}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Error listing users:', error.message);
    process.exit(1);
  }
}

export async function initializeDefaultUser() {
  try {
    const users = await listUsers();
    
    if (users.length === 0) {
      console.log('🚀 Setting up your first user...\n');
      
      const defaultUser = {
        email: 'eharris128@example.com',
        username: 'eharris128',
        fullName: 'Evan Harris'
      };
      
      const user = await createUser(defaultUser);
      
      console.log('✅ Default user created!');
      console.log(`   API Key: ${user.api_key}`);
      console.log('');
      console.log('This API key has been automatically saved for CLI usage.');
      
      // Save API key to a local config file
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      
      const configDir = path.join(os.homedir(), '.promptpulse');
      const configFile = path.join(configDir, 'config.json');
      
      // Create config directory if it doesn't exist
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      // Save config
      const config = {
        apiKey: user.api_key,
        userId: user.id,
        username: user.username,
        email: user.email
      };
      
      fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
      
      console.log(`Configuration saved to: ${configFile}`);
      console.log('');
      
      return user;
    } else {
      console.log('Users already exist. Current users:');
      await showUsers();
      return null;
    }
  } catch (error) {
    console.error('❌ Error initializing default user:', error.message);
    process.exit(1);
  }
}

// CLI interface when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  switch (command) {
    case 'create':
      const email = process.argv[3] || 'eharris128@example.com';
      const username = process.argv[4] || 'eharris128';
      const fullName = process.argv[5] || 'Evan Harris';
      
      await createUserInteractive({ email, username, fullName });
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
      console.log('  node lib/user-management.js create [email] [username] [fullName]   # Create new user');
      console.log('  node lib/user-management.js list                        # List all users');
      break;
  }
}