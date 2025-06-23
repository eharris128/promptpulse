// Service configuration for PromptPulse
// This file contains the configuration for connecting to the hosted PromptPulse service

export const SERVICE_CONFIG = {
  // API endpoint for the hosted PromptPulse service
  // In production, this would be your deployed server URL
  API_ENDPOINT: process.env.PROMPTPULSE_API_ENDPOINT || 'http://localhost:3000',
  
  // Dashboard URL for web interface
  DASHBOARD_URL: process.env.PROMPTPULSE_DASHBOARD_URL || 'http://localhost:3001',
  
  // Service name
  SERVICE_NAME: 'PromptPulse',
  
  // API version
  API_VERSION: 'v1'
};

// Helper function to build API URLs
export function getApiUrl(path) {
  const baseUrl = SERVICE_CONFIG.API_ENDPOINT;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}/api${cleanPath}`;
}

// Helper function to build dashboard URLs
export function getDashboardUrl(path = '') {
  const baseUrl = SERVICE_CONFIG.DASHBOARD_URL;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}