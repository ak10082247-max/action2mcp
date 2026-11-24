#!/usr/bin/env node
/**
 * CI helper: Looks up or creates Cloudflare KV namespace "KUROX_FUNNEL_KV"
 * using CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID and binds FUNNEL_KV
 * cleanly across all four Cloudflare wrangler.toml configs prior to deploy.
 */
import fs from "node:fs";

const accId = (process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID || "").trim();
const token = (process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN || "").trim();
const title = "KUROX_FUNNEL_KV";
const configs = [
  "wrangler.toml",
  "site_rescue/wrangler.toml",
  "ecom_fix/wrangler.toml",
  "revenue_dashboard/wrangler.toml",
  "brand_watch/wrangler.toml",
  "art50_scan/wrangler.toml",
];

if (!accId || !token) {
  console.error("[!] CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN missing; skipping KV binding injection.");
  process.exit(0);
}

const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const listRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accId}/storage/kv/namespaces?per_page=100`, { headers: hdrs });
const listJson = await listRes.json().catch(() => ({}));
if (!listRes.ok || !listJson.success) {
  console.warn("[!] Unable to list KV namespaces (HTTP " + listRes.status + "); continuing deploy without KV patch.");
  process.exit(0);
}

let ns = (listJson.result || []).find((x) => x.title === title);
if (!ns) {
  const createRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accId}/storage/kv/namespaces`, {
    method: "POST",
    headers: hdrs,
    body: JSON.stringify({ title }),
  });
  const createJson = await createRes.json().catch(() => ({}));
  if (!createRes.ok || !createJson.success || !createJson.result?.id) {
    console.warn("[!] Unable to create KV namespace (HTTP " + createRes.status + "); continuing without KV patch.");
    process.exit(0);
  }
  ns = createJson.result;
  console.log("[+] Created Cloudflare KV namespace:", title, ns.id);
} else {
  console.log("[+] Found existing Cloudflare KV namespace:", title, ns.id);
}

for (const cfg of configs) {
  let raw = fs.readFileSync(cfg, "utf8");
  if (/binding\s*=\s*"FUNNEL_KV"/.test(raw)) continue;
  raw = raw.trimEnd() + `\n\n[[kv_namespaces]]\nbinding = "FUNNEL_KV"\nid = "${ns.id}"\n`;
  fs.writeFileSync(cfg, raw);
  console.log("[+] Bound FUNNEL_KV in", cfg);
}
