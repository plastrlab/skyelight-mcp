# @skyelight/mcp

[npm](https://www.npmjs.com/package/@skyelight/mcp) ·
[source](https://github.com/plastrlab/skyelight-mcp) ·
[docs](https://skyelight.ai/docs/mcp)

An MCP server that lets a coding agent read the feedback people left on your
running app — the thread, the page, and the element they were pointing at —
and report back on it when the work is done.

Full guide: [skyelight.ai/docs/mcp](https://skyelight.ai/docs/mcp). The REST
API behind the local server is documented at
[skyelight.ai/docs/api](https://skyelight.ai/docs/api).

Two ways to connect, with the same eighteen tools either way:

- **Remote, with OAuth** — the default. Your agent talks to Skyelight over
  HTTP and you sign in once in the browser. Nothing is pasted and no key is
  stored on disk.
- **Local, with a token** — this package runs as a stdio server on your
  machine and carries a personal token. For clients or machines where the
  browser sign-in is not an option.

Coding agents need a paid seat (owner, admin or collaborator) on a Pro plan or
above. On Free, the same seat connects too and can publish to Skyelight
(`publish_review_link`, one hosted prototype); reading feedback with an agent
is on Pro. A reviewer seat reads and comments in the web app but does not
carry agent tools.

## The short way

```bash
npx @skyelight/mcp init
```

Finds your coding agents, registers Skyelight's remote server with them, and
leaves the sign-in to OAuth — the first time the agent connects it opens a
browser and you approve it there. It shows what it will change and waits;
`--yes` skips that once you have read it.

It knows Claude Code, Cursor, Grok, Codex and Windsurf. With several
installed it asks which; `--client cursor` or `--client all` answers in
advance. `npx @skyelight/mcp remove` takes the entry out again. Point at
another deployment with `SKYELIGHT_URL=https://…`; the deployment tells the
installer its own MCP URL and OAuth client over `/mcp/install-config`, so this
package holds no environment-specific constants.

The same setup, with a snippet per client, is in the Skyelight web app under
account settings → **Coding Agents**.

## With a token

**Get a personal access token.** In the Skyelight web app, go to account
settings → **API Keys** → create one. It is shown once, belongs to the
organization you create it in, and can be given an expiry.

Then add the server to your client:

```json
{
  "mcpServers": {
    "skyelight": {
      "command": "npx",
      "args": ["-y", "@skyelight/mcp"],
      "env": {
        "SKYELIGHT_API_URL": "https://app.skyelight.ai",
        "SKYELIGHT_API_TOKEN": "sky_..."
      }
    }
  }
}
```

Claude Code users can skip the file:

```bash
claude mcp add skyelight \
  --env SKYELIGHT_API_URL=https://app.skyelight.ai \
  --env SKYELIGHT_API_TOKEN=sky_... \
  -- npx -y @skyelight/mcp
```

`SKYELIGHT_API_URL` is `https://app.skyelight.ai`, the same host as the MCP
URL on the **Coding Agents** page (`https://app.skyelight.ai/mcp`), without
`/mcp`. A deployment's `.convex.site` host also works.

### Credentials

Checked in order, so an existing setup keeps working:

1. `SKYELIGHT_API_TOKEN` / `SKYELIGHT_API_URL` in the environment
2. `.env.local`, then `.env`, in the working directory
3. `~/.skyelight/credentials` — `{"apiUrl": "...", "token": "sky_..."}`

### Binding a repo to a project

With the local server, if you can reach several projects, drop a
`.skyelight.json` at the repo root:

```json
{ "projectId": "j57abc...", "projectName": "Checkout rebuild" }
```

Tools then default to that project and nobody has to pass an id. Without it
(and always on the remote server), `list_items` asks for a project and the
agent calls `list_projects` first rather than guess.

## Tools

| Tool                  | What it is for                                                                       |
| --------------------- | ------------------------------------------------------------------------------------ |
| `list_workspaces`     | Which workspaces this credential can reach, and who you are.                         |
| `list_projects`       | The projects inside them, with the ids the other tools take.                         |
| `list_items`          | What is outstanding. Filter by page, type, status, assignee.                         |
| `search_items`        | Find items whose thread mentions some text, replies included.                        |
| `get_item`            | Everything needed to work one item: thread, page, anchor, code, images.              |
| `post_update`         | Report back on the thread the feedback came from.                                    |
| `create_item`         | Raise a new item — an audit finding, something you noticed.                          |
| `set_status`          | Move an item to open, deferred or resolved.                                          |
| `list_members`        | Who is in the workspace, so you can name an assignee or a mention.                   |
| `assign`              | Hand an item to a person, or unassign it.                                            |
| `whats_new`           | What changed since you last looked, from your own bookmark.                          |
| `project_review`      | Where a project landed, for a wrap-up or hand-off document.                          |
| `decision_log`        | What the team decided in its threads, quoted, and its current rules.                 |
| `save_rule`           | Keep an agreed rule in the project context (owners and admins).                      |
| `find_by_source`      | Feedback on a file or component before you edit it, or the hot spots.                |
| `find_similar`        | Check for an existing report before creating one.                                    |
| `merge_items`         | Fold duplicate items into one.                                                       |
| `publish_review_link` | Share something for review: code for Skyelight to host, or a deployed app's address. |

**Publishing for review.** `publish_review_link` takes one of two things:

- `code`: one HTML page, or one React component with an export default (a
  Claude prototype, a v0 snippet). Skyelight hosts it at its own link on
  `skyelight.page` with the review badge on it, in a project you name or a new
  one. Publishing again makes a new version at the same link.
- `url`: an app already deployed, such as a Lovable, v0 or Bolt project on
  `*.lovable.app` or `*.vercel.app`. The address goes on the project's Review
  Links, and the answer carries a script tag for the app's `<head>` and the
  review link to share (the address with `?skyelight=1`).

Code that imports the rest of its app is not hosted; the answer says to send
the app's `url` instead. It answers to `publish_prototype` too, its name
before 0.7.0.

`list_items` leads with a summary — totals, breakdown by type and by page — so
an agent can tell you the shape of the work before pulling any of it. Rows are
stubs; `get_item` is where the thread and the anchor live.

**"What is assigned to me."** `list_workspaces` returns your own user id, and
`list_items` takes `assignee: "me"`, so the most ordinary question anyone asks
an agent needs no id looked up by hand.

**Merged duplicates do not appear twice.** When somebody merges five reports of
one problem in the web app, the duplicates leave the list and the item they were
merged into says `5 reports`. A list that shows all five reads as five bugs.

## What the agent sees

```
Alpha: 21 items total — 15 open, 3 deferred, 3 resolved, 19 unassigned.
By type: bug (7), idea (4), feedback (10).
Busiest pages: /checkout (8), /settings (4).

2 matches:
- The pay button does nothing on the second click
  bug · open · /checkout · unassigned · 2 replies · 5 reports — id i1
```

Deliberately prose rather than JSON. A tool that returns a bare array invites a
model to read the array out; this one invites it to summarise.

A row's line is the one-sentence summary Skyelight's classifier wrote, where
there is one, rather than the first 140 characters of whatever somebody typed —
four truncated paragraphs are not something you can choose between.

One call reads the 2,000 most recent items in a project. Past that the result
says so, in words, rather than presenting a slice as the total.

### The pictures

`get_item` returns the screenshot taken when the pin was left, and any images
people attached to the thread, as **image content blocks** — things a model can
actually look at, not links it cannot open.

```
Screenshot of the page when this was pinned: attached below.
2 images attached to this thread: also below.
```

Capped at four per call. Anything too large to inline comes back as its link
with the reason, so a picture never disappears silently.

### What somebody else already did

`get_item` also names the Linear issue a thread was handed to, and who it was
delegated to, so an agent does not start work a Linear-hosted agent is
finishing. Reactions come back counted by emoji — a thread with one comment and
nine thumbs up is not a thread with one comment.

### Where the code is

If the app was built with [`@skyelight/build`](https://www.npmjs.com/package/@skyelight/build),
`get_item` ends with the line that changes what an agent does next:

```
Written by components/Card.tsx, line 88, in build a1b2c3d on branch feat/checkout.
```

The file saves a grep. The commit and branch are how an agent tells "still
broken" from "already fixed, this pin is stale" — and, on a preview
deployment, which branch the code it wants is actually on.

## Who a write belongs to

Every write is **a person's**. Your sign-in or token carries your access, so a
reply the agent posts is yours. Over the remote server, the editor it came
through is shown as a mark beside the timestamp rather than as the author.

There is no service-account mode, and workspace API keys (`sk_live_...`) no
longer work. The API accepts two credentials, both of which are you: an OAuth
sign-in and a personal token (`sky_...`).

## Permissions

The server enforces nothing; the API does. The agent can do what your account
can do in that workspace, and nothing more:

- Agent tools need a **paid seat** (owner, admin or collaborator) in an
  organization on **Pro or above**. A reviewer seat is refused with the
  reason — the workspace is listed and marked rather than hidden, so you are
  told which gate closed instead of being told it does not exist.
- **On Free**, a paid seat connects for publishing: `list_workspaces`,
  `list_projects` and `publish_review_link` (one hosted prototype). The
  reading tools answer with how much feedback is waiting and that reading it
  is on Pro; the rest name the plan.
- Adding a deployed app's address to Review Links is for owners and admins.
- Owners, admins and collaborators read, reply, raise items and change any
  thread's status.
- A token only reaches workspaces in the organization it was created in.
