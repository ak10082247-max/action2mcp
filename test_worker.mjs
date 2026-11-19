import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import worker from "./worker.js";
import { compileOpenApiToMcp, generateStandaloneWorkerJs, buildDeployableBundle } from "./compiler.js";
import { createZipArchive } from "./zip_builder.js";

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

test("Stripe ($5 & $15), ZIP download, Hosted MCP Bridge & x402 dual-chain settlement flows", async () => {
  const origFetch = globalThis.fetch;
  let verifyCalls = 0;
  let settleCalls = 0;

  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u === "https://api.stripe.com/v1/checkout/sessions") {
      const formBody = String(init?.body || "");
      const amt = formBody.includes("1500") ? 1500 : 500;
      return new Response(
        JSON.stringify({ id: `cs_test_${amt}`, url: `https://checkout.stripe.com/c/pay/cs_test_${amt}` }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (u.startsWith("https://api.stripe.com/v1/checkout/sessions/cs_test_paid_5")) {
      return new Response(
        JSON.stringify({ id: "cs_test_paid_5", payment_status: "paid", amount_total: 500, currency: "usd", metadata: { tier: "bundle", spec_url: "https://raw.example.com/action.yaml" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (u === "https://raw.example.com/action.yaml") {
      return new Response(MULTI_ENDPOINT_YAML, { status: 200, headers: { "content-type": "text/yaml" } });
    }
    if (u.startsWith("https://api.stripe.com/v1/checkout/sessions/cs_test_paid_15")) {
      return new Response(
        JSON.stringify({ id: "cs_test_paid_15", payment_status: "paid", amount_total: 1500, currency: "usd", customer_details: { email: "buyer@corp.io" }, metadata: { tier: "hosted" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
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
    // 1. Stripe Checkout creation ($5 & $15)
    const co5 = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/checkout?tier=bundle&format=json"),
      FULL_ENV,
    );
    assert.equal(co5.status, 200);
    const j5 = await co5.json();
    assert.equal(j5.amount_cents, 500);
    assert.match(j5.url, /^https:\/\/checkout\.stripe\.com/);

    const co15 = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/checkout?tier=hosted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: "hosted" }),
      }),
      FULL_ENV,
    );
    assert.equal(co15.status, 200);
    assert.equal((await co15.json()).amount_cents, 1500);

    // 2. Paid $5 Stripe session preserves spec_url in fulfillment HTML & compiles remote ZIP cleanly
    const fulHtmlRes = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/download?session_id=cs_test_paid_5"),
      FULL_ENV,
    );
    assert.equal(fulHtmlRes.status, 200);
    const fulHtml = await fulHtmlRes.text();
    assert.match(fulHtml, /https:\/\/raw\.example\.com\/action\.yaml/);
    assert.match(fulHtml, /Direct Download Compiled ZIP/);

    const zipRes = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/download?session_id=cs_test_paid_5&format=zip"),
      FULL_ENV,
    );
    assert.equal(zipRes.status, 200);
    assert.equal(zipRes.headers.get("Content-Type"), "application/zip");
    const zb = new Uint8Array(await zipRes.arrayBuffer());
    assert.equal(zb[0], 0x50);
    assert.equal(zb[1], 0x4b);

    // 3. Paid $15 Stripe session mints HMAC management token -> registers live hosted MCP bridge
    const ful15 = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/download?session_id=cs_test_paid_15&format=json"),
      FULL_ENV,
    );
    assert.equal(ful15.status, 200);
    const f15 = await ful15.json();
    assert.ok(f15.fulfillment.management_token.startsWith("a2m_mgmt_v1."));

    const regRes = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/hosted/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${f15.fulfillment.management_token}`,
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

    // 4. x402 HTTP 402 fallback + settlement + pre-settlement fail-closed on broken schema
    const unp402 = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/buy?tier=bundle", { method: "POST" }),
      FULL_ENV,
    );
    assert.equal(unp402.status, 402);
    const ch402 = JSON.parse(Buffer.from(unp402.headers.get("PAYMENT-REQUIRED"), "base64").toString("utf8"));
    const baseOpt = ch402.accepts.find((a) => a.network === "eip155:8453");
    const solOpt = ch402.accepts.find((a) => a.network.startsWith("solana:"));
    assert.equal(baseOpt.amount, "5000000");
    assert.equal(solOpt.amount, "5000000");
    assert.equal(ch402.extensions?.bazaar?.discoverable, true);
    assert.ok(ch402.extensions?.bazaar?.schema);

    const sig = Buffer.from(
      JSON.stringify({ x402Version: 2, resource: ch402.resource, accepted: baseOpt, payload: { signature: "0x11" } }),
    ).toString("base64");

    const badSchemaRes = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/buy?tier=bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json", "PAYMENT-SIGNATURE": sig },
        body: JSON.stringify({ schema: "{invalid json" }),
      }),
      FULL_ENV,
    );
    assert.equal(badSchemaRes.status, 422);
    assert.equal(settleCalls, 0);

    const paidX402 = await worker.fetch(
      new Request("https://action2mcp.ak10082247.workers.dev/api/buy?tier=bundle", {
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
    assert.equal(paidBody.tool_count, 2);
    assert.ok(paidBody.files["worker.js"]);
  } finally {
    globalThis.fetch = origFetch;
  }
});
