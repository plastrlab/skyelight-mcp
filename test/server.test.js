import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  createServer,
  PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
  negotiateProtocolVersion,
} from "../src/server.js";
import { createClient, ApiError } from "../src/client.js";
import { readFileSync } from "node:fs";
import { renderList, renderItem, renderWorkspaces } from "../src/tools.js";
import { imageBlocksFor } from "../src/images.js";
import { VERSION } from "../src/version.js";
import { parseDotenv, resolveConfig, ConfigError } from "../src/config.js";
import {
  ITEM_CARD_URI,
  MCP_APP_MIME_TYPE,
  UI_EXTENSION_KEY,
  clientSupportsUi,
} from "../src/itemCard.js";

const LIST_FIXTURE = {
  project: { id: "p1", name: "Alpha", slug: "alpha" },
  summary: {
    total: 12,
    open: 9,
    resolved: 3,
    unassigned: 7,
    byType: { bug: 7, idea: 4, feedback: 1 },
    byPage: { "/checkout": 8, "/settings": 4 },
  },
  matched: 2,
  returned: 2,
  truncated: false,
  items: [
    {
      id: "i1",
      page: "/checkout",
      type: "bug",
      status: "open",
      excerpt: "The pay button does nothing on the second click",
      author: "Dana",
      assignee: null,
      assigneeId: null,
      replyCount: 2,
      createdAt: 1,
    },
    {
      id: "i2",
      page: "/settings",
      type: "idea",
      status: "resolved",
      excerpt: "Let me rename a workspace",
      author: "Ash",
      assignee: "Dev Person",
      assigneeId: "u2",
      replyCount: 0,
      createdAt: 2,
    },
  ],
};

const ITEM_FIXTURE = {
  id: "i1",
  project: {
    id: "p1",
    name: "Alpha",
    repo: {
      url: "https://github.com/acme/web",
      branch: "develop",
      pathPrefix: "apps/web",
    },
  },
  page: "/checkout",
  url: "https://app.example.com/checkout",
  type: "bug",
  status: "open",
  assignee: null,
  thread: {
    root: {
      author: "Dana",
      content: "The pay button does nothing",
      createdAt: 1,
    },
    replies: [{ author: "Ash", content: "Confirmed on Safari", createdAt: 2 }],
  },
  anchor: {
    selector: "#pay",
    elementText: "Pay now",
    selectedText: null,
    viewport: { width: 1440, height: 900, x: 1, y: 2 },
  },
};

/** A client whose calls are recorded and whose answers are canned. */
function fakeClient(responses = {}) {
  const calls = [];
  return {
    calls,
    listItems: async (params) => {
      calls.push(["listItems", params]);
      if (responses.listItems instanceof Error) throw responses.listItems;
      return responses.listItems ?? LIST_FIXTURE;
    },
    getItem: async (id) => {
      calls.push(["getItem", id]);
      if (responses.getItem instanceof Error) throw responses.getItem;
      return responses.getItem ?? ITEM_FIXTURE;
    },
    postUpdate: async (body) => {
      calls.push(["postUpdate", body]);
      if (responses.postUpdate instanceof Error) throw responses.postUpdate;
      return responses.postUpdate ?? { pinId: "p1", postedAs: "agent:cursor" };
    },
    createItem: async (body) => {
      calls.push(["createItem", body]);
      if (responses.createItem instanceof Error) throw responses.createItem;
      return responses.createItem ?? { pinId: "p2", postedAs: "agent:cursor" };
    },
    listMembers: async (params) => {
      calls.push(["listMembers", params]);
      return (
        responses.listMembers ?? {
          workspace: { id: "w1", name: "Acme" },
          members: [
            {
              id: "u1",
              name: "Churry Lane",
              email: "c@x.dev",
              role: "collaborator",
            },
          ],
        }
      );
    },
    assign: async (body) => {
      calls.push(["assign", body]);
      return responses.assign ?? { assignedTo: "Churry Lane", changed: true };
    },
    setStatus: async (body) => {
      calls.push(["setStatus", body]);
      if (responses.setStatus instanceof Error) throw responses.setStatus;
      return responses.setStatus ?? { changed: true, status: body.status };
    },
    /** What `get_item` pulls pictures with. */
    fetchImpl:
      responses.fetchImpl ?? (async () => ({ ok: false, status: 404 })),
  };
}

/**
 * A fetch that serves a fixed set of URLs as images.
 *
 * Only the three things `images.js` touches — `ok`, `headers.get` and
 * `arrayBuffer` — because standing up a real Response here would test the
 * runtime rather than the code.
 */
function imageFetch(byUrl) {
  return async (url) => {
    const hit = byUrl[url];
    if (!hit) return { ok: false, status: 404 };
    return {
      ok: true,
      status: 200,
      headers: {
        get: (h) => (h.toLowerCase() === "content-type" ? hit.type : null),
      },
      arrayBuffer: async () => hit.bytes.buffer,
    };
  };
}

const rpc = (server, method, params, id = 1) =>
  server.handle({ jsonrpc: "2.0", id, method, params });

describe("protocol", () => {
  test("initialize announces tools", async () => {
    const server = createServer({ client: fakeClient(), config: {} });
    const res = await rpc(server, "initialize", {});
    assert.ok(res.result.capabilities.tools);
    assert.match(res.result.instructions, /feedback/i);
  });

  // Answering with our own newest instead of the client's is a hard failure
  // on the client, not a downgrade: Claude Code 2.1.x asks for 2025-11-25
  // and refuses a server that replies 2026-07-28 outright.
  test("initialize echoes the client's protocol version", async () => {
    const server = createServer({ client: fakeClient(), config: {} });
    for (const v of SUPPORTED_PROTOCOL_VERSIONS) {
      const res = await rpc(server, "initialize", { protocolVersion: v });
      assert.equal(res.result.protocolVersion, v, `should echo ${v}`);
    }
  });

  test("the version Claude Code actually asks for is supported", () => {
    assert.ok(SUPPORTED_PROTOCOL_VERSIONS.includes("2025-11-25"));
  });

  test("an unknown version falls back to our newest", async () => {
    const server = createServer({ client: fakeClient(), config: {} });
    const res = await rpc(server, "initialize", {
      protocolVersion: "1999-01-01",
    });
    assert.equal(res.result.protocolVersion, PROTOCOL_VERSION);
  });

  test("a client that sends no version gets our newest", () => {
    assert.equal(negotiateProtocolVersion(undefined), PROTOCOL_VERSION);
  });

  test("tools/list offers exactly the tools we mean to offer", async () => {
    // Exhaustive on purpose: a tool appearing here that nobody meant to ship
    // is a capability handed to every model on every client.
    const server = createServer({ client: fakeClient(), config: {} });
    const res = await rpc(server, "tools/list", {});
    assert.deepEqual(res.result.tools.map((t) => t.name).sort(), [
      "assign",
      "create_item",
      "decision_log",
      "find_by_source",
      "find_similar",
      "get_item",
      "list_items",
      "list_members",
      "list_projects",
      "list_workspaces",
      "merge_items",
      "post_update",
      "project_review",
      "publish_review_link",
      "save_rule",
      "search_items",
      "set_status",
      "whats_new",
    ]);
  });

  test("every tool declares an input schema", async () => {
    const server = createServer({ client: fakeClient(), config: {} });
    const res = await rpc(server, "tools/list", {});
    for (const t of res.result.tools) {
      assert.equal(t.inputSchema.type, "object", `${t.name} schema`);
      assert.ok(t.description.length > 20, `${t.name} description`);
    }
  });

  // A notification carries no id and must produce no reply. Answering one
  // desynchronises a client that is not expecting a message.
  test("notifications get no response", async () => {
    const server = createServer({ client: fakeClient(), config: {} });
    assert.equal(
      await server.handle({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
      null,
    );
  });

  test("an unknown method is an error, not a crash", async () => {
    const server = createServer({ client: fakeClient(), config: {} });
    const res = await rpc(server, "prompts/list", {});
    assert.equal(res.error.code, -32601);
  });

  test("ping answers", async () => {
    const server = createServer({ client: fakeClient(), config: {} });
    assert.deepEqual((await rpc(server, "ping", {})).result, {});
  });
});

describe("tools/call", () => {
  test("list_items falls back to the bound project", async () => {
    const client = fakeClient();
    const server = createServer({ client, config: { projectId: "p_bound" } });
    await rpc(server, "tools/call", { name: "list_items", arguments: {} });
    assert.equal(client.calls[0][1].projectId, "p_bound");
  });

  test("an explicit projectId wins over the bound one", async () => {
    const client = fakeClient();
    const server = createServer({ client, config: { projectId: "p_bound" } });
    await rpc(server, "tools/call", {
      name: "list_items",
      arguments: { projectId: "p_explicit" },
    });
    assert.equal(client.calls[0][1].projectId, "p_explicit");
  });

  test("search_items maps query onto q", async () => {
    const client = fakeClient();
    const server = createServer({ client, config: {} });
    await rpc(server, "tools/call", {
      name: "search_items",
      arguments: { query: "stripe" },
    });
    assert.equal(client.calls[0][1].q, "stripe");
  });

  test("results carry both prose and structured data", async () => {
    const server = createServer({ client: fakeClient(), config: {} });
    const res = await rpc(server, "tools/call", {
      name: "list_items",
      arguments: {},
    });
    assert.equal(res.result.content[0].type, "text");
    assert.equal(res.result.structuredContent.summary.total, 12);
  });

  // A failed call is a result with isError, not a JSON-RPC error: the model
  // needs to read what went wrong and adjust.
  test("an API failure comes back as an error result, not a protocol error", async () => {
    const server = createServer({
      client: fakeClient({
        listItems: new ApiError("This key acts as reviewer", 403),
      }),
      config: {},
    });
    const res = await rpc(server, "tools/call", {
      name: "list_items",
      arguments: {},
    });
    assert.equal(res.error, undefined);
    assert.equal(res.result.isError, true);
    assert.match(res.result.content[0].text, /Not permitted.*reviewer/);
  });

  test("a revoked key says so in words", async () => {
    const server = createServer({
      client: fakeClient({
        listItems: new ApiError("Invalid or revoked token", 401),
      }),
      config: {},
    });
    const res = await rpc(server, "tools/call", {
      name: "list_items",
      arguments: {},
    });
    assert.match(res.result.content[0].text, /revoked/);
  });

  test("an unknown tool is an error result", async () => {
    const server = createServer({ client: fakeClient(), config: {} });
    const res = await rpc(server, "tools/call", {
      name: "delete_everything",
      arguments: {},
    });
    assert.equal(res.result.isError, true);
  });
});

describe("narration", () => {
  // The whole point: a model should be able to read this out. If it renders
  // as JSON, a model dumps JSON.
  test("a list leads with the shape of the project, not the rows", () => {
    const text = renderList(LIST_FIXTURE);
    const firstLine = text.split("\n")[0];
    assert.match(firstLine, /Alpha: 12 items total/);
    assert.match(firstLine, /9 open/);
    assert.match(text, /By type: bug \(7\)/);
    assert.match(text, /Busiest pages: \/checkout \(8\)/);
  });

  test("rows read as sentences and carry their id", () => {
    const text = renderList(LIST_FIXTURE);
    assert.match(
      text,
      /bug · open · \/checkout · unassigned · 2 replies — id i1/,
    );
    assert.match(
      text,
      /idea · resolved · \/settings · assigned to Dev Person — id i2/,
    );
  });

  test("truncation asks the model to narrow rather than page", () => {
    const text = renderList({ ...LIST_FIXTURE, truncated: true, matched: 40 });
    assert.match(text, /Showing 2 of 40 matches — narrow the filters/);
  });

  test("an empty search says what was searched for", () => {
    const text = renderList(
      { ...LIST_FIXTURE, items: [], matched: 0 },
      { searched: "stripe" },
    );
    assert.match(text, /Nothing matched "stripe"/);
  });

  test("singulars are not '1 replies'", () => {
    const text = renderList({
      ...LIST_FIXTURE,
      items: [{ ...LIST_FIXTURE.items[0], replyCount: 1 }],
    });
    assert.match(text, /1 reply/);
    assert.doesNotMatch(text, /1 replies/);
  });

  test("an item leads with the element's visible text", () => {
    const text = renderItem(ITEM_FIXTURE);
    assert.match(text, /They were pointing at:/);
    const pointingAt = text.slice(text.indexOf("They were pointing at:"));
    assert.ok(
      pointingAt.indexOf('reading "Pay now"') < pointingAt.indexOf("selector:"),
      "visible text should come before the selector",
    );
  });

  test("an item includes the whole thread in order", () => {
    const text = renderItem(ITEM_FIXTURE);
    assert.ok(text.indexOf("Dana wrote") < text.indexOf("Ash: Confirmed"));
  });

  /**
   * The source path.
   *
   * The stamps have always been captured on ancestors and descendants; only
   * the target's was ever rendered. The element a person points at is often
   * not the element anyone edits — a row is clicked when the text inside it
   * is meant — so the parts are what make the pin actionable.
   */
  const WITH_PATH = {
    ...ITEM_FIXTURE,
    source: {
      file: "components/today/today-plan.tsx",
      line: 90,
      build: "26e0ea7",
      branch: "main",
    },
    sourceUrl:
      "https://github.com/acme/marrow/blob/26e0ea7/components/today/today-plan.tsx#L90",
    sourcePath: {
      above: [
        { file: "app/page.tsx", line: 31, tag: "div" },
        { file: "components/ui/card.tsx", line: 10, tag: "div" },
      ],
      target: { file: "components/today/today-plan.tsx", line: 90, tag: "li" },
      below: [
        {
          file: "components/today/today-plan.tsx",
          line: 91,
          tag: "button",
          depth: 0,
        },
        { file: "components/ui/icon.tsx", line: 289, tag: "svg", depth: 1 },
        {
          file: "components/today/today-plan.tsx",
          line: 125,
          tag: "span",
          depth: 0,
          text: "Taken 6:31 AM",
        },
      ],
    },
  };

  test("an item names what wrapped the element and what it contains", () => {
    const text = renderItem(WITH_PATH);
    assert.match(text, /Nested inside/);
    assert.match(text, /components\/ui\/card\.tsx:10/);
    assert.match(text, /Contains/);
    assert.match(text, /components\/ui\/icon\.tsx:289/);
  });

  test("a contained node carries the text that identifies it", () => {
    assert.match(renderItem(WITH_PATH), /<span> .*:125 {2}"Taken 6:31 AM"/);
  });

  test("depth is shown as indentation, so the tree reads as a tree", () => {
    const line = renderItem(WITH_PATH)
      .split("\n")
      .find((l) => l.includes("icon.tsx:289"));
    const button = renderItem(WITH_PATH)
      .split("\n")
      .find((l) => l.includes("today-plan.tsx:91"));
    assert.ok(
      line.length - line.trimStart().length >
        button.length - button.trimStart().length,
      "a child should be indented further than its parent",
    );
  });

  test("the permalink follows the source line", () => {
    const text = renderItem(WITH_PATH);
    assert.ok(
      text.indexOf("Written by components/today") <
        text.indexOf("https://github.com/acme/marrow/blob"),
    );
  });

  test("an item with no stamps says nothing about paths", () => {
    const text = renderItem(ITEM_FIXTURE);
    assert.doesNotMatch(text, /Nested inside/);
    assert.doesNotMatch(text, /Contains/);
  });

  test("a project with no repository produces no link", () => {
    const text = renderItem({ ...WITH_PATH, sourceUrl: null });
    assert.doesNotMatch(text, /github\.com\/acme\/marrow\/blob/);
    assert.match(text, /Written by components\/today/);
  });
});

describe("config", () => {
  test("parses env files with quotes and comments", () => {
    const parsed = parseDotenv(
      [
        "# comment",
        'SKYELIGHT_API_TOKEN="sk_live_x"',
        "SKYELIGHT_API_URL='https://a.b'",
        "BARE=1",
      ].join("\n"),
    );
    assert.equal(parsed.SKYELIGHT_API_TOKEN, "sk_live_x");
    assert.equal(parsed.SKYELIGHT_API_URL, "https://a.b");
    assert.equal(parsed.BARE, "1");
  });

  test("env vars win and trailing slashes are trimmed", () => {
    const cfg = resolveConfig({
      cwd: "/nonexistent-dir-for-test",
      home: "/nonexistent-home-for-test",
      env: {
        SKYELIGHT_API_TOKEN: "sk_live_env",
        SKYELIGHT_API_URL: "https://x.convex.site/",
      },
    });
    assert.equal(cfg.token, "sk_live_env");
    assert.equal(cfg.apiUrl, "https://x.convex.site");
  });

  test("missing credentials explain how to get some", () => {
    assert.throws(
      () =>
        resolveConfig({
          cwd: "/nonexistent-dir-for-test",
          home: "/nonexistent-home-for-test",
          env: {},
        }),
      // Points at the only credential that exists. It used to name workspace
      // API keys, which would now send somebody to mint a token the API
      // refuses.
      (err) => err instanceof ConfigError && /API Keys/.test(err.message),
    );
  });
});

describe("client", () => {
  test("sends the bearer token and drops empty params", async () => {
    let seen;
    const client = createClient({
      apiUrl: "https://x.convex.site",
      token: "sk_live_1",
      fetchImpl: async (url, init) => {
        seen = { url, init };
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });
    await client.listItems({ projectId: "p1", page: undefined, type: "" });
    assert.equal(seen.init.headers.Authorization, "Bearer sk_live_1");
    assert.ok(seen.url.includes("projectId=p1"));
    assert.ok(!seen.url.includes("page="));
    assert.ok(!seen.url.includes("type="));
  });

  test("surfaces the API's own error message", async () => {
    const client = createClient({
      apiUrl: "https://x.convex.site",
      token: "t",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({ error: "Not found in this key's scope" }),
          {
            status: 404,
          },
        ),
    });
    await assert.rejects(client.getItem("i1"), /Not found in this key's scope/);
  });

  test("an unreachable host names the host", async () => {
    const client = createClient({
      apiUrl: "https://x.convex.site",
      token: "t",
      fetchImpl: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    await assert.rejects(
      client.listItems({}),
      /Could not reach https:\/\/x.convex.site/,
    );
  });
});

describe("people (SKY-324)", () => {
  test("list_members reads the roster and names each person", async () => {
    const client = fakeClient();
    const server = createServer({ client, config: { projectId: "proj1" } });
    const res = await rpc(server, "tools/call", {
      name: "list_members",
      arguments: {},
    });
    assert.deepEqual(client.calls[0], [
      "listMembers",
      { projectId: "proj1", workspaceId: undefined },
    ]);
    assert.match(
      res.result.content[0].text,
      /Churry Lane <c@x.dev>, collaborator \(id u1\)/,
    );
  });

  test("assign passes the person through, and null unassigns", async () => {
    const client = fakeClient();
    const server = createServer({ client, config: {} });
    const res = await rpc(server, "tools/call", {
      name: "assign",
      arguments: { itemId: "i1", assignee: "Churry" },
    });
    assert.deepEqual(client.calls[0], [
      "assign",
      { itemId: "i1", assignee: "Churry" },
    ]);
    assert.match(res.result.content[0].text, /Assigned to Churry Lane/);
    await rpc(server, "tools/call", {
      name: "assign",
      arguments: { itemId: "i1", assignee: null },
    });
    assert.deepEqual(client.calls[1], [
      "assign",
      { itemId: "i1", assignee: null },
    ]);
  });

  test("create_item carries mentions and the assignee", async () => {
    const client = fakeClient();
    const server = createServer({ client, config: {} });
    await rpc(server, "tools/call", {
      name: "create_item",
      arguments: {
        url: "https://a.dev/",
        body: "@Churry look",
        mentions: ["Churry"],
        assignee: "Churry",
      },
    });
    assert.equal(client.calls[0][0], "createItem");
    assert.deepEqual(client.calls[0][1].mentions, ["Churry"]);
    assert.equal(client.calls[0][1].assignee, "Churry");
  });
});

describe("write tools", () => {
  test("post_update carries the body and links through", async () => {
    const client = fakeClient();
    const server = createServer({ client, config: {} });
    await rpc(server, "tools/call", {
      name: "post_update",
      arguments: {
        itemId: "i1",
        body: "Fixed",
        links: [{ label: "PR", url: "https://example.com/1" }],
      },
    });
    assert.deepEqual(client.calls[0], [
      "postUpdate",
      {
        itemId: "i1",
        body: "Fixed",
        links: [{ label: "PR", url: "https://example.com/1" }],
      },
    ]);
  });

  test("post_update refuses an empty body before calling the API", async () => {
    const client = fakeClient();
    const server = createServer({ client, config: {} });
    const res = await rpc(server, "tools/call", {
      name: "post_update",
      arguments: { itemId: "i1", body: "   " },
    });
    assert.equal(res.result.isError, true);
    assert.equal(client.calls.length, 0, "should not have hit the API");
  });

  test("create_item falls back to the bound project", async () => {
    const client = fakeClient();
    const server = createServer({ client, config: { projectId: "p_bound" } });
    await rpc(server, "tools/call", {
      name: "create_item",
      arguments: { url: "https://x.test/a", body: "finding" },
    });
    assert.equal(client.calls[0][1].projectId, "p_bound");
  });

  test("create_item needs a url", async () => {
    const client = fakeClient();
    const server = createServer({ client, config: {} });
    const res = await rpc(server, "tools/call", {
      name: "create_item",
      arguments: { body: "finding" },
    });
    assert.equal(res.result.isError, true);
    assert.equal(client.calls.length, 0);
  });

  // A person's key gets a refusal naming its role, so the model learns why
  // rather than wondering where the tool went.
  test("a non-agent key gets a readable refusal", async () => {
    const server = createServer({
      client: fakeClient({
        postUpdate: new ApiError(
          "post_update requires a key issued to an agent. This key acts as admin.",
          403,
        ),
      }),
      config: {},
    });
    const res = await rpc(server, "tools/call", {
      name: "post_update",
      arguments: { itemId: "i1", body: "x" },
    });
    assert.equal(res.result.isError, true);
    assert.match(res.result.content[0].text, /issued to an agent/);
  });

  // Deliberately absent: an agent marking its own work done removes the
  // human review step that makes agent output trustworthy.
  test("there is no resolve tool", async () => {
    const server = createServer({ client: fakeClient(), config: {} });
    const res = await rpc(server, "tools/list", {});
    const names = res.result.tools.map((t) => t.name);
    assert.ok(!names.some((n) => /resolve|close|done/.test(n)));
  });
});

describe("MCP Apps capability (SKY-279)", () => {
  const UI_CAPS = {
    extensions: { [UI_EXTENSION_KEY]: { mimeTypes: [MCP_APP_MIME_TYPE] } },
  };

  test("recognises a client that declares the extension", () => {
    assert.equal(clientSupportsUi(UI_CAPS), true);
    assert.equal(
      clientSupportsUi({ extensions: { [UI_EXTENSION_KEY]: {} } }),
      true,
      "declaring the extension with no mimeTypes is taken at its word",
    );
  });

  test("a client that says nothing gets no card", () => {
    assert.equal(clientSupportsUi(undefined), false);
    assert.equal(clientSupportsUi({}), false);
    assert.equal(clientSupportsUi({ extensions: {} }), false);
    assert.equal(
      clientSupportsUi({
        extensions: { [UI_EXTENSION_KEY]: { mimeTypes: ["image/png"] } },
      }),
      false,
      "declares the extension but cannot render html",
    );
  });

  // Claude Code has no iframe. The text result is complete on its own, so
  // the card is strictly additive and its absence costs nothing.
  test("without the capability, get_item carries no ui pointer", async () => {
    const server = createServer({ client: fakeClient(), config: {} });
    await rpc(server, "initialize", { capabilities: {} });
    const res = await rpc(server, "tools/list", {});
    const getItem = res.result.tools.find((t) => t.name === "get_item");
    assert.equal(getItem._meta?.ui, undefined);
  });

  test("with the capability, get_item points at the card", async () => {
    const server = createServer({ client: fakeClient(), config: {} });
    await rpc(server, "initialize", { capabilities: UI_CAPS });
    const res = await rpc(server, "tools/list", {});
    const getItem = res.result.tools.find((t) => t.name === "get_item");
    assert.equal(getItem._meta.ui.resourceUri, ITEM_CARD_URI);
    // The card calls post_update back through the host, so it must be
    // visible to the app and not only to the model.
    assert.deepEqual(getItem._meta.ui.visibility, ["model", "app"]);
  });

  test("the card is offered regardless — only the pointer is gated", async () => {
    const server = createServer({ client: fakeClient(), config: {} });
    await rpc(server, "initialize", { capabilities: {} });
    const res = await rpc(server, "resources/list", {});
    assert.equal(res.result.resources[0].uri, ITEM_CARD_URI);
    assert.equal(res.result.resources[0].mimeType, MCP_APP_MIME_TYPE);
  });
});

describe("the card resource", () => {
  test("reads back as a self-contained html document", async () => {
    const server = createServer({ client: fakeClient(), config: {} });
    const res = await rpc(server, "resources/read", { uri: ITEM_CARD_URI });
    const doc = res.result.contents[0];
    assert.equal(doc.mimeType, MCP_APP_MIME_TYPE);
    assert.match(doc.text, /^<!DOCTYPE html>/);
    // No external loads at all — which is why every CSP list can be empty.
    assert.ok(!/<script[^>]+src=/i.test(doc.text), "no external scripts");
    assert.ok(!/<link[^>]+stylesheet/i.test(doc.text), "no external styles");
  });

  test("declares an empty CSP, because nothing external is loaded", async () => {
    const server = createServer({ client: fakeClient(), config: {} });
    const res = await rpc(server, "resources/read", { uri: ITEM_CARD_URI });
    const csp = res.result.contents[0]._meta.ui.csp;
    assert.deepEqual(csp.connectDomains, []);
    assert.deepEqual(csp.resourceDomains, []);
    assert.deepEqual(csp.frameDomains, []);
  });

  test("performs the ui/initialize handshake and calls tools by name", async () => {
    const server = createServer({ client: fakeClient(), config: {} });
    const res = await rpc(server, "resources/read", { uri: ITEM_CARD_URI });
    const html = res.result.contents[0].text;
    assert.match(html, /ui\/initialize/);
    assert.match(html, /ui\/notifications\/tool-result/);
    assert.match(html, /"post_update"/);
  });

  test("an unknown resource uri is a parameter error", async () => {
    const server = createServer({ client: fakeClient(), config: {} });
    const res = await rpc(server, "resources/read", { uri: "ui://nope" });
    assert.equal(res.error.code, -32602);
  });
});

describe("repo binding in the work order (SKY-281)", () => {
  test("states where the code lives, early and plainly", () => {
    const text = renderItem(ITEM_FIXTURE);
    assert.match(text, /Code: https:\/\/github.com\/acme\/web$/m);
    // Before the thread: an agent should know what to clone before it starts
    // reading about the problem.
    assert.ok(text.indexOf("Code:") < text.indexOf("wrote:"));
  });

  /**
   * The repository, and deliberately nothing else.
   *
   * A branch and a monorepo prefix used to be stated here. Neither was ours
   * to state: an agent reading this is sitting in a checkout, on a branch,
   * and its own `git branch --show-current` beats anything a settings field
   * could hold. The branch the *page* came from is a different fact, and it
   * is on the source line — see the suite below.
   */
  test("does not tell the agent which branch to work on", () => {
    const text = renderItem(ITEM_FIXTURE);
    const codeLine = text.split("\n").find((l) => l.startsWith("Code:"));
    assert.ok(!codeLine.includes("branch"));
    assert.ok(!codeLine.includes("under"));
  });

  test("says nothing at all when no repo is bound", () => {
    const text = renderItem({
      ...ITEM_FIXTURE,
      project: { id: "p1", name: "Alpha", repo: null },
    });
    assert.ok(!text.includes("Code:"));
  });

  // Fields a stale caller might still send are ignored rather than rendered.
  test("ignores a branch and prefix an old payload still carries", () => {
    const text = renderItem({
      ...ITEM_FIXTURE,
      project: {
        id: "p1",
        name: "Alpha",
        repo: {
          url: "https://github.com/acme/web",
          branch: "develop",
          pathPrefix: "apps/web",
        },
      },
    });
    assert.match(text, /Code: https:\/\/github.com\/acme\/web$/m);
  });
});

describe("the source stamp in the work order", () => {
  test("names the file and line, so the agent opens rather than searches", () => {
    const text = renderItem({
      ...ITEM_FIXTURE,
      source: { file: "components/PricingCard.tsx", line: 88 },
    });
    assert.match(text, /Written by components\/PricingCard\.tsx, line 88\./);
  });

  test("names the build the page was made by", async () => {
    // Which commit was on the screen is the difference between a live bug
    // and a pin about something already shipped.
    const text = renderItem({
      ...ITEM_FIXTURE,
      source: { file: "components/Card.tsx", line: 12, build: "a1b2c3d" },
    });
    assert.match(
      text,
      /Written by components\/Card\.tsx, line 12, in build a1b2c3d\./,
    );
  });

  test("names the branch as well, when the page was a preview", async () => {
    const text = renderItem({
      ...ITEM_FIXTURE,
      source: {
        file: "components/Card.tsx",
        line: 12,
        build: "a1b2c3d",
        branch: "feat/checkout",
      },
    });
    assert.match(text, /in build a1b2c3d on branch feat\/checkout\./);
  });

  test("names the branch alone when there is no build", async () => {
    const text = renderItem({
      ...ITEM_FIXTURE,
      source: { file: "components/Card.tsx", line: null, branch: "main" },
    });
    assert.match(text, /Written by components\/Card\.tsx, in branch main\./);
  });

  test("names the file alone when there is no line", () => {
    const text = renderItem({
      ...ITEM_FIXTURE,
      source: { file: "components/PricingCard.tsx", line: null },
    });
    assert.match(text, /Written by components\/PricingCard\.tsx\./);
    assert.ok(!text.includes("line"));
  });

  test("says nothing when the build did not stamp it", () => {
    // Silence rather than "source: unknown" — a line stating an absence is a
    // line the model has to read and cannot act on.
    const text = renderItem({ ...ITEM_FIXTURE, source: null });
    assert.ok(!text.includes("Written by"));
  });

  test("says nothing for an item payload that predates the field", () => {
    const text = renderItem(ITEM_FIXTURE);
    assert.ok(!text.includes("Written by"));
  });

  test("comes after the anchor — the page first, then the file", () => {
    const text = renderItem({
      ...ITEM_FIXTURE,
      source: { file: "components/PricingCard.tsx", line: 88 },
    });
    assert.ok(text.indexOf("selector:") < text.indexOf("Written by"));
  });
});

/**
 * Phase 0 — what the narration had stopped saying, or never said.
 *
 * Each of these is a fact the web app has shown a person for months and the
 * tool result did not carry: that several reports are one problem, that the
 * counts are a floor, that somebody already handed this to Linear, that there
 * is a picture.
 */
describe("the version everything reports", () => {
  test("initialize reports the version this package ships", async () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );
    // The literal here and the one in package.json are the pair that drifted:
    // `0.1.0` was announced for two releases after the package moved on.
    assert.equal(VERSION, pkg.version);

    const server = createServer({ client: fakeClient(), config: {} });
    const res = await rpc(server, "initialize", {});
    assert.equal(res.result.serverInfo.version, pkg.version);
  });
});

describe("who you are", () => {
  test("renderWorkspaces leads with the caller's own id", () => {
    const text = renderWorkspaces({
      total: 1,
      you: { id: "user_abc", name: "Cory" },
      workspaces: [{ id: "w1", name: "Acme", role: "owner", projectCount: 2 }],
    });
    assert.match(text, /You are Cory — user_abc\./);
    // And says what it is for, which is the whole reason it is here.
    assert.match(text, /"me" as assignee/);
  });

  test("a credential with no person says nothing about one", () => {
    const text = renderWorkspaces({
      total: 1,
      you: null,
      workspaces: [{ id: "w1", name: "Acme", role: "owner", projectCount: 2 }],
    });
    assert.doesNotMatch(text, /You are/);
  });
});

describe("merged duplicates in the narration", () => {
  test("a row says how many people reported it, past one", () => {
    const text = renderList({
      ...LIST_FIXTURE,
      items: [
        { ...LIST_FIXTURE.items[0], reportCount: 9 },
        { ...LIST_FIXTURE.items[1], reportCount: 1 },
      ],
    });
    assert.match(text, /9 reports/);
    // Silent at one: a list where every line ends "1 report" has spent its
    // width saying nothing.
    assert.doesNotMatch(text, /1 reports?\b/);
  });

  test("a merged item tells the reader to go work the other one", () => {
    const text = renderItem({
      ...ITEM_FIXTURE,
      reportCount: 1,
      duplicateOf: "i9",
    });
    assert.match(text, /Merged as a duplicate of item i9/);
  });

  test("the canonical item counts its reporters", () => {
    const text = renderItem({ ...ITEM_FIXTURE, reportCount: 5 });
    assert.match(text, /5 people reported this \(4 merged into it\)/);
  });
});

describe("the scan ceiling", () => {
  test("a capped list says its counts are a floor", () => {
    const text = renderList({ ...LIST_FIXTURE, capped: true, scanLimit: 2000 });
    assert.match(text, /floor, not a total/);
    assert.match(text, /2,000 most recent/);
  });

  test("an uncapped list says nothing about it", () => {
    assert.doesNotMatch(renderList(LIST_FIXTURE), /floor/);
  });
});

describe("work somebody else already started", () => {
  test("a Linear issue is named before the thread", () => {
    const text = renderItem({
      ...ITEM_FIXTURE,
      linear: [
        {
          identifier: "ENG-412",
          url: "https://linear.app/acme/issue/ENG-412",
          delegateName: "Linear Agent",
          delegatedMode: "fix",
        },
      ],
    });
    assert.match(
      text,
      /Linear: ENG-412 — handed to Linear Agent, asked to fix\./,
    );
    assert.ok(
      text.indexOf("ENG-412") < text.indexOf("Dana wrote:"),
      "the reader should learn this before reading the thread",
    );
  });

  test("an item nobody handed over says nothing", () => {
    assert.doesNotMatch(renderItem({ ...ITEM_FIXTURE, linear: [] }), /Linear/);
  });
});

describe("reactions", () => {
  test("counted, not listed", () => {
    const text = renderItem({
      ...ITEM_FIXTURE,
      reactions: [
        { emoji: "\u{1F44D}", count: 9, names: ["Dana"] },
        { emoji: "\u{1F389}", count: 1, names: ["Ash"] },
      ],
    });
    assert.match(text, /Reactions: \u{1F44D} 9, \u{1F389} 1\./u);
  });
});

describe("pictures, as pictures", () => {
  const withPictures = {
    ...ITEM_FIXTURE,
    evidence: { screenshotUrl: "https://storage.example/shot.jpg" },
    attachments: [
      {
        url: "https://storage.example/one.png",
        author: "Ash",
        where: "reply",
      },
    ],
  };
  const bytes = new Uint8Array([137, 80, 78, 71]);

  test("get_item returns image blocks after its text", async () => {
    const server = createServer({
      client: fakeClient({
        getItem: withPictures,
        fetchImpl: imageFetch({
          "https://storage.example/shot.jpg": { type: "image/jpeg", bytes },
          "https://storage.example/one.png": { type: "image/png", bytes },
        }),
      }),
      config: {},
    });

    const res = await rpc(server, "tools/call", {
      name: "get_item",
      arguments: { itemId: "i1" },
    });
    const content = res.result.content;

    assert.equal(content[0].type, "text");
    const images = content.filter((b) => b.type === "image");
    assert.equal(images.length, 2);
    assert.equal(images[0].mimeType, "image/jpeg");
    assert.equal(images[1].mimeType, "image/png");
    // Base64 of the bytes handed over, not a link to them.
    assert.equal(images[0].data, Buffer.from(bytes).toString("base64"));

    // Each is introduced, so four pictures of one application are not four
    // things the reader has to work out.
    const labels = content.filter((b) => b.type === "text").map((b) => b.text);
    assert.ok(labels.some((l) => /page when this was pinned/.test(l)));
    assert.ok(labels.some((l) => /Attached by Ash, on a reply/.test(l)));
  });

  test("the text says the picture is below rather than printing its link", () => {
    const text = renderItem(withPictures);
    assert.match(
      text,
      /Screenshot of the page when this was pinned: attached below\./,
    );
    assert.doesNotMatch(text, /https:\/\/storage\.example/);
    assert.match(text, /1 image attached to this thread: also below\./);
  });

  test("an expired bundle still says why there is nothing to see", () => {
    const text = renderItem({
      ...ITEM_FIXTURE,
      evidence: { screenshotUrl: null, expired: true },
    });
    assert.match(text, /expired and deleted/);
  });

  test("a picture that will not load comes back as a link and a reason", async () => {
    const blocks = await imageBlocksFor(withPictures, {
      fetchImpl: imageFetch({}),
    });
    assert.equal(blocks.filter((b) => b.type === "image").length, 0);
    const note = blocks[blocks.length - 1].text;
    assert.match(note, /https:\/\/storage\.example\/shot\.jpg/);
    assert.match(note, /could not be fetched \(404\)/);
  });

  test("an oversized image is named, not inlined", async () => {
    const blocks = await imageBlocksFor(
      { evidence: { screenshotUrl: "https://storage.example/huge.jpg" } },
      {
        fetchImpl: imageFetch({
          "https://storage.example/huge.jpg": {
            type: "image/jpeg",
            bytes: new Uint8Array(64),
          },
        }),
        maxBytes: 16,
      },
    );
    assert.equal(blocks.filter((b) => b.type === "image").length, 0);
    assert.match(blocks[0].text, /over the .*limit for an inline image/);
  });

  test("a thread full of pictures is capped, and says so", async () => {
    const urls = {};
    const attachments = [];
    for (let i = 0; i < 6; i += 1) {
      const url = `https://storage.example/${i}.png`;
      urls[url] = { type: "image/png", bytes };
      attachments.push({ url, author: "Ash", where: "thread" });
    }
    const blocks = await imageBlocksFor(
      { attachments },
      { fetchImpl: imageFetch(urls), maxImages: 4 },
    );
    assert.equal(blocks.filter((b) => b.type === "image").length, 4);
    assert.match(
      blocks[blocks.length - 1].text,
      /2 more images on this thread/,
    );
  });

  test("an item with no pictures adds no blocks", async () => {
    assert.deepEqual(await imageBlocksFor(ITEM_FIXTURE, {}), []);
  });
});

describe("set_status", () => {
  // It returned a bare string, which the server destructured into
  // `text: undefined` — so a successful move answered with an empty block and
  // the model could not tell it had worked.
  test("a successful move says so in a text block", async () => {
    const server = createServer({ client: fakeClient(), config: {} });
    const res = await rpc(server, "tools/call", {
      name: "set_status",
      arguments: { itemId: "i1", status: "resolved" },
    });
    assert.equal(res.result.content[0].type, "text");
    assert.equal(res.result.content[0].text, "Moved to resolved.");
    assert.equal(res.result.structuredContent.changed, true);
  });

  test("a no-op says that instead", async () => {
    const server = createServer({
      client: fakeClient({ setStatus: { changed: false, status: "resolved" } }),
      config: {},
    });
    const res = await rpc(server, "tools/call", {
      name: "set_status",
      arguments: { itemId: "i1", status: "resolved" },
    });
    assert.equal(
      res.result.content[0].text,
      "Already resolved — nothing to do.",
    );
  });
});

describe("base64 without Node", () => {
  /**
   * The remote endpoint bundles this module into a Convex V8 isolate, which
   * has `btoa` and no `Buffer`. Node has both, so the fallback branch would
   * otherwise only ever run in production — where a broken one means every
   * screenshot through the hosted transport is a corrupt image.
   */
  test("the btoa path encodes the same bytes", async () => {
    const bytes = new Uint8Array(1000).map((_, i) => i % 256);
    const expected = Buffer.from(bytes).toString("base64");

    const held = globalThis.Buffer;
    delete globalThis.Buffer;
    try {
      const blocks = await imageBlocksFor(
        { evidence: { screenshotUrl: "https://storage.example/a.png" } },
        {
          load: async () => ({ bytes, mimeType: "image/png" }),
        },
      );
      assert.equal(blocks.find((b) => b.type === "image").data, expected);
    } finally {
      globalThis.Buffer = held;
    }
  });
});

describe("bytes from somewhere other than a URL", () => {
  // The remote endpoint reads its own storage rather than fetching its own
  // public links. Same labels, same caps, same notes — one code path.
  test("an injected loader is used instead of fetch", async () => {
    const asked = [];
    const blocks = await imageBlocksFor(
      {
        evidence: {
          screenshotUrl: "https://storage.example/a.png",
          screenshotStorageId: "st_1",
        },
      },
      {
        fetchImpl: () => assert.fail("should not have gone over the network"),
        load: async (source) => {
          asked.push(source.storageId);
          return { bytes: new Uint8Array([1, 2]), mimeType: "image/png" };
        },
      },
    );
    assert.deepEqual(asked, ["st_1"]);
    assert.equal(blocks.filter((b) => b.type === "image").length, 1);
  });

  test("a loader that throws becomes a note, not a failed call", async () => {
    const blocks = await imageBlocksFor(
      { evidence: { screenshotUrl: "https://storage.example/a.png" } },
      {
        load: async () => {
          throw new Error("storage is down");
        },
      },
    );
    assert.match(blocks[0].text, /could not be read \(storage is down\)/);
  });

  test("something that is not an image is named rather than sent", async () => {
    const blocks = await imageBlocksFor(
      { evidence: { screenshotUrl: "https://storage.example/a.pdf" } },
      {
        load: async () => ({
          bytes: new Uint8Array([1]),
          mimeType: "application/pdf",
        }),
      },
    );
    assert.equal(blocks.filter((b) => b.type === "image").length, 0);
    assert.match(blocks[0].text, /is not an image \(application\/pdf\)/);
  });
});

test("the server names itself with the Skyelight mark, and ChatGPT gets a status line per tool", async () => {
  const server = createServer({ client: fakeClient(), config: {} });
  const init = await rpc(server, "initialize", {});
  assert.equal(init.result.serverInfo.title, "Skyelight");
  assert.match(init.result.serverInfo.icons[0].src, /^data:image\/png;base64,/);
  const list = await rpc(server, "tools/list", {});
  for (const t of list.result.tools) {
    const invoking = t._meta?.["openai/toolInvocation/invoking"];
    const invoked = t._meta?.["openai/toolInvocation/invoked"];
    assert.ok(invoking && invoked, `${t.name} has status text`);
    assert.ok(invoking.length <= 64 && invoked.length <= 64, `${t.name} fits`);
  }
});
