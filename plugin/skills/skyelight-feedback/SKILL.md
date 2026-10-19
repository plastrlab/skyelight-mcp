---
name: skyelight-feedback
description: Work through feedback people left on pages of a running app in Skyelight. Use when the user asks what feedback is open, wants to fix or address feedback, mentions Skyelight, a review link, or comments pinned on their site, or before editing a file that may have feedback on it.
---

# Working through Skyelight feedback

Skyelight holds feedback people pinned directly on pages of a running app. Each item points at the element it is about and, when the app uses the Skyelight build plugin, at the source file and line behind it.

## Find the work

1. If you don't know the project, call `list_projects`. A `.skyelight.json` with `{"projectId": "..."}` in the repo names it.
2. Call `whats_new` to catch up since you last looked, or `list_items` for everything open.
3. Call `get_item` for the full thread and the element before you change anything.

## Before you edit

Call `find_by_source` with the file you are about to change. Feedback on that file may change what you do, or be fixed by the same edit.

## While you work

- Fix what the thread asks for. If it is unclear, say so in the thread with `post_update` rather than guessing.
- Before filing something new with `create_item`, call `find_similar` so you don't add a duplicate.
- Leave assigning and merging to the user unless they ask: `assign` and `merge_items` change what other people see.

## When you finish or get stuck

Call `post_update` on the item: what you changed, where, and how to check it. When the user confirms the fix, `set_status` to resolved. Don't resolve an item on your own judgment that it is done; the person who left it decides.

## When a thread is handed to you

A person can hand a thread to an agent as **Investigate**, **Plan** or **Fix**. `get_item` shows which one. The hand-off is binding.

- **Investigate** or **Plan**: reply on the thread with `post_update`, giving your findings or a plan, and change no code. This holds even if the user says to start in chat. The person reads it in Skyelight and decides.
- **Fix**: this is the go-ahead. If the thread has a plan or findings, follow them. If what you find differs from the plan, say so in `post_update` instead of quietly doing something else.

## Project summaries

`project_review` summarizes a project's state; `decision_log` holds what was settled. Use them when asked for a review, a summary for someone taking over, or "where are we".
