/** @type {import('next').NextConfig} */
const nextConfig = {
  // Suppress known harmless warnings from recharts
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    return config;
  },
};

export default nextConfig;
