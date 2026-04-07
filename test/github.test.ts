import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { getGitHubEvent, verifySignature } from "../src/lib/github";

function createGitHubSignature(rawBody: string, secret: string): string {
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

  return `sha256=${digest}`;
}

describe("verifySignature", () => {
  test("returns true for valid HMAC SHA-256 signature", async () => {
    const rawBody = JSON.stringify({ action: "opened", pull_request: { number: 42 } });
    const secret = "webhook-secret";
    const signature = createGitHubSignature(rawBody, secret);

    const isValid = await verifySignature(rawBody, signature, secret);

    expect(isValid).toBe(true);
  });

  test("returns false for invalid signature", async () => {
    const rawBody = JSON.stringify({ action: "opened" });
    const secret = "webhook-secret";
    const signature = createGitHubSignature(rawBody, "different-secret");

    const isValid = await verifySignature(rawBody, signature, secret);

    expect(isValid).toBe(false);
  });

  test("returns false for missing signature", async () => {
    const rawBody = JSON.stringify({ action: "opened" });
    const secret = "webhook-secret";

    const isValid = await verifySignature(rawBody, "", secret);

    expect(isValid).toBe(false);
  });

  test("returns true when secret is empty", async () => {
    const rawBody = JSON.stringify({ action: "opened" });
    const signature = "sha256=invalid";

    const isValid = await verifySignature(rawBody, signature, "");

    expect(isValid).toBe(true);
  });
});

describe("getGitHubEvent", () => {
  test("extracts x-github-event header", () => {
    const headers = new Headers({ "x-github-event": "pull_request" });

    expect(getGitHubEvent(headers)).toBe("pull_request");
  });

  test("returns empty string when header is missing", () => {
    const headers = new Headers();

    expect(getGitHubEvent(headers)).toBe("");
  });
});
