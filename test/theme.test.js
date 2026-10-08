/**
 * What the CLI looks like somewhere that is not a developer's terminal.
 *
 * The theme decides from the environment at import time, so the honest test
 * is a subprocess with that environment set rather than a unit test that
 * reaches past it. Every assertion here is about output somebody will
 * actually see: a CI log, a piped file, a Windows console.
 *
 * Colour itself is not asserted on directly, because stdout is a pipe under
 * `node --test` and so colour is off in every case. That is the point worth
 * pinning: piped output carries no escape codes at all.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ENTRY = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "index.js",
);

function run(env = {}) {
  return execFileSync(process.execPath, [ENTRY, "--help"], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

describe("terminal output degrades", () => {
  test("piped output carries no escape codes", () => {
    // Anything captured to a file or a CI log should be readable as text.
    const out = run({ LANG: "en_US.UTF-8" });
    assert.ok(!out.includes("\x1b["), "found ANSI escapes in piped output");
  });

  test("NO_COLOR is honoured", () => {
    const out = run({ NO_COLOR: "1" });
    assert.ok(!out.includes("\x1b["));
    assert.match(out, /Skyelight/);
  });

  test("a UTF-8 locale gets the mark", () => {
    assert.match(run({ LANG: "en_US.UTF-8" }), /◆ Skyelight/);
  });

  test("a non-UTF-8 locale gets an ASCII stand-in, not a broken glyph", () => {
    // A console that cannot draw ◆ renders a replacement character, which
    // reads as corruption rather than as plainness.
    const out = run({ LANG: "C", LC_ALL: "", LC_CTYPE: "" });
    assert.match(out, /\* Skyelight/);
    assert.ok(!out.includes("◆"));
  });
});

describe("the help screen", () => {
  test("names every agent the installer knows", async () => {
    const { CLIENTS } = await import("../src/install.js");
    const out = run({ LANG: "en_US.UTF-8" });
    for (const c of CLIENTS) {
      assert.match(
        out,
        new RegExp(`--client ${c.id}\\b`),
        `${c.id} missing from the help screen`,
      );
    }
  });

  test("agent labels line up in one column", () => {
    /**
     * The reason `pad` exists. `padEnd` on a styled string counts escape
     * codes, so a column padded after styling comes out ragged by however
     * many codes each row happens to carry — invisible to whoever wrote it
     * if their own terminal has colour off.
     */
    const lines = run({ LANG: "en_US.UTF-8" })
      .split("\n")
      .filter((l) => l.includes("--client ") && !l.includes("npx"));
    assert.ok(lines.length >= 2, "expected the agent list");

    // Where the label starts, not where the last word does — "Claude Code"
    // has a space in it, so anchoring on the end of the line finds the wrong
    // column on exactly the rows that matter.
    const columns = lines.map((l) => l.match(/^\s*--client \S+\s+/)[0].length);
    assert.equal(
      new Set(columns).size,
      1,
      `labels start at differing columns: ${columns.join(", ")}`,
    );
  });

  test("says which deployment it would configure", () => {
    // Running this against the wrong deployment is the mistake with the
    // least visible symptom: everything succeeds, against somebody else's
    // data. The header is the only place that says so before it happens.
    const out = run({
      SKYELIGHT_URL: "https://example-deployment.convex.site",
    });
    assert.match(out, /example-deployment\.convex\.site/);
  });
});
