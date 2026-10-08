/**
 * Types for tools.js.
 *
 * The module is plain JavaScript so the package stays dependency-free and
 * runnable with no build step. It is also imported by convex/mcp/protocol.ts,
 * which is TypeScript — and by the extension's tsconfig, which does not
 * enable allowJs. Shipping declarations is what lets one definition of the
 * tool set serve all three without a build.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  _meta?: Record<string, unknown>;
  securitySchemes?: Array<{ type: string; scopes?: string[] }>;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

export declare function toolDefinitions(opts?: {
  uiResourceUri?: string;
}): ToolDefinition[];

export declare function renderList(
  result: unknown,
  opts?: { searched?: string },
): string;

export declare function renderItem(item: unknown): string;
export declare function renderWorkspaces(result: unknown): string;
export declare function renderProjects(result: unknown): string;
export declare function renderMembers(result: unknown): string;
export declare function renderAssigned(result: unknown): string;

export declare function renderPublished(result: unknown): string;
export declare function renderReviewLink(result: unknown): string;
export declare function renderPosted(
  result: unknown,
  opts: { kind: "update" | "item" },
): string;

export declare function callTool(
  name: string,
  args: Record<string, unknown>,
  deps: { client: unknown; config: { projectId?: string | null } },
): Promise<{
  text: string;
  data: unknown;
  /** Blocks to append after the text. `get_item` returns images here. */
  content?: import("./images.js").ContentBlock[];
}>;

export declare const PROJECT_HINT: string;
