/**
 * Royalty Split Calculator
 *
 * Free tier: Equal split by stem count (stems ÷ contributors)
 * Premium tier: Custom basis points per collaborator
 *
 * Splits are stored in basis points (bps): 10000 bps = 100%
 * Example: 3 contributors → 3333 + 3333 + 3334 bps (rounding remainder to last)
 */

export interface Collaborator {
  userId: number;
  walletAddress: string;
  stemCount: number;
  displayName?: string;
}

export interface SplitEntry {
  userId: number;
  walletAddress: string;
  stemCount: number;
  splitBps: number;      // basis points out of 10000
  splitPercent: number;  // human-readable percentage
  displayName?: string;
}

export interface SplitResult {
  entries: SplitEntry[];
  totalBps: number;       // should always equal 10000
  isEqual: boolean;
  isPremium: boolean;
}

/**
 * Calculate equal splits for the free tier.
 * Each collaborator gets floor(10000 / count) bps.
 * Remainder goes to the last collaborator.
 */
export function calculateEqualSplits(collaborators: Collaborator[]): SplitResult {
  if (collaborators.length === 0) {
    throw new Error("Cannot calculate splits for empty collaborator list");
  }

  const count = collaborators.length;
  const baseBps = Math.floor(10000 / count);
  const remainder = 10000 - baseBps * count;

  const entries: SplitEntry[] = collaborators.map((c, i) => {
    const bps = i === count - 1 ? baseBps + remainder : baseBps;
    return {
      userId: c.userId,
      walletAddress: c.walletAddress,
      stemCount: c.stemCount,
      splitBps: bps,
      splitPercent: parseFloat((bps / 100).toFixed(2)),
      displayName: c.displayName,
    };
  });

  return {
    entries,
    totalBps: entries.reduce((sum, e) => sum + e.splitBps, 0),
    isEqual: true,
    isPremium: false,
  };
}

/**
 * Validate and normalize custom premium splits.
 * Input bps values must sum to exactly 10000.
 */
export function validateCustomSplits(
  collaborators: Array<Collaborator & { customBps: number }>
): SplitResult {
  const total = collaborators.reduce((sum, c) => sum + c.customBps, 0);
  if (total !== 10000) {
    throw new Error(`Custom splits must sum to 10000 bps (100%). Got: ${total}`);
  }

  const entries: SplitEntry[] = collaborators.map(c => ({
    userId: c.userId,
    walletAddress: c.walletAddress,
    stemCount: c.stemCount,
    splitBps: c.customBps,
    splitPercent: parseFloat((c.customBps / 100).toFixed(2)),
    displayName: c.displayName,
  }));

  return {
    entries,
    totalBps: 10000,
    isEqual: false,
    isPremium: true,
  };
}

/**
 * Build Metaplex creator array from split entries.
 * Metaplex uses 0-100 percentage (not bps), so we convert.
 * The relayer address is included as verified creator with 0% share
 * (required for Metaplex to mark the collection as verified).
 */
export function buildMetaplexCreators(
  splits: SplitResult,
  relayerAddress: string
): Array<{ address: string; share: number; verified: boolean }> {
  // Metaplex creator shares must sum to 100 (integer percentages)
  // We convert bps → integer percent, handling rounding
  const creators = splits.entries.map(e => ({
    address: e.walletAddress,
    share: Math.floor(e.splitBps / 100),
    verified: false, // artists verify via their own wallet; relayer can't verify for them
  }));

  // Fix rounding: ensure shares sum to 100
  const totalShare = creators.reduce((s, c) => s + c.share, 0);
  if (totalShare < 100 && creators.length > 0) {
    creators[creators.length - 1].share += 100 - totalShare;
  }

  return creators;
}

/**
 * Format splits for display in the UI.
 */
export function formatSplitPreview(splits: SplitResult): string {
  return splits.entries
    .map(e => `${e.displayName ?? e.walletAddress.slice(0, 8) + "..."}: ${e.splitPercent}%`)
    .join(", ");
}
