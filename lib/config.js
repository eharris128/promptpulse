// Service configuration for PromptPulse
// This file contains the configuration for connecting to the hosted PromptPulse service

// Environment detection
const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.PROMPTPULSE_DEV === 'true';

// Default production URLs (users always connect to hosted service)
const PRODUCTION_API_URL = process.env.PROMPTPULSE_API_ENDPOINT || 'https://exciting-patience-production.up.railway.app';
const PRODUCTION_DASHBOARD_URL = process.env.PROMPTPULSE_DASHBOARD_URL || 'https://www.promptpulse.dev';

export const SERVICE_CONFIG = {
  // API endpoint for the hosted PromptPulse service
  // Default to production unless explicitly in development mode
  API_ENDPOINT: isDevelopment ? 'http://localhost:3000' : PRODUCTION_API_URL,
  
  // Dashboard URL for web interface  
  DASHBOARD_URL: isDevelopment ? 'http://localhost:3001' : PRODUCTION_DASHBOARD_URL,
  
  // Service name
  SERVICE_NAME: 'PromptPulse',
  
  // API version
  API_VERSION: 'v1',
  
  // Environment info
  ENVIRONMENT: isDevelopment ? 'development' : 'production',
  IS_RAILWAY: isRailway
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