/**
 * Privacy notice utilities for PromptPulse
 * Provides consistent privacy messaging across the application
 */

/**
 * Display comprehensive privacy notice with PROJECT_PATH_PRIVACY information
 * @param {Object} options - Configuration options
 * @param {boolean} options.showSetupInfo - Whether to show setup/configuration information
 * @param {boolean} options.showProjectPathWarning - Whether to show project path sensitivity warning
 */
export function showPrivacyNotice(options = {}) {
  const {
    showSetupInfo = true,
    showProjectPathWarning = true
  } = options;

  console.log("Privacy Notice: PromptPulse collects usage statistics and metadata.");
  console.log("Collected data includes: usage statistics, project paths, machine identifiers,");
  console.log("timestamps, and model usage patterns.");
  console.log("Your prompts and conversation content are NEVER uploaded or stored.");
  console.log("");

  if (showProjectPathWarning) {
    console.log("⚠️  Project paths may contain sensitive information (company names, project names).");
    console.log("");
  }

  // Show current PROJECT_PATH_PRIVACY setting
  const privacySetting = process.env.PROJECT_PATH_PRIVACY || "basename";
  console.log(`Project path privacy: ${privacySetting}`);

  switch (privacySetting) {
    case "full":
      console.log("   → Full project paths will be collected");
      break;
    case "basename":
      console.log("   → Only project folder names will be collected (default)");
      break;
    case "hash":
      console.log("   → Project paths will be hashed for privacy");
      break;
    case "none":
      console.log("   → No project paths will be collected");
      break;
  }

  if (showSetupInfo) {
    console.log("Set PROJECT_PATH_PRIVACY environment variable to: full, basename, hash, or none");
    console.log("");
  }
}

/**
 * Display basic privacy notice for account creation
 * Shows essential privacy information with option to configure privacy settings
 */
export function showAccountCreationPrivacyNotice() {
  showPrivacyNotice({
    showSetupInfo: true,
    showProjectPathWarning: true
  });

  console.log("💡 Tip: You can configure your project path privacy before collecting data:");
  console.log("   export PROJECT_PATH_PRIVACY=basename  # Only folder names (recommended)");
  console.log("   export PROJECT_PATH_PRIVACY=none      # No project paths");
  console.log("   export PROJECT_PATH_PRIVACY=hash      # Hashed paths");
  console.log("   export PROJECT_PATH_PRIVACY=full      # Full paths");
  console.log("");
}

/**
 * Display collection privacy notice
 * Simplified notice for data collection, assuming user has already seen full disclosure
 */
export function showCollectionPrivacyNotice() {
  showPrivacyNotice({
    showSetupInfo: false,
    showProjectPathWarning: true
  });
}

/**
 * Get privacy setting explanation text
 * @param {string} setting - The privacy setting value
 * @returns {string} Human-readable explanation
 */
export function getPrivacySettingExplanation(setting = "basename") {
  switch (setting) {
    case "full":
      return "Full project paths will be collected";
    case "basename":
      return "Only project folder names will be collected (default)";
    case "hash":
      return "Project paths will be hashed for privacy";
    case "none":
      return "No project paths will be collected";
    default:
      return "Only project folder names will be collected (default)";
  }
}
