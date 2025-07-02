/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimized for Vercel deployment
  poweredByHeader: false,

  // Proxy auth routes to Express server in development
  async rewrites() {
    return [
      {
        source: "/auth/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/auth/:path*`
      }
    ];
  }
};

module.exports = nextConfig;
