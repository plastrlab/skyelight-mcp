/**
 * Where the token, the API and the project binding come from.
 *
 * Resolution order deliberately matches the Python skill this supersedes, so
 * anyone who already has credentials on disk gets a working MCP server
 * without moving anything:
 *
 *   1. SKYELIGHT_API_TOKEN / SKYELIGHT_API_URL in the environment
 *   2. .env.local, then .env, in the working directory
 *   3. ~/.skyelight/credentials  ({"apiUrl": "...", "token": "..."})
 *
 * The project binding is separate and comes from `.skyelight.json` in the
 * working directory, so a repo can declare which Skyelight project it is
 * without every developer configuring it. A personal token reaches every
 * project its owner can, so the binding is what saves passing a projectId on
 * every call.
 */

import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export class ConfigError extends Error {}

/** Minimal .env parser: KEY=VALUE, optional quotes, # comments. */
export function parseDotenv(text) {
  const out = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

function readJsonIfPresent(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    // A malformed config should not take the server down — it should be
    // reported and skipped. stderr is safe: stdout is the protocol channel.
    process.stderr.write(`[skyelight-mcp] ignoring malformed ${path}\n`);
    return null;
  }
}

export function resolveConfig({
  cwd = process.cwd(),
  env = process.env,
  // Injectable so tests do not read the developer's real credentials file
  // and pass or fail depending on whose machine they run on.
  home = homedir(),
} = {}) {
  let token = env.SKYELIGHT_API_TOKEN || null;
  let apiUrl = env.SKYELIGHT_API_URL || null;

  if (!token || !apiUrl) {
    for (const name of [".env.local", ".env"]) {
      const path = join(cwd, name);
      if (!existsSync(path)) continue;
      const parsed = parseDotenv(readFileSync(path, "utf8"));
      token = token || parsed.SKYELIGHT_API_TOKEN || null;
      apiUrl = apiUrl || parsed.SKYELIGHT_API_URL || null;
      if (token && apiUrl) break;
    }
  }

  if (!token || !apiUrl) {
    const creds = readJsonIfPresent(join(home, ".skyelight", "credentials"));
    if (creds) {
      token = token || creds.token || null;
      apiUrl = apiUrl || creds.apiUrl || null;
    }
  }

  if (!token || !apiUrl) {
    throw new ConfigError(
      [
        "No Skyelight credentials found. Either:",
        "  • export SKYELIGHT_API_URL and SKYELIGHT_API_TOKEN, or",
        "  • put them in .env.local, or",
        '  • save ~/.skyelight/credentials as {"apiUrl": "...", "token": "sky_..."}',
        "",
        "Create one under Account settings → API Keys in the",
        "Skyelight web app. Workspace API keys (sk_live_...) no longer work.",
      ].join("\n"),
    );
  }

  const project = readJsonIfPresent(join(cwd, ".skyelight.json")) ?? {};

  return {
    token,
    apiUrl: apiUrl.replace(/\/+$/, ""),
    // Named projectId to match the API. A projectId the token's owner cannot
    // reach is refused by the server, whatever this says.
    projectId: project.projectId ?? null,
    projectName: project.projectName ?? null,
  };
}
