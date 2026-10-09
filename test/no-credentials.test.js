import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * With no credentials the server still starts, completes the handshake and
 * lists its tools, so a directory's checker can see what it does. Calling
 * a tool returns the setup message as the tool's error.
 */
test("no credentials: handshake and tools/list work, a call explains setup", async () => {
  const empty = mkdtempSync(join(tmpdir(), "skyelight-mcp-"));
  const child = spawn(
    process.execPath,
    [join(import.meta.dirname, "..", "src", "index.js")],
    {
      cwd: empty,
      env: { PATH: process.env.PATH, HOME: empty },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  const replies = new Map();
  let buffer = "";
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let i;
    while ((i = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, i).trim();
      buffer = buffer.slice(i + 1);
      if (line) {
        const msg = JSON.parse(line);
        replies.set(msg.id, msg);
      }
    }
  });
  const send = (msg) => child.stdin.write(`${JSON.stringify(msg)}\n`);
  const reply = async (id) => {
    for (let t = 0; t < 100 && !replies.has(id); t++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return replies.get(id);
  };

  try {
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "checker", version: "0" },
      },
    });
    const init = await reply(1);
    assert.equal(init?.result?.serverInfo?.title, "Skyelight");

    send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const list = await reply(2);
    assert.ok(list.result.tools.length >= 10);
    assert.ok(list.result.tools.some((t) => t.name === "list_items"));

    send({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "list_workspaces", arguments: {} },
    });
    const call = await reply(3);
    assert.equal(call.result.isError, true);
    assert.match(call.result.content[0].text, /No Skyelight credentials found/);
  } finally {
    child.kill();
  }
});
