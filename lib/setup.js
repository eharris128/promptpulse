import { execSync } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export async function setup() {
  try {
    console.log('🚀 Setting up PromptPulse cron job...\n');
    
    // Check if promptpulse or ppulse is in PATH
    let commandName = 'promptpulse';
    let commandPath = '';
    
    try {
      commandPath = execSync('which promptpulse', { encoding: 'utf-8' }).trim();
      console.log(`✅ Found promptpulse at: ${commandPath}`);
    } catch (error) {
      // Try ppulse as fallback
      try {
        commandPath = execSync('which ppulse', { encoding: 'utf-8' }).trim();
        commandName = 'ppulse';
        console.log(`✅ Found ppulse at: ${commandPath}`);
      } catch (error2) {
        console.error('❌ Error: promptpulse/ppulse command not found in PATH');
        console.error('   Please ensure promptpulse is installed globally with: npm install -g promptpulse');
        process.exit(1);
      }
    }

    // Check current crontab
    let currentCrontab = '';
    try {
      currentCrontab = execSync('crontab -l 2>/dev/null', { encoding: 'utf-8' });
    } catch (error) {
      // No existing crontab is fine
      console.log('📝 No existing crontab found, creating new one...');
    }

    // Check if our cron job already exists (check for both command names)
    if (currentCrontab.includes('promptpulse collect') || currentCrontab.includes('ppulse collect')) {
      console.log('⚠️  PromptPulse cron job already exists in crontab');
      console.log('   To view your crontab, run: crontab -l');
      return;
    }

    // Add the cron job using the detected command name
    const cronEntry = `*/15 * * * * $(which ${commandName}) collect`;
    const newCrontab = currentCrontab.trim() ? 
      `${currentCrontab.trim()}\n${cronEntry}\n` : 
      `${cronEntry}\n`;

    // Use a temporary approach to update crontab
    execSync(`echo "${newCrontab}" | crontab -`);

    console.log('✅ Successfully added cron job!');
    console.log('   The following entry was added to your crontab:');
    console.log(`   ${cronEntry}`);
    console.log('\n📊 Usage data will be collected every 15 minutes');
    console.log(`   To manually collect data, run: ${commandName} collect`);
    console.log('   To view your crontab, run: crontab -l');
    console.log('   To remove the cron job, run: crontab -e and delete the line');

  } catch (error) {
    console.error('❌ Error setting up cron job:', error.message);
    process.exit(1);
  }
}