import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  transpilePackages: ["@rangers-strike/engine", "@rangers-strike/cards"],
  outputFileTracingRoot: rootDir,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.grnrngr.com",
        pathname: "/cards/rangers-strike/cards/**",
      },
    ],
  },
};

export default nextConfig;
