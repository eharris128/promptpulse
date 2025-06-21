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
  .action(async () => {
    const { collect } = await import('../lib/collect.js');
    await collect();
  });

program.parse(process.argv);