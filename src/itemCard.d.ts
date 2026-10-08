/** Types for itemCard.js — see tools.d.ts for why declarations are shipped. */

export declare const ITEM_CARD_URI: string;
export declare const MCP_APP_MIME_TYPE: string;
export declare const UI_EXTENSION_KEY: string;
export declare const APPS_PROTOCOL_VERSION: string;

/** Whether a client declared it can render an MCP Apps HTML resource. */
export declare function clientSupportsUi(source: unknown): boolean;

export declare function itemCardResource(): {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
};

export declare function itemCardContents(): {
  uri: string;
  mimeType: string;
  text: string;
  _meta: { ui: Record<string, unknown> };
};
