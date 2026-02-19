import { execSync } from "node:child_process";
import * as nextEnv from "@next/env";

const loadEnvConfig =
  (nextEnv as { loadEnvConfig?: (dir: string) => void }).loadEnvConfig ??
  (nextEnv as { default?: { loadEnvConfig?: (dir: string) => void } }).default?.loadEnvConfig;

export default async function globalSetup() {
  if (!loadEnvConfig) {
    throw new Error("Unable to load Next env config");
  }
  loadEnvConfig(process.cwd());

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required for E2E tests");
  }

  execSync("npm run db:migrate", {
    stdio: "inherit",
    env: process.env
  });
}
