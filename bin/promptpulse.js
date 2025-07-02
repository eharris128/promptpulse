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
  .action(async () => {
    const { logout } = await import("../lib/auth-cli.js");
    await logout();
  });

// Who am I command
program
  .command("whoami")
  .description("Show current authentication status")
  .action(async () => {
    const { whoami } = await import("../lib/auth-cli.js");
    await whoami();
  });

// User management commands (deprecated - kept for config debugging only)
program
  .command("user")
  .description("Advanced user configuration (debugging only - use login/logout/whoami instead)")
  .argument("<action>", "user action: config")
  .argument("[...args]", "additional arguments for the action")
  .action(async (action, args) => {
    const { userCommand } = await import("../lib/user-cli.js");
    await userCommand(action, args);
  });

// Status command
program
  .command("status")
  .description("Show collection status and health information")
  .action(async () => {
    const { status } = await import("../lib/status.js");
    await status();
  });

// Doctor command
program
  .command("doctor")
  .description("Diagnose common collection issues and system health")
  .action(async () => {
    const { doctor } = await import("../lib/status.js");
    await doctor();
  });

// Dashboard command
program
  .command("dashboard")
  .description("Open the PromptPulse web dashboard in your browser")
  .action(async () => {
    const { getDashboardUrl } = await import("../lib/config.js");
    const { spawn } = await import("child_process");
    const dashboardUrl = getDashboardUrl();

    console.log(`Opening PromptPulse dashboard at ${dashboardUrl}`);
    console.log("   Use your API key to log in.");
    console.log("");

    // Try to open the URL in the default browser
    const platform = process.platform;
    let command;

    if (platform === "darwin") {
      command = "open";
    } else if (platform === "win32") {
      command = "start";
    } else {
      // Linux and others
      command = "xdg-open";
    }

    try {
      spawn(command, [dashboardUrl], { detached: true, stdio: "ignore" }).unref();
    } catch (error) {
      console.error("Could not automatically open browser.");
      console.log(`Please open manually: ${dashboardUrl}`);
    }
  });

// Server command (for development/self-hosting)
program
  .command("server")
  .description("Commands for managing the PromptPulse server (advanced users only)")
  .argument("<action>", "server action: start")
  .action(async (action) => {
    if (action === "start") {
      console.log("The PromptPulse server is hosted as a service.");
      console.log("   CLI users do not need to run their own server.");
      console.log("");
      console.log("   If you need to self-host, please see the documentation at:");
      console.log("   https://github.com/eharris128/promptpulse#self-hosting");
    } else {
      console.log("Unknown server action. Available actions: start");
    }
  });

program.parse(process.argv);
