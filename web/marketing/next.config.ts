import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Local only: Windows often returns UNKNOWN on `.next` after long live reloads /
  // antivirus scans. Production stays on `.next` so Vercel can find routes-manifest.
  ...(process.env.NODE_ENV !== 'production' ? { distDir: '.next-dev' } : {}),
  images: {
    // Screenshots are local static files under public/screenshots after sync.
    unoptimized: false,
  },
  // Allow 127.0.0.1 / ngrok when the marketing site is opened that way in local preview.
  allowedDevOrigins: ['127.0.0.1', '*.ngrok-free.dev', '*.ngrok-free.app', '*.ngrok.io'],
};

export default nextConfig;
