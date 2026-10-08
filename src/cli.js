#!/usr/bin/env node

/**
 * `npx @skyelight/mcp init`
 *
 * Finds your coding agent, registers Skyelight's MCP server with it, and
 * leaves the sign-in to the agent — the server speaks OAuth, so the first
 * time the agent connects it opens a browser and you approve it there. No
 * token is pasted anywhere, and none is stored on disk by this.
 *
 * It shows the change and waits, like `@skyelight/build init` does. Editing
 * a config somebody else wrote is the kind of help that has to ask first.
 * `--yes` exists for people who have already read it once.
 *
 * Several agents used to be a dead end: it printed the list and exited 1, as
 * though having two editors were an error. Most developers have more than
 * one, so the commonest case on the first command anybody runs was a refusal.
 * It asks now, and `--client` still answers in advance for a script.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { createInterface } from "node:readline/promises";
import { spawnSync } from "node:child_process";
import {
  CLIENTS,
  SERVER_NAME,
  detectClients,
  findClient,
  addToJson,
  addToToml,
  removeFromJson,
  removeFromToml,
} from "./install.js";
import {
  bold,
  dim,
  green,
  amber,
  brand,
  header,
  heading,
  pad,
  MARK,
} from "./theme.js";

/**
 * Which deployment to register. Production unless told otherwise.
 */
const ORIGIN = (
  process.env.SKYELIGHT_URL ?? "https://app.skyelight.ai"
).replace(/\/+$/, "");

/**
 * Asked for rather than baked in.
 *
 * The OAuth client id is per deployment, so a published package cannot hold
 * one — that would be an npm release per environment, and the first person
 * to run it against the wrong one gets an OAuth error naming a client that
 * is not theirs. `/mcp/install-config` is the deployment saying what it is.
 *
 * A deployment that answers without a client id is one doing dynamic client
 * registration, which is the correct fallback rather than a failure: the
 * flags that carry the id are simply left off.
 */
async function fetchConfig() {
  const res = await fetch(`${ORIGIN}/mcp/install-config`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`${ORIGIN} answered ${res.status}`);
  }
  const body = await res.json();
  if (typeof body?.url !== "string") {
    throw new Error(`${ORIGIN} did not say where its MCP server is`);
  }
  return body;
}

/** The host being configured, for the header. Not the whole URL — it is the */
/** part that tells you whether you are pointed somewhere unexpected. */
function originLabel() {
  try {
    return new URL(ORIGIN).host;
  } catch {
    return ORIGIN;
  }
}

async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(`  ${question} ${brand(MARK.arrow)} `)).trim();
  } finally {
    rl.close();
  }
}

async function confirm(question) {
  // No terminal, no question. A CI run should not hang on a prompt nobody is
  // there to answer, and `--yes` is how it says so deliberately.
  if (!process.stdin.isTTY) return false;
  return /^y(es)?$/i.test(await ask(`${question} ${dim("[y/N]")}`));
}

/**
 * Which agent, when several are on the machine.
 *
 * A numbered prompt rather than a list of commands to go and retype. The
 * commands are still printed underneath, because somebody scripting this
 * needs them and because the prompt is unavailable without a terminal.
 */
async function choose(found) {
  console.log(`  Found ${bold(found.length)} agents.\n`);
  found.forEach((c, i) => {
    console.log(`    ${brand(String(i + 1))}  ${c.label}`);
  });
  console.log(`    ${brand("a")}  ${dim("All of them")}\n`);

  if (!process.stdin.isTTY) {
    console.log(dim("  Not a terminal, so nothing was chosen. Name one:\n"));
    listClients();
    return null;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const answer = (
      await ask(`Which one? ${dim(`[1-${found.length}, a]`)}`)
    ).toLowerCase();
    if (answer === "a" || answer === "all") return found;
    const n = Number(answer);
    if (Number.isInteger(n) && n >= 1 && n <= found.length) {
      return [found[n - 1]];
    }
    console.log(dim(`  Not one of them.\n`));
  }
  return null;
}

/** The widest agent id, so the labels line up whatever is in the registry. */
const ID_WIDTH = Math.max(...CLIENTS.map((c) => c.id.length));

function listClients() {
  for (const c of CLIENTS) {
    console.log(
      `    ${dim("--client")} ${bold(pad(c.id, ID_WIDTH))}  ${dim(c.label)}`,
    );
  }
  console.log("");
}

/**
 * Register one agent. Returns whether anything changed, so the summary at
 * the end can tell "added" from "already there" without guessing.
 */
async function register(client, config, { yes, quiet }) {
  const { url: MCP_URL, clientId: CLIENT_ID, callbackPort } = config;

  // Claude Code registers through its own CLI — see `install.js`.
  if (client.command) {
    const [bin, args] = client.command(MCP_URL, CLIENT_ID, callbackPort);
    console.log(`  ${bold(client.label)}`);
    console.log(dim(`    ${bin} ${args.join(" ")}\n`));
    if (!yes && !(await confirm("Run it?"))) {
      console.log(dim("\n  Nothing changed.\n"));
      return "skipped";
    }
    const res = spawnSync(bin, args, { stdio: quiet ? "ignore" : "inherit" });
    if (res.status !== 0) {
      console.log(
        amber(`\n  That command failed. Run it yourself to see why.\n`),
      );
      return "failed";
    }
    return "added";
  }

  const file = client.file();
  const before = existsSync(file) ? readFileSync(file, "utf8") : "";
  const after =
    client.format === "json"
      ? addToJson(before, client.entry(MCP_URL, CLIENT_ID))
      : addToToml(before, client.entry(MCP_URL, CLIENT_ID));

  if (after === null) {
    console.log(
      `  ${green(MARK.tick)} ${client.label} ${dim("— already set up")}`,
    );
    return "already";
  }

  console.log(`  ${bold(client.label)}`);
  console.log(dim(`    ${file}`));
  console.log(
    dim(
      client.format === "json"
        ? `    mcpServers.${SERVER_NAME} → ${MCP_URL}\n`
        : `    [mcp_servers.${SERVER_NAME}] → ${MCP_URL}\n`,
    ),
  );

  if (!yes && !(await confirm("Write it?"))) {
    console.log(dim("\n  Nothing written.\n"));
    return "skipped";
  }

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, after, "utf8");
  return "added";
}

/**
 * Take the server back out of one agent.
 *
 * Symmetrical with `register` on purpose, including the confirmation: the
 * file belongs to whoever configured it, and a command that edits it without
 * showing what it is about to do is the thing `init` deliberately is not.
 */
async function unregister(client, { yes, quiet }) {
  if (client.removeCommand) {
    const [bin, args] = client.removeCommand();
    console.log(`  ${bold(client.label)}`);
    console.log(dim(`    ${bin} ${args.join(" ")}\n`));
    if (!yes && !(await confirm("Run it?"))) {
      console.log(dim("\n  Nothing changed.\n"));
      return "skipped";
    }
    const res = spawnSync(bin, args, { stdio: quiet ? "ignore" : "inherit" });
    // A client that had no such server exits non-zero saying so, which is
    // the answer rather than a failure — `remove` is meant to be safe to
    // run twice.
    return res.status === 0 ? "removed" : "absent";
  }

  const file = client.file();
  if (!existsSync(file)) {
    console.log(
      `  ${dim(MARK.dot)} ${client.label} ${dim("— nothing to remove")}`,
    );
    return "absent";
  }
  const before = readFileSync(file, "utf8");
  const after =
    client.format === "json" ? removeFromJson(before) : removeFromToml(before);

  if (after === null) {
    console.log(
      `  ${dim(MARK.dot)} ${client.label} ${dim("— nothing to remove")}`,
    );
    return "absent";
  }

  console.log(`  ${bold(client.label)}`);
  console.log(dim(`    ${file}`));
  console.log(
    dim(
      client.format === "json"
        ? `    mcpServers.${SERVER_NAME} ${MARK.arrow} removed\n`
        : `    [mcp_servers.${SERVER_NAME}] ${MARK.arrow} removed\n`,
    ),
  );

  if (!yes && !(await confirm("Write it?"))) {
    console.log(dim("\n  Nothing written.\n"));
    return "skipped";
  }
  writeFileSync(file, after, "utf8");
  return "removed";
}

/**
 * Which agents to act on. Shared by `init` and `remove` so the two cannot
 * disagree about what `--client all` means or how a tie is broken.
 *
 * `known` is for removal: an agent whose config directory has since been
 * deleted still fails detection, and somebody uninstalling wants every place
 * we ever wrote considered rather than only the ones still standing.
 */
async function pickTargets({ clientFlag, known = false }) {
  if (clientFlag === "all") {
    const all = known ? CLIENTS : detectClients();
    if (all.length === 0) {
      console.log(amber("  No coding agent found on this machine.\n"));
      listClients();
      return null;
    }
    return all;
  }
  if (clientFlag) {
    const one = findClient(clientFlag);
    if (!one) {
      console.log(amber(`  Unknown agent "${clientFlag}".\n`));
      listClients();
      return null;
    }
    return [one];
  }
  const found = detectClients();
  if (found.length === 0) {
    console.log(amber("  No coding agent found on this machine.\n"));
    listClients();
    return null;
  }
  if (found.length === 1) {
    console.log(`  Found ${bold(found[0].label)}.\n`);
    return found;
  }
  const chosen = await choose(found);
  if (chosen) console.log("");
  return chosen;
}

async function remove({ yes, clientFlag }) {
  console.log(header());

  // Default to every agent we know, not every agent detected. "Uninstall
  // Skyelight" means everywhere, and asking which one to forget is a
  // question with no useful wrong answer.
  const targets = await pickTargets({
    clientFlag: clientFlag ?? "all",
    known: true,
  });
  if (!targets) {
    process.exitCode = 1;
    return;
  }

  const results = [];
  for (const client of targets) {
    results.push({
      client,
      outcome: await unregister(client, { yes, quiet: targets.length > 1 }),
    });
  }

  const removed = results.filter((r) => r.outcome === "removed");
  const skipped = results.filter((r) => r.outcome === "skipped");
  if (removed.length === 0) {
    // "Not registered anywhere" and "you declined every prompt" are
    // different facts, and saying the first when the second happened tells
    // somebody their agent is clean when it is not.
    console.log(
      skipped.length
        ? `\n  ${dim("Nothing was removed.")}\n`
        : `\n  ${dim("Skyelight was not registered anywhere.")}\n`,
    );
    return;
  }
  console.log("");
  for (const r of removed) {
    console.log(
      `  ${green(MARK.tick)} ${bold(r.client.label)} ${dim("— removed")}`,
    );
  }
  console.log(
    `\n${heading("Note")}\n    ${dim(MARK.dot)} Restart the agent for it to notice.`,
  );
  console.log(
    `    ${dim(MARK.dot)} Your sign-in is still valid; revoke it under Account ${MARK.arrow} API Keys\n      or in the agent's own OAuth settings.\n`,
  );
}

async function init({ yes, clientFlag }) {
  console.log(header(originLabel()));

  let config;
  try {
    config = await fetchConfig();
  } catch (err) {
    console.log(amber(`  Could not reach Skyelight: ${err.message}\n`));
    console.log(
      dim("  Point at another deployment with SKYELIGHT_URL=https://…\n"),
    );
    process.exitCode = 1;
    return;
  }

  const targets = await pickTargets({ clientFlag });
  if (!targets) {
    process.exitCode = 1;
    return;
  }

  const results = [];
  for (const client of targets) {
    const outcome = await register(client, config, {
      yes,
      quiet: targets.length > 1,
    });
    results.push({ client, outcome });
  }

  done(results);
}

function done(results) {
  const added = results.filter((r) => r.outcome === "added");
  const already = results.filter((r) => r.outcome === "already");
  const failed = results.filter((r) => r.outcome === "failed");

  if (added.length === 0 && already.length === 0) {
    if (failed.length) process.exitCode = 1;
    return;
  }

  console.log("");
  for (const r of [...added, ...already]) {
    console.log(`  ${green(MARK.tick)} ${bold(r.client.label)}`);
  }
  for (const r of failed) {
    console.log(
      `  ${amber(MARK.bullet)} ${bold(r.client.label)} ${dim("— not changed")}`,
    );
  }

  console.log(`\n${heading("Next")}`);
  console.log(
    `    ${dim(MARK.dot)} Restart ${added.length + already.length > 1 ? "them" : (added[0] ?? already[0]).client.label}, then ask for your Skyelight items.`,
  );
  console.log(
    `    ${dim(MARK.dot)} A browser opens to sign you in the first time.\n`,
  );

  if (failed.length) process.exitCode = 1;
}

function help() {
  console.log(header());
  console.log(
    `  ${dim("MCP server — your feedback, in your coding agent.")}\n`,
  );
  console.log(heading("Usage"));
  const usage = [
    ["npx @skyelight/mcp init", "set up your coding agent"],
    ["npx @skyelight/mcp init --client <id>", "skip the question"],
    ["npx @skyelight/mcp init --client all", "every agent on this machine"],
    ["npx @skyelight/mcp init --yes", "don't ask before writing"],
    ["npx @skyelight/mcp remove", "take it out of every agent"],
  ];
  const w = Math.max(...usage.map(([u]) => u.length));
  for (const [u, what] of usage) {
    console.log(`    ${bold(pad(u, w))}  ${dim(what)}`);
  }
  console.log("");
  console.log(heading("Agents"));
  listClients();
  console.log(heading("Environment"));
  const env = [
    ["SKYELIGHT_URL", `which deployment to register (${originLabel()})`],
    ["NO_COLOR", "plain output"],
  ];
  const ew = Math.max(...env.map(([n]) => n.length));
  for (const [n, what] of env) {
    console.log(`    ${bold(pad(n, ew))}  ${dim(what)}`);
  }
  console.log("");
  console.log(dim("  Running with no command starts the stdio server.\n"));
}

const argv = process.argv.slice(2);
const cmd = argv[0];

const yes = argv.includes("--yes") || argv.includes("-y");
const at = argv.indexOf("--client");
const clientFlag = at === -1 ? null : argv[at + 1];

if (cmd === "init") {
  await init({ yes, clientFlag });
} else if (cmd === "remove" || cmd === "uninstall") {
  await remove({ yes, clientFlag });
} else {
  help();
}
