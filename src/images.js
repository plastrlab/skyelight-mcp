/**
 * Evidence, as something a model can actually look at.
 *
 * `get_item` used to print `Screenshot: https://…` and stop there. No agent
 * tool turns a link into a picture, so the most expensive thing Skyelight
 * captures — the state of the page at the moment somebody pinned it — reached
 * nobody. The same was true of the images people attach themselves, which are
 * frequently the whole diagnosis: the reply that says "here, look".
 *
 * MCP tool results are a LIST of content blocks and an image is one of them,
 * so the fix is to fetch the bytes and hand them over as
 * `{ type: "image", data, mimeType }`.
 *
 * Shared by both transports on purpose. The stdio package and the remote
 * endpoint are two doors onto the same server, and an agent that can see a
 * screenshot through one and not the other is the kind of difference nobody
 * can debug from the outside.
 */

/**
 * How many pictures one call may carry.
 *
 * A thread with a screenshot on every reply would otherwise put a dozen
 * images into a single result. Four is the evidence capture plus the first
 * few things people attached, which is where the information is — an
 * eleventh screenshot of the same page has never changed a diagnosis.
 */
export const MAX_IMAGES = 4;

/**
 * The most one picture may weigh.
 *
 * Captures are JPEG at quality 0.85 and at most 2x device density, so a large
 * viewport lands around a megabyte and nothing legitimate comes close to this.
 * The cap is here for what people attach, which is arbitrary: somebody drags
 * in a full-resolution phone screenshot and every subsequent call carries it.
 *
 * Over the line, the link is reported instead, with the size, so the reader
 * knows a picture exists and why it is not here. Downscaling would be better
 * and is not available: neither the dependency-free stdio package nor the
 * Convex runtime has an image codec to re-encode with.
 */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Bytes to base64, in both runtimes this module is loaded into. */
function toBase64(bytes) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  // Convex runs a V8 isolate with no Buffer. `btoa` takes a binary string,
  // and building one in chunks keeps the argument list to `fromCharCode`
  // inside what a call stack will take.
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CHUNK)),
    );
  }
  return btoa(binary);
}

/**
 * The pictures on one item, in the order a reader wants them.
 *
 * Evidence first: it answers "what did this look like" without opening
 * anything. Then what people attached, thread before replies, which is the
 * order `attachments` already arrives in.
 */
export function imageSources(item) {
  const sources = [];
  if (item?.evidence?.screenshotUrl) {
    sources.push({
      url: item.evidence.screenshotUrl,
      storageId: item.evidence.screenshotStorageId ?? null,
      label: "The page when this was pinned:",
    });
  }
  for (const a of item?.attachments ?? []) {
    if (!a?.url) continue;
    sources.push({
      url: a.url,
      storageId: a.storageId ?? null,
      label: `Attached by ${a.author ?? "someone"}${
        a.where === "reply" ? ", on a reply" : ""
      }:`,
    });
  }
  return sources;
}

/**
 * The default loader: pull the storage URL over HTTP.
 *
 * What the stdio package has to do, because the bytes are on the other side
 * of the network from it. The remote endpoint runs inside the deployment that
 * holds them and passes its own loader instead — see `load` below.
 */
function httpLoader(fetchImpl) {
  return async (source) => {
    let res;
    try {
      res = await fetchImpl(source.url);
    } catch (err) {
      return { skipped: `could not be fetched (${err.message})` };
    }
    if (!res.ok) return { skipped: `could not be fetched (${res.status})` };
    const mimeType = (res.headers?.get?.("content-type") ?? "")
      .split(";")[0]
      .trim();
    return { bytes: new Uint8Array(await res.arrayBuffer()), mimeType };
  };
}

/**
 * Content blocks to append after `get_item`'s text.
 *
 * Each picture is introduced by a line saying what it is, because four
 * unlabelled images of the same application are four things a reader has to
 * work out. Anything that could not be inlined comes back as a closing note
 * with its link, so a picture never disappears silently.
 *
 * Never throws. A screenshot that will not load is a worse work order, not a
 * failed tool call — the thread, the anchor and the source line are all still
 * in the text block above it.
 *
 * `load` is how the bytes arrive. It is injected because the two transports
 * are in different places relative to the file: the stdio package is across a
 * network and fetches the URL, and the remote endpoint is inside the
 * deployment that stores it and reads it straight out of storage. Everything
 * after that — the labels, the size ceiling, the cap, the notes — is one code
 * path, which is the only way the two doors keep answering the same.
 */
export async function imageBlocksFor(item, options = {}) {
  const {
    fetchImpl = fetch,
    load,
    maxImages = MAX_IMAGES,
    maxBytes = MAX_IMAGE_BYTES,
  } = options;
  const loader = load ?? httpLoader(fetchImpl);

  const sources = imageSources(item);
  if (sources.length === 0) return [];

  const blocks = [];
  const notes = [];
  for (const source of sources.slice(0, maxImages)) {
    let got;
    try {
      got = await loader(source);
    } catch (err) {
      got = { skipped: `could not be read (${err.message})` };
    }

    // Storage serves what was uploaded. Anything that is not an image is a
    // misfiled attachment, and a non-image in an image block fails at the
    // client rather than here, which is a worse place to find out.
    if (!got.skipped && got.mimeType && !got.mimeType.startsWith("image/")) {
      got = { skipped: `is not an image (${got.mimeType})` };
    }
    if (!got.skipped && got.bytes.byteLength > maxBytes) {
      got = {
        skipped:
          `is ${Math.round(got.bytes.byteLength / 1024)}KB, over the ` +
          `${Math.round(maxBytes / 1024)}KB limit for an inline image`,
      };
    }

    if (got.skipped) {
      notes.push(`${source.label} ${source.url} — ${got.skipped}.`);
      continue;
    }
    blocks.push({ type: "text", text: source.label });
    blocks.push({
      type: "image",
      data: toBase64(got.bytes),
      mimeType: got.mimeType || "image/jpeg",
    });
  }

  const overflow = sources.length - maxImages;
  if (overflow > 0) {
    notes.push(
      `${overflow} more image${overflow === 1 ? "" : "s"} on this thread, not shown.`,
    );
  }
  if (notes.length > 0) {
    blocks.push({ type: "text", text: notes.join("\n") });
  }
  return blocks;
}
