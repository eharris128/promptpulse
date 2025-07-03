#!/usr/bin/env node

import { Command } from "commander";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8")
);

const program = new Command();

program
  .name("promptpulse")
  .description("Track and aggregate Claude Code usage across multiple machines")
  .version(packageJson.version);

// Setup command
program
  .command("setup")
  .description("Set up automatic collection of usage data")
  .option("-i, --interval <minutes>", "collection interval: 15, 30, 60, or daily", "15")
  .option("-r, --remove", "remove automatic collection")
  .action(async (options) => {
    const { setup, removeSetup } = await import("../lib/setup.js");
    if (options.remove) {
      await removeSetup();
    } else {
      await setup(options);
    }
  });

// Collect command
program
  .command("collect")
  .description("Collect and upload Claude Code usage data to the database")
  .option("-g, --granularity <type>", "data granularity: daily, session, blocks, or all", "all")
  .action(async (options) => {
    const { collect } = await import("../lib/collect.js");
    await collect(options);
  });

// Login command (OAuth authentication only)
program
  .command("login")
  .description("Login with secure OAuth authentication")
  .action(async () => {
    const { smartLogin } = await import("../lib/auth-cli.js");
    await smartLogin();
  });

// Logout command
program
  .command("logout")
  .description("Clear authentication and log out")
  .option("--browser", "also clear browser session (default: true)")
  .option("--no-browser", "only clear CLI session, keep browser session")
  .action(async (options) => {
    const { logout } = await import("../lib/auth-cli.js");
    await logout(options);
  });

// Who am I command
program
  .command("whoami")
  .description("Show current authentication status")
  .action(async () => {
    const { whoami } = await import("../lib/auth-cli.js");
    await whoami();
  });

program.parse(process.argv);
