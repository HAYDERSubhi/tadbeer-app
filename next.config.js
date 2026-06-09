
/** @type {import('next').NextConfig} */

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    // Take control immediately when a new SW version is installed,
    // instead of waiting for all tabs to close. This ensures users
    // always get fresh code as soon as a new deployment lands.
    skipWaiting: true,
    clientsClaim: true,
  },
  // --- START of PWA manifest options ---
  id: "app.tadbeer.web",
  start_url: "/",
  display: "standalone",
  orientation: "portrait",
  // White splash screen background so the icon doesn't appear on black.
  background_color: "#F8FAFC",
  // Teal theme matches the app primary color.
  theme_color: "#14A39A",
  short_name: "تدبير",
  description: "إدارة مصاريفك، حدد أهدافك، وحقق استقرارك المالي مع تدبير.",
  icons: [
    { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    // maskable: allows Android to use adaptive icon with coloured background.
    { src: "/icons/maskable-icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  screenshots: [
    {
      "src": "/screenshots/screenshot-1-light.png",
      "sizes": "1080x2340",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "الواجهة الرئيسية"
    },
    {
      "src": "/screenshots/screenshot-2-light.png",
      "sizes": "1080x2340",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "صفحة الإحصائيات"
    },
    {
      "src": "/screenshots/screenshot-3-light.png",
      "sizes": "1080x2340",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "صفحة الإعدادات"
    }
  ],
  related_applications: [],
  prefer_related_applications: false,
  // --- END of PWA manifest options ---
});

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Raise server-action body limit to 4 MB so large audio data-URIs
    // (long voice recordings) don't get rejected by Next.js before reaching
    // the handler. The /api/voice route handles audio so this also acts as
    // a safety net for any remaining server actions that receive media.
    serverActionsBodySizeLimit: '4mb',
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
  // This is a workaround for a build issue with the handlebars dependency in genkit.
  // It ensures that the package is treated as an external dependency by the server components.
  serverExternalPackages: ['handlebars'],
};

module.exports = withPWA(nextConfig);
