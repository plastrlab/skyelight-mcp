/**
 * The tools, and — more importantly — how their results are worded.
 *
 * A tool that returns raw JSON invites a model to read it aloud. Each of
 * these returns prose with the numbers already in it, so the natural thing
 * for a model to do is summarise rather than dump. The structured payload is
 * still attached for anything that wants to compute on it.
 */

import { imageBlocksFor } from "./images.js";
import { STATUS } from "./brand.js";
import {
  callInsightTool,
  insightToolDefinitions,
  INSIGHT_TOOLS,
  renderInsight,
} from "./insights.js";

const PROJECT_HINT =
  'No project. Pass projectId, or add .skyelight.json with {"projectId": "..."}.';

/**
 * @param opts.uiResourceUri When set, `get_item` advertises a `ui://`
 *   resource the host can render as a card. Omitted for clients that cannot
 *   render one — the text result is complete on its own, so the card is
 *   strictly additive and its absence costs nothing (SKY-279).
 */
export function toolDefinitions(opts = {}) {
  const withUi = (tool) =>
    opts.uiResourceUri
      ? {
          ...tool,
          _meta: {
            ui: {
              resourceUri: opts.uiResourceUri,
              // The model calls it, and the card calls back into it.
              visibility: ["model", "app"],
            },
          },
        }
      : tool;

  return [
    {
      name: "list_workspaces",
      description:
        "Workspaces you can reach, with the role you hold in each, and who " +
        "you are. Use when you do not know what exists yet, to find which " +
        "workspace a project belongs to, or to learn your own user id.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_projects",
      description:
        "Projects you can reach, newest activity first, across every " +
        "workspace unless one is named. Start here when no project is bound " +
        "— `list_items` needs a project id and this is where one comes from.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: {
            type: "string",
            description: "Narrow to one workspace. Optional.",
          },
        },
      },
    },
    {
      name: "list_items",
      description:
        "List feedback items (bugs, ideas, comments) people left on a Skyelight project. " +
        "Returns a summary of the project plus matching items. Start here to see what is outstanding.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description:
              "Project to read. Optional when a project is bound or the workspace has only one; " +
              "otherwise the error lists the projects and their ids.",
          },
          page: {
            type: "string",
            description: 'Only items on one page, e.g. "/checkout".',
          },
          type: {
            type: "string",
            description: 'Item type, e.g. "bug", "idea", "feedback".',
          },
          status: {
            type: "string",
            enum: ["open", "deferred", "resolved"],
            description:
              'Defaults to everything. "deferred" is work someone put off ' +
              "until later — outstanding, but deliberately not now.",
          },
          assignee: {
            type: "string",
            description:
              'A user id, "me" for whoever this connection belongs to, or ' +
              '"none" for unassigned items.',
          },
          limit: { type: "number", description: "Max items (default 50)." },
        },
      },
    },
    {
      name: "search_items",
      description:
        "Find items whose thread mentions some text. Searches replies as well as the original " +
        "message, so an item someone already diagnosed in a reply still turns up.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Text to look for." },
          projectId: {
            type: "string",
            description:
              "Project to search. Optional when a project is bound or the workspace has only one; " +
              "otherwise the error lists the projects and their ids.",
          },
          status: { type: "string", enum: ["open", "deferred", "resolved"] },
          limit: { type: "number" },
        },
        required: ["query"],
      },
    },
    {
      name: "post_update",
      description:
        "Report back on an item: what you found, what you changed, a link to the PR. Posts as a " +
        "reply on the thread the feedback was left on, so the person who reported it sees the " +
        "answer where they asked. Use this when you finish work on an item, and when you get stuck.",
      inputSchema: {
        type: "object",
        properties: {
          itemId: { type: "string", description: "Item id from list_items." },
          body: {
            type: "string",
            description:
              "What you found or changed, in plain language for the person who reported it.",
          },
          mentions: {
            type: "array",
            items: { type: "string" },
            description:
              'People to notify, by name, email or id from list_members ("me" is you). ' +
              "Write @Name in the body where you mention them.",
          },
          links: {
            type: "array",
            description: "Optional links — a PR, a commit, a deploy.",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                url: { type: "string" },
              },
              required: ["url"],
            },
          },
        },
        required: ["itemId", "body"],
      },
    },
    {
      name: "create_item",
      description:
        "Open a new thread on a page, as the person whose connection you are using. " +
        "Only available on a person's own connection — an agent reporting what it found " +
        "or changed uses post_update on the thread it was working, so the answer lands " +
        "where the question was asked.",
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "Full URL of the page this is about.",
          },
          body: { type: "string", description: "What you want to say." },
          selector: {
            type: "string",
            description: "CSS selector for the element, if there is one.",
          },
          projectId: {
            type: "string",
            description: "Optional if a project is bound.",
          },
          pageTitle: { type: "string" },
          mentions: {
            type: "array",
            items: { type: "string" },
            description:
              'People to notify, by name, email or id from list_members ("me" is you). ' +
              "Write @Name in the body where you mention them.",
          },
          assignee: {
            type: "string",
            description:
              'Who should take it: a name, email or id from list_members, or "me".',
          },
        },
        required: ["url", "body"],
      },
    },
    {
      name: "publish_review_link",
      description:
        "Share something with Skyelight for review, and get a link people can pin feedback on. " +
        "Two ways:\n" +
        "- code: one file Skyelight hosts at its own link with the review badge on it. A whole HTML page, " +
        "or one React component with an export default (Tailwind classes and npm imports work; local " +
        "imports such as @/components do not). For Claude prototypes, v0 snippets and single pages. " +
        "Publishing again with the same prototypeId, or the same name in the same project, makes a new " +
        "version at the same link.\n" +
        "- url: an app already deployed (a Lovable, v0, Bolt or Vercel project: anything with more than " +
        "one file). Adds its address to the project's Review Links and returns a script tag to add to the " +
        "app's <head> (index.html, or the root layout); add it and redeploy. Owners and admins.\n" +
        "Returns the share link and the project link; give both to the person. A hosted link is public " +
        "to anyone who has it.",
      inputSchema: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description:
              "For Skyelight to host: the complete file, never a summary or an excerpt. Or give url.",
          },
          url: {
            type: "string",
            description:
              "Where the app is deployed, e.g. https://my-app.lovable.app. Or give code.",
          },
          name: {
            type: "string",
            description:
              "What it is, in a few words. Names the hosted link and, when no project is given, a new project.",
          },
          kind: {
            type: "string",
            enum: ["html", "react"],
            description: "With code; worked out from it when left out.",
          },
          projectId: {
            type: "string",
            description:
              "Optional: the project to put it in. Left out, a new project is made for it.",
          },
          prototypeId: {
            type: "string",
            description:
              "With code: to publish a new version of a prototype published before.",
          },
          workspaceId: {
            type: "string",
            description:
              "When you are in more than one workspace and give no project, from list_workspaces.",
          },
          source: {
            type: "string",
            description:
              'With code: where it was made, shown as its logo in Skyelight: "claude", "claude-code", "openai" (ChatGPT), "cursor", "windsurf", "v0", "lovable" or "other". Name yourself.',
          },
        },
      },
    },
    {
      name: "list_members",
      description:
        "The people in a workspace: name, email, role and id. Call it when you are asked to " +
        "tell, ask or hand something to someone by name, then pass their name or id to " +
        "assign, or in mentions on create_item or post_update.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "Optional if a project is bound.",
          },
          workspaceId: {
            type: "string",
            description: "Instead of a project, from list_workspaces.",
          },
        },
      },
    },
    {
      name: "assign",
      description:
        "Hand an item to a person, who is notified the way an assignment in the app notifies " +
        "them. Pass null as the assignee to unassign it. Only owners, admins and collaborators " +
        "can assign; a resolved item has to be reopened first.",
      inputSchema: {
        type: "object",
        properties: {
          itemId: { type: "string", description: "Item id from list_items." },
          assignee: {
            type: ["string", "null"],
            description:
              'A name, email or id from list_members, "me", or null to unassign.',
          },
        },
        required: ["itemId", "assignee"],
      },
    },
    {
      name: "set_status",
      description:
        "Move an item to open, deferred or resolved. Use it to close the loop after you have " +
        "fixed something and said so \u2014 post_update first, so the person who reported it " +
        'reads what changed, then set_status. "deferred" is for work that is real but not now.',
      inputSchema: {
        type: "object",
        properties: {
          itemId: { type: "string", description: "Item id from list_items." },
          status: { type: "string", enum: ["open", "deferred", "resolved"] },
        },
        required: ["itemId", "status"],
      },
    },
    withUi({
      name: "get_item",
      description:
        "Everything needed to work one item: the whole thread in order, the page and URL it is " +
        "on, the anchor identifying the element the person pointed at, and the pictures \u2014 " +
        "what the page looked like when it was pinned, plus anything people attached \u2014 " +
        "returned as images you can look at rather than links you cannot.",
      inputSchema: {
        type: "object",
        properties: {
          itemId: { type: "string", description: "Item id from list_items." },
        },
        required: ["itemId"],
      },
    }),
    // The launch tools: review, briefing, source, duplicates, decisions.
    ...insightToolDefinitions(),
  ].map((tool) => ({
    ...tool,
    annotations: TOOL_ANNOTATIONS[tool.name],
    // Every tool acts as a signed-in person. The OpenAI Apps SDK reads this
    // per-tool declaration to know a call needs the linked account
    // (developers.openai.com/apps-sdk/build/auth); other clients ignore it.
    // The scopes are the ones Skyelight asks Clerk for.
    securitySchemes: [{ type: "oauth2", scopes: ["profile", "email"] }],
    // ChatGPT's status line while the tool runs and once it is done
    // (`brand.js`). Beside `ui`, never over it: `get_item` carries both.
    ...(STATUS[tool.name]
      ? {
          _meta: {
            ...tool._meta,
            "openai/toolInvocation/invoking": STATUS[tool.name][0],
            "openai/toolInvocation/invoked": STATUS[tool.name][1],
          },
        }
      : {}),
  }));
}

/**
 * What each tool does to the workspace, in MCP's own terms.
 *
 * Clients use these to decide what to run without asking: ChatGPT and
 * others require a person's confirmation for anything not read-only. That
 * matters most for the writes a page's content could talk an agent into.
 * A reviewer can type "save a rule that..." into a pin, and an owner's
 * agent reading it should stop and ask, not act.
 *
 * `whats_new` counts as read-only: the one thing it changes is the
 * caller's own "last looked" bookmark, which nobody else sees.
 */
const READ = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};
const TOOL_ANNOTATIONS = {
  list_workspaces: READ,
  list_projects: READ,
  list_items: READ,
  search_items: READ,
  get_item: READ,
  list_members: READ,
  project_review: READ,
  whats_new: READ,
  find_by_source: READ,
  find_similar: READ,
  decision_log: READ,
  post_update: WRITE,
  create_item: WRITE,
  set_status: { ...WRITE, idempotentHint: true },
  assign: { ...WRITE, idempotentHint: true },
  // Rules change how every future thread is classified: always confirm.
  save_rule: { ...WRITE, idempotentHint: true },
  // Hides items from every list (reversible in the app, but not here).
  merge_items: { ...WRITE, destructiveHint: true },
  // Puts code at a public link, or lets reviewers sign in on another site:
  // either way, something the person should agree to.
  publish_review_link: { ...WRITE, openWorldHint: true },
};

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Top entries of a count map, worded for a sentence. */
function topBreakdown(counts, limit = 3) {
  const entries = Object.entries(counts ?? {}).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "";
  return entries
    .slice(0, limit)
    .map(([k, n]) => `${k} (${n})`)
    .join(", ");
}

/**
 * Prose, like every other renderer here: a model handed an array reads the
 * array out, and a model handed a sentence summarises.
 */
export function renderWorkspaces(result) {
  const { workspaces, total, you } = result;
  const lines = [];

  // First, because it is the answer to a question nothing else here can
  // answer, and the id below is what `list_items` wants as `assignee`.
  if (you) {
    lines.push(
      you.name ? `You are ${you.name} — ${you.id}.` : `You are ${you.id}.`,
    );
    lines.push('Pass "me" as assignee to list_items to see your own work.');
    lines.push("");
  }

  if (total === 0) {
    lines.push("You are not a member of any workspace yet.");
    return lines.join("\n");
  }

  lines.push(`${plural(total, "workspace", "workspaces")} you can reach:`);
  lines.push("");
  for (const w of workspaces) {
    const projects = plural(w.projectCount, "project", "projects");
    lines.push(`  ${w.name} — ${w.role}, ${projects}`);
    lines.push(`    ${w.id}`);
    // What an agent cannot do here, and why: a seat to ask for, a plan to
    // upgrade, or Free's MCP, which publishes prototypes.
    if (w.unavailableReason) lines.push(`    ${w.unavailableReason}`);
  }
  return lines.join("\n");
}

/**
 * Coarse relative time.
 *
 * Deliberately vague past a day: an agent deciding whether to look at a
 * project needs "today" or "last month", and a precise timestamp invites it
 * to quote a date it has no reason to trust to the minute.
 */
function ago(ts) {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return months < 12 ? `${months}mo ago` : `${Math.round(months / 12)}y ago`;
}

export function renderProjects(result) {
  const { projects, total } = result;
  if (total === 0) {
    return "No projects you can reach. Create one in the Skyelight web app.";
  }

  const spans = new Set(projects.map((p) => p.workspace.id)).size > 1;
  const lines = [`${plural(total, "project", "projects")} you can reach:`];
  lines.push("");
  for (const p of projects) {
    // The workspace is only worth naming when there is more than one in
    // play; repeating it down a single-workspace list is noise.
    // The activity date is why this list is ordered the way it is, and it
    // was previously only in the structured payload — so an agent reading the
    // prose could not tell a busy project from a dormant one, and one reading
    // the raw field got `updatedAt`, which meant "renamed recently".
    const when = p.lastActivityAt ? ` · ${ago(p.lastActivityAt)}` : "";
    lines.push(`  ${p.name}${spans ? ` (${p.workspace.name})` : ""}${when}`);
    lines.push(`    ${p.id}${p.repo ? ` — ${p.repo}` : ""}`);
  }
  lines.push("");
  lines.push(
    "Pass one of these ids as projectId, or write it to .skyelight.json in " +
      "the repo so it is the default from now on.",
  );
  return lines.join("\n");
}

export function renderList(result, { searched } = {}) {
  const { project, summary, items, matched, truncated, capped, scanLimit } =
    result;
  const lines = [];

  lines.push(
    `${project.name}: ${plural(summary.total, "item", "items")} total — ` +
      `${summary.open} open, ${summary.deferred ?? 0} deferred, ` +
      `${summary.resolved} resolved, ${summary.unassigned} unassigned.`,
  );

  // Said immediately after the counts, because it is what those counts mean.
  // A floor stated as a total is the kind of wrong nobody catches: the number
  // looks like every other number this tool has ever returned.
  if (capped) {
    lines.push(
      `Those counts are a floor, not a total: this project is larger than ` +
        `the ${(scanLimit ?? 2000).toLocaleString("en-US")} most recent items ` +
        `one call reads. Filter by page, type or status for an exact count.`,
    );
  }

  const byType = topBreakdown(summary.byType);
  if (byType) lines.push(`By type: ${byType}.`);
  const byPage = topBreakdown(summary.byPage);
  if (byPage) lines.push(`Busiest pages: ${byPage}.`);

  lines.push("");

  if (items.length === 0) {
    lines.push(
      searched
        ? `Nothing matched "${searched}".`
        : "Nothing matched those filters.",
    );
    return lines.join("\n");
  }

  lines.push(
    truncated
      ? `Showing ${items.length} of ${matched} matches — narrow the filters to see the rest:`
      : `${plural(items.length, "match", "matches")}:`,
  );

  for (const i of items) {
    const bits = [i.type ?? "unsorted", i.status, i.page];
    if (i.assignee) bits.push(`assigned to ${i.assignee}`);
    else bits.push("unassigned");
    if (i.replyCount > 0) bits.push(plural(i.replyCount, "reply", "replies"));
    // How many people hit this, once merging has told us they are the same
    // thing. Silent at 1, which is almost every row — a list where every line
    // ends in "1 report" has spent its width saying nothing.
    if (i.reportCount > 1) bits.push(`${i.reportCount} reports`);
    lines.push(`- ${i.excerpt}`);
    lines.push(`  ${bits.join(" · ")} — id ${i.id}`);
  }

  lines.push("");
  lines.push(
    "Use get_item with an id for the full thread and the element it points at.",
  );
  return lines.join("\n");
}

export function renderItem(item) {
  const lines = [];
  lines.push(
    `${item.type ?? "unsorted"} · ${item.status} · ${item.page}` +
      (item.project ? ` · ${item.project.name}` : ""),
  );
  lines.push(`URL: ${item.url}`);
  // The repo, when the project names one. Stated plainly and early: it is
  // the difference between an agent knowing where to work and inferring it
  // from a URL, which is how work lands in the wrong codebase.
  // The repository and nothing else. Which branch to work on is the reader's
  // own checkout to answer; which branch the page came from is on the source
  // line below, and that is the half an agent cannot work out for itself.
  const repo = item.project && item.project.repo;
  if (repo) lines.push(`Code: ${repo.url}`);

  // Before anything else worth reading: this thread is not the one to work.
  // Everything below still describes it faithfully, and acting on it would
  // put the answer where nobody is looking.
  if (item.duplicateOf) {
    lines.push(
      `Merged as a duplicate of item ${item.duplicateOf}. Work that one — ` +
        `a reply here will not reach the thread people are following.`,
    );
  } else if (item.reportCount > 1) {
    lines.push(
      `${item.reportCount} people reported this ` +
        `(${item.reportCount - 1} merged into it).`,
    );
  }

  // Who else is already on it. An agent that starts work a Linear-hosted
  // agent is finishing produces a second answer nobody asked for, and the
  // first anyone hears of it is a duplicate branch.
  for (const l of item.linear ?? []) {
    const handed = l.delegateName
      ? ` — handed to ${l.delegateName}${l.delegatedMode ? `, asked to ${l.delegatedMode}` : ""}`
      : "";
    lines.push(`Linear: ${l.identifier}${handed}. ${l.url}`);
  }

  // The mode is the ask. An agent that reads "investigate" and opens a
  // pull request has done the wrong job well.
  const ASKS = {
    investigate: "investigate — report back, change nothing",
    plan: "plan — describe the change, do not make it",
    fix: "fix — make the change and open a pull request",
    build: "build — build it and open a pull request",
  };

  // The thread's standing ask, set by whoever triaged it (Hand off in the
  // app). It was in the structured result only, and many clients show the
  // model nothing but this text (SKY-341).
  if (item.agentTask && ASKS[item.agentTask]) {
    lines.push(`Agent task: ${ASKS[item.agentTask]}`);
  }

  if (item.assignee?.name) {
    const ask = ASKS[item.assignee.mode];
    const asked = ask ? `asked to ${ask}` : undefined;
    lines.push(
      asked
        ? `Assigned to ${item.assignee.name}, ${asked}`
        : `Assigned to: ${item.assignee.name}`,
    );
  }
  lines.push("");

  lines.push(`${item.thread.root.author} wrote:`);
  lines.push(item.thread.root.content);

  if (item.thread.replies.length > 0) {
    lines.push("");
    lines.push(`${plural(item.thread.replies.length, "reply", "replies")}:`);
    for (const r of item.thread.replies) {
      lines.push(`- ${r.author}: ${r.content}`);
    }
  }

  // How many people felt strongly enough to say so without writing a reply.
  // A thread with one comment and nine thumbs up is not a thread with one
  // comment, and nothing here said so.
  if (item.reactions?.length) {
    lines.push("");
    lines.push(
      `Reactions: ${item.reactions
        .map((r) => `${r.emoji} ${r.count}`)
        .join(", ")}.`,
    );
  }

  // Stated before the anchor: a picture answers "what did this look like" in
  // one step, where a selector needs the page opened first.
  //
  // The URL is deliberately not here. These arrive as image blocks after this
  // text, which is the point of the change — and a link that has already been
  // honoured is a line a reader has to decide about for nothing. When one
  // cannot be fetched, the block builder says so and prints the link then.
  // Said before the screenshot, which it qualifies: the picture and the
  // captured markup show where the pin was first placed, not where it is.
  if (item.movedAt) {
    lines.push("");
    lines.push(
      `Moved to a different element on ${new Date(item.movedAt).toISOString().slice(0, 10)}. ` +
        "The anchor and source above are the current ones; the screenshot and page capture were taken where it was first placed.",
    );
  }

  if (item.evidence) {
    if (item.evidence.screenshotUrl) {
      lines.push("");
      lines.push(
        "Screenshot of the page when this was pinned: attached below.",
      );
    } else if (item.evidence.expired) {
      lines.push("");
      lines.push(
        "Screenshot: expired and deleted under this workspace's retention policy.",
      );
    }
  }

  if (item.attachments?.length) {
    const n = item.attachments.length;
    lines.push(
      `${plural(n, "image", "images")} attached to this thread: also below.`,
    );
  }

  lines.push("");
  lines.push("They were pointing at:");
  // elementText first: it is what a person would have named, and the one
  // part of an anchor that stays true when the markup moves.
  if (item.anchor.elementText) {
    lines.push(`  the element reading "${item.anchor.elementText}"`);
  }
  if (item.anchor.selectedText) {
    lines.push(`  with "${item.anchor.selectedText}" selected`);
  }
  // Which row, when the element is one of many the same component rendered.
  // The author's own React key, so it reads as something from their codebase
  // — "the row with key plan:pro" locates a record, which is a different and
  // better question than where on the page it was drawn.
  //
  // `skyId` is deliberately not here. It is an opaque hash: it anchors the
  // pin and tells a reader nothing they can act on, and `source` below
  // already names the file. It stays in the structured response for anything
  // resolving anchors, out of the prose for anything reading one.
  if (item.anchor.skyKey) {
    lines.push(`  the item with key ${item.anchor.skyKey}`);
  }
  lines.push(`  selector: ${item.anchor.selector}`);
  lines.push(
    `  seen at ${item.anchor.viewport.width}x${item.anchor.viewport.height}`,
  );

  // Last and on its own line, because it is the line that changes what the
  // reader does next: everything above describes the page, this names the
  // file. Absent unless the build stamped it, and silent when it is — an
  // agent that reads "no source" learns nothing it can act on.
  if (item.source) {
    lines.push("");
    const where = item.source.line
      ? `${item.source.file}, line ${item.source.line}`
      : item.source.file;
    // Named before located: "the DoseRow component" is what someone would say,
    // and it stays true after the line has moved.
    const rendered = item.sourcePath?.target?.component;
    // The build too, when the page carried one. Which commit was on the
    // screen is the difference between a live bug and a stale pin — and the
    // branch is what makes that commit findable when the page was a preview
    // of work that has not landed on the main line.
    const from = [];
    if (item.source.build) from.push(`build ${item.source.build}`);
    if (item.source.branch) from.push(`branch ${item.source.branch}`);
    const by = rendered ? `the ${rendered} component, ${where}` : where;
    lines.push(
      from.length
        ? `Written by ${by}, in ${from.join(" on ")}.`
        : `Written by ${by}.`,
    );
    // The permalink, when the project names a repository. Pinned to the
    // commit the page carried rather than to a branch, so it opens the code
    // the person was actually looking at.
    if (item.sourceUrl) lines.push(item.sourceUrl);
  }

  // The stamps read in both directions.
  //
  // Separated from the one-line `Written by` above because they answer a
  // different question. That line says where the pinned element came from;
  // this says which component it lives in, and which of its parts a request
  // is likely to be about. A person points at a row and means the text
  // inside it far more often than they mean the row.
  const path = item.sourcePath;
  if (path && (path.above.length || path.below.length)) {
    if (path.above.length) {
      lines.push("");
      lines.push("Nested inside");
      // Outermost first, so a repeated file reads as one component and a
      // change of file reads as a boundary between two.
      for (const step of path.above) {
        // The component first when there is one: it is what a person would
        // call this part of the page, and the one identifier that survives
        // the lines below it moving.
        const who = step.component ? `${step.component}  ` : "";
        lines.push(`  ${who}${step.file}:${step.line ?? "?"}  <${step.tag}>`);
      }
    }
    if (path.below.length) {
      lines.push("");
      lines.push("Contains");
      for (const step of path.below) {
        const indent = "  ".repeat((step.depth ?? 0) + 1);
        const text = step.text ? `  "${step.text}"` : "";
        const who = step.component ? ` ${step.component}` : "";
        lines.push(
          `${indent}<${step.tag}>${who} ${step.file}:${step.line ?? "?"}${text}`,
        );
      }
    }
  }

  return lines.join("\n");
}

/** Who was notified, as a trailing sentence, or nothing. */
function notifiedLine(result) {
  const parts = [];
  if (result?.assignedTo) parts.push(`Assigned to ${result.assignedTo}.`);
  const mentioned = result?.mentioned ?? [];
  if (mentioned.length) parts.push(`Mentioned ${mentioned.join(", ")}.`);
  return parts.length ? ` ${parts.join(" ")}` : "";
}

export function renderPosted(result, { kind }) {
  if (kind === "update") {
    return (
      "Posted to the thread. The person who reported this will see it where " +
      "they left the feedback." +
      notifiedLine(result)
    );
  }
  return (
    `Raised a new item on ${result.page ?? "that page"}. id ${result.pinId}` +
    notifiedLine(result)
  );
}

export function renderPublished(result) {
  const lines = [
    result.newPrototype
      ? `Published "${result.name}" in ${result.projectName}.`
      : `Published version ${result.version}. The link is the same, and shows this version now.`,
    `Share link: ${result.shareUrl}`,
    `Project: ${result.projectUrl}${result.createdProject ? " (new project)" : ""}`,
    `prototypeId ${result.prototypeId}: pass it to publish the next version at the same link.`,
    "Anyone with the share link can open it; people sign in to Skyelight to leave pins.",
  ];
  return lines.join("\n");
}

export function renderReviewLink(result) {
  return [
    result.alreadyAdded
      ? `${result.origin} was already on ${result.projectName}'s Review Links.`
      : `Added ${result.origin} to ${result.projectName}'s Review Links${result.createdProject ? " (new project)" : ""}.`,
    "Add this to the app's <head> (index.html, or the root layout), then redeploy:",
    result.scriptTag,
    `Share link: ${result.shareUrl}`,
    `Project: ${result.projectUrl}`,
    "Reviewers sign in to Skyelight from the badge to leave pins.",
  ].join("\n");
}

export function renderMembers(result) {
  const members = result?.members ?? [];
  const where = result?.workspace?.name ? ` in ${result.workspace.name}` : "";
  if (members.length === 0) return `Nobody${where} yet.`;
  const lines = members.map(
    (m) =>
      `- ${m.name}${m.email ? ` <${m.email}>` : ""}, ${m.role} (id ${m.id})`,
  );
  return `${members.length} ${members.length === 1 ? "person" : "people"}${where}:\n${lines.join("\n")}`;
}

export function renderAssigned(result) {
  if (!result.changed) {
    return result.assignedTo
      ? `Already assigned to ${result.assignedTo}. Nothing to do.`
      : "Already unassigned. Nothing to do.";
  }
  return result.assignedTo
    ? `Assigned to ${result.assignedTo}. They have been notified.`
    : "Unassigned.";
}

export async function callTool(name, args, { client, config }) {
  const projectId = args.projectId ?? config.projectId ?? undefined;

  if (name === "list_workspaces") {
    const result = await client.listWorkspaces();
    return { text: renderWorkspaces(result), data: result };
  }

  if (name === "list_projects") {
    const result = await client.listProjects({
      workspaceId: args.workspaceId,
    });
    return { text: renderProjects(result), data: result };
  }

  if (name === "list_items") {
    const result = await client.listItems({
      projectId,
      page: args.page,
      type: args.type,
      status: args.status,
      assignee: args.assignee,
      limit: args.limit,
    });
    return { text: renderList(result), data: result };
  }

  if (name === "search_items") {
    if (!args.query?.trim()) throw new Error("search_items needs a query");
    const result = await client.listItems({
      projectId,
      q: args.query,
      status: args.status,
      limit: args.limit,
    });
    return { text: renderList(result, { searched: args.query }), data: result };
  }

  if (name === "post_update") {
    if (!args.itemId) throw new Error("post_update needs an itemId");
    if (!args.body?.trim()) throw new Error("post_update needs a body");
    const result = await client.postUpdate({
      itemId: args.itemId,
      body: args.body,
      ...(args.mentions ? { mentions: args.mentions } : {}),
      links: args.links,
    });
    return { text: renderPosted(result, { kind: "update" }), data: result };
  }

  if (name === "create_item") {
    if (!args.url) throw new Error("create_item needs a url");
    if (!args.body?.trim()) throw new Error("create_item needs a body");
    const result = await client.createItem({
      url: args.url,
      body: args.body,
      selector: args.selector,
      projectId,
      pageTitle: args.pageTitle,
      ...(args.mentions ? { mentions: args.mentions } : {}),
      ...(args.assignee ? { assignee: args.assignee } : {}),
    });
    return { text: renderPosted(result, { kind: "item" }), data: result };
  }

  if (name === "publish_review_link" || name === "publish_prototype") {
    const hasCode = !!args.code?.trim();
    const hasUrl = !!args.url?.trim();
    if (hasCode === hasUrl) {
      throw new Error(
        "publish_review_link takes code (one file for Skyelight to host) or url (where the app is deployed)",
      );
    }
    if (hasCode && !args.prototypeId && !args.name?.trim()) {
      throw new Error("publish_review_link needs a name");
    }
    const pick = (keys) =>
      Object.fromEntries(keys.filter((k) => args[k]).map((k) => [k, args[k]]));
    const result = await client.publishReviewLink(
      hasUrl
        ? pick(["url", "projectId", "name", "workspaceId"])
        : {
            name: args.name ?? "",
            ...pick([
              "code",
              "kind",
              "projectId",
              "prototypeId",
              "workspaceId",
              "source",
            ]),
          },
    );
    return {
      text: result?.linked ? renderReviewLink(result) : renderPublished(result),
      data: result,
    };
  }

  if (name === "list_members") {
    const result = await client.listMembers({
      projectId,
      workspaceId: args.workspaceId,
    });
    return { text: renderMembers(result), data: result };
  }

  if (name === "assign") {
    if (!args.itemId) throw new Error("assign needs an itemId");
    if (args.assignee === undefined) {
      throw new Error("assign needs an assignee, or null to unassign");
    }
    const result = await client.assign({
      itemId: args.itemId,
      assignee: args.assignee,
    });
    return { text: renderAssigned(result), data: result };
  }

  if (name === "set_status") {
    if (!args.itemId) throw new Error("set_status needs an itemId");
    if (!args.status) throw new Error("set_status needs a status");
    const res = await client.setStatus({
      itemId: args.itemId,
      status: args.status,
    });
    if (res?.error) throw new Error(res.error);
    // `{ text, data }` like every other tool. It used to return a bare
    // string, which the stdio server destructured into `text: undefined` —
    // so a successful set_status answered with an empty content block and
    // the model had no way to tell it had worked.
    return {
      text: res.changed
        ? `Moved to ${res.status}.`
        : `Already ${res.status} — nothing to do.`,
      data: res,
    };
  }

  if (name === "get_item") {
    if (!args.itemId) throw new Error("get_item needs an itemId");
    const item = await client.getItem(args.itemId);
    return {
      text: renderItem(item),
      data: item,
      // The pictures, as pictures. Appended after the text so the work order
      // still reads top-down, and empty whenever there is nothing to show.
      content: await imageBlocksFor(item, { fetchImpl: client.fetchImpl }),
    };
  }

  if (INSIGHT_TOOLS.has(name)) {
    const result = await callInsightTool(name, args, { client, projectId });
    return { text: renderInsight(name, result), data: result };
  }

  throw new Error(`Unknown tool: ${name}`);
}

export { PROJECT_HINT };
