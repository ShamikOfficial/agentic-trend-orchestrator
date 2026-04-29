import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";

function loadRootEnv(): Record<string, string> {
  const rootEnvPath = path.resolve(process.cwd(), "../.env");
  if (!fs.existsSync(rootEnvPath)) return {};

  const raw = fs.readFileSync(rootEnvPath, "utf8");
  const parsed: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
    process.env[key] = value;
  }
  return parsed;
}

const rootEnv = loadRootEnv();

const appEnv = (process.env.APP_ENV ?? "development").toLowerCase();
const apiBaseFromMode =
  appEnv === "production"
    ? process.env.API_BASE_URL_PROD ??
      "https://agentic-trend-orchestrator.onrender.com/api/v1"
    : process.env.API_BASE_URL_DEV ?? "http://127.0.0.1:8000/api/v1";
const publicApiBaseUrl = rootEnv.NEXT_PUBLIC_API_BASE_URL ?? apiBaseFromMode;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_BASE_URL: publicApiBaseUrl,
  },
};

export default nextConfig;
