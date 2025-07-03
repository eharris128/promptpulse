/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimized for Railway deployment
  poweredByHeader: false,

  // Configure for static export in production only
  output: process.env.NODE_ENV === "production" ? "export" : undefined,

  // Disable features that don't work with static export (production only)
  images: {
    unoptimized: process.env.NODE_ENV === "production"
  },

  // Set trailing slash for consistent routing in production
  trailingSlash: process.env.NODE_ENV === "production",

  // Experimental features to improve hydration
  experimental: {
    // Don't optimize specific packages that can cause hydration issues
    optimizePackageImports: [],
  },

  // Compiler options for better hydration
  compiler: {
    // Remove console logs in production to prevent hydration issues
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ['error', 'warn']
    } : false,
  },

  // Only add rewrites in development to avoid static export warnings
  ...(process.env.NODE_ENV === "development" && {
    async rewrites() {
      return [
        {
          source: "/auth/:path*",
          destination: "http://localhost:3000/auth/:path*"
        }
      ];
    }
  })
};

module.exports = nextConfig;
