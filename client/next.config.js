/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimized for Railway deployment
  poweredByHeader: false,

  // Disable static export - causes issues with authentication
  // output: process.env.NODE_ENV === "production" ? "export" : undefined,

  // Re-enable image optimization
  images: {
    unoptimized: false
  },

  // Remove trailing slash requirement
  // trailingSlash: process.env.NODE_ENV === "production",

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
