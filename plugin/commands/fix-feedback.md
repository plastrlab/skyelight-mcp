---
name: fix-feedback
description: Pick up an open Skyelight feedback item and fix it
argument-hint: "[item or project]"
---

Use the skyelight-feedback skill. Find the open feedback for "$ARGUMENTS" (an item, or a project; if empty, the project for this repo). Pick the item to work on, or ask me if there are several and the choice isn't clear. Read it with `get_item`, check `find_by_source` for the files you'll touch, make the fix, and post what you changed with `post_update`. Don't resolve it; I'll do that once I've checked.
