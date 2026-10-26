import { existsSync } from "node:fs";
import path from "node:path";

import type { NextConfig } from "next";

// Next.js only reads .env from client/, so load the shared root .env.
// Variables already set in the environment take precedence over the file.
const rootEnvFile = path.resolve(process.cwd(), "../.env");
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
