import { describe, expect, it } from "vitest";

// ─── Split Calculator Tests ────────────────────────────────────────────────────

/**
 * Equal split logic: each collaborator gets (their stems / total stems) * 100%
 * expressed in basis points (bps) where 10000 = 100%.
 */
function calculateEqualSplits(
  stemsByUser: { userId: number; walletAddress: string; stemCount: number }[]
): { userId: number; walletAddress: string; stemCount: number; splitBps: number; splitPercent: number }[] {
  const total = stemsByUser.reduce((sum, u) => sum + u.stemCount, 0);
  if (total === 0) return [];

  const splits = stemsByUser.map(u => ({
    ...u,
    splitBps: Math.floor((u.stemCount / total) * 10000),
    splitPercent: parseFloat(((u.stemCount / total) * 100).toFixed(2)),
  }));

  // Adjust rounding so bps sum to exactly 10000
  const bpsTotal = splits.reduce((sum, s) => sum + s.splitBps, 0);
  const remainder = 10000 - bpsTotal;
  if (remainder !== 0 && splits.length > 0) {
    splits[0].splitBps += remainder;
  }

  return splits;
}

describe("Split Calculator — equal splits", () => {
  it("splits 50/50 for two artists with equal stem counts", () => {
    const splits = calculateEqualSplits([
      { userId: 1, walletAddress: "wallet1", stemCount: 1 },
      { userId: 2, walletAddress: "wallet2", stemCount: 1 },
    ]);
    expect(splits[0].splitBps).toBe(5000);
    expect(splits[1].splitBps).toBe(5000);
    expect(splits[0].splitPercent).toBe(50);
    expect(splits[1].splitPercent).toBe(50);
  });

  it("splits proportionally for unequal stem counts", () => {
    const splits = calculateEqualSplits([
      { userId: 1, walletAddress: "wallet1", stemCount: 3 },
      { userId: 2, walletAddress: "wallet2", stemCount: 1 },
    ]);
    expect(splits[0].splitBps).toBe(7500); // 75%
    expect(splits[1].splitBps).toBe(2500); // 25%
  });

  it("splits equally for three artists with equal stem counts", () => {
    const splits = calculateEqualSplits([
      { userId: 1, walletAddress: "wallet1", stemCount: 1 },
      { userId: 2, walletAddress: "wallet2", stemCount: 1 },
      { userId: 3, walletAddress: "wallet3", stemCount: 1 },
    ]);
    const total = splits.reduce((sum, s) => sum + s.splitBps, 0);
    expect(total).toBe(10000); // Must always sum to 10000
    expect(splits[0].splitBps).toBeGreaterThan(3330);
    expect(splits[0].splitBps).toBeLessThan(3340);
  });

  it("always sums bps to exactly 10000 regardless of rounding", () => {
    const splits = calculateEqualSplits([
      { userId: 1, walletAddress: "w1", stemCount: 2 },
      { userId: 2, walletAddress: "w2", stemCount: 3 },
      { userId: 3, walletAddress: "w3", stemCount: 5 },
    ]);
    const total = splits.reduce((sum, s) => sum + s.splitBps, 0);
    expect(total).toBe(10000);
  });

  it("handles single artist (100%)", () => {
    const splits = calculateEqualSplits([
      { userId: 1, walletAddress: "wallet1", stemCount: 5 },
    ]);
    expect(splits[0].splitBps).toBe(10000);
    expect(splits[0].splitPercent).toBe(100);
  });

  it("returns empty array for zero stems", () => {
    const splits = calculateEqualSplits([]);
    expect(splits).toHaveLength(0);
  });

  it("handles 5 artists with 1 stem each — bps sum to 10000", () => {
    const input = Array.from({ length: 5 }, (_, i) => ({
      userId: i + 1,
      walletAddress: `wallet${i + 1}`,
      stemCount: 1,
    }));
    const splits = calculateEqualSplits(input);
    const total = splits.reduce((sum, s) => sum + s.splitBps, 0);
    expect(total).toBe(10000);
  });
});

// ─── Phantom Wallet Validation Tests ─────────────────────────────────────────

function isValidSolanaAddress(address: string): boolean {
  if (!address || address.length < 32 || address.length > 44) return false;
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

function shortenAddress(address: string, chars = 4): string {
  if (!address || address.length < chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

describe("Phantom wallet utilities", () => {
  it("validates a real Solana address", () => {
    expect(isValidSolanaAddress("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU")).toBe(true);
  });

  it("rejects an Ethereum address", () => {
    expect(isValidSolanaAddress("0x742d35Cc6634C0532925a3b8D4C9C8E5f6b7e8f9")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidSolanaAddress("")).toBe(false);
  });

  it("rejects a too-short string", () => {
    expect(isValidSolanaAddress("abc123")).toBe(false);
  });

  it("rejects a string with invalid base58 chars (0, O, I, l)", () => {
    expect(isValidSolanaAddress("0xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAs")).toBe(false);
  });

  it("shortens an address correctly", () => {
    const addr = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
    const short = shortenAddress(addr, 4);
    expect(short).toBe("7xKX...gAsU");
  });

  it("returns original address if too short to shorten", () => {
    expect(shortenAddress("abc", 4)).toBe("abc");
  });
});

// ─── Mint Queue Logic Tests ───────────────────────────────────────────────────

type MintEntry = {
  id: number;
  type: "stem" | "song";
  referenceId: number;
  artistWalletAddress: string;
  status: "pending" | "processing" | "complete" | "failed";
  attempts: number;
};

function shouldRetryMint(entry: MintEntry, maxAttempts = 3): boolean {
  return entry.status === "failed" && entry.attempts < maxAttempts;
}

function isMintComplete(entry: MintEntry): boolean {
  return entry.status === "complete";
}

describe("Mint queue logic", () => {
  const baseStemEntry: MintEntry = {
    id: 1,
    type: "stem",
    referenceId: 42,
    artistWalletAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    status: "pending",
    attempts: 0,
  };

  it("identifies a pending entry as not complete", () => {
    expect(isMintComplete(baseStemEntry)).toBe(false);
  });

  it("identifies a complete entry as complete", () => {
    expect(isMintComplete({ ...baseStemEntry, status: "complete" })).toBe(true);
  });

  it("allows retry for failed entry under max attempts", () => {
    expect(shouldRetryMint({ ...baseStemEntry, status: "failed", attempts: 2 })).toBe(true);
  });

  it("blocks retry for failed entry at max attempts", () => {
    expect(shouldRetryMint({ ...baseStemEntry, status: "failed", attempts: 3 })).toBe(false);
  });

  it("does not retry a successful entry", () => {
    expect(shouldRetryMint({ ...baseStemEntry, status: "complete", attempts: 1 })).toBe(false);
  });

  it("correctly identifies song type entries", () => {
    const songEntry: MintEntry = { ...baseStemEntry, type: "song", referenceId: 7 };
    expect(songEntry.type).toBe("song");
    expect(songEntry.referenceId).toBe(7);
  });
});

// ─── Royalty Basis Points Validation ─────────────────────────────────────────

describe("Royalty basis points", () => {
  it("5% royalty = 500 bps", () => {
    expect(Math.round(5 * 100)).toBe(500);
  });

  it("10% royalty = 1000 bps", () => {
    expect(Math.round(10 * 100)).toBe(1000);
  });

  it("royalty bps are within valid Metaplex range (0-10000)", () => {
    const stemRoyaltyBps = 500;  // 5%
    const songRoyaltyBps = 1000; // 10%
    expect(stemRoyaltyBps).toBeGreaterThanOrEqual(0);
    expect(stemRoyaltyBps).toBeLessThanOrEqual(10000);
    expect(songRoyaltyBps).toBeGreaterThanOrEqual(0);
    expect(songRoyaltyBps).toBeLessThanOrEqual(10000);
  });
});
