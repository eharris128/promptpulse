// Re-export device flow functions for backward compatibility
export { 
  loginWithDeviceFlow as loginWithOAuth,
  getValidAccessToken,
  whoamiDevice as whoamiOAuth,
  logoutDevice as logoutOAuth
} from './auth-device.js';