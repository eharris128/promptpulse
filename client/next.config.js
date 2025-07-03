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

  // Proxy auth routes in development only
  async rewrites() {
    // In development, proxy auth routes to Express server on port 3000
    if (process.env.NODE_ENV === "development") {
      return [
        {
          source: "/auth/:path*",
          destination: "http://localhost:3000/auth/:path*"
        }
      ];
    }
    return [];
  }
};

module.exports = nextConfig;
