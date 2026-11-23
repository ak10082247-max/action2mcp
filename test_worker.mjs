import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync, createHmac } from "node:crypto";
import worker from "./worker.js";
import { compileOpenApiToMcp, generateStandaloneWorkerJs, buildDeployableBundle } from "./compiler.js";
import { createZipArchive } from "./zip_builder.js";
import { compileForApify, runActorMain, APIFY_PPE_EVENT } from "./apify_main.mjs";
import { signCdpJwt } from "./cdp_auth.js";
import { computeStopLossVerdict } from "./edge_helpers.js";
import siteRescueWorker from "./site_rescue/worker.js";
import ecomFixWorker from "./ecom_fix/worker.js";
import brandWatchWorker from "./brand_watch/worker.js";
import { validateTikTokVideoUrl, extractUnverifiedCautionRecord } from "./brand_watch/scanner.js";
import revenueDashboardWorker from "./revenue_dashboard/worker.js";

function createMemoryKv() {
  const store = new Map();
  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(String(key), String(value));
    },
    async delete(key) {
      store.delete(String(key));
    },
    async list({ prefix = "", limit = 1000 } = {}) {
      const keys = [];
      for (const name of store.keys()) {
        if (name.startsWith(prefix)) keys.push({ name });
        if (keys.length >= limit) break;
      }
      return { keys, list_complete: true, cursor: "" };
    },
  };
}

const ENV = {
  MERCHANT_BASE_ADDRESS: "0x80E0Ae84679b7f11bE171DaADd492FBECf628cd6",
  MERCHANT_SOLANA_ATA: "DD3A7jaXFeHcif9eYj6Vhomuxypat5Yxi8ow6wxz27yL",
  MERCHANT_SOLANA_OWNER: "9wuMysgXwNhtQeqJgGByAiMYc4EjzZ5wUSmnjrrt3ffh",
  SOLANA_FEE_PAYER: "CjNFTjvBhbJJd2B5ePPMHRLx1ELZpa8dwQgGL727eKww",
  PAYAI_FACILITATOR: "https://facilitator.payai.network",
};
const SIGNING_SECRET = "test-a2m-signing-secret-0123456789abcdef";
const FULL_ENV = {
  ...ENV,
  STRIPE_SECRET_KEY: "sk_test_action2mcp_123",
  KUROX_SIGNING_SECRET: SIGNING_SECRET,
};

const MULTI_ENDPOINT_YAML = `
openapi: "3.1.0"
info:
  title: Inventory Ops GPT
  version: "1.2.0"
  description: Manage warehouse stock and trigger restock orders.
servers:
  - url: https://api.inventory-ops.example.com
components:
  securitySchemes:
    apiKeyHeader:
      type: apiKey
      in: header
      name: X-Warehouse-Key
  schemas:
    RestockItem:
      type: object
      required:
        - sku
        - qty
      properties:
        sku:
          type: string
          description: Product SKU code
        qty:
          type: integer
paths:
  /v1/items/{sku}:
    get:
      operationId: getStockBySku
      summary: Fetch real-time stock level for a SKU
      x-openai-isConsequential: false
      parameters:
        - name: sku
          in: path
          required: true
          schema:
            type: string
        - name: warehouse
          in: query
          schema:
            type: string
  /v1/restock:
    post:
      operationId: submitRestockOrder
      summary: Submit a warehouse restock order
      x-openai-isConsequential: true
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/RestockItem"
`;

test("Compiler parses YAML OpenAPI 3.1 + x-openai-isConsequential + $ref and generates valid standalone Worker & ZIP", async () => {
  const compiled = compileOpenApiToMcp({
    schemaText: MULTI_ENDPOINT_YAML,
    instructions: "Always verify stock levels before restocking.",
  });
  assert.equal(compiled.ok, true);
  assert.equal(compiled.tool_count, 2);
  assert.equal(compiled.consequential_count, 1);
  assert.equal(compiled.auth.authType, "api_key_header");
  assert.equal(compiled.auth.headerName, "X-Warehouse-Key");

  const getTool = compiled.mcp_tools.find((t) => t.name === "get_stock_by_sku");
  const postTool = compiled.mcp_tools.find((t) => t.name === "submit_restock_order");
  assert.ok(getTool && postTool);
  assert.equal(getTool.annotations.readOnlyHint, true);
  assert.equal(postTool.annotations.destructiveHint, true);
  assert.deepEqual(postTool.inputSchema.required, ["sku", "qty"]);
  assert.match(compiled.skill_md, /name: inventory-ops-gpt/);
  assert.match(compiled.skill_md, /Always verify stock levels before restocking\./);

  // Verify standalone generated worker.js parses as valid JS and executes tools/list cleanly
  const files = buildDeployableBundle(compiled);
  assert.ok(files["worker.js"] && files["wrangler.toml"] && files["SKILL.md"] && files["SETUP_CHATGPT_PLUGIN.md"] && files[".github/workflows/deploy.yml"]);

  const dataUrl = `data:text/javascript;base64,${Buffer.from(files["worker.js"]).toString("base64")}`;
  const mod = await import(dataUrl);
  const rpcRes = await mod.default.fetch(
    new Request("https://generated.workers.dev/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    }),
    {},
  );
  assert.equal(rpcRes.status, 200);
  assert.equal(rpcRes.headers.get("MCP-Protocol-Version"), "2025-03-26");
  const rpcJson = await rpcRes.json();
  assert.equal(rpcJson.result.tools.length, 2);

  // Verify PKZIP archive passes Python standard library zipfile integrity check
  const zipBytes = createZipArchive(files);
  assert.equal(zipBytes[0], 0x50);
  assert.equal(zipBytes[1], 0x4b);
  const pyCheck = spawnSync(
    "python",
    [
      "-c",
      "import io, sys, zipfile; z = zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None; print(','.join(sorted(z.namelist())))",
    ],
    { input: Buffer.from(zipBytes) },
  );
  assert.equal(pyCheck.status, 0, pyCheck.stderr?.toString());
  assert.match(pyCheck.stdout.toString(), /SETUP_CHATGPT_PLUGIN\.md/);
  assert.match(pyCheck.stdout.toString(), /worker\.js/);
});

test("Landing UI, /api/preview, /mcp convert_openapi_to_mcp, /server.json & /.well-known/x402.json", async () => {
  const [homeRes, previewRes, mcpRes, serverRes, x402Res] = await Promise.all([
    worker.fetch(new Request("https://action2mcp.ak10082247.workers.dev/"), FULL_ENV),
    worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema: MULTI_ENDPOINT_YAML }),
      }),
      FULL_ENV,
    ),
    worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 9,
          method: "tools/call",
          params: { name: "convert_openapi_to_mcp", arguments: { schema: MULTI_ENDPOINT_YAML } },
        }),
      }),
      FULL_ENV,
    ),
    worker.fetch(new Request("https://action2mcp.ak10082247.workers.dev/server.json"), FULL_ENV),
    worker.fetch(new Request("https://action2mcp.ak10082247.workers.dev/.well-known/x402.json"), FULL_ENV),
  ]);

  assert.equal(homeRes.status, 200);
  const homeHtml = await homeRes.text();
  assert.match(homeHtml, /Dec 11, 2026/);
  assert.match(homeHtml, /Action2MCP/);
  assert.match(homeHtml, /Download Free Worker ZIP/);
  assert.match(homeHtml, /\/api\/download-free/);
  assert.match(homeHtml, /\$25/);
  assert.match(homeHtml, /\$10 Deal/);
  assert.match(homeHtml, /spec_url/);

  assert.equal(previewRes.status, 200);
  const prev = await previewRes.json();
  assert.equal(prev.tool_count, 2);
  assert.equal(prev.consequential_count, 1);

  assert.equal(mcpRes.status, 200);
  const mcpData = await mcpRes.json();
  assert.equal(mcpData.result.isError, false);
  const parsedToolOut = JSON.parse(mcpData.result.content[0].text);
  assert.equal(parsedToolOut.tool_count, 2);

  assert.equal(serverRes.status, 200);
  const srv = await serverRes.json();
  assert.equal(srv.name, "io.github.ak10082247-max/action2mcp");

  assert.equal(x402Res.status, 200);
  const x4 = await x402Res.json();
  assert.equal(x4.merchantAddressBase, "0x80E0Ae84679b7f11bE171DaADd492FBECf628cd6");
  assert.equal(x4.merchantAddressSolana, "DD3A7jaXFeHcif9eYj6Vhomuxypat5Yxi8ow6wxz27yL");
});

test("Free ZIP download (/api/download-free), removed bundle paywall, $10 Hosted Deal (was $25) Stripe & x402 flows", async () => {
  const origFetch = globalThis.fetch;
  let verifyCalls = 0;
  let settleCalls = 0;

  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u === "https://api.stripe.com/v1/checkout/sessions") {
      return new Response(
        JSON.stringify({ id: "cs_test_1000", url: "https://checkout.stripe.com/c/pay/cs_test_1000" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (u.startsWith("https://api.stripe.com/v1/checkout/sessions/cs_test_paid_10")) {
      return new Response(
        JSON.stringify({
          id: "cs_test_paid_10",
          payment_status: "paid",
          amount_total: 1000,
          currency: "usd",
          customer_details: { email: "buyer@corp.io" },
          metadata: { tier: "hosted", spec_url: "https://raw.example.com/action.yaml" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (u === "https://raw.example.com/action.yaml") {
      return new Response(MULTI_ENDPOINT_YAML, { status: 200, headers: { "content-type": "text/yaml" } });
    }
    if (u === "https://facilitator.payai.network/verify") {
      verifyCalls += 1;
      return new Response(JSON.stringify({ isValid: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (u === "https://facilitator.payai.network/settle") {
      settleCalls += 1;
      return new Response(JSON.stringify({ success: true, payer: "0x1111", transaction: "0xabc123def456" }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (u === "https://api.inventory-ops.example.com/v1/items/SKU-9?warehouse=uk") {
      return new Response(JSON.stringify({ sku: "SKU-9", in_stock: 42 }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`Unexpected fetch in Action2MCP test: ${u}`);
  };

  try {
    // 0. 100% Free DIY Cloudflare Worker ZIP download (no checkout or email wall)
    const missingRes = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/download-free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      FULL_ENV,
    );
    assert.equal(missingRes.status, 400);

    const freeZipRes = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/download-free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema: MULTI_ENDPOINT_YAML, instructions: "Always check SKU first." }),
      }),
      FULL_ENV,
    );
    assert.equal(freeZipRes.status, 200);
    assert.equal(freeZipRes.headers.get("Content-Type"), "application/zip");
    const freeZipBytes = new Uint8Array(await freeZipRes.arrayBuffer());
    assert.equal(freeZipBytes[0], 0x50);
    assert.equal(freeZipBytes[1], 0x4b);
    const freeZipList = spawnSync(
      "python",
      [
        "-c",
        "import io, sys, zipfile; z = zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None; print(','.join(sorted(z.namelist())))",
      ],
      { input: Buffer.from(freeZipBytes) },
    );
    assert.equal(freeZipList.status, 0, freeZipList.stderr?.toString());
    const freeNames = freeZipList.stdout.toString();
    assert.match(freeNames, /worker\.js/);
    assert.match(freeNames, /wrangler\.toml/);
    assert.match(freeNames, /deploy\.yml/);
    assert.match(freeNames, /SKILL\.md/);
    assert.match(freeNames, /SETUP_CHATGPT_PLUGIN\.md/);

    // Bundle paywall removed cleanly
    const oldCheckout = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/checkout?tier=bundle"),
      FULL_ENV,
    );
    assert.equal(oldCheckout.status, 410);
    const oldBuy = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/buy?tier=bundle", { method: "POST" }),
      FULL_ENV,
    );
    assert.equal(oldBuy.status, 410);

    // 1. $10 Deal (was $25) Hosted Stripe Checkout creation
    const co10 = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/checkout?tier=hosted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: "hosted" }),
      }),
      FULL_ENV,
    );
    assert.equal(co10.status, 200);
    const j10 = await co10.json();
    assert.equal(j10.amount_cents, 1000);
    assert.equal(j10.tier, "hosted");
    assert.match(j10.url, /^https:\/\/checkout\.stripe\.com/);

    // 2. Paid $10 Stripe session preserves spec_url, compiles remote ZIP & mints Hosted MCP Bridge
    const fulHtmlRes = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/download?session_id=cs_test_paid_10"),
      FULL_ENV,
    );
    assert.equal(fulHtmlRes.status, 200);
    const fulHtml = await fulHtmlRes.text();
    assert.match(fulHtml, /https:\/\/raw\.example\.com\/action\.yaml/);
    assert.match(fulHtml, /Direct Download Compiled ZIP/);

    const zipRes = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/download?session_id=cs_test_paid_10&format=zip"),
      FULL_ENV,
    );
    assert.equal(zipRes.status, 200);
    assert.equal(zipRes.headers.get("Content-Type"), "application/zip");
    const zb = new Uint8Array(await zipRes.arrayBuffer());
    assert.equal(zb[0], 0x50);
    assert.equal(zb[1], 0x4b);

    // 3. Paid $10 Stripe JSON mints HMAC management token -> registers live hosted MCP bridge
    const ful10 = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/download?session_id=cs_test_paid_10&format=json"),
      FULL_ENV,
    );
    assert.equal(ful10.status, 200);
    const f10 = await ful10.json();
    assert.equal(f10.fulfillment.amount_total_cents, 1000);
    assert.ok(f10.fulfillment.management_token.startsWith("a2m_mgmt_v1."));
    assert.match(f10.fulfillment.hosted_bridge_url, /\/mcp\/h\/a2m_bridge_v1\./);

    const regRes = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/hosted/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${f10.fulfillment.management_token}`,
        },
        body: JSON.stringify({ schema: MULTI_ENDPOINT_YAML }),
      }),
      FULL_ENV,
    );
    assert.equal(regRes.status, 200);
    const regData = await regRes.json();
    assert.equal(regData.tool_count, 2);
    assert.match(regData.hosted_mcp_url, /\/mcp\/h\/a2m_bridge_v1\./);

    const hostedCallRes = await worker.fetch(
      new Request(regData.hosted_mcp_url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Upstream-Auth": "wh-secret-1" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 42,
          method: "tools/call",
          params: { name: "get_stock_by_sku", arguments: { sku: "SKU-9", warehouse: "uk" } },
        }),
      }),
      FULL_ENV,
    );
    assert.equal(hostedCallRes.status, 200);
    const hostedCallData = await hostedCallRes.json();
    assert.equal(hostedCallData.result.isError, false);
    assert.match(hostedCallData.result.content[0].text, /"in_stock": 42/);

    // 4. x402 HTTP 402 $10 USDC (10000000 atomic units) + settlement + pre-settlement fail-closed on broken schema
    const unp402 = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/buy?tier=hosted", { method: "POST" }),
      FULL_ENV,
    );
    assert.equal(unp402.status, 402);
    const ch402 = JSON.parse(Buffer.from(unp402.headers.get("PAYMENT-REQUIRED"), "base64").toString("utf8"));
    const baseOpt = ch402.accepts.find((a) => a.network === "eip155:8453");
    const solOpt = ch402.accepts.find((a) => a.network.startsWith("solana:"));
    assert.equal(baseOpt.amount, "10000000");
    assert.equal(solOpt.amount, "10000000");
    assert.equal(ch402.extensions?.bazaar?.discoverable, true);
    assert.ok(ch402.extensions?.bazaar?.schema);

    const sig = Buffer.from(
      JSON.stringify({ x402Version: 2, resource: ch402.resource, accepted: baseOpt, payload: { signature: "0x11" } }),
    ).toString("base64");

    const badSchemaRes = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/buy?tier=hosted", {
        method: "POST",
        headers: { "Content-Type": "application/json", "PAYMENT-SIGNATURE": sig },
        body: JSON.stringify({ schema: "{invalid json" }),
      }),
      FULL_ENV,
    );
    assert.equal(badSchemaRes.status, 422);
    assert.equal(settleCalls, 0);

    const paidX402 = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/buy?tier=hosted", {
        method: "POST",
        headers: { "Content-Type": "application/json", "PAYMENT-SIGNATURE": sig },
        body: JSON.stringify({ schema: MULTI_ENDPOINT_YAML }),
      }),
      FULL_ENV,
    );
    assert.equal(paidX402.status, 200);
    assert.equal(verifyCalls, 2);
    assert.equal(settleCalls, 1);
    const paidBody = await paidX402.json();
    assert.equal(paidBody.paid, true);
    assert.equal(paidBody.tier, "hosted");
    assert.equal(paidBody.tool_count, 2);
    assert.ok(paidBody.files["worker.js"]);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("Coinbase CDP Facilitator Base routing with ES256 JWT + PayAI override", async () => {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pkcs8Pem = privateKey.export({ format: "pem", type: "pkcs8" });
  const CDP_ENV = {
    ...FULL_ENV,
    CDP_API_KEY_ID: "organizations/test-org/apiKeys/test-key-1",
    CDP_API_KEY_SECRET: pkcs8Pem.replace(/\n/g, "\\n"),
  };

  const healthRes = await worker.fetch(new Request("https://action2mcp.ak10082247.workers.dev/health"), CDP_ENV);
  assert.equal(healthRes.status, 200);
  const hJson = await healthRes.json();
  assert.equal(hJson.cdp_bazaar_enabled, true);
  assert.deepEqual(hJson.facilitators, ["coinbase-cdp", "payai"]);

  const jwtSample = await signCdpJwt({
    apiKeyId: CDP_ENV.CDP_API_KEY_ID,
    apiKeySecret: CDP_ENV.CDP_API_KEY_SECRET,
    requestMethod: "POST",
    requestPath: "/platform/v2/x402/verify",
  });
  assert.equal(jwtSample.split(".").length, 3);

  const origFetch = globalThis.fetch;
  let cdpVerifyAuth = "";
  let cdpVerifyExt = null;
  let cdpSettleCalls = 0;
  let payaiOverrideCalls = 0;

  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u === "https://api.cdp.coinbase.com/platform/v2/x402/verify") {
      cdpVerifyAuth = init?.headers?.Authorization || "";
      cdpVerifyExt = JSON.parse(String(init?.body || "{}")).paymentPayload?.extensions || null;
      return new Response(JSON.stringify({ isValid: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (u === "https://api.cdp.coinbase.com/platform/v2/x402/settle") {
      cdpSettleCalls += 1;
      return new Response(JSON.stringify({ success: true, payer: "0x2222", transaction: "0xcdpsettle999" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (u === "https://facilitator.payai.network/verify") {
      payaiOverrideCalls += 1;
      return new Response(JSON.stringify({ isValid: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (u === "https://facilitator.payai.network/settle") {
      return new Response(JSON.stringify({ success: true, payer: "0x3333", transaction: "0xpayaisettle" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`Unexpected fetch in CDP test: ${u}`);
  };

  try {
    const chRes = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/buy?tier=hosted", { method: "POST" }),
      CDP_ENV,
    );
    const ch = await chRes.json();
    const baseOpt = ch.accepts.find((a) => a.network === "eip155:8453");
    const sig = Buffer.from(
      JSON.stringify({ x402Version: 2, resource: ch.resource, accepted: baseOpt, payload: { signature: "0x99" } }),
    ).toString("base64");

    const paidCdp = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/buy?tier=hosted", {
        method: "POST",
        headers: { "Content-Type": "application/json", "PAYMENT-SIGNATURE": sig },
        body: JSON.stringify({ schema: MULTI_ENDPOINT_YAML }),
      }),
      CDP_ENV,
    );
    assert.equal(paidCdp.status, 200);
    assert.match(cdpVerifyAuth, /^Bearer eyJ/);
    assert.equal(cdpVerifyExt?.bazaar?.discoverable, true);
    assert.equal(cdpSettleCalls, 1);
    const paidJson = await paidCdp.json();
    assert.equal(paidJson.tx_hash, "0xcdpsettle999");

    const paidOverride = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/buy?tier=hosted", {
        method: "POST",
        headers: { "Content-Type": "application/json", "PAYMENT-SIGNATURE": sig, "X-X402-Facilitator": "payai" },
        body: JSON.stringify({ schema: MULTI_ENDPOINT_YAML }),
      }),
      CDP_ENV,
    );
    assert.equal(paidOverride.status, 200);
    assert.equal(payaiOverrideCalls, 1);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("Apify PPE entrypoint compiles OpenAPI -> MCP + ZIP before charging and rejects invalid inputs uncharged", async () => {
  const { record, zipBytes } = await compileForApify({ schema: MULTI_ENDPOINT_YAML, instructions: "Stock helper" });
  assert.equal(record.status, "success");
  assert.equal(record.event_name, APIFY_PPE_EVENT);
  assert.equal(record.tool_count, 2);
  assert.equal(record.consequential_count, 1);
  assert.match(record.skill_md, /Stock helper/);
  assert.equal(zipBytes[0], 0x50);
  assert.equal(zipBytes[1], 0x4b);

  const kvStore = {};
  const pushed = [];
  const charges = [];
  let failedMsg = "";
  let exited = false;

  const mockActor = {
    Actor: {
      init: async () => {},
      getInput: async () => ({ schema: MULTI_ENDPOINT_YAML }),
      setValue: async (k, v) => {
        kvStore[k] = v;
      },
      charge: async (ev) => {
        charges.push(ev);
      },
      pushData: async (d) => {
        pushed.push(d);
      },
      exit: async () => {
        exited = true;
      },
      fail: async (m) => {
        failedMsg = m;
      },
    },
  };

  await runActorMain({ actorModule: mockActor });
  assert.equal(exited, true);
  assert.equal(failedMsg, "");
  assert.deepEqual(charges, [{ eventName: "action2mcp-compile", count: 1 }]);
  assert.ok(kvStore["bundle.zip"]);
  assert.equal(pushed.length, 1);

  const badCharges = [];
  let badFailed = "";
  await runActorMain({
    actorModule: {
      Actor: {
        init: async () => {},
        getInput: async () => ({ schema_url: "http://127.0.0.1/secret.yaml" }),
        setValue: async () => {},
        charge: async (ev) => badCharges.push(ev),
        pushData: async () => {},
        exit: async () => {},
        fail: async (m) => {
          badFailed = m;
        },
      },
    },
  });
  assert.equal(badCharges.length, 0);
  assert.match(badFailed, /SSRF protection/i);
});

test("Play A (SiteRescue): live broken booking scan, $10 Deal (was $49) / $29 Priority (was $149) Stripe Checkout & ZIP recovery download", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u === "http://clinic.example.co.uk/") return new Response("", { status: 200 });
    if (u === "https://clinic.example.co.uk/") {
      return new Response('<html><head><title>Bright Dental Clinic</title></head><form action="http://clinic.example.co.uk/submit"></form><a href="/book-online">Book Appointment</a></html>', {
        status: 200,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-credentials": "true",
        },
      });
    }
    if (u === "https://clinic.example.co.uk/book-online") return new Response("Not Found", { status: 404 });
    if (u === "https://api.stripe.com/v1/checkout/sessions") {
      return new Response(JSON.stringify({ id: "cs_test_sr10", url: "https://checkout.stripe.com/c/pay/cs_test_sr10" }), { status: 200 });
    }
    if (u.startsWith("https://api.stripe.com/v1/checkout/sessions/cs_test_sr_paid")) {
      return new Response(
        JSON.stringify({ id: "cs_test_sr_paid", payment_status: "paid", amount_total: 1000, metadata: { tier: "pack", target_domain: "clinic.example.co.uk" } }),
        { status: 200 },
      );
    }
    throw new Error(`Unexpected fetch in SiteRescue test: ${u}`);
  };

  try {
    const hRes = await siteRescueWorker.fetch(new Request("https://site-rescue.ak10082247.workers.dev/health"), FULL_ENV);
    assert.equal(hRes.status, 200);
    const hJson = await hRes.json();
    assert.equal(hJson.plans.pack.amountCents, 1000);
    assert.equal(hJson.plans.pack.originalCents, 4900);
    assert.equal(hJson.plans.priority.amountCents, 2900);
    assert.equal(hJson.plans.priority.originalCents, 14900);
    assert.equal(hJson.plans.dfy.amountCents, 9900);
    assert.equal(hJson.plans.dfy.originalCents, 24900);

    const uiRes = await siteRescueWorker.fetch(new Request("https://site-rescue.ak10082247.workers.dev/"), FULL_ENV);
    const uiHtml = await uiRes.text();
    assert.match(uiHtml, /\$49/);
    assert.match(uiHtml, /\$10 Deal/);

    const scanRes = await siteRescueWorker.fetch(
      new Request("https://site-rescue.ak10082247.workers.dev/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: "clinic.example.co.uk", ssl_days_remaining: "5" }),
      }),
      FULL_ENV,
    );
    assert.equal(scanRes.status, 200);
    const scanData = await scanRes.json();
    assert.equal(scanData.broken_links.length, 1);
    assert.equal(scanData.broken_links[0].status, 404);
    assert.equal(scanData.missing_viewport, true);
    assert.equal(scanData.missing_og_image, true);
    assert.equal(scanData.cors_credentials_leak, true);
    assert.equal(scanData.insecure_http_assets.length, 1);
    assert.ok(scanData.issues.some((i) => i.includes("expires in 5 day(s)")));

    const coRes = await siteRescueWorker.fetch(
      new Request("https://site-rescue.ak10082247.workers.dev/api/checkout?tier=pack&domain=clinic.example.co.uk&format=json", { method: "POST" }),
      FULL_ENV,
    );
    assert.equal(coRes.status, 200);
    assert.equal((await coRes.json()).amount_cents, 1000);

    const zipRes = await siteRescueWorker.fetch(
      new Request("https://site-rescue.ak10082247.workers.dev/api/download?session_id=cs_test_sr_paid&format=zip"),
      FULL_ENV,
    );
    assert.equal(zipRes.status, 200);
    assert.equal(zipRes.headers.get("Content-Type"), "application/zip");
    const zb = new Uint8Array(await zipRes.arrayBuffer());
    const checkZip = spawnSync(
      "python",
      ["-c", "import io, sys, zipfile; z = zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None; print(','.join(sorted(z.namelist())))"],
      { input: Buffer.from(zb) },
    );
    assert.equal(checkZip.status, 0);
    assert.match(checkZip.stdout.toString(), /03-redirects\.htaccess/);
    assert.match(checkZip.stdout.toString(), /04-localbusiness-schema\.jsonld/);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("Play B (StoreFix): detects broken Google Product JSON-LD, ScriptTags & compiles store-fix-kit.zip ($10 Deal was $49 / $25 Pro was $79)", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u === "https://mystore.example.com/") {
      return new Response(
        '<html><title>Acme Outdoor Gear</title><script>Shopify.currency={"active":"GBP"}; function asyncLoad(){var urls=["https://legacy.app.io/tag.js"];}</script><a href="/collections/tents">Tents</a></html>',
        { status: 200 },
      );
    }
    if (u === "https://mystore.example.com/products.json?limit=15") {
      return new Response(
        JSON.stringify({
          products: [
            {
              title: "Storm Tent",
              handle: "storm-tent",
              variants: [{ price: "120.00", sku: "TENT-1" }],
              images: [{ src: "https://cdn.shopify.com/storm-thumb.jpg", width: 320, height: 320, position: 1 }],
            },
          ],
        }),
        { status: 200 },
      );
    }
    if (u === "https://mystore.example.com/products/storm-tent") {
      return new Response('<html><script type="application/ld+json">{"@type":"Product","name":"Storm Tent","offers":{"price":"99.00"}}</script></html>', { status: 200 });
    }
    if (u === "https://mystore.example.com/collections/tents") return new Response("Gone", { status: 404 });
    if (u === "https://api.stripe.com/v1/checkout/sessions") {
      return new Response(JSON.stringify({ id: "cs_test_ef10", url: "https://checkout.stripe.com/c/pay/cs_test_ef10" }), { status: 200 });
    }
    if (u.startsWith("https://api.stripe.com/v1/checkout/sessions/cs_test_ef_paid")) {
      return new Response(
        JSON.stringify({ id: "cs_test_ef_paid", payment_status: "paid", amount_total: 1000, metadata: { tier: "fix_pack", target_domain: "mystore.example.com" } }),
        { status: 200 },
      );
    }
    throw new Error(`Unexpected fetch in StoreFix test: ${u}`);
  };

  try {
    const hRes = await ecomFixWorker.fetch(new Request("https://ecom-fix.ak10082247.workers.dev/health"), FULL_ENV);
    assert.equal(hRes.status, 200);
    const hJson = await hRes.json();
    assert.equal(hJson.plans.fix_pack.amountCents, 1000);
    assert.equal(hJson.plans.fix_pack.originalCents, 4900);
    assert.equal(hJson.plans.pro_kit.amountCents, 2500);
    assert.equal(hJson.plans.pro_kit.originalCents, 7900);
    assert.equal(hJson.plans.dfy.amountCents, 9900);
    assert.equal(hJson.plans.dfy.originalCents, 24900);

    const coRes = await ecomFixWorker.fetch(
      new Request("https://ecom-fix.ak10082247.workers.dev/api/checkout?tier=fix_pack&domain=mystore.example.com&format=json", { method: "POST" }),
      FULL_ENV,
    );
    assert.equal(coRes.status, 200);
    assert.equal((await coRes.json()).amount_cents, 1000);

    const auditRes = await ecomFixWorker.fetch(
      new Request("https://ecom-fix.ak10082247.workers.dev/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: "mystore.example.com" }),
      }),
      FULL_ENV,
    );
    assert.equal(auditRes.status, 200);
    const audit = await auditRes.json();
    assert.equal(audit.platform, "shopify");
    assert.equal(audit.currency, "GBP");
    assert.equal(audit.broken_links.length, 1);
    assert.equal(audit.deprecated_script_tags.length, 1);
    assert.equal(audit.undersized_images.length, 1);
    assert.equal(audit.undersized_images[0].width, 320);
    assert.ok(audit.schema_issues.some((i) => i.issue.includes("Price mismatch")));
    assert.ok(audit.issues.some((i) => i.includes("500x500px")));

    const zipRes = await ecomFixWorker.fetch(
      new Request("https://ecom-fix.ak10082247.workers.dev/api/download?session_id=cs_test_ef_paid&format=zip"),
      FULL_ENV,
    );
    assert.equal(zipRes.status, 200);
    const zb = new Uint8Array(await zipRes.arrayBuffer());
    const checkZip = spawnSync(
      "python",
      ["-c", "import io, sys, zipfile; z = zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None; print(','.join(sorted(z.namelist())))"],
      { input: Buffer.from(zb) },
    );
    assert.equal(checkZip.status, 0);
    assert.match(checkZip.stdout.toString(), /01-product-schema\.liquid/);
    assert.match(checkZip.stdout.toString(), /02-shopify-url-redirects\.csv/);
    assert.match(checkZip.stdout.toString(), /06-merchant-500px-image-audit\.csv/);
    assert.match(checkZip.stdout.toString(), /07-instant-1500px-image-padder\.html/);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("Revenue Dashboard enforces auth, tracks FUNNEL_KV, verifies Stripe webhooks, gates bounces & computes Net P&L", async () => {
  const origFetch = globalThis.fetch;
  const sharedKv = createMemoryKv();
  const WEBHOOK_SECRET = "whsec_test_kurox_1234567890";
  const INGEST_TOKEN = "ingest_tok_test_abcdef";
  const DASH_PW = "Sup3rS3cretDash!";

  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u === "https://api.stripe.com/v1/balance") {
      return new Response(JSON.stringify({ available: [{ currency: "usd", amount: 4900 }], pending: [{ currency: "usd", amount: 2500 }] }), { status: 200 });
    }
    if (u.startsWith("https://api.stripe.com/v1/checkout/sessions")) {
      return new Response(
        JSON.stringify({
          data: [
            { id: "cs_live_1111222233334444", status: "complete", payment_status: "paid", amount_total: 1000, currency: "usd", created: 1795000000, customer_details: { email: "secret@buyer.com" }, metadata: { sku: "action2mcp-hosted-v1", tier: "hosted" } },
            { id: "cs_live_5555666677778888", status: "complete", payment_status: "paid", amount_total: 1000, currency: "usd", created: 1795000100, customer_details: { email: "clinic@buyer.co.uk" }, metadata: { sku: "siterescue-pack-v1", target_domain: "clinic.co.uk" } },
            { id: "cs_exp_9999000011112222", status: "expired", payment_status: "unpaid", amount_total: 1000, currency: "usd", created: 1795000200, customer_details: { email: "abandoner@shop.com" }, metadata: { sku: "ecomfix-bundle-v1", tier: "fix_pack", target_domain: "realshop.com" } },
          ],
        }),
        { status: 200 },
      );
    }
    if (u === "https://api.cloudflare.com/client/v4/graphql") {
      return new Response(
        JSON.stringify({
          data: {
            viewer: {
              accounts: [
                {
                  workersInvocationsAdaptive: [
                    { sum: { requests: 42 }, dimensions: { scriptName: "site-rescue" } },
                    { sum: { requests: 17 }, dimensions: { scriptName: "ecom-fix" } },
                    { sum: { requests: 88 }, dimensions: { scriptName: "action2mcp" } },
                  ],
                },
              ],
            },
          },
        }),
        { status: 200 },
      );
    }
    if (u === "https://mainnet.base.org") return new Response(JSON.stringify({ result: "0x0f4240" }), { status: 200 });
    if (u === "https://solana-rpc.publicnode.com" || u === "https://api.mainnet-beta.solana.com") {
      const b = String(init?.body || "");
      if (b.includes("getAccountInfo")) {
        const splBuf = Buffer.alloc(165);
        splBuf.writeBigUInt64LE(500000n, 64);
        return new Response(JSON.stringify({ result: { value: { data: [splBuf.toString("base64"), "base64"] } } }), { status: 200 });
      }
      return new Response(JSON.stringify({ result: [{ signature: "5abc123def", blockTime: 1795000200, confirmationStatus: "finalized", err: null }] }), { status: 200 });
    }
    if (u.includes("apify.com/v2/acts")) return new Response(JSON.stringify({ data: { items: [{ name: "action2mcp", stats: { totalRuns: 4 } }] } }), { status: 200 });
    if (u.includes("apify.com/v2/users/me/limits")) return new Response(JSON.stringify({ data: { current: { monthlyUsageUsd: 0.08 }, limits: { maxMonthlyUsageUsd: 5 } } }), { status: 200 });
    if (u.includes("raw.githubusercontent.com")) {
      return new Response(JSON.stringify({ contacted_emails: ["a@b.com"], bounced_emails: [], replied_emails: [], history: [{ email: "a@b.com", sent_date: "2026-11-20T10:00:00Z" }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
  };

  try {
    const DASH_ENV = {
      ...FULL_ENV,
      FUNNEL_KV: sharedKv,
      DASHBOARD_PASSWORD: DASH_PW,
      STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
      DASHBOARD_INGEST_TOKEN: INGEST_TOKEN,
      MONTHLY_FIXED_COST_USD: "5.00",
      APIFY_TOKEN: "apify_test_tok",
      CF_ANALYTICS_TOKEN: "cf_tok",
      CF_ACCOUNT_ID: "acc_123",
      GITHUB_REPO: "ak10082247-max/action2mcp",
    };

    // 1. Auth gate & health checks
    const [healthRes, unauthUiRes, unauthApiRes] = await Promise.all([
      revenueDashboardWorker.fetch(new Request("https://kurox-revenue-dashboard.ak10082247.workers.dev/health"), DASH_ENV),
      revenueDashboardWorker.fetch(new Request("https://kurox-revenue-dashboard.ak10082247.workers.dev/"), DASH_ENV),
      revenueDashboardWorker.fetch(new Request("https://kurox-revenue-dashboard.ak10082247.workers.dev/api/live"), DASH_ENV),
    ]);
    assert.equal(healthRes.status, 200);
    assert.equal(unauthUiRes.status, 302);
    assert.equal(unauthUiRes.headers.get("location"), "/login");
    assert.equal(unauthApiRes.status, 401);

    const badLogin = await revenueDashboardWorker.fetch(
      new Request("https://kurox-revenue-dashboard.ak10082247.workers.dev/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "password=wrongpass",
      }),
      DASH_ENV,
    );
    assert.equal(badLogin.status, 401);

    const okLogin = await revenueDashboardWorker.fetch(
      new Request("https://kurox-revenue-dashboard.ak10082247.workers.dev/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `password=${encodeURIComponent(DASH_PW)}`,
      }),
      DASH_ENV,
    );
    assert.equal(okLogin.status, 302);
    assert.equal(okLogin.headers.get("location"), "/");
    const setCookie = okLogin.headers.get("set-cookie") || "";
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /Secure/i);
    assert.match(setCookie, /SameSite=Lax/i);
    const cookiePair = setCookie.split(";")[0];

    // 2. Click tracking /t dedup + open redirect guard
    const evilRedir = await revenueDashboardWorker.fetch(
      new Request("https://kurox-revenue-dashboard.ak10082247.workers.dev/t?play=play_b_ecom&id=lead1&to=https%3A%2F%2Fevil.example%2Fphish"),
      DASH_ENV,
    );
    assert.equal(evilRedir.status, 400);

    const trackUrl = "https://kurox-revenue-dashboard.ak10082247.workers.dev/t?play=play_b_ecom&id=leadA&to=" + encodeURIComponent("https://ecom-fix.ak10082247.workers.dev/?domain=realshop.com");
    const track1 = await revenueDashboardWorker.fetch(new Request(trackUrl), DASH_ENV);
    const track2 = await revenueDashboardWorker.fetch(new Request(trackUrl), DASH_ENV);
    const track3 = await revenueDashboardWorker.fetch(
      new Request("https://kurox-revenue-dashboard.ak10082247.workers.dev/t?play=play_b_ecom&id=leadB&to=" + encodeURIComponent("https://ecom-fix.ak10082247.workers.dev/?domain=other.com")),
      DASH_ENV,
    );
    assert.equal(track1.status, 302);
    assert.equal(track1.headers.get("location"), "https://ecom-fix.ak10082247.workers.dev/?domain=realshop.com");
    assert.equal(track2.status, 302);
    assert.equal(track3.status, 302);
    assert.equal(await sharedKv.get("metric:play_b_ecom:unique_clicks"), "2");

    // 3. Free preview / ZIP counters on Action2MCP + SiteRescue + StoreFix
    const freeDl = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/download-free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema: MULTI_ENDPOINT_YAML }),
      }),
      DASH_ENV,
    );
    assert.equal(freeDl.status, 200);
    assert.equal(await sharedKv.get("metric:action2mcp:free_previews_or_zips"), "1");

    // 4. Stripe Webhook HMAC verification + Sale Alert + 30m Abandoned Recovery Queue + Dedup
    const signStripe = (payloadStr) => {
      const ts = Math.floor(Date.now() / 1000);
      const v1 = createHmac("sha256", WEBHOOK_SECRET).update(`${ts}.${payloadStr}`).digest("hex");
      return `t=${ts},v1=${v1}`;
    };
    const badWh = await revenueDashboardWorker.fetch(
      new Request("https://kurox-revenue-dashboard.ak10082247.workers.dev/webhooks/stripe", {
        method: "POST",
        headers: { "Stripe-Signature": "t=123,v1=deadbeef" },
        body: "{}",
      }),
      DASH_ENV,
    );
    assert.equal(badWh.status, 401);

    const completedEvt = JSON.stringify({
      id: "evt_completed_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_live_webhook_1",
          payment_status: "paid",
          amount_total: 1000,
          customer_details: { email: "buyer1@clinic.co.uk" },
          metadata: { sku: "siterescue-pack-v1", tier: "pack", target_domain: "clinic.co.uk" },
        },
      },
    });
    const okWhCompleted = await revenueDashboardWorker.fetch(
      new Request("https://kurox-revenue-dashboard.ak10082247.workers.dev/webhooks/stripe", {
        method: "POST",
        headers: { "Stripe-Signature": signStripe(completedEvt) },
        body: completedEvt,
      }),
      DASH_ENV,
    );
    assert.equal(okWhCompleted.status, 200);
    const dupWhCompleted = await revenueDashboardWorker.fetch(
      new Request("https://kurox-revenue-dashboard.ak10082247.workers.dev/webhooks/stripe", {
        method: "POST",
        headers: { "Stripe-Signature": signStripe(completedEvt) },
        body: completedEvt,
      }),
      DASH_ENV,
    );
    assert.equal((await dupWhCompleted.json()).duplicate, true);

    const expiredEvt1 = JSON.stringify({
      id: "evt_exp_1",
      type: "checkout.session.expired",
      data: {
        object: {
          id: "cs_exp_wh_1",
          payment_status: "unpaid",
          amount_total: 1000,
          customer_details: { email: "abandon@clinic.co.uk" },
          metadata: { sku: "ecomfix-bundle-v1", tier: "fix_pack", target_domain: "realshop.com" },
        },
      },
    });
    const expiredEvt2SameEmail = JSON.stringify({
      id: "evt_exp_2",
      type: "checkout.session.expired",
      data: {
        object: {
          id: "cs_exp_wh_2",
          payment_status: "unpaid",
          amount_total: 1000,
          customer_details: { email: "abandon@clinic.co.uk" },
          metadata: { sku: "ecomfix-bundle-v1", tier: "fix_pack", target_domain: "realshop.com" },
        },
      },
    });
    const rExp1 = await (await revenueDashboardWorker.fetch(
      new Request("https://kurox-revenue-dashboard.ak10082247.workers.dev/webhooks/stripe", {
        method: "POST",
        headers: { "Stripe-Signature": signStripe(expiredEvt1) },
        body: expiredEvt1,
      }),
      DASH_ENV,
    )).json();
    const rExp2 = await (await revenueDashboardWorker.fetch(
      new Request("https://kurox-revenue-dashboard.ak10082247.workers.dev/webhooks/stripe", {
        method: "POST",
        headers: { "Stripe-Signature": signStripe(expiredEvt2SameEmail) },
        body: expiredEvt2SameEmail,
      }),
      DASH_ENV,
    )).json();
    assert.equal(rExp1.queued_recovery, true);
    assert.equal(rExp2.queued_recovery, false);

    // Due-now alerts only contain sale_confirmed; ?all=1 contains both (+30m recovery)
    const dueRes = await (await revenueDashboardWorker.fetch(
      new Request("https://kurox-revenue-dashboard.ak10082247.workers.dev/api/pending-alerts", {
        headers: { Authorization: `Bearer ${INGEST_TOKEN}` },
      }),
      DASH_ENV,
    )).json();
    assert.equal(dueRes.alerts.length, 1);
    assert.equal(dueRes.alerts[0].kind, "sale_confirmed");
    assert.match(dueRes.alerts[0].subject, /\$\$\$ SALE CONFIRMED/);

    const allAlertsRes = await (await revenueDashboardWorker.fetch(
      new Request("https://kurox-revenue-dashboard.ak10082247.workers.dev/api/pending-alerts?all=1", {
        headers: { Authorization: `Bearer ${INGEST_TOKEN}` },
      }),
      DASH_ENV,
    )).json();
    assert.equal(allAlertsRes.alerts.length, 2);

    const ackRes = await (await revenueDashboardWorker.fetch(
      new Request("https://kurox-revenue-dashboard.ak10082247.workers.dev/api/ack-alert", {
        method: "POST",
        headers: { Authorization: `Bearer ${INGEST_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: dueRes.alerts[0].id }),
      }),
      DASH_ENV,
    )).json();
    assert.equal(ackRes.ok, true);

    // 5. Bounce Ingest -> 5% PAUSED_HIGH_BOUNCE circuit breaker -> /api/play-status
    const ingestRes = await (await revenueDashboardWorker.fetch(
      new Request("https://kurox-revenue-dashboard.ak10082247.workers.dev/api/ingest", {
        method: "POST",
        headers: { Authorization: `Bearer ${INGEST_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ play: "play_a_local", emails_sent: 14, emails_bounced: 2, post_fix_sent: 12, post_fix_bounced: 2 }),
      }),
      DASH_ENV,
    )).json();
    assert.equal(ingestRes.paused_high_bounce, true);
    assert.equal(ingestRes.pause_reason, "PAUSED_HIGH_BOUNCE");

    const playStatusRes = await (await revenueDashboardWorker.fetch(
      new Request("https://kurox-revenue-dashboard.ak10082247.workers.dev/api/play-status?play=play_a_local", {
        headers: { Authorization: `Bearer ${INGEST_TOKEN}` },
      }),
      DASH_ENV,
    )).json();
    assert.equal(playStatusRes.paused, true);
    assert.equal(playStatusRes.reason, "PAUSED_HIGH_BOUNCE");

    // 6. Authenticated dashboard UI & /api/live with Stop-Loss Matrix, P&L & PII masking
    const [uiRes, liveRes] = await Promise.all([
      revenueDashboardWorker.fetch(new Request("https://kurox-revenue-dashboard.ak10082247.workers.dev/", { headers: { Cookie: cookiePair } }), DASH_ENV),
      revenueDashboardWorker.fetch(new Request("https://kurox-revenue-dashboard.ak10082247.workers.dev/api/live", { headers: { Cookie: cookiePair } }), DASH_ENV),
    ]);
    assert.equal(uiRes.status, 200);
    const dashHtml = await uiRes.text();
    assert.match(dashHtml, /Real Net P&amp;L/);
    assert.match(dashHtml, /Stop-Loss Decision Matrix/);
    assert.match(dashHtml, /Abandoned Stripe Checkouts/);

    assert.equal(liveRes.status, 200);
    const liveText = await liveRes.text();
    assert.doesNotMatch(liveText, /secret@buyer\.com/);
    assert.doesNotMatch(liveText, /clinic@buyer\.co\.uk/);
    assert.doesNotMatch(liveText, /abandoner@shop\.com/);
    assert.doesNotMatch(liveText, /abandon@clinic\.co\.uk/);
    assert.doesNotMatch(liveText, new RegExp(DASH_PW));

    const data = JSON.parse(liveText);
    assert.equal(data.totals.stripe_paid_usd, 20);
    assert.equal(data.totals.onchain_usdc, 1.5);
    assert.equal(data.totals.tracked_revenue_usd, 21.5);
    assert.equal(data.totals.abandoned_orders, 1);
    assert.equal(data.stripe.recent_abandoned[0].buyer_masked, "a***@shop.com");
    assert.equal(data.pnl.stripe_fees_usd, 1.18);
    assert.equal(data.pnl.apify_compute_usd, 0.08);
    assert.equal(data.pnl.monthly_fixed_cost_usd, 5);
    assert.equal(data.pnl.net_profit_usd, 15.24);
    assert.equal(data.matrix.length, 8);
    assert.ok(data.matrix.some((m) => m.key === "play_d_launch"));
    const playAMatrix = data.matrix.find((m) => m.key === "play_a_local");
    const playBMatrix = data.matrix.find((m) => m.key === "play_b_ecom");
    assert.equal(playAMatrix.verdict, "SCALING");
    assert.equal(playBMatrix.unique_clicks, 2);
    assert.equal(playBMatrix.verdict, "FIX TRUST/PRICE");

    // 7. Unit test all 5 Stop-Loss verdict states directly
    assert.equal(computeStopLossVerdict({ paid_sales: 1 }), "SCALING");
    assert.equal(computeStopLossVerdict({ clean_delivered: 200, stop_loss_cap: 200, replied_count: 1 }), "KILL");
    assert.equal(computeStopLossVerdict({ clean_delivered: 10, active_sent: 10, bounce_rate_pct: 6.5 }), "FIX DELIVERABILITY");
    assert.equal(computeStopLossVerdict({ clean_delivered: 55, unique_clicks: 0, replied_count: 0, abandoned_checkouts: 0 }), "FIX DELIVERABILITY");
    assert.equal(computeStopLossVerdict({ clean_delivered: 25, unique_clicks: 2, abandoned_checkouts: 1 }), "FIX TRUST/PRICE");
    assert.equal(computeStopLossVerdict({ clean_delivered: 10, unique_clicks: 0 }), "TESTING");

    const logoutRes = await revenueDashboardWorker.fetch(new Request("https://kurox-revenue-dashboard.ak10082247.workers.dev/logout", { method: "POST" }), DASH_ENV);
    assert.equal(logoutRes.status, 302);
    assert.match(logoutRes.headers.get("set-cookie") || "", /Max-Age=0/);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("CautionWatch strictly filters unverified-content Caution videos, ingests, captures Business/Individual alert leads & serves dossier ZIP", async () => {
  assert.throws(() => validateTikTokVideoUrl("http://127.0.0.1:8080/admin"), /valid tiktok\.com domain/);
  assert.throws(() => validateTikTokVideoUrl("https://evil.example.com/@x/video/1"), /valid tiktok\.com domain/);
  assert.equal(
    validateTikTokVideoUrl("https://www.tiktok.com/@maskedtruthmt/video/7709208502949940500").cleanUrl,
    "https://www.tiktok.com/@maskedtruthmt/video/7709208502949940500",
  );

  // Strict Caution extractor rejects clean, caption-only mentions, and unrelated warning labels
  assert.equal(
    extractUnverifiedCautionRecord({
      id: "111",
      webVideoUrl: "https://www.tiktok.com/@clean/video/111",
      warnInfo: [],
      text: "Normal boxing clip Caution: Video flagged for unverified content in caption",
    }),
    null,
  );
  assert.equal(
    extractUnverifiedCautionRecord({
      id: "222",
      webVideoUrl: "https://www.tiktok.com/@ai/video/222",
      warnInfo: [{ text: "Contains AI-generated media" }],
      labelTop: "Creator labeled as AI-generated",
    }),
    null,
  );
  assert.ok(
    extractUnverifiedCautionRecord({
      id: "333",
      webVideoUrl: "https://www.tiktok.com/@nested/video/333",
      anchors: [{ extraInfo: { warning: "Caution: Video flagged for unverified content." } }],
    }),
  );
  // Novi snake_case content_desc slide captions mentioning "unverified content" without misc_info.ktf_info MUST be rejected
  assert.equal(
    extractUnverifiedCautionRecord({
      aweme_id: "444",
      share_url: "https://www.tiktok.com/@josephbournex/video/444?_r=1",
      content_desc: '["THEY FLAGGED THE VIDEO FOR \\"unverified content\\""]',
      misc_info: '{"tns_im_info":{"caution_label":"None"}}',
    }),
    null,
  );
  // Real Novi misc_info.ktf_info payload normalizes handle from share_url, cleans URL, and normalizes cautionText
  const noviHit = extractUnverifiedCautionRecord({
    aweme_id: "7702510622650518817",
    share_url: "https://www.tiktok.com/@maskedtruthmt/video/7702510622650518817?_r=1&u_code=abc",
    content_desc: '["Watch what happened to Anthony Joshua after not following the script"]',
    author: { nickname: "maskedtruthmt" },
    video: { cover: { url_list: ["https://cdn.example/novi-cover.jpg"] } },
    misc_info: JSON.stringify({
      ktf_info: {
        show_warning: true,
        caution_label: "Caution:",
        warning_text: "%s Video flagged for unverified content.",
      },
    }),
  });
  assert.ok(noviHit);
  assert.equal(noviHit.authorUsername, "@maskedtruthmt");
  assert.equal(noviHit.url, "https://www.tiktok.com/@maskedtruthmt/video/7702510622650518817");
  assert.equal(noviHit.cautionText, "Caution: Video flagged for unverified content.");
  assert.equal(noviHit.matchedField, "misc_info.ktf_info");
  assert.equal(noviHit.thumbnailUrl, "https://cdn.example/novi-cover.jpg");
  assert.match(noviHit.description, /Anthony Joshua/);
  // Re-ingesting already-normalized record in /api/ingest-caution must preserve @handle & description
  const reingested = extractUnverifiedCautionRecord(noviHit, "apify");
  assert.equal(reingested.authorUsername, "@maskedtruthmt");
  assert.equal(reingested.matchedField, "misc_info.ktf_info");
  assert.match(reingested.description, /Anthony Joshua/);
  const cautionHit = extractUnverifiedCautionRecord({
    id: "7709208502949940500",
    webVideoUrl: "https://www.tiktok.com/@maskedtruthmt/video/7709208502949940500",
    authorMeta: { name: "maskedtruthmt", nickName: "maskedtruthmt" },
    text: "Watch what happened to Anthony Joshua after not following the script #maskedtruth",
    voice_to_text: "Transcript mentioning Anthony Joshua",
    hashtags: [{ name: "maskedtruth" }],
    warnInfo: [{ text: "Caution: Video flagged for unverified content." }],
  });
  assert.ok(cautionHit);
  assert.equal(cautionHit.videoId, "7709208502949940500");
  assert.equal(cautionHit.matchedField, "warnInfo");
  assert.equal(cautionHit.authorUsername, "@maskedtruthmt");

  const origFetch = globalThis.fetch;
  const kv = createMemoryKv();
  const ADMIN_TOK = "bw-ingest-secret-token";
  const BW_ENV = {
    ...FULL_ENV,
    FUNNEL_KV: kv,
    DASHBOARD_INGEST_TOKEN: ADMIN_TOK,
    B2B_CONTACT_EMAIL: "armkhan18@gmail.com",
  };

  globalThis.fetch = async (input) => {
    const u = typeof input === "string" ? input : input.url;
    if (u.startsWith("https://www.tiktok.com/oembed?")) {
      return new Response(
        JSON.stringify({
          title: "Watch what happened to Anthony Joshua #maskedtruth",
          author_name: "maskedtruthmt",
          author_url: "https://www.tiktok.com/@maskedtruthmt",
          thumbnail_url: "https://p16-sign.tiktokcdn.example/thumb.jpg",
          embed_product_id: "7709208502949940500",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (u === "https://api.stripe.com/v1/checkout/sessions") {
      return new Response(JSON.stringify({ id: "cs_test_bw_1", url: "https://checkout.stripe.com/pay/cs_test_bw_1", payment_status: "unpaid" }), { status: 200 });
    }
    if (u === "https://api.stripe.com/v1/checkout/sessions/cs_test_bw_1") {
      return new Response(
        JSON.stringify({ id: "cs_test_bw_1", payment_status: "paid", amount_total: 4900, metadata: { tier: "audit", target_domain: "Anthony Joshua" } }),
        { status: 200 },
      );
    }
    return new Response("Not Found", { status: 404 });
  };

  try {
    // 1. Landing HTML + Health strict filter check
    const homeRes = await brandWatchWorker.fetch(new Request("https://brand-watch.ak10082247.workers.dev/"), BW_ENV);
    assert.equal(homeRes.status, 200);
    const homeHtml = await homeRes.text();
    assert.match(homeHtml, /Contact for Live Alerts \(Businesses &amp; Individuals\)/);

    const healthJson = await (await brandWatchWorker.fetch(new Request("https://brand-watch.ak10082247.workers.dev/health"), BW_ENV)).json();
    assert.equal(healthJson.strict_filter, "Caution: Video flagged for unverified content ONLY");
    const baseFeed = await (await brandWatchWorker.fetch(new Request("https://brand-watch.ak10082247.workers.dev/api/feed"), BW_ENV)).json();
    const baseCount = baseFeed.total_stored_caution_videos;

    // 2. Authenticated Caution Ingestion strictly drops clean/unrelated clips
    const unauthIngest = await brandWatchWorker.fetch(
      new Request("https://brand-watch.ak10082247.workers.dev/api/ingest-caution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [] }),
      }),
      BW_ENV,
    );
    assert.equal(unauthIngest.status, 401);

    const ingestRes = await (await brandWatchWorker.fetch(
      new Request("https://brand-watch.ak10082247.workers.dev/api/ingest-caution", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ADMIN_TOK}` },
        body: JSON.stringify({
          source: "apify_caution_poller",
          items: [
            { id: "1001", webVideoUrl: "https://www.tiktok.com/@clean/video/1001", warnInfo: [] },
            { id: "1002", webVideoUrl: "https://www.tiktok.com/@ai/video/1002", warnInfo: [{ text: "Contains AI-generated media" }] },
            {
              id: "7709208502949940999",
              webVideoUrl: "https://www.tiktok.com/@rumorclip/video/7709208502949940999",
              authorMeta: { name: "rumorclip" },
              text: "Unverified Anthony Joshua clip #maskedtruth",
              labelTop: "Caution: Video flagged for unverified content.",
            },
          ],
        }),
      }),
      BW_ENV,
    )).json();
    assert.equal(ingestRes.ok, true);
    assert.equal(ingestRes.accepted, 1);
    assert.equal(ingestRes.rejected, 2);

    // 3. Report rejects non-Caution labels with 422, accepts Caution clip via oEmbed verification
    const badReport = await brandWatchWorker.fetch(
      new Request("https://brand-watch.ak10082247.workers.dev/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://www.tiktok.com/@maskedtruthmt/video/7709208502949940500",
          cautionLabel: "Misleading financial advice",
        }),
      }),
      BW_ENV,
    );
    assert.equal(badReport.status, 422);

    const repRes = await (await brandWatchWorker.fetch(
      new Request("https://brand-watch.ak10082247.workers.dev/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://www.tiktok.com/@maskedtruthmt/video/7709208502949940500",
          brandTag: "Anthony Joshua",
          voiceToText: "Watch what happened to Anthony Joshua after not following the script",
          cautionLabel: "Caution: Video flagged for unverified content",
        }),
      }),
      BW_ENV,
    )).json();
    assert.equal(repRes.ok, true);
    assert.equal(repRes.persisted, true);
    assert.equal(repRes.entry.authorUsername, "@maskedtruthmt");

    // 4. Scan & Feed endpoints return ONLY verified Caution videos
    const scanRes = await (await brandWatchWorker.fetch(
      new Request("https://brand-watch.ak10082247.workers.dev/api/scan?q=Anthony%20Joshua"),
      BW_ENV,
    )).json();
    assert.equal(scanRes.ok, true);
    assert.equal(scanRes.strict_filter, "Caution: Video flagged for unverified content ONLY");
    assert.ok(scanRes.matched_count >= 2);
    assert.ok(scanRes.caution_videos.some((v) => v.videoId === "7709208502949940999"));
    assert.ok(scanRes.caution_videos.some((v) => v.videoId === "7709208502949940500"));
    assert.ok(scanRes.caution_videos.every((v) => /flagged\s+for\s+unverified\s+content/i.test(v.cautionText)));

    const feedRes = await (await brandWatchWorker.fetch(
      new Request("https://brand-watch.ak10082247.workers.dev/api/feed"),
      BW_ENV,
    )).json();
    assert.equal(feedRes.total_stored_caution_videos, baseCount + 2);

    // 5. Businesses & Individuals Alert Contact + authenticated inbox read
    const leadBad = await brandWatchWorker.fetch(
      new Request("https://brand-watch.ak10082247.workers.dev/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: "", email: "notanemail", keywords: "" }),
      }),
      BW_ENV,
    );
    assert.equal(leadBad.status, 400);

    const leadOk = await (await brandWatchWorker.fetch(
      new Request("https://brand-watch.ak10082247.workers.dev/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_type: "Individual / Creator / Public Figure",
          company: "Matchroom PR",
          contact_name: "Alex",
          email: "alex@matchroom.example",
          keywords: "Anthony Joshua, @maskedtruthmt",
          reference_url: "https://www.tiktok.com/@maskedtruthmt/video/7709208502949940500",
        }),
      }),
      BW_ENV,
    )).json();
    assert.equal(leadOk.ok, true);
    assert.match(leadOk.lead_id, /^BW-[0-9A-F]{8}$/);

    const unauthLeads = await brandWatchWorker.fetch(new Request("https://brand-watch.ak10082247.workers.dev/api/leads"), BW_ENV);
    assert.equal(unauthLeads.status, 401);

    const authLeads = await (await brandWatchWorker.fetch(
      new Request("https://brand-watch.ak10082247.workers.dev/api/leads", { headers: { Authorization: `Bearer ${ADMIN_TOK}` } }),
      BW_ENV,
    )).json();
    assert.equal(authLeads.ok, true);
    assert.equal(authLeads.count, 1);
    assert.equal(authLeads.leads[0].account_type, "Individual / Creator / Public Figure");

    // 6. Stripe Dossier Checkout + Verified ZIP Download
    const ck = await (await brandWatchWorker.fetch(
      new Request("https://brand-watch.ak10082247.workers.dev/api/checkout?tier=audit&domain=Anthony%20Joshua&format=json"),
      BW_ENV,
    )).json();
    assert.equal(ck.id, "cs_test_bw_1");
    assert.equal(ck.amount_cents, 4900);

    const dlConfirm = await (await brandWatchWorker.fetch(
      new Request("https://brand-watch.ak10082247.workers.dev/api/download?session_id=cs_test_bw_1"),
      BW_ENV,
    )).text();
    assert.match(dlConfirm, /Payment Confirmed/);
    const tokenMatch = dlConfirm.match(/token=([^&"]+)/);
    assert.ok(tokenMatch);

    const zipRes = await brandWatchWorker.fetch(
      new Request(`https://brand-watch.ak10082247.workers.dev/api/download?token=${tokenMatch[1]}&format=zip`),
      BW_ENV,
    );
    assert.equal(zipRes.status, 200);
    assert.equal(zipRes.headers.get("Content-Type"), "application/zip");
    const zipBuf = Buffer.from(await zipRes.arrayBuffer());
    assert.equal(zipBuf[0], 0x50);
    assert.equal(zipBuf[1], 0x4b);
  } finally {
    globalThis.fetch = origFetch;
  }
});
