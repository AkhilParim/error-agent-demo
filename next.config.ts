import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "*": ["agent/**", "scripts/**"],
  },
  outputFileTracingIncludes: {
    "/api/chaos": ["error-sets/**"],
  },
};

export default nextConfig;
