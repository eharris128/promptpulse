import { execSync } from "child_process";
import { promisify } from "util";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

function createWrapperScript(commandPath, isDevelopment) {
  // Extract the directory containing node from the promptpulse path
  // e.g., /home/user/.nvm/versions/node/vX.X.X/bin/promptpulse -> /home/user/.nvm/versions/node/vX.X.X/bin
  const nodeBinDir = path.dirname(commandPath);

  const script = `#!/bin/bash
# PromptPulse cron wrapper script
# This script ensures proper environment setup for cron execution

# Add node binary directory and common paths
export PATH="${nodeBinDir}:/usr/local/bin:/usr/bin:/bin:$PATH"

${isDevelopment ? "# Development mode\nexport PROMPTPULSE_DEV=true\n" : ""}
# Execute collection using absolute path
exec "${commandPath}" collect
`;

  return script;
}

export async function setup(options = {}) {
  try {
    console.log("Setting up PromptPulse automatic collection...\n");

    // Check authentication first
    const configPath = path.join(os.homedir(), ".promptpulse", "config.json");
    if (!fs.existsSync(configPath)) {
      console.error("Error: You must be logged in to set up automatic collection");
      console.error("   Run: promptpulse login");
      process.exit(1);
    }

    let config;
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (error) {
      console.error("Error: Invalid config file");
      console.error("   Run: promptpulse login");
      process.exit(1);
    }

    // Check if promptpulse or ppulse is in PATH
    let commandName = "promptpulse";
    let commandPath = "";

    console.log("\nFinding PromptPulse command...");
    try {
      commandPath = execSync("which promptpulse", { encoding: "utf-8" }).trim();
      console.log(`   Found promptpulse at: ${commandPath}`);
    } catch (error) {
      // Try ppulse as fallback
      try {
        commandPath = execSync("which ppulse", { encoding: "utf-8" }).trim();
        commandName = "ppulse";
        console.log(`   Found ppulse at: ${commandPath}`);
      } catch (error2) {
        console.error("Error: promptpulse/ppulse command not found in PATH");
        console.error("   Please ensure promptpulse is installed globally with: npm install -g promptpulse");
        process.exit(1);
      }
    }

    // Define wrapper path early for duplicate checking
    const wrapperPath = path.join(os.homedir(), ".promptpulse", "cron-wrapper.sh");

    // Check current crontab
    console.log("\nSetting up scheduled collection...");
    let currentCrontab = "";
    try {
      currentCrontab = execSync("crontab -l 2>/dev/null", { encoding: "utf-8" });
    } catch (error) {
      // No existing crontab is fine
      console.log("   No existing crontab found, creating new one...");
    }

    // Check if our cron job already exists (check for wrapper script)
    if (currentCrontab.includes(wrapperPath)) {
      console.log("   Warning: PromptPulse cron job already exists in crontab");
      console.log("   To view your crontab, run: crontab -l");
      console.log("   To remove existing job, run: promptpulse setup --remove");
      return;
    }

    // Determine collection interval
    const interval = options.interval || "15";
    let cronSchedule;
    switch (interval) {
      case "5":
        cronSchedule = "*/5 * * * *";
        break;
      case "15":
        cronSchedule = "*/15 * * * *";
        break;
      case "30":
        cronSchedule = "*/30 * * * *";
        break;
      case "60":
      case "hourly":
        cronSchedule = "0 * * * *";
        break;
      case "daily":
        cronSchedule = "0 9 * * *"; // 9 AM daily
        break;
      default:
        cronSchedule = "*/15 * * * *"; // Default to 15 minutes
    }

    // Detect development environment and set appropriate environment variables
    const isDevelopment = process.env.NODE_ENV === "development" || process.env.PROMPTPULSE_DEV === "true";

    if (isDevelopment) {
      console.log("   Development mode detected - configuring for localhost endpoints");
      // For ease of testing.
      if (interval === "1") {
        cronSchedule = "*/1 * * * *";
      }
    }

    // Ensure .promptpulse directory exists
    const promptpulseDir = path.join(os.homedir(), ".promptpulse");
    if (!fs.existsSync(promptpulseDir)) {
      fs.mkdirSync(promptpulseDir, { recursive: true });
    }

    // Create wrapper script
    const wrapperContent = createWrapperScript(commandPath, isDevelopment);

    console.log("   Creating wrapper script...");
    fs.writeFileSync(wrapperPath, wrapperContent);

    try {
      fs.chmodSync(wrapperPath, 0o755);
    } catch (error) {
      console.error("Warning: Could not set executable permissions on wrapper script");
      console.error(`You may need to run: chmod +x ${  wrapperPath}`);
    }
    console.log(`   Wrapper script created at: ${wrapperPath}`);

    // Create cron job with wrapper script
    const logFile = path.join(os.homedir(), ".promptpulse", "collection.log");
    const cronEntry = `${cronSchedule} ${wrapperPath} >> "${logFile}" 2>&1`;
    const newCrontab = currentCrontab.trim() ?
      `${currentCrontab.trim()}\n${cronEntry}\n` :
      `${cronEntry}\n`;

    // Use a temporary approach to update crontab
    execSync(`echo "${newCrontab}" | crontab -`);

    console.log("   Successfully added cron job!");
    console.log(`   Schedule: Every ${interval} minutes`);
    console.log(`   Logs: ${logFile}`);
    if (isDevelopment) {
      console.log("   Environment: Development (localhost:3000)");
    }

    // Verify the cron job was added
    console.log("\nVerifying setup...");
    try {
      const verifyTabs = execSync("crontab -l", { encoding: "utf-8" });
      if (verifyTabs.includes(wrapperPath)) {
        console.log("   Cron job successfully installed");
        // Show the actual cron entry for verification
        const cronLines = verifyTabs.split("\n").filter(line =>
          line.includes(wrapperPath)
        );
        if (cronLines.length > 0) {
          console.log(`   Entry: ${cronLines[0].trim()}`);
        }
      } else {
        console.log("   Warning: Could not verify cron job installation");
      }
    } catch (error) {
      console.log("   ⚠️  Could not verify cron job installation");
    }

    // Test collection manually (skip --test flag as it may not exist)
    console.log("\nTesting collection...");
    try {
      // Just test that the command exists and shows help, don't actually collect
      execSync(`${commandPath} --help >/dev/null 2>&1`, { timeout: 5000 });
      console.log("   Command is accessible and ready");
    } catch (error) {
      console.log("   Warning: Command test failed - check manually with: promptpulse collect");
    }

    console.log("\nSetup complete!");
    console.log(`   Run 'promptpulse doctor' to diagnose any issues`);
    console.log(`   View logs: tail -f "${logFile}"`);
    console.log(`   To remove: crontab -e and delete the PromptPulse line`);

  } catch (error) {
    console.error("Error setting up cron job:", error.message);
    process.exit(1);
  }
}

export async function removeSetup() {
  try {
    console.log("Removing PromptPulse automatic collection...\n");

    // Check current crontab
    let currentCrontab = "";
    try {
      currentCrontab = execSync("crontab -l 2>/dev/null", { encoding: "utf-8" });
    } catch (error) {
      console.log("No crontab found");
      return;
    }

    // Check if our cron job exists (check for wrapper script)
    const wrapperPath = path.join(os.homedir(), ".promptpulse", "cron-wrapper.sh");
    const cronLines = currentCrontab.split("\n");
    const filteredLines = cronLines.filter(line =>
      !line.includes(wrapperPath) && !line.includes("promptpulse collect") && !line.includes("ppulse collect")
    );

    if (cronLines.length === filteredLines.length) {
      console.log("No PromptPulse cron job found to remove");
      return;
    }

    // Update crontab without PromptPulse entries
    const newCrontab = filteredLines.join("\n");
    if (newCrontab.trim() === "") {
      // Remove entire crontab if empty
      execSync("crontab -r 2>/dev/null || true");
    } else {
      execSync(`echo "${newCrontab}" | crontab -`);
    }

    console.log("Successfully removed PromptPulse cron job");

    // Remove wrapper script if it exists
    if (fs.existsSync(wrapperPath)) {
      try {
        fs.unlinkSync(wrapperPath);
        console.log("Removed wrapper script");
      } catch (error) {
        console.log("Warning: Could not remove wrapper script:", error.message);
      }
    }

    console.log("Automatic collection has been disabled");
    console.log("You can still collect manually with: promptpulse collect");

  } catch (error) {
    console.error("Error removing cron job:", error.message);
    process.exit(1);
  }
}
