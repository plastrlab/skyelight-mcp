# Skyelight

Skyelight holds feedback people pinned on pages of a running web app. Each item has a thread, the page URL and the element it points at, with any console errors or failed requests from just before the pin. Projects that use Skyelight Build also carry the source file, line, commit and branch.

## When to use the skyelight tools

When the user asks about feedback, review comments, reported bugs on their site, or a Skyelight link, and before you edit a file that may have feedback on it. The `skyelight-feedback` skill has the full steps.

## How to work an item

1. If you don't know the project, call `list_projects`, then `list_items`. A `.skyelight.json` with `{"projectId": "..."}` in the repo names it.
2. Call `get_item` before you change any code, and `find_by_source` for each file you are about to edit.
3. Make the change.
4. Call `post_update` on the same thread: what you changed, where, and how to check it.
5. Leave resolving to the user. Call `set_status` only when they confirm the fix.

Call `whats_new` only when the user asks what changed since they last looked: it moves their bookmark.

## When you list or summarize feedback

The user reads this, not code. For each item:

- Say what the person asked for, and who asked, in one plain sentence.
- Group items by page. Give the status in plain words: open, parked for later (deferred), or resolved.
- Leave out item IDs, element selectors, test IDs and component names unless the user is about to fix the item or asks for them. Keep them for your own tool calls.

For example: **New alert page:** Sidney Keith suggested a standard date picker instead of the custom one in the Timing section. Parked for later.

## Hand-offs are binding

`get_item` shows whether a person handed the thread to an agent as **Investigate**, **Plan** or **Fix**. On Investigate or Plan, reply with `post_update` and change no code, even if asked to in chat. Fix is the go-ahead.

## Sign-in

If a Skyelight tool fails because the user isn't signed in, tell them to run `/mcp auth skyelight`, sign in in the browser that opens, and ask again. Gemini CLI won't start the sign-in by itself.
