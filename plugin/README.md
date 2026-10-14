# Skyelight for Claude Code

Skyelight is feedback pinned directly on the pages of a running app: a
comment on a button, a heading or a layout, with the element it points at and,
when the app uses the Skyelight build plugin, the source file and line behind
it. This plugin gives Claude Code that feedback, so it can fix what people
asked for and tell them when it's done.

## What it adds

- **The Skyelight connection.** Skyelight's hosted MCP server at
  `https://app.skyelight.ai/mcp`, with 18 tools to list, search and read
  feedback, check feedback on a file before editing it, post updates, set
  status, and publish a review link.
- **A skill, `skyelight-feedback`.** How to work through feedback: catch up,
  read the whole thread, check the files you'll touch, post what you changed,
  and leave resolving to the person who asked.
- **Two commands.** `/skyelight:whats-new` catches you up;
  `/skyelight:fix-feedback` picks up an item and fixes it.

## Install

```
/plugin marketplace add plastrlab/skyelight-mcp
/plugin install skyelight@skyelight
```

The first time Claude Code connects, it opens a browser to sign in to
Skyelight (OAuth). No API key is stored in the plugin or in your settings.

You need a Skyelight account. Reading feedback with an agent needs a seat
(owner, admin or collaborator) on Pro or above; on Free the connection can
publish a review link. Plans: https://www.skyelight.ai/docs/plans

## What data it sends

The plugin itself runs nothing on your machine. Claude Code talks to
`https://app.skyelight.ai/mcp` over HTTPS, signed in as you, and only when a
tool is called.

- **What Skyelight receives:** each tool call and its arguments. That
  includes the text Claude writes when it posts an update or creates an item,
  the file paths it asks about (`find_by_source`), and, for
  `publish_review_link`, the prototype code it publishes. Skyelight records
  each call (who, which tool, when, whether it succeeded) for usage limits and
  support.
- **What Claude receives:** the feedback you can already see in Skyelight:
  threads, who wrote them, the page and element, source locations, and the
  screenshots your workspace captured.
- **What it doesn't send:** your source code, files or repository, except
  what Claude puts in a tool call's arguments.

Every call acts with your own permissions in Skyelight. A write is yours, with
the editor it came through (Claude Code) shown beside the timestamp.

- Privacy policy: https://www.skyelight.ai/privacy-policy
- Terms of service: https://www.skyelight.ai/terms-of-service
- Docs: https://www.skyelight.ai/docs/mcp
- Support: support@skyelight.ai or
  https://github.com/plastrlab/skyelight-mcp/issues

## License

Proprietary; free to install and use with a Skyelight account. See
[LICENSE](LICENSE).
