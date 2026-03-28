/**
 * Phantom Wallet integration for Solana
 * Handles wallet detection, connection, and address management.
 * The STEM platform uses a server-side relayer model:
 * - Artists connect Phantom only to provide their wallet address
 * - The relayer (your Mac Mini) pays all gas fees
 * - Artists never need SOL in their wallet to mint
 */

export interface PhantomProvider {
  isPhantom: boolean;
  publicKey: { toString(): string } | null;
  isConnected: boolean;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
    phantom?: { solana?: PhantomProvider };
  }
}

/**
 * Get the Phantom provider from the window object.
 * Phantom injects itself as window.solana or window.phantom.solana
 */
export function getPhantomProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;

  // Prefer window.phantom.solana (newer injection point)
  if (window.phantom?.solana?.isPhantom) {
    return window.phantom.solana;
  }

  // Fallback to window.solana
  if (window.solana?.isPhantom) {
    return window.solana;
  }

  return null;
}

/**
 * Check if Phantom is installed in the browser
 */
export function isPhantomInstalled(): boolean {
  return getPhantomProvider() !== null;
}

/**
 * Connect to Phantom wallet and return the public key string
 */
export async function connectPhantom(): Promise<string> {
  const provider = getPhantomProvider();

  if (!provider) {
    // Open Phantom install page in a new tab
    window.open("https://phantom.app/download", "_blank");
    throw new Error("Phantom wallet not installed. Please install it and try again.");
  }

  try {
    const response = await provider.connect();
    return response.publicKey.toString();
  } catch (err: any) {
    if (err?.code === 4001) {
      throw new Error("Connection rejected. Please approve the connection in Phantom.");
    }
    throw new Error("Failed to connect to Phantom wallet.");
  }
}

/**
 * Disconnect from Phantom wallet
 */
export async function disconnectPhantom(): Promise<void> {
  const provider = getPhantomProvider();
  if (provider) {
    await provider.disconnect();
  }
}

/**
 * Get the currently connected wallet address (if any)
 */
export function getConnectedAddress(): string | null {
  const provider = getPhantomProvider();
  if (!provider?.isConnected || !provider.publicKey) return null;
  return provider.publicKey.toString();
}

/**
 * Validate a Solana wallet address (base58, 32-44 chars)
 */
export function isValidSolanaAddress(address: string): boolean {
  if (!address || address.length < 32 || address.length > 44) return false;
  // Base58 character set
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

/**
 * Shorten a Solana address for display: "ABC...XYZ"
 */
export function shortenAddress(address: string, chars = 4): string {
  if (!address || address.length < chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Get Solana explorer URL for a transaction or address
 */
export function getSolanaExplorerUrl(
  value: string,
  type: "tx" | "address" | "token" = "tx",
  network: "mainnet-beta" | "devnet" = "devnet"
): string {
  const cluster = network === "devnet" ? "?cluster=devnet" : "";
  const base = "https://explorer.solana.com";
  if (type === "tx") return `${base}/tx/${value}${cluster}`;
  if (type === "address") return `${base}/address/${value}${cluster}`;
  return `${base}/address/${value}${cluster}`;
}
