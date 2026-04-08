import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/jobs/run": ["./sops/**/*"],
    "/api/cron/dispatch": ["./sops/**/*"],
  },
};

export default nextConfig;
