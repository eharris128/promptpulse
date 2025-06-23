// PromptPulse CLI Library
// Main entry point for programmatic usage

export { collect } from './collect.js';
export { setup } from './setup.js';
export { userCommand } from './user-cli.js';
export { 
  createUserInteractive, 
  showUsers, 
  initializeDefaultUser 
} from './user-management.js';
export { SERVICE_CONFIG, getApiUrl, getDashboardUrl } from './config.js';

// Re-export auth functions for programmatic use
export { 
  createUser,
  getUserByApiKey,
  listUsers 
} from './auth.js';