/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '7050',
        pathname: '/uploads/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/photos/:path*',
        destination: 'http://localhost:7050/api/photos/:path*',
      },
      {
        source: '/api/chat/:path*',
        destination: 'http://localhost:7050/api/chat/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: 'http://localhost:7050/uploads/:path*',
      },
    ]
  },
}

module.exports = nextConfig