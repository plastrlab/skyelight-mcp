/**
 * MCP over stdio, JSON-RPC 2.0, newline-delimited.
 *
 * Written against the protocol directly rather than the SDK. The surface a
 * read-only server needs is four methods, and a package people run with
 * `npx` is worth keeping dependency-free — nothing to install, nothing to
 * audit, and the whole thing is testable by feeding it strings.
 *
 * stdout is the protocol channel. Anything diagnostic goes to stderr; a
 * stray console.log here corrupts the stream and the failure looks like the
 * client being broken.
 */

import { toolDefinitions, callTool } from "./tools.js";
import { ICONS } from "./brand.js";
import { ApiError } from "./client.js";
import { VERSION } from "./version.js";
import {
  ITEM_CARD_URI,
  clientSupportsUi,
  itemCardResource,
  itemCardContents,
} from "./itemCard.js";

/**
 * Protocol revisions this server speaks, newest first.
 *
 * Only `tools` is implemented, and that surface has been stable across all of
 * these, so supporting the range costs nothing and is what keeps a client on
 * an older revision working.
 *
 * `initialize` MUST echo the client's requested version when we support it.
 * Answering with our own newest instead is a hard failure on the client side,
 * not a downgrade — Claude Code 2.1.x asks for 2025-11-25 and refuses a
 * server that replies 2026-07-28 with "protocol version is not supported".
 */
export const SUPPORTED_PROTOCOL_VERSIONS = [
  "2026-07-28",
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
];

/** Newest we speak. Used where there is no client to negotiate with. */
export const PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

/**
 * Pick the version to answer `initialize` with: the client's, when we speak
 * it. Otherwise our newest, and the client decides whether to continue —
 * which is the spec's escape hatch, not an error to raise here.
 */
export function negotiateProtocolVersion(requested) {
  return SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
    ? requested
    : PROTOCOL_VERSION;
}

const PARSE_ERROR = -32700;
const METHOD_NOT_FOUND = -32601;
const INTERNAL_ERROR = -32603;

export function createServer({ client, config, name = "skyelight" }) {
  /**
   * Whether this client can render the item card. Unlike the remote endpoint,
   * stdio HAS a session — the capability is declared once at `initialize` and
   * remembered for the connection (SKY-279).
   */
  let supportsUi = false;

  async function handle(message) {
    const { id, method, params } = message;
    // A notification has no id and takes no reply — including
    // notifications/initialized, which is the client saying it is ready.
    const isNotification = id === undefined || id === null;

    try {
      let result;
      switch (method) {
        case "initialize":
          supportsUi = clientSupportsUi(params?.capabilities);
          result = {
            protocolVersion: negotiateProtocolVersion(params?.protocolVersion),
            capabilities: { tools: {}, resources: {} },
            serverInfo: {
              name,
              title: "Skyelight",
              version: VERSION,
              icons: ICONS,
            },
            instructions:
              "Skyelight holds feedback people left directly on pages of a running app. " +
              "list_items to see what is outstanding, get_item for the full thread and the " +
              "element it points at. whats_new catches you up since you last looked; " +
              "find_by_source shows feedback on a file before you edit it; find_similar " +
              "checks for an existing report before create_item; project_review and " +
              "decision_log hold what a project settled, for reviews and hand-offs.",
          };
          break;

        case "tools/list":
          result = {
            tools: toolDefinitions(
              supportsUi ? { uiResourceUri: ITEM_CARD_URI } : undefined,
            ),
          };
          break;

        case "resources/list":
          result = { resources: [itemCardResource()] };
          break;

        case "resources/read":
          if (params?.uri !== ITEM_CARD_URI) {
            if (isNotification) return null;
            return {
              jsonrpc: "2.0",
              id,
              error: {
                code: -32602,
                message: `Unknown resource: ${params?.uri}`,
              },
            };
          }
          result = { contents: [itemCardContents()] };
          break;

        case "tools/call": {
          const { name: toolName, arguments: args = {} } = params ?? {};
          try {
            const {
              text,
              data,
              content: extra,
            } = await callTool(toolName, args, {
              client,
              config,
            });
            result = {
              // A tool result is a LIST of blocks. `get_item` uses the rest
              // of it for images; everything else returns the one block it
              // always did.
              content: [{ type: "text", text }, ...(extra ?? [])],
              structuredContent: data,
            };
          } catch (err) {
            // A failed tool call is a RESULT with isError, not a protocol
            // error — the model should see what went wrong and adjust, not
            // have the call vanish into a transport failure.
            result = {
              content: [{ type: "text", text: toolErrorText(err) }],
              isError: true,
            };
          }
          break;
        }

        case "ping":
          result = {};
          break;

        default:
          if (isNotification) return null;
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: METHOD_NOT_FOUND,
              message: `Unknown method: ${method}`,
            },
          };
      }

      if (isNotification) return null;
      return { jsonrpc: "2.0", id, result };
    } catch (err) {
      if (isNotification) return null;
      return {
        jsonrpc: "2.0",
        id,
        error: { code: INTERNAL_ERROR, message: err.message },
      };
    }
  }

  return { handle };
}

/** Turn an API failure into something a model can act on. */
function toolErrorText(err) {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return "Skyelight rejected the API key. Check SKYELIGHT_API_TOKEN — it may have been revoked.";
    }
    if (err.status === 403) {
      // The server's message names the role and what was required.
      return `Not permitted: ${err.message}`;
    }
    if (err.status === 404) {
      return `Not found: ${err.message}`;
    }
    return err.message;
  }
  return err.message;
}

/**
 * Wire a server to a byte stream. Split on newlines and ignore blank lines;
 * a partial line is held until the rest arrives.
 */
export function serveStdio(
  server,
  { input = process.stdin, output = process.stdout } = {},
) {
  let buffer = "";

  input.setEncoding?.("utf8");
  input.on("data", async (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;

      let message;
      try {
        message = JSON.parse(line);
      } catch {
        output.write(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: { code: PARSE_ERROR, message: "Invalid JSON" },
          }) + "\n",
        );
        continue;
      }

      const response = await server.handle(message);
      if (response) output.write(JSON.stringify(response) + "\n");
    }
  });
}
