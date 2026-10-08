//@ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Import only the icons a page uses instead of the whole icon set.
    optimizePackageImports: ['lucide-react', '@tanstack/react-query'],
  },
  poweredByHeader: false,
};

module.exports = nextConfig;
