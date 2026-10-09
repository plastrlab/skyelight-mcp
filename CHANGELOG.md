# Changelog

Notable changes to `@skyelight/mcp`. Dates are npm publish dates.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this package follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

What a version number means here: the tools are the interface. A **minor** is a
new tool, a new argument, or a new field in a result — an agent that ignores it
keeps working. A **patch** is a fix or a wording change. A **major** would be
removing a tool or an argument, or changing what an existing field means, and
there has not been one.

## 0.8.1 — 2026-10-09

### Fixed

- **Starts without credentials.** With no token configured, the server used
  to print the setup message and exit before the handshake, so MCP
  directories and clients checking what it can do saw no tools at all. It
  now completes the handshake and lists its tools; each tool call returns the
  setup message as its error until a token is configured. Nothing more is
  exposed than the README and source already show. The hosted server at
  `app.skyelight.ai/mcp` already worked this way.

## 0.8.0 — 2026-10-08

### Added

- **`list_items` filters by hand-off.** A new `task` argument (`investigate`,
  `plan`, `fix`, or `none`) returns only the items a person handed to an agent
  with that task in the app, or only those with none. Each row in the list now
  names its hand-off, so an agent can choose its work without fetching every
  item.

## 0.7.3 — 2026-10-08

### Changed

- **Docs.** The README opens with a picture of Skyelight. No change to the
  tools.

## 0.7.2 — 2026-10-08

### Changed

- **Source on GitHub.** The package's source is published at
  [github.com/plastrlab/skyelight-mcp](https://github.com/plastrlab/skyelight-mcp),
  and `package.json` names it as the repository, so npm links to it. The
  license is unchanged: free to install and run with a Skyelight account
  (see `LICENSE`). No change to the tools.

## 0.7.1 — 2026-10-05

### Changed

- **Docs.** The README lists `publish_review_link` and says what the MCP
  does on Free. No change to the tools.

## 0.7.0 — 2026-10-05

### Changed

- **`publish_prototype` is now `publish_review_link`, and takes `code` or
  `url`.** With `code`, as before: Skyelight hosts one file at its own link.
  With `url`, a deployed app (Lovable, v0, Bolt, Vercel) goes on the
  project's Review Links, and the answer carries the script tag to add to
  the app's `<head>`. Code that is part of a larger app is no longer hosted;
  the answer says to send the app's `url`. The server still answers the old
  name, so 0.6.0 keeps working.
- **`source`:** where a hosted prototype was made (`claude`, `openai`, `v0`,
  `lovable` and others), shown as its logo on the project's Review Links.

- **`list_workspaces` says what an agent can't do in a workspace:** a
  reviewer seat, a plan without agent tools, or Free, whose MCP publishes
  prototypes.

## 0.6.0 — 2026-10-05

### Added

- **`publish_prototype`.** Hosts a prototype on Skyelight: pass the complete
  code of one file (an HTML page, or one React component with an export
  default) and Skyelight serves it at its own link with the review badge on
  it, in a project of your choosing or a new one. Returns the share link and
  the project link. Publishing again with the same `prototypeId`, or the same
  name in the same project, makes a new version at the same link. Owners,
  admins and collaborators; on a person's own connection.

## 0.5.3 — 2026-10-02

### Changed

- **License.** `@skyelight/mcp` is now proprietary ("UNLICENSED" on npm; see
  `LICENSE`): it may be used to connect your own tools to your own Skyelight
  account, and not copied, modified or redistributed. Versions up to 0.5.2
  stay under the MIT License they were published with. No change to the
  tools or how they behave.

## 0.5.2 — 2026-09-30

### Changed

- **Docs.** The README links the full guide,
  [skyelight.ai/docs/mcp](https://skyelight.ai/docs/mcp), and the REST API
  reference, [skyelight.ai/docs/api](https://skyelight.ai/docs/api).

## 0.5.1 — 2026-09-29

### Changed

- **Skyelight's own address.** `npx @skyelight/mcp init` registers
  `https://app.skyelight.ai/mcp` by default, instead of the deployment's
  `.convex.site` host, and the README gives `https://app.skyelight.ai` as
  `SKYELIGHT_API_URL`. Servers registered with the old address keep
  working; re-run `init` to move to the new one.

## 0.5.0 — 2026-09-29

### Added

- **Seven tools for working with a project's history.** `whats_new` catches
  you up since you last looked, from a bookmark kept per person per project.
  `project_review` returns what a project settled, for a review or hand-off
  document. `decision_log` quotes the threads where decisions were made and
  returns the project's rules; `save_rule` keeps a new one (owners and
  admins). `find_by_source` finds feedback by the file or component the build
  plugin stamped. `find_similar` checks for an existing report, and
  `merge_items` folds duplicates together. Needs a deployment with the
  `/api/v1/review`, `/whats-new`, `/source`, `/similar`, `/decisions`,
  `/rules` and `/items/merge` routes. `project_review` and `decision_log`
  are paged (`section`, `offset`) so a result fits in an agent's context.

- **Hosted server speaks MCP 2026-07-28.** Not in this package (its stdio
  server keeps the `initialize` handshake), but worth knowing: the hosted
  `/mcp` now answers `server/discover` and modern requests in that
  revision's shape, which ChatGPT requires.

- **The Skyelight mark and title.** `serverInfo` carries `title` and
  `icons`, so clients that show a server's icon show ours. Each tool also
  carries ChatGPT's status lines for while it runs and once it is done.

- **Tool annotations.** Every tool says whether it only reads
  (`readOnlyHint`), and `merge_items` that it hides items
  (`destructiveHint`), so clients can ask before a write.

- **Assigning and mentioning people (SKY-324).** `list_members` returns the
  workspace's people. `assign` hands an item to one of them, or unassigns it
  with `null`. `create_item` takes `assignee` and `mentions`, and
  `post_update` takes `mentions`. People can be named by name, email, id or
  `me`; an ambiguous name is refused with the candidates. They are notified
  the way an assignment or a mention in the app notifies them. Needs a
  deployment with the `/api/v1/members` and `/api/v1/items/assign` routes.

- **A picker when several agents are installed.** `init` detected them all
  along and then refused to choose: it printed the list and exited 1, as
  though having two editors were an error. Most developers have more than
  one, so the commonest case on the first command anybody runs was a dead
  end. It asks now, with `a` for every agent at once.
- **`--client all`**, the same thing without the question.
- **`npx @skyelight/mcp remove`**, which there was no command for at all —
  uninstalling meant knowing where five different agents keep their config
  and editing each by hand. Defaults to every agent rather than asking
  which one to forget, takes Codex's `oauth` sub-table with the server
  (removing only the first leaves a table that parses as a server with no
  url), and leaves `mcpServers` in place when it empties: it is the
  client's key, not ours.
- **Skyelight's own colours**, from `--accent` in the app's own tokens so the
  terminal and the product are one blue rather than two that were each
  chosen to look right alone. Everything degrades: 24-bit where `COLORTERM`
  says so, the 256-colour cube otherwise, plain text under `NO_COLOR`, when
  stdout is piped, or under `TERM=dumb`. Marks fall back to ASCII where the
  locale is not UTF-8, because a console that cannot draw a glyph renders
  corruption rather than plainness.
- **The deployment in the header.** Running this against the wrong one is the
  mistake with the least visible symptom — everything succeeds, against
  somebody else's data — and nothing said which one before it happened.

### Changed

- **The help screen** lists the agents, the flags and the environment
  variables in aligned columns, rather than two example commands.
- **Registering several agents** reports one summary at the end, telling
  "added" from "already set up" instead of reporting neither.

## 0.4.1 — 2026-09-19

### Fixed

- **Two wrong permission claims in the README**, which is what npm serves on
  the package page. It said a reviewer "reads and cannot write" — a reviewer
  replies and raises items like every other role. It also said resolving stays
  a person's call "for a thread you do not own", which read as a rule for
  everyone; the actual rule touches only reviewers, who may move threads they
  opened and nobody else's. Both are now taken from `convex/mcp/writes.ts`.
- Documented the 0.4.0 tool surface, which the README had not caught up with:
  the image blocks, merged duplicates, `assignee: "me"`, and the read ceiling.

### Added

- This changelog, and it ships in the package.

## 0.4.0 — 2026-09-19

Nine things the Skyelight web app had shown a person for months that the tool
results did not carry.

### Added

- **`get_item` returns the pictures as pictures.** The screenshot taken when
  the pin was left, and any images people attached to the thread, come back as
  MCP `image` content blocks instead of links no agent tool can open. Capped at
  four per call and 4MB each; anything skipped is named with its link and the
  reason. The stdio transport fetches the storage URL, and the remote endpoint
  reads its own storage directly.
- **Merged duplicates leave the list**, and the item they were merged into
  carries `reportCount`. Five reports of one problem used to read as five bugs.
- **`list_workspaces` returns `you`** — the caller's own user id and name — and
  `list_items` accepts `assignee: "me"`. "What is assigned to me" had no way to
  be asked before.
- **`get_item` carries `linear`**, naming the issue a thread was handed to and
  who it was delegated to, so an agent stops starting work a Linear-hosted
  agent is already finishing.
- **`get_item` carries `attachments` and `reactions`.** Attachments cover the
  thread and its replies, in reading order; reactions are counted by emoji
  rather than listed one row per person.
- **List rows use the classifier's one-line summary** where there is one, with
  `excerptSource` saying whether the line is a machine summary or the
  reporter's own words. Rows used to be the first 140 characters of whatever
  somebody typed.
- **The 2,000-item read ceiling states itself.** `capped` is set when it binds
  and the narration calls the counts a floor rather than a total. The scan also
  reads newest-first, so the items it keeps when it binds are the live ones.

### Fixed

- `set_status` returned a bare string where the server expected `{ text, data }`,
  so a successful move answered with an empty content block and the model had
  no way to tell it had worked.
- `initialize` reported `0.1.0`. Both transports carried their own stale copy
  of that literal while the package shipped 0.3.0. There is one `VERSION`
  constant now, and a test asserts it matches `package.json`.
- `status=deferred` was refused with a 400 by the API the stdio transport calls,
  although every tool schema has offered `deferred` since it existed.

## 0.3.0 — 2026-09-17

### Added

- Grok in the installer's client list, and a README that lists it.

## 0.2.0 — 2026-09-09

### Added

- `npx @skyelight/mcp init` — finds the coding agent, registers the remote
  server with it, and leaves sign-in to OAuth, so nothing is pasted and no key
  is stored on disk.
- The `ui://` item card, for clients that can render an MCP Apps resource. The
  text result is complete on its own, so the card is strictly additive.

## 0.1.4 — 2026-09-09

### Added

- The component that rendered the pinned element, where `@skyelight/build`
  stamped it.

## 0.1.3 — 2026-09-09

### Added

- Projects sort by real activity rather than by when the project record last
  changed, so "anything new here?" gets a true answer.

## 0.1.2 — 2026-09-08

### Added

- The source file and line behind a pin, and a repo permalink pinned to the
  commit the page was built from.

## 0.1.1 — 2026-09-08

### Fixed

- The README npm was serving.

## 0.1.0 — 2026-09-08

First release. An MCP server over stdio that reads the feedback people left on
a running app — the thread, the page, the element they pointed at — and reports
back on it (SKY-273).
