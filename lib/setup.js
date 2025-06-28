import { execSync } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getUserByApiKey } from './auth.js';

const execAsync = promisify(exec);

function createWrapperScript(commandPath, commandName, isDevelopment) {
  const script = `#!/bin/bash
# PromptPulse cron wrapper script
# This script ensures proper environment setup for cron execution

# Add common paths for system-installed node
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

# Load NVM if available and add to PATH
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    . "$NVM_DIR/nvm.sh" --no-use  # Load NVM without switching versions
    # Add current node version to PATH
    NODE_VERSION=\$(nvm current 2>/dev/null)
    if [ "$NODE_VERSION" != "none" ] && [ "$NODE_VERSION" != "system" ]; then
        export PATH="$NVM_DIR/versions/node/$NODE_VERSION/bin:$PATH"
    fi
fi

# Load fnm if available
if [ -s "$HOME/.fnm/fnm" ]; then
    export PATH="$HOME/.fnm:$PATH"
    eval "\$(fnm env --use-on-cd=false)"
fi

${isDevelopment ? '# Development mode\nexport PROMPTPULSE_DEV=true\n' : ''}
# Find and execute promptpulse
PROMPTPULSE_CMD="\$(which ${commandName} 2>/dev/null || which promptpulse 2>/dev/null || which ppulse 2>/dev/null)"

if [ -z "$PROMPTPULSE_CMD" ]; then
    echo "[\$(date)] ERROR: Could not find promptpulse command in PATH" >&2
    echo "[\$(date)] PATH was: $PATH" >&2
    exit 1
fi

# Execute collection
exec "$PROMPTPULSE_CMD" collect
`;
  
  return script;
}

export async function setup(options = {}) {
  try {
    console.log('Setting up PromptPulse automatic collection...\n');
    
    // Check authentication first
    const configPath = path.join(os.homedir(), '.promptpulse', 'config.json');
    if (!fs.existsSync(configPath)) {
      console.error('❌ Error: You must be logged in to set up automatic collection');
      console.error('   💡 Run: promptpulse login');
      process.exit(1);
    }
    
    let config;
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      console.error('❌ Error: Invalid config file');
      console.error('   💡 Run: promptpulse login');
      process.exit(1);
    }
    
    if (!config.apiKey) {
      console.error('❌ Error: No API key found in config');
      console.error('   💡 Run: promptpulse login');
      process.exit(1);
    }
    
    // Verify API key is valid
    console.log('🔐 Verifying authentication...');
    try {
      const user = await getUserByApiKey(config.apiKey);
      if (!user) {
        console.error('❌ Error: Invalid API key');
        console.error('   💡 Run: promptpulse login');
        process.exit(1);
      }
      console.log(`   ✅ Authenticated as: ${user.username}`);
    } catch (error) {
      console.error(`❌ Authentication failed: ${error.message}`);
      console.error('   💡 Run: promptpulse login');
      process.exit(1);
    }
    
    // Check if promptpulse or ppulse is in PATH
    let commandName = 'promptpulse';
    let commandPath = '';
    
    console.log('\n🔍 Finding PromptPulse command...');
    try {
      commandPath = execSync('which promptpulse', { encoding: 'utf-8' }).trim();
      console.log(`   ✅ Found promptpulse at: ${commandPath}`);
    } catch (error) {
      // Try ppulse as fallback
      try {
        commandPath = execSync('which ppulse', { encoding: 'utf-8' }).trim();
        commandName = 'ppulse';
        console.log(`   ✅ Found ppulse at: ${commandPath}`);
      } catch (error2) {
        console.error('❌ Error: promptpulse/ppulse command not found in PATH');
        console.error('   💡 Please ensure promptpulse is installed globally with: npm install -g promptpulse');
        process.exit(1);
      }
    }

    // Define wrapper path early for duplicate checking
    const wrapperPath = path.join(os.homedir(), '.promptpulse', 'cron-wrapper.sh');
    
    // Check current crontab
    console.log('\n⏰ Setting up scheduled collection...');
    let currentCrontab = '';
    try {
      currentCrontab = execSync('crontab -l 2>/dev/null', { encoding: 'utf-8' });
    } catch (error) {
      // No existing crontab is fine
      console.log('   📋 No existing crontab found, creating new one...');
    }

    // Check if our cron job already exists (check for wrapper script)
    if (currentCrontab.includes(wrapperPath)) {
      console.log('   ⚠️  PromptPulse cron job already exists in crontab');
      console.log('   💡 To view your crontab, run: crontab -l');
      console.log('   💡 To remove existing job, run: promptpulse setup --remove');
      return;
    }

    // Determine collection interval
    const interval = options.interval || '15';
    let cronSchedule;
    switch (interval) {
      case '15':
        cronSchedule = '*/15 * * * *';
        break;
      case '30':
        cronSchedule = '*/30 * * * *';
        break;
      case '60':
      case 'hourly':
        cronSchedule = '0 * * * *';
        break;
      case 'daily':
        cronSchedule = '0 9 * * *'; // 9 AM daily
        break;
      default:
        cronSchedule = '*/15 * * * *'; // Default to 15 minutes
    }

    // Detect development environment and set appropriate environment variables
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.PROMPTPULSE_DEV === 'true';
    
    if (isDevelopment) {
      console.log('   🔧 Development mode detected - configuring for localhost endpoints');
    }

    // Ensure .promptpulse directory exists
    const promptpulseDir = path.join(os.homedir(), '.promptpulse');
    if (!fs.existsSync(promptpulseDir)) {
      fs.mkdirSync(promptpulseDir, { recursive: true });
    }

    // Create wrapper script
    const wrapperContent = createWrapperScript(commandPath, commandName, isDevelopment);
    
    console.log('   📝 Creating wrapper script...');
    fs.writeFileSync(wrapperPath, wrapperContent, { mode: 0o755 });
    console.log(`   ✅ Wrapper script created at: ${wrapperPath}`);

    // Create cron job with wrapper script
    const logFile = path.join(os.homedir(), '.promptpulse', 'collection.log');
    const cronEntry = `${cronSchedule} ${wrapperPath} >> "${logFile}" 2>&1`;
    const newCrontab = currentCrontab.trim() ? 
      `${currentCrontab.trim()}\n${cronEntry}\n` : 
      `${cronEntry}\n`;

    // Use a temporary approach to update crontab
    execSync(`echo "${newCrontab}" | crontab -`);

    console.log('   ✅ Successfully added cron job!');
    console.log(`   📅 Schedule: Every ${interval} minutes`);
    console.log(`   📝 Logs: ${logFile}`);
    if (isDevelopment) {
      console.log('   🔧 Environment: Development (localhost:3000)');
    }
    
    // Verify the cron job was added
    console.log('\n🔍 Verifying setup...');
    try {
      const verifyTabs = execSync('crontab -l', { encoding: 'utf-8' });
      if (verifyTabs.includes(wrapperPath)) {
        console.log('   ✅ Cron job successfully installed');
        // Show the actual cron entry for verification
        const cronLines = verifyTabs.split('\n').filter(line => 
          line.includes(wrapperPath)
        );
        if (cronLines.length > 0) {
          console.log(`   📋 Entry: ${cronLines[0].trim()}`);
        }
      } else {
        console.log('   ⚠️  Could not verify cron job installation');
      }
    } catch (error) {
      console.log('   ⚠️  Could not verify cron job installation');
    }
    
    // Test collection manually (skip --test flag as it may not exist)
    console.log('\n🧪 Testing collection...');
    try {
      // Just test that the command exists and shows help, don't actually collect
      execSync(`${commandPath} --help >/dev/null 2>&1`, { timeout: 5000 });
      console.log('   ✅ Command is accessible and ready');
    } catch (error) {
      console.log('   ⚠️  Command test failed - check manually with: promptpulse collect');
    }
    
    console.log('\n🎉 Setup complete!');
    console.log(`   💡 Run 'promptpulse status' to check collection health`);
    console.log(`   💡 Run 'promptpulse doctor' to diagnose any issues`);
    console.log(`   💡 View logs: tail -f "${logFile}"`);
    console.log(`   💡 To remove: crontab -e and delete the PromptPulse line`);

  } catch (error) {
    console.error('Error setting up cron job:', error.message);
    process.exit(1);
  }
}

export async function removeSetup() {
  try {
    console.log('Removing PromptPulse automatic collection...\n');
    
    // Check current crontab
    let currentCrontab = '';
    try {
      currentCrontab = execSync('crontab -l 2>/dev/null', { encoding: 'utf-8' });
    } catch (error) {
      console.log('❌ No crontab found');
      return;
    }

    // Check if our cron job exists (check for wrapper script)
    const wrapperPath = path.join(os.homedir(), '.promptpulse', 'cron-wrapper.sh');
    const cronLines = currentCrontab.split('\n');
    const filteredLines = cronLines.filter(line => 
      !line.includes(wrapperPath) && !line.includes('promptpulse collect') && !line.includes('ppulse collect')
    );

    if (cronLines.length === filteredLines.length) {
      console.log('❌ No PromptPulse cron job found to remove');
      return;
    }

    // Update crontab without PromptPulse entries
    const newCrontab = filteredLines.join('\n');
    if (newCrontab.trim() === '') {
      // Remove entire crontab if empty
      execSync('crontab -r 2>/dev/null || true');
    } else {
      execSync(`echo "${newCrontab}" | crontab -`);
    }

    console.log('✅ Successfully removed PromptPulse cron job');
    
    // Remove wrapper script if it exists
    if (fs.existsSync(wrapperPath)) {
      try {
        fs.unlinkSync(wrapperPath);
        console.log('✅ Removed wrapper script');
      } catch (error) {
        console.log('⚠️  Could not remove wrapper script:', error.message);
      }
    }
    
    console.log('💡 Automatic collection has been disabled');
    console.log('💡 You can still collect manually with: promptpulse collect');
    
  } catch (error) {
    console.error('Error removing cron job:', error.message);
    process.exit(1);
  }
}