import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createSessionToken, verifyAdminPassword, verifySessionToken, SESSION_TTL_SECONDS } from "@/lib/session";

beforeEach(() => {
  process.env.ADMIN_PASSWORD = "correct horse";
  process.env.SESSION_SECRET = "test-secret-1";
});

test("a fresh token verifies", async () => {
  const token = await createSessionToken();
  assert.equal(await verifySessionToken(token), true);
});

test("the token is not the password or its hash", async () => {
  const token = await createSessionToken();
  assert.ok(!token.includes("correct"));
  assert.equal(token.split(".").length, 3);
});

test("expired tokens are rejected", async () => {
  const issuedAt = Date.now() - (SESSION_TTL_SECONDS + 5) * 1000;
  const token = await createSessionToken(issuedAt);
  assert.equal(await verifySessionToken(token), false);
});

test("tampered expiry or signature is rejected", async () => {
  const token = await createSessionToken();
  const [exp, nonce, sig] = token.split(".");
  assert.equal(await verifySessionToken(`${Number(exp) + 9999}.${nonce}.${sig}`), false);
  assert.equal(await verifySessionToken(`${exp}.${nonce}.${sig.replace(/.$/, sig.endsWith("0") ? "1" : "0")}`), false);
  assert.equal(await verifySessionToken("garbage"), false);
});

test("rotating SESSION_SECRET signs everyone out", async () => {
  const token = await createSessionToken();
  process.env.SESSION_SECRET = "test-secret-2";
  assert.equal(await verifySessionToken(token), false);
});

test("without SESSION_SECRET the key derives from ADMIN_PASSWORD", async () => {
  delete process.env.SESSION_SECRET;
  const token = await createSessionToken();
  assert.equal(await verifySessionToken(token), true);
  process.env.ADMIN_PASSWORD = "changed";
  assert.equal(await verifySessionToken(token), false);
});

test("password check", async () => {
  assert.equal(await verifyAdminPassword("correct horse"), true);
  assert.equal(await verifyAdminPassword("correct hors"), false);
  assert.equal(await verifyAdminPassword(undefined), false);
  delete process.env.ADMIN_PASSWORD;
  assert.equal(await verifyAdminPassword(""), false);
});
