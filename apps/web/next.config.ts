import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@rangers-strike/engine", "@rangers-strike/cards"],
};

export default nextConfig;
