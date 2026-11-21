/**
 * A small, polite Wikimedia Commons API client (dev-only).
 * - One request at a time, at least GAP_MS apart, with `maxlag` so the API can
 *   ask us to wait when its servers are busy.
 * - Retries 429, 5xx and maxlag answers with growing waits.
 * - Identifies itself as the Wikimedia User-Agent policy asks
 *   (meta.wikimedia.org/wiki/User-Agent_policy): client name and version, a
 *   contact, and the library. The contact is the owner's public GitHub profile,
 *   given by the owner for this purpose (DECISIONS AU12); no e-mail address.
 */
export const CONTACT_URL = "https://github.com/Denver6-d";
export const USER_AGENT = `kitaba-audio-pipeline/1.1 (${CONTACT_URL}; open-data build script, low volume, sequential) node/${process.versions.node}`;
export const API = "https://commons.wikimedia.org/w/api.php";
const GAP_MS = 350;
const TIMEOUT_MS = 30_000;

let last = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function paced(url, init = {}) {
  const wait = last + GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  // A stalled connection would otherwise hang for minutes (Node's fetch has no overall timeout).
  return fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), ...init, headers: { "user-agent": USER_AGENT, "api-user-agent": USER_AGENT, ...(init.headers ?? {}) } });
}

/** GET with retries. Returns the Response (ok) or throws after the last try. */
export async function get(url, { tries = 6 } = {}) {
  let delay = 2000;
  for (let i = 1; ; i++) {
    let res;
    try {
      res = await paced(url);
    } catch (e) {
      if (i >= tries) throw e;
      await sleep(delay);
      delay *= 2;
      continue;
    }
    if (res.ok) return res;
    if (i >= tries || !(res.status === 429 || res.status >= 500)) throw new Error(`${res.status} for ${url}`);
    const retryAfter = Number(res.headers.get("retry-after"));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : delay);
    delay *= 2;
  }
}

/** One API query (JSON, formatversion 2). Retries "maxlag" answers. */
export async function query(params) {
  const qs = new URLSearchParams({ action: "query", format: "json", formatversion: "2", maxlag: "5", ...params });
  for (let i = 0; i < 6; i++) {
    const body = await (await get(`${API}?${qs}`)).json();
    if (body.error?.code === "maxlag") {
      await sleep(5000 * (i + 1));
      continue;
    }
    if (body.error) throw new Error(`Commons API: ${body.error.code} ${body.error.info}`);
    return body;
  }
  throw new Error("Commons API stayed lagged");
}
