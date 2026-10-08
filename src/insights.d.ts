/** Types for insights.js; see tools.d.ts for why the package ships these. */

import type { ToolDefinition } from "./tools.js";

export declare function insightToolDefinitions(): ToolDefinition[];
export declare const INSIGHT_TOOLS: Set<string>;
export declare function renderInsight(
  name: string,
  data: unknown,
): string | null;
export declare function callInsightTool(
  name: string,
  args: Record<string, any>,
  opts: { client: any; projectId?: string },
): Promise<unknown> | undefined;
