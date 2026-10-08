/** Types for images.js — see tools.d.ts for why declarations are shipped. */

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ImageBlock {
  type: "image";
  /** Base64, no data: prefix — what the MCP content block wants. */
  data: string;
  mimeType: string;
}

export type ContentBlock = TextBlock | ImageBlock;

export declare const MAX_IMAGES: number;
export declare const MAX_IMAGE_BYTES: number;

export interface ImageSource {
  url: string;
  storageId: string | null;
  label: string;
}

/** What a loader hands back: the bytes, or why there are none. */
export type LoadedImage =
  | { bytes: Uint8Array; mimeType?: string; skipped?: undefined }
  | { skipped: string };

export declare function imageSources(item: unknown): ImageSource[];

export declare function imageBlocksFor(
  item: unknown,
  options?: {
    /** Where the bytes come from. Defaults to fetching `source.url`. */
    load?: (source: ImageSource) => Promise<LoadedImage>;
    fetchImpl?: typeof fetch;
    maxImages?: number;
    maxBytes?: number;
  },
): Promise<ContentBlock[]>;
