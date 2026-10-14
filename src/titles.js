/**
 * Each tool's name for people. Connector directories (Claude's, ChatGPT's)
 * show these and require one on every tool, and the admin tool shows them
 * beside the names in its usage tables. Kept apart from tools.js so a page
 * can read them without loading the tools.
 */
export const TOOL_TITLES = {
  list_workspaces: "List workspaces",
  list_projects: "List projects",
  list_items: "List feedback",
  search_items: "Search feedback",
  get_item: "Get feedback item",
  list_members: "List members",
  project_review: "Review project",
  whats_new: "What's new",
  find_by_source: "Find feedback by source file",
  find_similar: "Find similar feedback",
  decision_log: "Decision log",
  post_update: "Post an update",
  create_item: "Create feedback",
  set_status: "Set status",
  assign: "Assign",
  save_rule: "Save a rule",
  merge_items: "Merge duplicates",
  publish_review_link: "Publish a review link",
};
