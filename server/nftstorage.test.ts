/**
 * Pinata IPFS API key validation test
 * Calls the lightweight /data/testAuthentication endpoint to verify the JWT.
 */
import { describe, it, expect } from "vitest";

describe("Pinata IPFS API key", () => {
  it("should be a valid JWT format (starts with eyJ)", () => {
    // stemstorage is the primary secret name — check it first
    const token = process.env.stemstorage ?? process.env.NFTSTORAGE_API_KEY ?? process.env.VITE_WEB3_STORAGE_TOKEN ?? "";
    // If no token set, skip gracefully — platform works with simulated CID fallback
    if (!token) {
      console.warn("No Pinata JWT set — IPFS uploads will use simulated CID fallback");
      return;
    }
    expect(token.startsWith("eyJ")).toBe(true);
  });

  it("should be accepted by the Pinata API", async () => {
    const token = process.env.stemstorage ?? process.env.NFTSTORAGE_API_KEY ?? process.env.VITE_WEB3_STORAGE_TOKEN ?? "";
    if (!token || !token.startsWith("eyJ")) {
      console.warn("No valid Pinata JWT — skipping live API test");
      return;
    }

    // Pinata test authentication endpoint — lightweight, no upload
    const resp = await fetch("https://api.pinata.cloud/data/testAuthentication", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(resp.status).not.toBe(401);
    expect(resp.ok).toBe(true);
  }, 15000);
});
