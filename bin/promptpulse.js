#!/usr/bin/env node

import { Command } from 'commander';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
);

const program = new Command();

program
  .name('promptpulse')
  .description('Track and aggregate Claude Code usage across multiple machines')
  .version(packageJson.version);

// Setup command
program
  .command('setup')
  .description('Set up cron job to automatically collect usage data every 15 minutes')
  .action(async () => {
    const { setup } = await import('../lib/setup.js');
    await setup();
  });

// Collect command
program
  .command('collect')
  .description('Collect and upload Claude Code usage data to the database')
  .option('-g, --granularity <type>', 'data granularity: daily, session, blocks, or all', 'all')
  .action(async (options) => {
    const { collect } = await import('../lib/collect.js');
    await collect(options);
  });

// User management commands
program
  .command('user')
  .description('Manage user accounts and authentication')
  .argument('<action>', 'user action: init, create, list, config, whoami')
  .argument('[email]', 'email for create command')
  .argument('[username]', 'username for create command')
  .action(async (action, email, username) => {
    const { userCommand } = await import('../lib/user-cli.js');
    const args = [email, username].filter(Boolean);
    await userCommand(action, args);
  });

// Dashboard command
program
  .command('dashboard')
  .description('Open the PromptPulse web dashboard in your browser')
  .action(async () => {
    const { getDashboardUrl } = await import('../lib/config.js');
    const { spawn } = await import('child_process');
    const dashboardUrl = getDashboardUrl();
    
    console.log(`Opening PromptPulse dashboard at ${dashboardUrl}`);
    console.log('   Use your API key to log in.');
    console.log('');
    
    // Try to open the URL in the default browser
    const platform = process.platform;
    let command;
    
    if (platform === 'darwin') {
      command = 'open';
    } else if (platform === 'win32') {
      command = 'start';
    } else {
      // Linux and others
      command = 'xdg-open';
    }
    
    try {
      spawn(command, [dashboardUrl], { detached: true, stdio: 'ignore' }).unref();
    } catch (error) {
      console.error('Could not automatically open browser.');
      console.log(`Please open manually: ${dashboardUrl}`);
    }
  });

// Server command (for development/self-hosting)
program
  .command('server')
  .description('Commands for managing the PromptPulse server (advanced users only)')
  .argument('<action>', 'server action: start')
  .action(async (action) => {
    if (action === 'start') {
      console.log('The PromptPulse server is hosted as a service.');
      console.log('   CLI users do not need to run their own server.');
      console.log('');
      console.log('   If you need to self-host, please see the documentation at:');
      console.log('   https://github.com/eharris128/promptpulse#self-hosting');
    } else {
      console.log('Unknown server action. Available actions: start');
    }
  });

program.parse(process.argv);