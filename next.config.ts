import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  outputFileTracingIncludes: {
    "/api/jobs/run": ["./sops/**/*"],
    "/api/cron/dispatch": ["./sops/**/*"],
  },
};

export default nextConfig;
