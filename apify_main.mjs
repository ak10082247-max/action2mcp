/**
 * Action2MCP — Apify Pay-Per-Event (PPE) Execution Entrypoint
 * Verify -> Compile -> Charge -> Store (zero charge on invalid or unreachable specs)
 */

import { pathToFileURL } from "node:url";
import { compileOpenApiToMcp, buildDeployableBundle } from "./compiler.js";
import { createZipArchive } from "./zip_builder.js";
import { resolveSchemaFromParams } from "./schema_fetch.js";

export const APIFY_PPE_EVENT = "action2mcp-compile";

export async function compileForApify(rawInput = {}, opts = {}) {
  const input = rawInput && typeof rawInput === "object" ? rawInput : {};
  const fetchFn = opts.fetchFn || fetch;
  const resolved = await resolveSchemaFromParams(input, fetchFn);
  if (!resolved.schemaText) {
    throw new Error("Missing required OpenAPI 3.0/3.1 input: provide 'schema' (JSON/YAML string) or 'schema_url'.");
  }

  const compiled = compileOpenApiToMcp({
    schemaText: resolved.schemaText,
    instructions: typeof input.instructions === "string" ? input.instructions : "",
    authType: typeof input.auth_type === "string" ? input.auth_type : "auto",
    authHeaderName: typeof input.auth_header === "string" ? input.auth_header : "",
  });

  const files = buildDeployableBundle(compiled);
  const includeZip = input.include_zip !== false;
  const zipBytes = includeZip ? createZipArchive(files) : null;

  return {
    record: {
      status: "success",
      event_name: APIFY_PPE_EVENT,
      timestamp_ms: Date.now(),
      title: compiled.title,
      openapi_version: compiled.openapi_version,
      base_url: compiled.base_url,
      spec_url: resolved.schemaUrl || null,
      tool_count: compiled.tool_count,
      consequential_count: compiled.consequential_count,
      warnings: compiled.warnings,
      mcp_tools: compiled.mcp_tools,
      skill_md: compiled.skill_md,
      files,
      zip_size_bytes: zipBytes ? zipBytes.length : 0,
    },
    zipBytes,
  };
}

export async function runActorMain(opts = {}) {
  const { Actor } = opts.actorModule || (await import("apify"));
  await Actor.init();
  try {
    const input = (await Actor.getInput()) || {};
    const { record, zipBytes } = await compileForApify(input, opts);

    if (zipBytes) {
      await Actor.setValue("bundle.zip", Buffer.from(zipBytes), { contentType: "application/zip" });
      const kvId = process.env.APIFY_DEFAULT_KEY_VALUE_STORE_ID;
      if (kvId) {
        record.bundle_zip_url = `https://api.apify.com/v2/key-value-stores/${encodeURIComponent(kvId)}/records/bundle.zip`;
      }
    }

    try {
      await Actor.charge({ eventName: APIFY_PPE_EVENT, count: 1 });
    } catch (chargeErr) {
      console.warn(`[action2mcp-apify] PPE charge notice: ${chargeErr?.message || chargeErr}`);
    }

    await Actor.setValue("OUTPUT", record);
    await Actor.pushData(record);
    await Actor.exit();
  } catch (err) {
    console.error(`[action2mcp-apify] Compilation failed: ${err.message}`);
    await Actor.fail(`Action2MCP compilation failed: ${err.message}`);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  await runActorMain();
}
