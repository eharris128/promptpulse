/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimized for Vercel deployment
  poweredByHeader: false,
  
  // API calls will use NEXT_PUBLIC_API_URL environment variable
  // No rewrites needed for production
}

module.exports = nextConfig