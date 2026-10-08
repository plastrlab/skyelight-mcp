#!/usr/bin/env node
/**
 * Entry point, wearing two hats.
 *
 * With no arguments this is the stdio MCP server, which is what a client
 * spawns. With `init` it is the installer that registers the *remote* server
 * with a coding agent — see `cli.js`.
 *
 * One binary rather than two, because npm resolves `npx @skyelight/mcp` to
 * the package's only bin whatever it is called; a second bin would make that
 * resolution ambiguous and `npx @skyelight/mcp init` would stop working.
 * Dispatching here keeps the one-command install one command.
 */

// The static import below is hoisted, so `config.js` is evaluated either
// way — but `resolveConfig()` is only *called* past this point, and calling
// it is what throws when there are no credentials. The installer needs none.
/**
 * Every word that is a command rather than "be the server".
 *
 * Listed rather than tested for "not empty", because an unknown word has to
 * reach the server path: that is where a client passes flags we have never
 * heard of, and turning those into a help screen would break the client
 * rather than the typo.
 */
const COMMANDS = new Set(["init", "remove", "uninstall", "--help", "-h"]);

if (COMMANDS.has(process.argv[2])) {
  await import("./cli.js");
  process.exit(process.exitCode ?? 0);
}

import { resolveConfig, ConfigError } from "./config.js";
import { createClient } from "./client.js";
import { createServer, serveStdio } from "./server.js";

let config;
try {
  config = resolveConfig();
} catch (err) {
  if (err instanceof ConfigError) {
    // stderr, and a non-zero exit: an MCP client surfaces this as a failed
    // server rather than hanging on a handshake that will never complete.
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
  throw err;
}

const client = createClient({ apiUrl: config.apiUrl, token: config.token });
serveStdio(createServer({ client, config }));
