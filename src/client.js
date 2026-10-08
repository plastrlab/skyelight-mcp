/**
 * HTTP calls to the Skyelight public API. No business logic — the server
 * decides what a key may see; this just carries the bearer token and turns
 * error bodies into readable messages.
 */

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function createClient({ apiUrl, token, fetchImpl = fetch }) {
  async function post(path, body) {
    let res;
    try {
      res = await fetchImpl(apiUrl + path, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new ApiError(`Could not reach ${apiUrl}: ${err.message}`, 0);
    }
    const text = await res.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      throw new ApiError(
        `${res.status} from ${path}, and the body was not JSON`,
        res.status,
      );
    }
    if (!res.ok) {
      throw new ApiError(
        parsed.error ?? `Request failed (${res.status})`,
        res.status,
      );
    }
    return parsed;
  }

  async function request(path, params = {}) {
    const url = new URL(apiUrl + path);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }

    let res;
    try {
      res = await fetchImpl(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      throw new ApiError(`Could not reach ${apiUrl}: ${err.message}`, 0);
    }

    const text = await res.text();
    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      throw new ApiError(
        `${res.status} from ${path}, and the body was not JSON`,
        res.status,
      );
    }

    if (!res.ok) {
      // The API's own message is more useful than anything invented here —
      // it says which role the key has, or that a project is out of scope.
      throw new ApiError(
        body.error ?? `Request failed (${res.status})`,
        res.status,
      );
    }
    return body;
  }

  return {
    /**
     * The fetch this client was built with, for the one thing that is not an
     * API call: pulling a storage URL the API just handed us so its bytes can
     * be returned as an image. Exposed rather than wrapped because it carries
     * no bearer token — those links are their own credential, and attaching
     * ours to an off-API request is how a token ends up somewhere it was
     * never meant to go.
     */
    fetchImpl,
    listWorkspaces: () => request("/api/v1/workspaces"),
    listProjects: (params) => request("/api/v1/projects", params),
    listItems: (params) => request("/api/v1/items", params),
    getItem: (id) => request(`/api/v1/items/${encodeURIComponent(id)}`),
    postUpdate: (body) => post("/api/v1/items/update", body),
    createItem: (body) => post("/api/v1/items/create", body),
    setStatus: (body) => post("/api/v1/items/status", body),
    listMembers: (params) => request("/api/v1/members", params),
    assign: (body) => post("/api/v1/items/assign", body),
    projectReview: (params) => request("/api/v1/review", params),
    whatsNew: (params) => request("/api/v1/whats-new", params),
    findBySource: (params) => request("/api/v1/source", params),
    findSimilar: (body) => post("/api/v1/similar", body),
    mergeItems: (body) => post("/api/v1/items/merge", body),
    decisionLog: (params) => request("/api/v1/decisions", params),
    saveRule: (body) => post("/api/v1/rules", body),
    publishReviewLink: (body) => post("/api/v1/review-links", body),
  };
}
