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
let client;
try {
  config = resolveConfig();
  client = createClient({ apiUrl: config.apiUrl, token: config.token });
} catch (err) {
  if (!(err instanceof ConfigError)) throw err;
  /**
   * No credentials: start anyway, and say so on every tool call.
   *
   * It used to exit here, before the handshake. A directory or a client
   * checking what the server can do then got nothing, and listed Skyelight
   * as having no tools. The tool list is static and public (it is in the
   * README and the source); only calling a tool needs an account, and that
   * is where the setup message now arrives, as the tool's error, where the
   * person or the model will read it. The hosted server at /mcp already
   * works this way: discovery is open, tools/call needs a sign-in.
   */
  process.stderr.write(
    `${err.message}\n\nStarting without credentials: tools are listed, and each call returns this message.\n`,
  );
  config = { token: null, apiUrl: null, projectId: null, projectName: null };
  client = new Proxy(
    {},
    { get: () => () => Promise.reject(new Error(err.message)) },
  );
}

serveStdio(createServer({ client, config }));
