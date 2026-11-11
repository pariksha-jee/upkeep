import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Standalone output for containerized "dist-only" deployments (guardrails §5.4).
  // The web app is a pure API consumer (NEXT_PUBLIC_API_URL); deployable to Vercel as-is.
  output: 'standalone',
  poweredByHeader: false,
};

export default nextConfig;
