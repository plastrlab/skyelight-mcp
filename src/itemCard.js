/**
 * The `ui://` item card (SKY-278), per MCP Apps spec revision 2026-01-26.
 *
 * Lives in the package, like tools.js, and is imported by convex/mcp — one
 * definition of what the host renders, for both transports.
 *
 * A STATIC template, not a per-item render. The host fetches it once, then
 * pushes each tool result into the running iframe as a
 * `ui/notifications/tool-result` notification — so one cacheable resource
 * serves every item, and the card updates in place when the user asks about
 * another one.
 *
 * Self-contained by construction: no external scripts, styles or fonts, so
 * every CSP domain list is empty. That is the strongest sandbox the host can
 * give us, and it costs nothing here — the card is a few hundred lines of
 * markup, not an application.
 *
 * TWO DELIBERATE OMISSIONS, both worth knowing before reading the markup:
 *
 * No screenshot. The ticket asks for "screenshot with the anchor
 * highlighted", and the data for that does not exist yet. Screenshots live on
 * the SURFACE, which is keyed by host — so a pin on /checkout and a pin on
 * /settings share one image, and a marker placed from the pin's coordinates
 * would sit on the wrong page most of the time. Per-pin capture is SKY-282.
 * A card showing the wrong page confidently is worse than one showing none.
 *
 * Not Preact. The ticket asks to share rendering with overlay-next rather
 * than duplicate it, and those components are being extracted into shared/ by
 * SKY-298 and the chip deleted in Phase 12. Building on them now means
 * building on something mid-demolition, and bundling Preact into a resource
 * that must be a single self-contained document buys nothing for markup this
 * small. When SKY-298 lands, this template is the natural consumer.
 */

export const ITEM_CARD_URI = "ui://skyelight/item-card";

/** Required by the spec for HTML apps. */
export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";

/** The extension identifier a client declares support with. */
export const UI_EXTENSION_KEY = "io.modelcontextprotocol/ui";

/**
 * The app dialect version this template speaks in its `ui/initialize`.
 * Distinct from the core protocol version — MCP Apps revs separately.
 */
export const APPS_PROTOCOL_VERSION = "2026-01-26";

/**
 * Whether a client can render the card.
 *
 * Read from two places because the two transports differ. stdio has a session
 * and declares capabilities once at `initialize`; the remote endpoint is
 * stateless and carries them per request in `_meta` (SKY-279, and the reason
 * spec 2026-07-28 moved them there at all).
 *
 * Absent means no. A client that says nothing gets the text experience, which
 * is complete on its own — the card is strictly additive.
 */
export function clientSupportsUi(source) {
  const caps = source?.capabilities ?? source;
  const ext = caps?.extensions?.[UI_EXTENSION_KEY];
  if (!ext) return false;
  const mimeTypes = ext.mimeTypes;
  // A client that declares the extension but no mime types is taken at its
  // word; one that lists them must include ours.
  if (!Array.isArray(mimeTypes) || mimeTypes.length === 0) return true;
  return mimeTypes.some(
    (m) => typeof m === "string" && m.startsWith("text/html"),
  );
}

/** The resource entry for `resources/list`. */
export function itemCardResource() {
  return {
    uri: ITEM_CARD_URI,
    name: "Skyelight item card",
    description:
      "Renders a feedback item as an interactive card: the thread, the page it is on, and what the person pointed at.",
    mimeType: MCP_APP_MIME_TYPE,
  };
}

/** The `resources/read` payload, including sandbox metadata. */
export function itemCardContents() {
  return {
    uri: ITEM_CARD_URI,
    mimeType: MCP_APP_MIME_TYPE,
    text: ITEM_CARD_HTML,
    _meta: {
      ui: {
        // Everything is inline. Nothing to allow, so nothing is allowed.
        csp: {
          connectDomains: [],
          resourceDomains: [],
          frameDomains: [],
          baseUriDomains: [],
        },
        permissions: {},
        prefersBorder: true,
      },
    },
  };
}

const ITEM_CARD_HTML = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Skyelight item</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #ffffff; --fg: #17181a; --muted: #6b7280;
    --line: #e5e7eb; --chip: #f3f4f6; --accent: #2563eb;
  }
  [data-theme="dark"] {
    --bg: #17181a; --fg: #f3f4f6; --muted: #9ca3af;
    --line: #2c2e33; --chip: #232529; --accent: #60a5fa;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 16px; background: var(--bg); color: var(--fg);
    font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .chips { margin-bottom: 10px; }
  .chip {
    font-size: 11px; letter-spacing: .02em; text-transform: uppercase;
    font-weight: 600; color: var(--muted);
    border: 1px solid var(--line); border-radius: 999px; padding: 3px 8px;
  }
  .chip-open { color: #b45309; border-color: #b4530933; }
  .chip-resolved { color: #15803d; border-color: #15803d33; }
  h1 { font-size: 15px; font-weight: 600; margin: 0 0 2px; }
  a { color: var(--accent); }
  .page { font-size: 12px; color: var(--muted); word-break: break-all; margin-bottom: 14px; }
  .msg { padding: 10px 0; border-top: 1px solid var(--line); }
  .msg:first-of-type { border-top: 0; }
  .who { font-weight: 600; font-size: 13px; }
  .agent {
    font-size: 10px; text-transform: uppercase; letter-spacing: .03em;
    font-weight: 700; color: var(--muted);
    border: 1px solid var(--line); border-radius: 999px; padding: 1px 6px;
  }
  .body { white-space: pre-wrap; overflow-wrap: anywhere; margin-top: 3px; }
  .anchor {
    margin-top: 14px; padding: 10px; border: 1px solid var(--line);
    border-radius: 8px; background: var(--chip); font-size: 12px;
  }
  .anchor b { font-weight: 600; }
  .anchor code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
  .actions { margin-top: 14px; display: flex; gap: 8px; flex-wrap: wrap; }
  button {
    font: inherit; font-size: 13px; padding: 6px 12px; border-radius: 7px;
    border: 1px solid var(--line); background: var(--chip); color: var(--fg);
    cursor: pointer;
  }
  button:hover { border-color: var(--accent); }
  button[disabled] { opacity: .5; cursor: default; }
  .note { margin-top: 10px; font-size: 12px; color: var(--muted); }
  .empty { color: var(--muted); }
</style>
</head>
<body>
<div id="root"><p class="empty">Loading item…</p></div>
<script>
(function () {
  "use strict";

  // --- postMessage JSON-RPC to the host -----------------------------------
  var nextId = 1;
  var pending = {};
  var item = null;

  function send(msg) {
    // The host is the only possible parent; "*" is safe inside a sandboxed
    // iframe whose parent we cannot address by origin.
    window.parent.postMessage(msg, "*");
  }

  function request(method, params) {
    var id = nextId++;
    return new Promise(function (resolve, reject) {
      pending[id] = { resolve: resolve, reject: reject };
      send({ jsonrpc: "2.0", id: id, method: method, params: params || {} });
    });
  }

  window.addEventListener("message", function (event) {
    var msg = event.data;
    if (!msg || msg.jsonrpc !== "2.0") return;

    if (msg.id !== undefined && msg.id !== null && pending[msg.id]) {
      var p = pending[msg.id];
      delete pending[msg.id];
      if (msg.error) p.reject(new Error(msg.error.message || "Request failed"));
      else p.resolve(msg.result);
      return;
    }

    // The host pushes each tool result in rather than the card fetching it.
    // One cached template therefore serves every item, and asking about a
    // different one re-renders in place.
    if (msg.method === "ui/notifications/tool-result") {
      var structured = msg.params && msg.params.structuredContent;
      if (structured && structured.thread) {
        item = structured;
        render();
      }
      return;
    }
  });

  request("ui/initialize", {
    protocolVersion: "2026-01-26",
    clientInfo: { name: "skyelight-item-card", version: "0.1.0" },
    appCapabilities: {
      availableDisplayModes: ["inline"],
      tools: { listChanged: false }
    }
  }).then(function (result) {
    var theme = result && result.hostContext && result.hostContext.theme;
    if (theme) document.documentElement.setAttribute("data-theme", theme);
  }).catch(function () {
    // A host that never answers still leaves a readable card once a result
    // arrives; the handshake only supplies theming.
  });

  // --- rendering ----------------------------------------------------------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }

  function isAgent(id) {
    return typeof id === "string" && id.indexOf("agent:") === 0;
  }

  function message(m) {
    var wrap = el("div", "msg");
    var head = el("div", "row");
    head.appendChild(el("span", "who", m.author));
    if (isAgent(m.authorId)) head.appendChild(el("span", "agent", "agent"));
    wrap.appendChild(head);
    wrap.appendChild(el("div", "body", m.content));
    return wrap;
  }

  function render() {
    var root = document.getElementById("root");
    root.textContent = "";

    var chips = el("div", "row chips");
    if (item.type) chips.appendChild(el("span", "chip", item.type));
    chips.appendChild(
      el("span", "chip " + (item.status === "resolved" ? "chip-resolved" : "chip-open"), item.status)
    );
    if (item.project && item.project.name) {
      chips.appendChild(el("span", "chip", item.project.name));
    }
    root.appendChild(chips);

    root.appendChild(el("h1", null, item.pageTitle || item.page || "Item"));
    var page = el("div", "page");
    if (item.url) {
      var a = el("a", null, item.url);
      a.href = item.url;
      a.target = "_blank";
      a.rel = "noreferrer";
      page.appendChild(a);
    } else {
      page.textContent = item.page || "";
    }
    root.appendChild(page);

    root.appendChild(message(item.thread.root));
    (item.thread.replies || []).forEach(function (r) {
      root.appendChild(message(r));
    });

    // What the person was pointing at. Visible text first: it is what they
    // would have named, and the part that survives the markup changing.
    if (item.anchor) {
      var box = el("div", "anchor");
      box.appendChild(el("b", null, "Pointing at"));
      if (item.anchor.elementText) {
        box.appendChild(el("div", null, '“' + item.anchor.elementText + '”'));
      }
      if (item.anchor.selectedText) {
        box.appendChild(el("div", null, "selected: " + item.anchor.selectedText));
      }
      var sel = el("div");
      sel.appendChild(el("code", null, item.anchor.selector || "—"));
      box.appendChild(sel);
      root.appendChild(box);
    }

    var actions = el("div", "actions");
    var open = el("button", null, "Open in Skyelight");
    open.addEventListener("click", function () {
      request("ui/open-link", { url: item.url }).catch(function () {});
    });
    actions.appendChild(open);

    // Calls the same tool the model would. The host proxies it to the server
    // and applies whatever consent it requires — the card never talks to the
    // API itself, and could not: it has no credential.
    var ack = el("button", null, "Reply: looking into it");
    ack.addEventListener("click", function () {
      ack.disabled = true;
      ack.textContent = "Posting…";
      request("tools/call", {
        name: "post_update",
        arguments: { itemId: item.id, body: "Looking into this now." }
      }).then(function () {
        ack.textContent = "Posted";
      }).catch(function (err) {
        ack.disabled = false;
        ack.textContent = "Reply: looking into it";
        var note = document.querySelector(".note") || el("div", "note");
        note.textContent = err.message;
        root.appendChild(note);
      });
    });
    actions.appendChild(ack);
    root.appendChild(actions);
  }
})();
</script>
</body>
</html>`;
