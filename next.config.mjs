/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async rewrites() {
    return [
      {
        source: "/static/:path*",
        destination: "http://localhost:8002/static/:path*",
      },
    ];
  },
};

export default nextConfig;
