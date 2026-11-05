import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GEMINI_CALLBACK_PORT, findClient } from "../src/install.js";

/**
 * The Gemini CLI extension lives at the package root, because the gallery
 * and `gemini extensions install` read the root of the public repo. Its
 * skill and commands are copies or ports of the Claude Code plugin's, so
 * these keep the two from drifting apart.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const json = (p) => JSON.parse(read(p));

describe("the Gemini CLI extension", () => {
  const ext = json("gemini-extension.json");

  test("has the package's version", () => {
    assert.equal(ext.version, json("package.json").version);
  });

  test("points at the hosted server and its context file exists", () => {
    assert.equal(ext.mcpServers.skyelight.httpUrl, "https://app.skyelight.ai/mcp");
    assert.ok(read(ext.contextFileName).startsWith("# Skyelight"));
  });

  test("signs in as the same pre-registered client as Cursor", () => {
    const cursor = json("plugin/.cursor-plugin/plugin.json");
    const { oauth } = ext.mcpServers.skyelight;
    assert.equal(oauth.clientId, cursor.mcpServers.skyelight.auth.CLIENT_ID);
    assert.equal(
      oauth.redirectUri,
      `http://localhost:${GEMINI_CALLBACK_PORT}/oauth/callback`,
    );
    // The same settings `init --client gemini` writes.
    const written = findClient("gemini").entry(ext.mcpServers.skyelight.httpUrl, oauth.clientId);
    assert.deepEqual(written, ext.mcpServers.skyelight);
  });

  test("its skill is the plugin's skill, word for word", () => {
    assert.equal(
      read("skills/skyelight-feedback/SKILL.md"),
      read("plugin/skills/skyelight-feedback/SKILL.md"),
    );
  });

  test("ports every plugin command", () => {
    const plugin = readdirSync(join(root, "plugin/commands"))
      .map((f) => f.replace(/\.md$/, ""))
      .sort();
    const gemini = readdirSync(join(root, "commands/skyelight"))
      .map((f) => f.replace(/\.toml$/, ""))
      .sort();
    assert.deepEqual(gemini, plugin);
    for (const name of gemini) {
      const toml = read(`commands/skyelight/${name}.toml`);
      assert.match(toml, /^description = "/m);
      assert.ok(toml.includes("{{args}}"), `${name} passes its arguments`);
      assert.ok(!toml.includes("$ARGUMENTS"), `${name} uses Claude's syntax`);
    }
  });
});
