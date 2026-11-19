/**
 * Pure WebCrypto Coinbase CDP v2 x402 Facilitator JWT & Auth Helpers.
 * Zero external dependencies — runs natively on Cloudflare Workers and Node 22+.
 */

import { cleanSecret } from "./stripe_billing.js";

export const CDP_FACILITATOR_BASE = "https://api.cdp.coinbase.com";
export const CDP_FACILITATOR_V2_ROUTE = "/platform/v2/x402";
export const CDP_FACILITATOR_URL = `${CDP_FACILITATOR_BASE}${CDP_FACILITATOR_V2_ROUTE}`;
export const CDP_SOLANA_FEE_PAYER = "BENrLoUbndxoNMUS5JXApGMtNykLjFXXixMtpDwDR9SP";

const ED25519_PKCS8_PREFIX = Uint8Array.from([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
  0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

function base64UrlEncode(bytes) {
  let binary = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i += 1) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Bytes(b64) {
  const clean = String(b64 || "").replace(/\s+/g, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

export function normalizeCdpSecret(rawSecret) {
  if (typeof rawSecret !== "string") return "";
  return rawSecret
    .replace(/[\uFEFF\x00-\x09\x0B-\x1F\x7F]+/g, "")
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n")
    .trim();
}

export function hasCdpCredentials(env) {
  return Boolean(cleanSecret(env?.CDP_API_KEY_ID) && normalizeCdpSecret(env?.CDP_API_KEY_SECRET));
}

export async function signCdpJwt({
  apiKeyId,
  apiKeySecret,
  requestMethod,
  requestHost = "api.cdp.coinbase.com",
  requestPath,
  expiresIn = 120,
}) {
  const keyId = cleanSecret(apiKeyId);
  const secretNormalized = normalizeCdpSecret(apiKeySecret);
  if (!keyId || !secretNormalized) {
    throw new Error("CDP_API_KEY_ID and CDP_API_KEY_SECRET are required.");
  }

  const now = Math.floor(Date.now() / 1000);
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonceHex = Array.from(nonceBytes, (b) => b.toString(16).padStart(2, "0")).join("");

  let alg;
  let cryptoKey;
  let signParams;

  if (secretNormalized.includes("PRIVATE KEY") || secretNormalized.includes("PRIVATEKEY")) {
    const pemBody = secretNormalized.replace(/-----[^-]+-----/g, "");
    const der = decodeBase64Bytes(pemBody);
    alg = "ES256";
    cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      der,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
    signParams = { name: "ECDSA", hash: "SHA-256" };
  } else {
    const rawEd = decodeBase64Bytes(secretNormalized);
    if (rawEd.length !== 64) {
      throw new Error("Unsupported CDP_API_KEY_SECRET format (expected PKCS#8 PEM EC key or 64-byte Ed25519 base64 key).");
    }
    const pkcs8 = new Uint8Array(ED25519_PKCS8_PREFIX.length + 32);
    pkcs8.set(ED25519_PKCS8_PREFIX, 0);
    pkcs8.set(rawEd.subarray(0, 32), ED25519_PKCS8_PREFIX.length);
    alg = "EdDSA";
    cryptoKey = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, false, ["sign"]);
    signParams = { name: "Ed25519" };
  }

  const enc = new TextEncoder();
  const header = { alg, kid: keyId, typ: "JWT", nonce: nonceHex };
  const claims = {
    sub: keyId,
    iss: "cdp",
    nbf: now,
    iat: now,
    exp: now + expiresIn,
    uris: [`${String(requestMethod).toUpperCase()} ${requestHost}${requestPath}`],
  };

  const signingInput = `${base64UrlEncode(enc.encode(JSON.stringify(header)))}.${base64UrlEncode(enc.encode(JSON.stringify(claims)))}`;
  const sig = await crypto.subtle.sign(signParams, cryptoKey, enc.encode(signingInput));
  return `${signingInput}.${base64UrlEncode(new Uint8Array(sig))}`;
}

export async function createCdpRequestHeaders(env, method, endpointPath) {
  const fullPath = `${CDP_FACILITATOR_V2_ROUTE}${endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`}`;
  const jwt = await signCdpJwt({
    apiKeyId: env?.CDP_API_KEY_ID,
    apiKeySecret: env?.CDP_API_KEY_SECRET,
    requestMethod: method,
    requestHost: "api.cdp.coinbase.com",
    requestPath: fullPath,
  });
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${jwt}`,
    "Correlation-Context": "sdk_version=1.29.0,sdk_language=typescript,source=x402,source_version=2.1.0",
  };
}
