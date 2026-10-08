/**
 * Where each agent keeps its MCP servers, and what to write there.
 *
 * Pure functions, so the CLI is the part that touches the disk and this is
 * the part that can be tested. Every entry answers three questions: how do
 * we know this agent is on the machine, what file holds its servers, and
 * what shape does an entry take in it.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";

/** The name the server is registered under, in every client. */
export const SERVER_NAME = "skyelight";

/**
 * The loopback port every client is told to listen on.
 *
 * Fixed rather than random because the redirect URI is registered with Clerk
 * in advance, and only a stable one can be. Loopback, so it only ever
 * resolves on the machine running the client.
 */
export const CALLBACK_PORT = 54545;

const home = () => homedir();

/**
 * The agents this can configure.
 *
 * Ordered by how likely a given machine is to have one, because the first
 * match wins when nothing is named. That is a guess, and `--client` exists
 * for when it guesses wrong. The same order the settings card lists them in,
 * so the two never disagree about which agent is the obvious one.
 */
export const CLIENTS = [
  {
    id: "claude",
    label: "Claude Code",
    /**
     * Registered by its own CLI rather than by editing a file.
     *
     * `claude mcp add` knows where the config lives on this machine and what
     * the current schema is; writing the file ourselves would be a guess at
     * both, and a wrong guess silently produces an agent with no tools.
     */
    command: (url, clientId, port = CALLBACK_PORT) => [
      "claude",
      [
        "mcp",
        "add",
        "-s",
        "user",
        "--transport",
        "http",
        SERVER_NAME,
        // Only when the deployment named a client. Without them Claude Code
        // registers itself dynamically, which is the right thing to do and
        // the wrong thing to prevent by passing an empty id.
        ...(clientId
          ? ["--client-id", clientId, "--callback-port", String(port)]
          : []),
        url,
      ],
    ],
    /** Removed by its own CLI too, for the reason it is added by one. */
    removeCommand: () => [
      "claude",
      ["mcp", "remove", "-s", "user", SERVER_NAME],
    ],
    detect: () => hasBinary("claude"),
  },
  {
    id: "cursor",
    label: "Cursor",
    file: () => join(home(), ".cursor", "mcp.json"),
    format: "json",
    entry: (url) => ({ url }),
    detect: () => existsSync(join(home(), ".cursor")),
  },
  {
    /**
     * Grok's own entry, which it needs despite appearing to work without one.
     *
     * It reads `~/.claude.json` as a compatibility source, so on a machine
     * that also has Claude Code it inherits that registration — client id,
     * callback port and all — and looks configured when nothing here ran.
     * On a machine without Claude Code there is nothing to inherit.
     *
     * Two differences from Codex, both from Grok's own config reference:
     * `oauth_client_id` is a flat key rather than a nested table, and there
     * is no callback setting at all — Grok picks the loopback address, which
     * is why both spellings of it are registered with Clerk.
     *
     * `oauth_scopes` is spelled out because Grok sends no `scope` parameter
     * otherwise, and a token minted without `offline_access` carries no
     * refresh: the session works, then quietly stops.
     */
    id: "grok",
    label: "Grok",
    file: () => join(home(), ".grok", "config.toml"),
    format: "toml",
    entry: (url, clientId) =>
      [
        `[mcp_servers.${SERVER_NAME}]`,
        `url = "${url}"`,
        "enabled = true",
        ...(clientId
          ? [
              `oauth_client_id = "${clientId}"`,
              'oauth_scopes = ["profile", "email", "offline_access"]',
            ]
          : []),
      ].join("\n"),
    detect: () => existsSync(join(home(), ".grok")),
  },
  {
    id: "codex",
    label: "Codex",
    file: () => join(home(), ".codex", "config.toml"),
    format: "toml",
    entry: (url, clientId, port = CALLBACK_PORT) =>
      [
        `[mcp_servers.${SERVER_NAME}]`,
        `url = "${url}"`,
        'auth = "oauth"',
        // The oauth table only when there is a client to name.
        ...(clientId
          ? [
              "",
              `[mcp_servers.${SERVER_NAME}.oauth]`,
              `client_id = "${clientId}"`,
              `callback_url = "http://127.0.0.1:${port}/callback"`,
            ]
          : []),
      ].join("\n"),
    detect: () => existsSync(join(home(), ".codex")),
  },
  {
    id: "windsurf",
    label: "Windsurf",
    file: () => join(home(), ".codeium", "windsurf", "mcp_config.json"),
    format: "json",
    entry: (url) => ({ serverUrl: url }),
    detect: () => existsSync(join(home(), ".codeium", "windsurf")),
  },
];

/** On PATH, without running the thing. */
function hasBinary(name) {
  const paths = (process.env.PATH ?? "").split(":").filter(Boolean);
  return paths.some((p) => existsSync(join(p, name)));
}

/**
 * Which agents are on this machine.
 *
 * All of them, not the first: somebody with Cursor and Claude Code installed
 * should be told both were found rather than have one picked for them.
 */
export function detectClients(clients = CLIENTS) {
  return clients.filter((c) => {
    try {
      return c.detect();
    } catch {
      return false;
    }
  });
}

export function findClient(id, clients = CLIENTS) {
  return clients.find((c) => c.id === id) ?? null;
}

/**
 * Add the server to a JSON config, preserving whatever else is in it.
 *
 * Returns the new text, or null when the server is already there and points
 * at the same place — nothing to write is a better answer than an identical
 * rewrite that churns the file's mtime.
 */
export function addToJson(existing, entry) {
  const parsed = existing.trim() ? JSON.parse(existing) : {};
  const servers = parsed.mcpServers ?? {};
  const current = servers[SERVER_NAME];
  if (current && JSON.stringify(current) === JSON.stringify(entry)) return null;
  return `${JSON.stringify(
    { ...parsed, mcpServers: { ...servers, [SERVER_NAME]: entry } },
    null,
    2,
  )}\n`;
}

/**
 * Append a TOML block, replacing an existing one for the same server.
 *
 * A parser would be the right tool for arbitrary TOML. This only ever writes
 * two tables it wrote itself, so it finds them by their headers and swaps
 * them; anything it does not recognise it leaves alone and appends after.
 */
export function addToToml(existing, block) {
  const header = `[mcp_servers.${SERVER_NAME}]`;
  if (!existing.includes(header)) {
    const sep = existing.trim() ? "\n\n" : "";
    return `${existing.trimEnd()}${sep}${block}\n`;
  }
  if (existing.includes(block)) return null;

  const lines = existing.split("\n");
  const start = lines.findIndex((l) => l.trim() === header);
  // Ours runs to the next table that is not one of ours.
  let end = start + 1;
  while (end < lines.length) {
    const t = lines[end].trim();
    if (t.startsWith("[") && !t.startsWith(`[mcp_servers.${SERVER_NAME}`))
      break;
    end++;
  }
  return `${[...lines.slice(0, start), block, ...lines.slice(end)]
    .join("\n")
    .trimEnd()}\n`;
}

/**
 * Take the server back out of a JSON config, leaving everything else.
 *
 * Null when it was not there, so the caller can say "nothing to remove"
 * rather than rewriting a file it did not change. `mcpServers` is left
 * behind even when empty: it is the client's key, not ours, and deleting a
 * structure somebody else's tool expects to find is a bigger liberty than
 * removing our own row from it.
 */
export function removeFromJson(existing) {
  if (!existing.trim()) return null;
  const parsed = JSON.parse(existing);
  if (!parsed?.mcpServers || !(SERVER_NAME in parsed.mcpServers)) return null;
  const { [SERVER_NAME]: _gone, ...rest } = parsed.mcpServers;
  return `${JSON.stringify({ ...parsed, mcpServers: rest }, null, 2)}\n`;
}

/**
 * Take our TOML tables back out.
 *
 * Both of them — Codex writes `[mcp_servers.skyelight]` and
 * `[mcp_servers.skyelight.oauth]`, and removing only the first would leave
 * an orphaned oauth table that parses as a server with no url. The same
 * "runs to the next table that is not ours" rule `addToToml` uses.
 */
export function removeFromToml(existing) {
  const header = `[mcp_servers.${SERVER_NAME}]`;
  if (!existing.includes(header)) return null;

  const lines = existing.split("\n");
  const start = lines.findIndex((l) => l.trim() === header);
  let end = start + 1;
  while (end < lines.length) {
    const t = lines[end].trim();
    if (t.startsWith("[") && !t.startsWith(`[mcp_servers.${SERVER_NAME}`))
      break;
    end++;
  }
  const kept = [...lines.slice(0, start), ...lines.slice(end)]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
  return kept ? `${kept}\n` : "";
}
