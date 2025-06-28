import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getUserByApiKey } from './auth.js';
import { getApiUrl } from './config.js';

export async function status() {
  console.log('PromptPulse Collection Status\n');
  
  // Check authentication
  console.log('🔐 Authentication:');
  try {
    const configPath = join(homedir(), '.promptpulse', 'config.json');
    if (!existsSync(configPath)) {
      console.log('   ❌ Not logged in - no config file found');
      console.log('   💡 Run: promptpulse login');
      return;
    }
    
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    if (!config.apiKey) {
      console.log('   ❌ Not logged in - no API key found');
      console.log('   💡 Run: promptpulse login');
      return;
    }
    
    const user = await getUserByApiKey(config.apiKey);
    if (user) {
      console.log(`   ✅ Logged in as: ${user.username} (${user.id})`);
    } else {
      console.log('   ❌ Invalid API key - authentication failed');
      console.log('   💡 Run: promptpulse login');
      return;
    }
  } catch (error) {
    console.log(`   ❌ Authentication error: ${error.message}`);
    console.log('   💡 Run: promptpulse login');
    return;
  }
  
  // Check cron job
  console.log('\n⏰ Scheduled Collection:');
  try {
    const crontab = execSync('crontab -l 2>/dev/null', { encoding: 'utf-8' });
    const cronLines = crontab.split('\n').filter(line => 
      line.includes('promptpulse collect') || line.includes('ppulse collect')
    );
    
    if (cronLines.length > 0) {
      console.log('   ✅ Cron job found:');
      cronLines.forEach(line => console.log(`      ${line.trim()}`));
      
      // Check if the command path is still valid
      const commandMatch = cronLines[0].match(/(\/[^\s]+(?:promptpulse|ppulse))/);
      if (commandMatch) {
        const commandPath = commandMatch[1];
        if (existsSync(commandPath)) {
          console.log('   ✅ Command path is valid');
        } else {
          console.log('   ⚠️  Command path no longer exists');
          console.log(`   💡 Run: promptpulse setup (to update path)`);
        }
      }
    } else {
      console.log('   ❌ No cron job found');
      console.log('   💡 Run: promptpulse setup');
    }
  } catch (error) {
    console.log('   ❌ Cannot read crontab');
    console.log(`   Error: ${error.message}`);
  }
  
  // Check Claude Code data directory
  console.log('\n📁 Claude Code Data:');
  const claudeDir = join(homedir(), '.claude', 'projects');
  if (existsSync(claudeDir)) {
    try {
      const projects = execSync(`find "${claudeDir}" -name "*.jsonl" | wc -l`, { encoding: 'utf-8' }).trim();
      console.log(`   ✅ Claude Code directory found: ${claudeDir}`);
      console.log(`   📊 Found ${projects} usage files`);
    } catch (error) {
      console.log(`   ⚠️  Error reading Claude Code directory: ${error.message}`);
    }
  } else {
    console.log('   ❌ Claude Code directory not found');
    console.log('   💡 Make sure you have used Claude Code on this machine');
  }
  
  // Check recent collection attempts
  console.log('\n📈 Recent Collection Activity:');
  await checkRecentCollection();
  
  // Check network connectivity
  console.log('\n🌐 Network Connectivity:');
  await checkConnectivity();
}

async function checkRecentCollection() {
  try {
    // Try to run a dry-run collection to see if it would work
    console.log('   🔄 Testing collection...');
    
    // Load config and test API connection
    const configPath = join(homedir(), '.promptpulse', 'config.json');
    if (!existsSync(configPath)) {
      console.log('   ❌ No config file found');
      return;
    }
    
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const response = await fetch(getApiUrl('/auth/validate'), {
      headers: {
        'X-API-Key': config.apiKey
      }
    });
    
    if (response.ok) {
      console.log('   ✅ API connection successful');
    } else {
      console.log(`   ❌ API connection failed: ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Collection test failed: ${error.message}`);
  }
}

async function checkConnectivity() {
  try {
    const response = await fetch('https://www.promptpulse.dev/health', {
      timeout: 5000
    });
    
    if (response.ok) {
      console.log('   ✅ PromptPulse service is reachable');
    } else {
      console.log(`   ⚠️  PromptPulse service returned: ${response.status}`);
    }
  } catch (error) {
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.log('   ❌ Cannot reach PromptPulse service');
      console.log('   💡 Check your internet connection');
    } else {
      console.log(`   ⚠️  Network test failed: ${error.message}`);
    }
  }
}

export async function doctor() {
  console.log('PromptPulse Doctor - Diagnosing Issues\n');
  
  // Run status first
  await status();
  
  // Additional diagnostic information
  console.log('\n🔧 System Information:');
  console.log(`   OS: ${process.platform} ${process.arch}`);
  console.log(`   Node.js: ${process.version}`);
  
  try {
    const promptpulsePath = execSync('which promptpulse', { encoding: 'utf-8' }).trim();
    console.log(`   PromptPulse: ${promptpulsePath}`);
  } catch (error) {
    console.log('   PromptPulse: Not found in PATH');
  }
  
  // Check common issues
  console.log('\n🩺 Common Issues Check:');
  
  // Check if config directory exists and is writable
  const configDir = join(homedir(), '.promptpulse');
  try {
    if (existsSync(configDir)) {
      console.log('   ✅ Config directory exists and accessible');
    } else {
      console.log('   ⚠️  Config directory does not exist');
    }
  } catch (error) {
    console.log(`   ❌ Config directory error: ${error.message}`);
  }
  
  // Check cron service
  try {
    execSync('ps aux | grep -q "[c]rond\\|[c]ron"', { encoding: 'utf-8' });
    console.log('   ✅ Cron service is running');
  } catch (error) {
    console.log('   ⚠️  Cron service may not be running');
    console.log('   💡 Try: sudo systemctl start cron (Linux) or ensure cron is enabled');
  }
  
  console.log('\n💡 Suggested Actions:');
  console.log('   1. Ensure you are logged in: promptpulse login');
  console.log('   2. Set up automatic collection: promptpulse setup');
  console.log('   3. Test manual collection: promptpulse collect');
  console.log('   4. Check status regularly: promptpulse status');
}