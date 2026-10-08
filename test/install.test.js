import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  SERVER_NAME,
  CLIENTS,
  detectClients,
  findClient,
  addToJson,
  addToToml,
  removeFromJson,
  removeFromToml,
} from "../src/install.js";

/**
 * The installer edits files somebody else owns.
 *
 * Which makes "leaves everything it did not come for alone" the property
 * worth testing hardest — a config that loses an unrelated server is a
 * worse outcome than one that was never edited.
 */
describe("adding the server to a JSON config", () => {
  test("creates the structure when the file is empty", () => {
    const out = JSON.parse(addToJson("", { url: "https://x/mcp" }));
    assert.deepEqual(out, {
      mcpServers: { skyelight: { url: "https://x/mcp" } },
    });
  });

  test("keeps every other server, and every other key", () => {
    const before = JSON.stringify({
      someOtherSetting: true,
      mcpServers: { linear: { url: "https://linear/mcp" } },
    });
    const out = JSON.parse(addToJson(before, { url: "https://x/mcp" }));
    assert.equal(out.someOtherSetting, true);
    assert.deepEqual(out.mcpServers.linear, { url: "https://linear/mcp" });
    assert.deepEqual(out.mcpServers.skyelight, { url: "https://x/mcp" });
  });

  test("replaces an entry that points somewhere else", () => {
    const before = JSON.stringify({
      mcpServers: { skyelight: { url: "https://old/mcp" } },
    });
    const out = JSON.parse(addToJson(before, { url: "https://new/mcp" }));
    assert.deepEqual(out.mcpServers.skyelight, { url: "https://new/mcp" });
  });

  /** Nothing to write beats an identical rewrite that churns the mtime. */
  test("returns null when it is already exactly right", () => {
    const entry = { url: "https://x/mcp" };
    const before = JSON.stringify({ mcpServers: { skyelight: entry } });
    assert.equal(addToJson(before, entry), null);
  });
});

describe("adding the server to a TOML config", () => {
  const block = [
    `[mcp_servers.${SERVER_NAME}]`,
    'url = "https://x/mcp"',
    'auth = "oauth"',
  ].join("\n");

  test("appends to an empty file", () => {
    assert.equal(addToToml("", block), `${block}\n`);
  });

  test("appends after what is already there", () => {
    const before = '[model]\nname = "gpt-5"\n';
    const out = addToToml(before, block);
    assert.ok(out.includes("[model]"));
    assert.ok(out.includes(block));
  });

  /**
   * Replacing our own table must not eat the one after it. This is the case
   * a naive "delete to the next `[`" gets wrong when our own sub-table sits
   * in between.
   */
  test("replaces its own tables and stops at somebody else's", () => {
    const before = [
      `[mcp_servers.${SERVER_NAME}]`,
      'url = "https://old/mcp"',
      "",
      `[mcp_servers.${SERVER_NAME}.oauth]`,
      'client_id = "old"',
      "",
      "[mcp_servers.other]",
      'url = "https://other/mcp"',
    ].join("\n");
    const out = addToToml(before, block);
    assert.ok(!out.includes("https://old/mcp"));
    assert.ok(!out.includes('client_id = "old"'));
    assert.ok(out.includes("[mcp_servers.other]"));
    assert.ok(out.includes("https://other/mcp"));
  });

  test("returns null when the block is already present", () => {
    assert.equal(addToToml(`${block}\n`, block), null);
  });
});

describe("finding an agent", () => {
  test("returns every one that is present, not the first", () => {
    const fake = [
      { id: "a", detect: () => true },
      { id: "b", detect: () => false },
      { id: "c", detect: () => true },
    ];
    assert.deepEqual(
      detectClients(fake).map((c) => c.id),
      ["a", "c"],
    );
  });

  // A detector that throws is a detector that found nothing.
  test("a detector that throws does not take the run down", () => {
    const fake = [
      {
        id: "a",
        detect: () => {
          throw new Error("no home dir");
        },
      },
      { id: "b", detect: () => true },
    ];
    assert.deepEqual(
      detectClients(fake).map((c) => c.id),
      ["b"],
    );
  });

  test("names resolve to entries, and unknown ones to null", () => {
    assert.equal(findClient("cursor").label, "Cursor");
    assert.equal(findClient("emacs"), null);
  });

  test("every client can either write a file or run a command", () => {
    for (const c of CLIENTS) {
      assert.ok(
        c.command || (c.file && c.format && c.entry),
        `${c.id} is incomplete`,
      );
    }
  });
});

/**
 * Grok looks configured on a machine that also has Claude Code, because it
 * reads `~/.claude.json` and inherits that registration. These assert the
 * entry it gets when nothing is there to inherit — the case the compat
 * import hides until somebody installs Grok on its own.
 */
describe("the Grok entry", () => {
  const grok = findClient("grok");
  const URL = "https://example.convex.site/mcp";

  test("writes the client id as a flat key, not a nested table", () => {
    const block = grok.entry(URL, "abc123");
    assert.match(block, /^oauth_client_id = "abc123"$/m);
    assert.ok(
      !block.includes(`[mcp_servers.${SERVER_NAME}.oauth]`),
      "Grok has no oauth sub-table — that is Codex's shape",
    );
  });

  test("asks for offline_access, or the session cannot refresh", () => {
    assert.match(grok.entry(URL, "abc123"), /offline_access/);
  });

  test("names no callback — Grok picks the loopback address itself", () => {
    assert.ok(!grok.entry(URL, "abc123").includes("callback"));
  });

  test("omits the OAuth keys when no client was named", () => {
    const block = grok.entry(URL, "");
    assert.ok(!block.includes("oauth_client_id"));
    assert.ok(!block.includes("oauth_scopes"));
    assert.match(block, /^enabled = true$/m);
  });

  test("its block round-trips through the TOML writer", () => {
    const block = grok.entry(URL, "abc123");
    const written = addToToml("[ui]\nyolo = false\n", block);
    assert.match(written, /^\[ui\]$/m);
    assert.ok(written.includes(block));
    // Already exactly right is nothing to write, not an identical rewrite.
    assert.equal(addToToml(written, block), null);
  });
});

describe("taking it back out", () => {
  test("removeFromJson leaves every other server alone", () => {
    const before = JSON.stringify({
      mcpServers: { skyelight: { url: "u" }, other: { url: "o" } },
      somethingElse: true,
    });
    const after = JSON.parse(removeFromJson(before));
    assert.deepEqual(after.mcpServers, { other: { url: "o" } });
    // Keys that are not ours are not ours to tidy.
    assert.equal(after.somethingElse, true);
  });

  test("removeFromJson keeps the mcpServers key when it empties", () => {
    // It is the client's structure, not ours. Deleting something another
    // tool expects to find is a bigger liberty than removing our row.
    const after = JSON.parse(
      removeFromJson(
        JSON.stringify({ mcpServers: { skyelight: { url: "u" } } }),
      ),
    );
    assert.deepEqual(after.mcpServers, {});
  });

  test("removeFromJson says null when there is nothing of ours", () => {
    // So the caller reports "nothing to remove" rather than rewriting a file
    // it did not change.
    assert.equal(
      removeFromJson(JSON.stringify({ mcpServers: { o: {} } })),
      null,
    );
    assert.equal(removeFromJson(""), null);
  });

  test("removeFromToml takes the oauth sub-table with it", () => {
    /**
     * The one that would break a config rather than leave it dirty. Codex
     * writes two tables, and removing only the first leaves an orphaned
     * `[mcp_servers.skyelight.oauth]` that parses as a server with no url.
     */
    const before = [
      "[mcp_servers.other]",
      'url = "x"',
      "",
      "[mcp_servers.skyelight]",
      'url = "u"',
      'auth = "oauth"',
      "",
      "[mcp_servers.skyelight.oauth]",
      'client_id = "c"',
      "",
      "[mcp_servers.third]",
      'url = "z"',
      "",
    ].join("\n");
    const after = removeFromToml(before);
    assert.ok(!after.includes("skyelight"));
    assert.ok(after.includes("[mcp_servers.other]"));
    assert.ok(after.includes("[mcp_servers.third]"));
  });

  test("removeFromToml says null when there is nothing of ours", () => {
    assert.equal(removeFromToml('[mcp_servers.other]\nurl = "x"\n'), null);
  });

  test("removing what init wrote gets back to where it started", () => {
    // The property worth having: the pair is a round trip, so running
    // `init` then `remove` leaves a config nobody has to inspect.
    for (const start of ['[mcp_servers.other]\nurl = "x"\n', ""]) {
      const client = CLIENTS.find((c) => c.id === "codex");
      const added = addToToml(start, client.entry("https://x.test/mcp", "cid"));
      assert.equal(removeFromToml(added), start === "" ? "" : start);
    }
  });
});
