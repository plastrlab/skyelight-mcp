/**
 * The launch tools: reading a project's history the way an agent needs it.
 *
 * - `project_review`: where a project landed, for a wrap-up or hand-off.
 * - `whats_new`: what changed since you last looked.
 * - `find_by_source`: feedback by the file and component that rendered it.
 * - `find_similar` and `merge_items`: has this been reported, and folding
 *   duplicates into one.
 * - `decision_log` and `save_rule`: what the team keeps deciding, and
 *   keeping it as a project rule.
 *
 * Same contract as `tools.js`: each result is prose with the numbers and
 * quotes already in it, every claim carrying the id it came from, and the
 * structured payload attached beside it. The prose is complete on its own,
 * because many clients only show a model the text.
 */

export function insightToolDefinitions() {
  return [
    {
      name: "project_review",
      description:
        "Everything needed to write an accurate project review or hand-off document: " +
        "the shape of the work, every resolved thread and how it ended, what was " +
        "deferred and why, what is still open, and the longest conversations quoted " +
        "in full, which is where decisions were made. Every entry carries its item id, " +
        "so each claim in your document can be traced back to its thread. Quote; do " +
        "not invent outcomes the threads do not state.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "Project to review. Optional if a project is bound.",
          },
          section: {
            type: "string",
            enum: ["resolved", "deferred", "open", "discussions"],
            description:
              "Omit for the overview (all counts, first rows of each section). Name one to read it in full, a page at a time.",
          },
          offset: {
            type: "number",
            description:
              "With section: where to start, from the previous result's 'more' line.",
          },
        },
      },
    },
    {
      name: "whats_new",
      description:
        "What changed on a project since you last looked: new threads, new replies " +
        "grouped by thread, what was resolved or deferred, and what was assigned to " +
        "you or mentioned you. Call it at the start of a session. Without `since` it " +
        "reads from your bookmark and moves it forward; with `since` it reads that " +
        "window and leaves the bookmark alone.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "Optional if a project is bound.",
          },
          since: {
            type: "string",
            description:
              'Optional. A date or time ("2026-09-01", an ISO time) to read from instead of your bookmark.',
          },
        },
      },
    },
    {
      name: "find_by_source",
      description:
        "Feedback by the code that rendered it, from the file and line the Skyelight " +
        "build plugin stamps on each element. Pass a file (a path or just its name) or " +
        "a component to see every thread about it before you edit it; pass neither to " +
        "get the hot spots, every stamped file ranked by outstanding feedback.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "Optional if a project is bound.",
          },
          file: {
            type: "string",
            description:
              'A source path or file name, e.g. "src/components/PricingTable.tsx" or "PricingTable.tsx".',
          },
          line: {
            type: "number",
            description: "Optional. Threads nearest this line come first.",
          },
          component: {
            type: "string",
            description: 'A component name, e.g. "PricingTable".',
          },
          status: { type: "string", enum: ["open", "deferred", "resolved"] },
          limit: { type: "number" },
        },
      },
    },
    {
      name: "find_similar",
      description:
        "Has this already been reported? Pass the text you are about to report (and " +
        "the page, if you know it) before create_item, or an itemId to find what an " +
        "existing thread duplicates. Returns likely matches with why each matched: " +
        "shared words, same page, same element, same source file. If two are the same " +
        "problem, merge_items folds one into the other.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "Optional if a project is bound or itemId is given.",
          },
          text: {
            type: "string",
            description: "What someone is about to report.",
          },
          itemId: {
            type: "string",
            description: "Instead of text: find duplicates of this item.",
          },
          page: {
            type: "string",
            description: 'Optional. A page path or URL, e.g. "/checkout".',
          },
          selector: {
            type: "string",
            description: "Optional. CSS selector of the element.",
          },
          includeResolved: {
            type: "boolean",
            description:
              "Default true: a resolved match may mean it came back. false to skip them.",
          },
          limit: { type: "number", description: "Max matches (default 5)." },
        },
      },
    },
    {
      name: "merge_items",
      description:
        "Fold duplicate items into one, the way merging works in the app: the " +
        "duplicates leave the list and count as extra reports on the item they were " +
        "merged into. Use it only when find_similar and the threads themselves show " +
        "they are the same problem. Owners, admins and collaborators can merge.",
      inputSchema: {
        type: "object",
        properties: {
          itemId: {
            type: "string",
            description: "The item to keep. The others fold into it.",
          },
          duplicateIds: {
            type: "array",
            items: { type: "string" },
            description: "Items that report the same problem.",
          },
        },
        required: ["itemId", "duplicateIds"],
      },
    },
    {
      name: "decision_log",
      description:
        "The decisions a project made in its threads, quoted: every thread resolved or " +
        "deferred after a discussion, with the conversation, plus types people " +
        "corrected and where outcomes keep recurring. Also returns the project's " +
        "existing rules, so you can tell what is new. Use it to write a decision log, " +
        "or to find rules worth keeping with save_rule.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "Optional if a project is bound.",
          },
          since: {
            type: "string",
            description:
              'Optional. Only decisions after this date ("2026-09-01").',
          },
          limit: {
            type: "number",
            description: "Decisions per page (default 15, at most 30).",
          },
          offset: {
            type: "number",
            description:
              "Where to start, from the previous result's 'more' line.",
          },
        },
      },
    },
    {
      name: "save_rule",
      description:
        'Keep a rule the team agreed on ("sentence case in every button", "the brand ' +
        "gray stays, do not raise contrast bugs on it\") in the project's context, " +
        "under Rules learned. The classifier reads that context, and every agent reads " +
        "it through decision_log, so it shapes future threads. Cite the threads it came " +
        "from. Workspace owners and admins only; confirm with the person before saving.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "Optional if a project is bound.",
          },
          rule: {
            type: "string",
            description: "The rule, in one plain sentence.",
          },
          sourceItemIds: {
            type: "array",
            items: { type: "string" },
            description: "Items the rule came from.",
          },
        },
        required: ["rule"],
      },
    },
  ];
}

export const INSIGHT_TOOLS = new Set(
  insightToolDefinitions().map((t) => t.name),
);

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function date(ms) {
  return ms ? new Date(ms).toISOString().slice(0, 10) : "unknown date";
}

function flaggedLine(i) {
  // A machine summary is not the reporter's words; say so once per row.
  return i.lineSource === "summary" ? `${i.line} (summary)` : `"${i.line}"`;
}

function row(i, extra = []) {
  const bits = [i.typeLabel ?? i.type ?? "Unclassified", i.page, ...extra];
  if (i.replyCount) bits.push(plural(i.replyCount, "reply", "replies"));
  if (i.reportCount > 1) bits.push(`${i.reportCount} reports`);
  if (i.source) {
    bits.push(`${i.source.file}${i.source.line ? `:${i.source.line}` : ""}`);
  }
  return `- ${flaggedLine(i)}\n  ${bits.join(" · ")} (id ${i.id})`;
}

function quote(m) {
  return `  > ${m.author}${m.via ? ` (with ${m.via})` : ""}, ${date(m.at)}: ${m.text}`;
}

function cappedNote(result) {
  return result.capped
    ? "This project is larger than one call reads (2,000 most recent pins), so counts are a floor."
    : null;
}

export function renderProjectReview(r) {
  const out = [];
  const c = r.counts;
  const only = r.section; // one section, a page at a time; null = overview
  const pages = r.pages;
  const more = (name) => {
    const p = pages[name];
    return p.nextOffset === null
      ? null
      : `  (${p.total - p.nextOffset} more: call project_review with section "${name}" and offset ${p.nextOffset})`;
  };

  out.push(
    only
      ? `# ${r.project.name}: ${only}, from ${r.offset + 1}`
      : `# ${r.project.name}: project review data`,
  );
  out.push("");
  out.push(
    `${plural(c.threads, "thread", "threads")} over ${plural(r.span.days, "day", "days")} ` +
      `(${date(r.span.firstAt)} to ${date(r.span.lastAt)}): ${c.resolved} resolved, ` +
      `${c.deferred} deferred, ${c.open} open. ${plural(c.replies, "reply", "replies")} ` +
      `from ${plural(c.people, "person", "people")}.` +
      (c.mergedDuplicates
        ? ` ${plural(c.mergedDuplicates, "duplicate was", "duplicates were")} merged.`
        : "") +
      (c.retyped ? ` ${c.retyped} retyped by hand.` : ""),
  );
  const note = cappedNote(r);
  if (note) out.push(note);

  if (!only) {
    if (r.byType.length) {
      out.push("");
      out.push("## By type");
      for (const t of r.byType) {
        out.push(
          `- ${t.key}: ${t.total} (${t.resolved} resolved, ${t.deferred} deferred, ${t.open} open)`,
        );
      }
    }
    if (r.byPage.length) {
      out.push("");
      out.push("## Busiest pages");
      for (const p of r.byPage.slice(0, 10)) {
        out.push(`- ${p.key}: ${p.total} (${p.open} open)`);
      }
    }
    if (r.people.length) {
      out.push("");
      out.push("## Who took part");
      for (const p of r.people.slice(0, 10)) {
        out.push(
          `- ${p.name}: ${plural(p.threads, "thread", "threads")}, ${plural(p.replies, "reply", "replies")}`,
        );
      }
    }
  }

  if (!only || only === "resolved") {
    out.push("");
    out.push(`## Resolved (${c.resolved}, newest first)`);
    if (!r.resolved.length) out.push("Nothing resolved.");
    for (const i of r.resolved) {
      out.push(
        row(i, [
          `resolved ${date(i.resolvedAt)}${i.resolvedBy ? ` by ${i.resolvedBy}` : ""}`,
        ]),
      );
      if (i.lastWord) out.push(quote(i.lastWord));
    }
    const m = more("resolved");
    if (m) out.push(m);
  }

  if (!only || only === "deferred") {
    out.push("");
    out.push(`## Deferred (${c.deferred})`);
    if (!r.deferred.length) out.push("Nothing deferred.");
    for (const i of r.deferred) {
      out.push(
        row(i, [
          `deferred ${date(i.deferredAt)}${i.deferredBy ? ` by ${i.deferredBy}` : ""}`,
        ]),
      );
      out.push(
        i.reason ? quote(i.reason) : "  (no reason written on the thread)",
      );
    }
    const m = more("deferred");
    if (m) out.push(m);
  }

  if (!only || only === "open") {
    out.push("");
    out.push(`## Still open (${c.open}, oldest first)`);
    if (!r.open.length) out.push("Nothing open.");
    for (const i of r.open) {
      out.push(
        row(i, [
          `${plural(i.ageDays, "day", "days")} old`,
          i.assignee ? `assigned to ${i.assignee}` : "unassigned",
        ]),
      );
    }
    const m = more("open");
    if (m) out.push(m);
  }

  if ((!only || only === "discussions") && pages.discussions.total) {
    out.push("");
    out.push(
      `## The longest conversations (${pages.discussions.total}; where decisions were made)`,
    );
    for (const d of r.discussions) {
      out.push(row(d, [d.status]));
      out.push(quote(d.opening));
      if (d.omittedReplies) {
        out.push(`  (${d.omittedReplies} earlier replies not shown)`);
      }
      for (const m of d.replies) out.push(quote(m));
    }
    const m = more("discussions");
    if (m) out.push(m);
  }

  out.push("");
  out.push(
    "Write the review from these facts. Read the remaining pages of any section you summarize before stating totals from it. Cite item ids, quote rather than paraphrase outcomes, and say when a thread does not state why it ended.",
  );
  return out.join("\n");
}

export function renderWhatsNew(r) {
  const c = r.counts;
  const out = [];
  const window = `since ${new Date(r.since).toISOString().replace("T", " ").slice(0, 16)} UTC`;
  const total =
    c.newThreads +
    c.newReplies +
    c.resolved +
    c.deferred +
    c.assignedToYou +
    c.mentionsYou;
  out.push(
    `${r.project.name}, ${window}${r.firstBriefing ? " (your first briefing, so the last 7 days)" : ""}:`,
  );
  if (total === 0) {
    out.push("Nothing new.");
    return out.join("\n");
  }
  out.push(
    `${plural(c.newThreads, "new thread", "new threads")}, ${plural(c.newReplies, "new reply", "new replies")} ` +
      `on ${plural(c.threadsWithNewReplies, "thread", "threads")}, ${c.resolved} resolved, ${c.deferred} deferred.`,
  );
  const note = cappedNote(r);
  if (note) out.push(note);

  if (r.assignedToYou.length) {
    out.push("");
    out.push("## Assigned to you");
    for (const i of r.assignedToYou) {
      out.push(
        row(i, [i.assignedBy ? `by ${i.assignedBy}` : ""].filter(Boolean)),
      );
    }
  }
  if (r.mentionsYou.length) {
    out.push("");
    out.push("## Mentioned you");
    for (const m of r.mentionsYou) {
      out.push(
        `- on ${m.thread ? flaggedLine(m.thread) : "a thread"} (id ${m.threadId})`,
      );
      out.push(quote(m.mention));
    }
  }
  if (r.newThreads.length) {
    out.push("");
    out.push("## New threads");
    for (const i of r.newThreads) out.push(row(i, [i.status]));
  }
  if (r.newReplies.length) {
    out.push("");
    out.push("## New replies");
    for (const i of r.newReplies) {
      out.push(row(i, [i.status]));
      if (i.omittedReplies) out.push(`  (${i.omittedReplies} more not shown)`);
      for (const m of i.replies) out.push(quote(m));
    }
  }
  if (r.resolved.length) {
    out.push("");
    out.push("## Resolved");
    for (const i of r.resolved) {
      out.push(row(i, i.resolvedBy ? [`by ${i.resolvedBy}`] : []));
    }
  }
  if (r.deferred.length) {
    out.push("");
    out.push("## Deferred");
    for (const i of r.deferred) {
      out.push(row(i, i.deferredBy ? [`by ${i.deferredBy}`] : []));
    }
  }
  return out.join("\n");
}

export function renderBySource(r) {
  const out = [];
  const cov = r.coverage;
  if (cov.stamped === 0) {
    return (
      `${r.project.name}: none of its ${plural(cov.threads, "thread", "threads")} carry a source stamp. ` +
      "Stamps come from the Skyelight build plugin (@skyelight/build) on preview builds; " +
      "threads pinned on a build without it have no file to match."
    );
  }
  if (r.mode === "hotspots") {
    out.push(
      `${r.project.name}: ${cov.stamped} of ${plural(cov.threads, "thread", "threads")} carry a source stamp, ` +
        `across ${plural(r.totalFiles, "file", "files")}. Most outstanding feedback first:`,
    );
    for (const f of r.files) {
      out.push(
        `- ${f.file}: ${f.open} open, ${f.deferred} deferred, ${f.resolved} resolved` +
          (f.components.length ? ` (${f.components.join(", ")})` : ""),
      );
    }
    out.push("");
    out.push("Pass file to see the threads about one of them.");
    return out.join("\n");
  }
  const what = [r.query.file, r.query.component].filter(Boolean).join(", ");
  if (r.matched === 0) {
    return `No threads on ${what} in ${r.project.name}. ${cov.stamped} of ${cov.threads} threads carry a source stamp.`;
  }
  out.push(
    `${plural(r.matched, "thread", "threads")} on ${what}: ${r.summary.open} open, ` +
      `${r.summary.deferred} deferred, ${r.summary.resolved} resolved.`,
  );
  for (const i of r.items) out.push(row(i, [i.status]));
  out.push("");
  out.push("Use get_item with an id for the full thread and the element.");
  return out.join("\n");
}

export function renderSimilar(r) {
  const out = [];
  const about = r.subject ? `item ${r.subject.id}` : "that report";
  if (!r.candidates.length) {
    return `Nothing in ${r.project.name} looks like ${about} (compared against ${plural(r.compared, "thread", "threads")}). Likely new.`;
  }
  out.push(
    `Possible matches for ${about} in ${r.project.name}, strongest first:`,
  );
  for (const c of r.candidates) {
    out.push(row(c, [c.status]));
    out.push(`  score ${c.score}: ${c.reasons.join(", ")}`);
  }
  out.push("");
  out.push(
    "Read the threads before deciding. If one is the same problem, reply on it instead of creating a new item, or fold duplicates with merge_items.",
  );
  return out.join("\n");
}

export function renderMerged(r) {
  return r.merged
    ? `Merged ${plural(r.merged, "item", "items")} into ${r.canonicalId}. They count as extra reports on it now.`
    : `Nothing merged: those items were already merged into ${r.canonicalId}, or were the same item.`;
}

export function renderDecisionLog(r) {
  const out = [];
  out.push(`# ${r.project.name}: decisions`);
  const note = cappedNote(r);
  if (note) out.push(note);
  out.push("");
  out.push("## Rules the project already has");
  out.push(r.rules.projectContext || "(no project context yet)");
  if (r.rules.workspaceInstructions) {
    out.push("");
    out.push("Workspace instructions:");
    out.push(r.rules.workspaceInstructions);
  }

  out.push("");
  out.push(
    `## Decided in threads (${r.decided}${r.decisions.length < r.decided ? `, ${r.offset + 1} to ${r.offset + r.decisions.length} shown` : ""})`,
  );
  if (!r.decisions.length)
    out.push("No thread was resolved or deferred after a discussion.");
  for (const d of r.decisions) {
    out.push(
      row(d, [
        `${d.outcome} ${date(d.decidedAt)}${d.decidedBy ? ` by ${d.decidedBy}` : ""}`,
      ]),
    );
    out.push(quote(d.question));
    if (d.omittedReplies)
      out.push(`  (${d.omittedReplies} earlier replies not shown)`);
    for (const m of d.conversation) out.push(quote(m));
  }
  if (r.nextOffset !== null && r.nextOffset !== undefined) {
    out.push(
      `  (${r.decided - r.nextOffset} more: call decision_log with offset ${r.nextOffset})`,
    );
  }

  if (r.corrections.length) {
    out.push("");
    out.push("## Types people corrected");
    for (const c of r.corrections) {
      out.push(`- ${c.from} to ${c.to}: "${c.line}" (id ${c.id})`);
    }
  }
  if (r.recurring.length) {
    out.push("");
    out.push("## Where outcomes recur");
    for (const x of r.recurring)
      out.push(`- ${x.where}: ${x.resolved} resolved`);
  }
  out.push("");
  out.push(
    "State each decision with its id and quote. To keep one as a rule for future threads, confirm with the person, then save_rule.",
  );
  return out.join("\n");
}

export function renderRuleSaved(r) {
  if (r.duplicate)
    return `That rule is already in the project context. Nothing saved.`;
  return (
    `Saved to the project's Rules learned: "${r.rule}"` +
    (r.cited?.length ? ` (citing ${r.cited.join(", ")})` : "") +
    ". The classifier and every agent will read it from now on."
  );
}

/** Text for a launch tool's result, or null for a tool that is not one. */
export function renderInsight(name, data) {
  switch (name) {
    case "project_review":
      return renderProjectReview(data);
    case "whats_new":
      return renderWhatsNew(data);
    case "find_by_source":
      return renderBySource(data);
    case "find_similar":
      return renderSimilar(data);
    case "merge_items":
      return renderMerged(data);
    case "decision_log":
      return renderDecisionLog(data);
    case "save_rule":
      return renderRuleSaved(data);
    default:
      return null;
  }
}

/** The stdio side: each launch tool as its REST call. */
export async function callInsightTool(name, args, { client, projectId }) {
  switch (name) {
    case "project_review":
      return client.projectReview({
        projectId,
        section: args.section,
        offset: args.offset,
      });
    case "whats_new":
      return client.whatsNew({ projectId, since: args.since });
    case "find_by_source":
      return client.findBySource({
        projectId,
        file: args.file,
        line: args.line,
        component: args.component,
        status: args.status,
        limit: args.limit,
      });
    case "find_similar":
      if (!args.itemId && !args.text?.trim()) {
        throw new Error(
          "find_similar needs the text you are about to report, or an itemId",
        );
      }
      return client.findSimilar({
        projectId,
        text: args.text,
        itemId: args.itemId,
        page: args.page,
        selector: args.selector,
        includeResolved: args.includeResolved,
        limit: args.limit,
      });
    case "merge_items":
      if (!args.itemId) throw new Error("merge_items needs an itemId");
      return client.mergeItems({
        itemId: args.itemId,
        duplicateIds: args.duplicateIds ?? [],
      });
    case "decision_log":
      return client.decisionLog({
        projectId,
        since: args.since,
        limit: args.limit,
        offset: args.offset,
      });
    case "save_rule":
      if (!args.rule?.trim()) throw new Error("save_rule needs the rule text");
      return client.saveRule({
        projectId,
        rule: args.rule,
        sourceItemIds: args.sourceItemIds,
      });
    default:
      return undefined;
  }
}
