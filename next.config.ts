import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "*": ["agent/**", "scripts/**"],
  },
  outputFileTracingIncludes: {
    "/api/chaos": ["error-sets/**"],
    "/api/fix": ["error-sets/clean/**"],
  },
};

export default nextConfig;
