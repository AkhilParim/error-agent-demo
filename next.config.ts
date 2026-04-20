import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "*": ["agent/**", "error-sets/**", "scripts/**"],
  },
};

export default nextConfig;
