
/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async redirects() {
    return [
      // Redirect from the root to the preview page for easy access during development
      // This can be removed later if needed.
      {
        source: '/',
        destination: '/preview',
        permanent: false,
      },
    ]
  },
  // This is a workaround for a build issue with the handlebars dependency in genkit.
  // It ensures that the package is treated as an external dependency by the server components.
  serverExternalPackages: ['handlebars'],
};

module.exports = nextConfig;
