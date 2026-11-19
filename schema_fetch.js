/**
 * Shared SSRF-safe OpenAPI JSON/YAML remote schema fetcher for Worker & Apify Actor.
 */

export function isBlockedPrivateHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  return (
    !h ||
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    h.startsWith("10.") ||
    h.startsWith("192.168.") ||
    h.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  );
}

export async function fetchRemoteSchemaText(schemaUrl, fetchFn = fetch) {
  let parsed;
  try {
    parsed = new URL(String(schemaUrl || "").trim());
  } catch {
    throw Object.assign(new Error("Invalid schema_url format."), { httpStatus: 400 });
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw Object.assign(new Error("schema_url must use http or https."), { httpStatus: 400 });
  }
  if (isBlockedPrivateHost(parsed.hostname)) {
    throw Object.assign(new Error("Blocked private or loopback schema_url host (SSRF protection)."), {
      httpStatus: 403,
    });
  }
  const res = await fetchFn(parsed.toString(), {
    headers: {
      "User-Agent": "Action2MCP-SchemaFetcher/1.0",
      Accept: "application/json,text/yaml,text/plain,*/*",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw Object.assign(new Error(`Failed to fetch schema_url (HTTP ${res.status}).`), {
      httpStatus: res.status === 404 ? 404 : 502,
    });
  }
  const txt = await res.text();
  if (!txt || txt.length > 500000) {
    throw Object.assign(new Error("Fetched schema is empty or exceeds 500KB limit."), { httpStatus: 422 });
  }
  return txt;
}

export async function resolveSchemaFromParams(params, fetchFn = fetch) {
  let schemaText = String(params?.schema || params?.openapi || "").trim();
  const schemaUrl = String(params?.schema_url || params?.spec_url || "").trim();
  if (!schemaText && schemaUrl) {
    schemaText = await fetchRemoteSchemaText(schemaUrl, fetchFn);
  }
  return { schemaText, schemaUrl };
}
