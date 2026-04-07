const GITHUB_SIGNATURE_PREFIX = "sha256=";

function decodeHex(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0) {
    return null;
  }

  if (!/^[0-9a-f]+$/i.test(hex)) {
    return null;
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
  }

  return bytes;
}

export async function verifySignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  if (secret.length === 0) {
    return true;
  }

  if (signatureHeader.length === 0) {
    return false;
  }

  if (!signatureHeader.startsWith(GITHUB_SIGNATURE_PREFIX)) {
    return false;
  }

  const signatureHex = signatureHeader.slice(GITHUB_SIGNATURE_PREFIX.length);
  const signatureBytes = decodeHex(signatureHex);

  if (!signatureBytes) {
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    return crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(rawBody),
    );
  } catch {
    return false;
  }
}

export function getGitHubEvent(headers: Headers): string {
  return headers.get("x-github-event") ?? "";
}
