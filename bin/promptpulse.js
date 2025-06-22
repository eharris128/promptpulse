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
  .argument('<action>', 'user action: init, create, list, config')
  .argument('[...args]', 'additional arguments')
  .action(async (action, args) => {
    const { userCommand } = await import('../lib/user-cli.js');
    await userCommand(action, args);
  });

program.parse(process.argv);