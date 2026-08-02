import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // Screenshots are local static files under public/screenshots after sync.
    unoptimized: false,
  },
  // Allow 127.0.0.1 / ngrok when the marketing site is opened that way in local preview.
  allowedDevOrigins: ['127.0.0.1', '*.ngrok-free.dev', '*.ngrok-free.app', '*.ngrok.io'],
};

export default nextConfig;
