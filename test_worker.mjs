import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import worker from "./worker.js";
import { compileOpenApiToMcp, generateStandaloneWorkerJs, buildDeployableBundle } from "./compiler.js";
import { createZipArchive } from "./zip_builder.js";
import { compileForApify, runActorMain, APIFY_PPE_EVENT } from "./apify_main.mjs";
import { signCdpJwt } from "./cdp_auth.js";
import siteRescueWorker from "./site_rescue/worker.js";
import ecomFixWorker from "./ecom_fix/worker.js";
import revenueDashboardWorker from "./revenue_dashboard/worker.js";

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
  assert.match(homeHtml, /\$25 One-Time/);
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

test("Free ZIP download (/api/download-free), removed bundle paywall, $25 Hosted Stripe & x402 flows", async () => {
  const origFetch = globalThis.fetch;
  let verifyCalls = 0;
  let settleCalls = 0;

  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u === "https://api.stripe.com/v1/checkout/sessions") {
      return new Response(
        JSON.stringify({ id: "cs_test_2500", url: "https://checkout.stripe.com/c/pay/cs_test_2500" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (u.startsWith("https://api.stripe.com/v1/checkout/sessions/cs_test_paid_25")) {
      return new Response(
        JSON.stringify({
          id: "cs_test_paid_25",
          payment_status: "paid",
          amount_total: 2500,
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

    // 1. $25 One-Time Hosted Stripe Checkout creation
    const co25 = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/checkout?tier=hosted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: "hosted" }),
      }),
      FULL_ENV,
    );
    assert.equal(co25.status, 200);
    const j25 = await co25.json();
    assert.equal(j25.amount_cents, 2500);
    assert.equal(j25.tier, "hosted");
    assert.match(j25.url, /^https:\/\/checkout\.stripe\.com/);

    // 2. Paid $25 Stripe session preserves spec_url, compiles remote ZIP & mints Hosted MCP Bridge
    const fulHtmlRes = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/download?session_id=cs_test_paid_25"),
      FULL_ENV,
    );
    assert.equal(fulHtmlRes.status, 200);
    const fulHtml = await fulHtmlRes.text();
    assert.match(fulHtml, /https:\/\/raw\.example\.com\/action\.yaml/);
    assert.match(fulHtml, /Direct Download Compiled ZIP/);

    const zipRes = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/download?session_id=cs_test_paid_25&format=zip"),
      FULL_ENV,
    );
    assert.equal(zipRes.status, 200);
    assert.equal(zipRes.headers.get("Content-Type"), "application/zip");
    const zb = new Uint8Array(await zipRes.arrayBuffer());
    assert.equal(zb[0], 0x50);
    assert.equal(zb[1], 0x4b);

    // 3. Paid $25 Stripe JSON mints HMAC management token -> registers live hosted MCP bridge
    const ful25 = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/download?session_id=cs_test_paid_25&format=json"),
      FULL_ENV,
    );
    assert.equal(ful25.status, 200);
    const f25 = await ful25.json();
    assert.equal(f25.fulfillment.amount_total_cents, 2500);
    assert.ok(f25.fulfillment.management_token.startsWith("a2m_mgmt_v1."));
    assert.match(f25.fulfillment.hosted_bridge_url, /\/mcp\/h\/a2m_bridge_v1\./);

    const regRes = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/hosted/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${f25.fulfillment.management_token}`,
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

    // 4. x402 HTTP 402 $25 USDC (25000000 atomic units) + settlement + pre-settlement fail-closed on broken schema
    const unp402 = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/buy?tier=hosted", { method: "POST" }),
      FULL_ENV,
    );
    assert.equal(unp402.status, 402);
    const ch402 = JSON.parse(Buffer.from(unp402.headers.get("PAYMENT-REQUIRED"), "base64").toString("utf8"));
    const baseOpt = ch402.accepts.find((a) => a.network === "eip155:8453");
    const solOpt = ch402.accepts.find((a) => a.network.startsWith("solana:"));
    assert.equal(baseOpt.amount, "25000000");
    assert.equal(solOpt.amount, "25000000");
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

test("Play A (SiteRescue): live broken booking scan, $49/$149 Stripe Checkout & ZIP recovery download", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u === "http://clinic.example.co.uk/") return new Response("", { status: 200 });
    if (u === "https://clinic.example.co.uk/") {
      return new Response('<html><title>Bright Dental Clinic</title><a href="/book-online">Book Appointment</a></html>', { status: 200 });
    }
    if (u === "https://clinic.example.co.uk/book-online") return new Response("Not Found", { status: 404 });
    if (u === "https://api.stripe.com/v1/checkout/sessions") {
      return new Response(JSON.stringify({ id: "cs_test_sr49", url: "https://checkout.stripe.com/c/pay/cs_test_sr49" }), { status: 200 });
    }
    if (u.startsWith("https://api.stripe.com/v1/checkout/sessions/cs_test_sr_paid")) {
      return new Response(
        JSON.stringify({ id: "cs_test_sr_paid", payment_status: "paid", amount_total: 4900, metadata: { tier: "pack", target_domain: "clinic.example.co.uk" } }),
        { status: 200 },
      );
    }
    throw new Error(`Unexpected fetch in SiteRescue test: ${u}`);
  };

  try {
    const hRes = await siteRescueWorker.fetch(new Request("https://site-rescue.ak10082247.workers.dev/health"), FULL_ENV);
    assert.equal(hRes.status, 200);
    const hJson = await hRes.json();
    assert.equal(hJson.plans.pack.amountCents, 4900);
    assert.equal(hJson.plans.priority.amountCents, 14900);

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
    assert.ok(scanData.issues.some((i) => i.includes("expires in 5 day(s)")));

    const coRes = await siteRescueWorker.fetch(
      new Request("https://site-rescue.ak10082247.workers.dev/api/checkout?tier=pack&domain=clinic.example.co.uk&format=json", { method: "POST" }),
      FULL_ENV,
    );
    assert.equal(coRes.status, 200);
    assert.equal((await coRes.json()).amount_cents, 4900);

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

test("Play B (StoreFix): detects broken Google Product JSON-LD, ScriptTags & compiles store-fix-kit.zip ($49/$79)", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u === "https://mystore.example.com/") {
      return new Response(
        '<html><title>Acme Outdoor Gear</title><script>Shopify.currency={"active":"GBP"}; function asyncLoad(){var urls=["https://legacy.app.io/tag.js"];}</script><a href="/collections/tents">Tents</a></html>',
        { status: 200 },
      );
    }
    if (u === "https://mystore.example.com/products.json?limit=3") {
      return new Response(JSON.stringify({ products: [{ title: "Storm Tent", handle: "storm-tent", variants: [{ price: "120.00", sku: "TENT-1" }] }] }), { status: 200 });
    }
    if (u === "https://mystore.example.com/products/storm-tent") {
      return new Response('<html><script type="application/ld+json">{"@type":"Product","name":"Storm Tent","offers":{"price":"99.00"}}</script></html>', { status: 200 });
    }
    if (u === "https://mystore.example.com/collections/tents") return new Response("Gone", { status: 404 });
    if (u === "https://api.stripe.com/v1/checkout/sessions") {
      return new Response(JSON.stringify({ id: "cs_test_ef79", url: "https://checkout.stripe.com/c/pay/cs_test_ef79" }), { status: 200 });
    }
    if (u.startsWith("https://api.stripe.com/v1/checkout/sessions/cs_test_ef_paid")) {
      return new Response(
        JSON.stringify({ id: "cs_test_ef_paid", payment_status: "paid", amount_total: 4900, metadata: { tier: "fix_pack", target_domain: "mystore.example.com" } }),
        { status: 200 },
      );
    }
    throw new Error(`Unexpected fetch in StoreFix test: ${u}`);
  };

  try {
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
    assert.ok(audit.schema_issues.some((i) => i.issue.includes("Price mismatch")));

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
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("Revenue Dashboard tallies live Stripe checkouts, Base/Solana USDC & redacts PII", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u === "https://api.stripe.com/v1/balance") {
      return new Response(JSON.stringify({ available: [{ currency: "usd", amount: 4900 }], pending: [{ currency: "usd", amount: 2500 }] }), { status: 200 });
    }
    if (u.startsWith("https://api.stripe.com/v1/checkout/sessions")) {
      return new Response(
        JSON.stringify({
          data: [
            { id: "cs_live_1111222233334444", payment_status: "paid", amount_total: 2500, currency: "usd", created: 1795000000, customer_details: { email: "secret@buyer.com" }, metadata: { sku: "action2mcp-hosted-v1", tier: "hosted" } },
            { id: "cs_live_5555666677778888", payment_status: "paid", amount_total: 4900, currency: "usd", created: 1795000100, customer_details: { email: "clinic@buyer.co.uk" }, metadata: { sku: "siterescue-pack-v1", target_domain: "clinic.co.uk" } },
          ],
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
    if (u.includes("raw.githubusercontent.com")) return new Response(JSON.stringify({ contacted_emails: ["a@b.com"], history: [] }), { status: 200 });
    return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
  };

  try {
    const DASH_ENV = { ...FULL_ENV, APIFY_TOKEN: "apify_test_tok", GITHUB_REPO: "ak10082247-max/action2mcp" };
    const [uiRes, liveRes] = await Promise.all([
      revenueDashboardWorker.fetch(new Request("https://kurox-revenue-dashboard.ak10082247.workers.dev/"), DASH_ENV),
      revenueDashboardWorker.fetch(new Request("https://kurox-revenue-dashboard.ak10082247.workers.dev/api/live"), DASH_ENV),
    ]);
    assert.equal(uiRes.status, 200);
    assert.match(await uiRes.text(), /Live Money Tally/);

    assert.equal(liveRes.status, 200);
    const liveText = await liveRes.text();
    assert.doesNotMatch(liveText, /secret@buyer\.com/);
    assert.doesNotMatch(liveText, /clinic@buyer\.co\.uk/);
    const data = JSON.parse(liveText);
    assert.equal(data.totals.stripe_paid_usd, 74);
    assert.equal(data.totals.onchain_usdc, 1.5);
    assert.equal(data.totals.tracked_revenue_usd, 75.5);
    assert.equal(data.stripe.by_play["Action2MCP"], 25);
    assert.equal(data.stripe.by_play["Play A: SiteRescue"], 49);
    assert.equal(data.apify.total_runs, 4);
  } finally {
    globalThis.fetch = origFetch;
  }
});
