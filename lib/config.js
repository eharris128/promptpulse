// Service configuration for PromptPulse
// This file contains the configuration for connecting to the hosted PromptPulse service

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';
const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';

// Default production URLs (update these when you deploy)
const PRODUCTION_API_URL = process.env.PROMPTPULSE_API_ENDPOINT || 'https://exciting-patience-production.up.railway.app';
const PRODUCTION_DASHBOARD_URL = process.env.PROMPTPULSE_DASHBOARD_URL || 'https://your-dashboard.vercel.app';

export const SERVICE_CONFIG = {
  // API endpoint for the hosted PromptPulse service
  API_ENDPOINT: isProduction || isRailway ? PRODUCTION_API_URL : 'http://localhost:3000',
  
  // Dashboard URL for web interface  
  DASHBOARD_URL: isProduction || isRailway ? PRODUCTION_DASHBOARD_URL : 'http://localhost:3001',
  
  // Service name
  SERVICE_NAME: 'PromptPulse',
  
  // API version
  API_VERSION: 'v1',
  
  // Environment info
  ENVIRONMENT: isProduction || isRailway ? 'production' : 'development',
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