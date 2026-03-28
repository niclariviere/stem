/**
 * NFT Proof-of-Ownership Minting
 * Uses Base Sepolia testnet (chain ID: 84532)
 * Contract: ERC-721 with stem CID embedded in token URI
 *
 * To switch to mainnet: change CHAIN_CONFIG.chainId to 8453 and rpcUrl to mainnet
 */

export const CHAIN_CONFIG = {
  testnet: {
    chainId: "0x14A34", // 84532 in hex
    chainName: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    blockExplorer: "https://sepolia.basescan.org",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  mainnet: {
    chainId: "0x2105", // 8453 in hex
    chainName: "Base",
    rpcUrl: "https://mainnet.base.org",
    blockExplorer: "https://basescan.org",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
};

// Minimal ERC-721 ABI for minting
const ERC721_ABI = [
  "function mint(address to, string memory tokenURI) external returns (uint256)",
  "function tokenURI(uint256 tokenId) external view returns (string memory)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function balanceOf(address owner) external view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

// STEM NFT contract on Base Sepolia (deploy your own and update this address)
export const STEM_NFT_CONTRACT = "0x0000000000000000000000000000000000000000"; // Placeholder — deploy contract

export interface StemNFTMetadata {
  name: string;
  description: string;
  image: string;
  external_url: string;
  attributes: Array<{ trait_type: string; value: string | number }>;
  stem_cid: string;
  stem_uri: string;
}

export function buildNFTMetadata(params: {
  fileName: string;
  artistName: string;
  bpm?: number;
  key?: string;
  instrumentType?: string;
  ipfsCid: string;
  ipfsUrl?: string;
}): StemNFTMetadata {
  return {
    name: `STEM: ${params.fileName}`,
    description: `Proof of ownership for audio stem "${params.fileName}" by ${params.artistName}. Stored permanently on IPFS.`,
    image: `https://api.dicebear.com/7.x/shapes/svg?seed=${params.ipfsCid}&backgroundColor=1a0a2e`,
    external_url: params.ipfsUrl ?? `https://${params.ipfsCid}.ipfs.w3s.link`,
    attributes: [
      { trait_type: "Artist", value: params.artistName },
      { trait_type: "BPM", value: params.bpm ?? 0 },
      { trait_type: "Key", value: params.key ?? "Unknown" },
      { trait_type: "Instrument", value: params.instrumentType ?? "Unknown" },
      { trait_type: "Chain", value: "Base Sepolia" },
      { trait_type: "Storage", value: "IPFS + Filecoin" },
    ],
    stem_cid: params.ipfsCid,
    stem_uri: `stem://${params.ipfsCid}`,
  };
}

export async function uploadMetadataToIPFS(metadata: StemNFTMetadata): Promise<string> {
  const json = JSON.stringify(metadata, null, 2);
  const blob = new Blob([json], { type: "application/json" });

  try {
    const formData = new FormData();
    formData.append("file", blob, "metadata.json");
    const resp = await fetch("https://up.web3.storage/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_WEB3_STORAGE_TOKEN ?? ""}`,
      },
      body: formData,
    });
    if (resp.ok) {
      const data = await resp.json();
      return `https://${data.cid}.ipfs.w3s.link`;
    }
  } catch {
    // Fallback: data URI
  }

  // Fallback: base64 data URI (works without API key)
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return `data:application/json;base64,${b64}`;
}

export async function switchToBaseSepolia(): Promise<void> {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("MetaMask not found");

  const chain = CHAIN_CONFIG.testnet;
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chain.chainId }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: chain.chainId,
          chainName: chain.chainName,
          rpcUrls: [chain.rpcUrl],
          blockExplorerUrls: [chain.blockExplorer],
          nativeCurrency: chain.nativeCurrency,
        }],
      });
    } else {
      throw switchError;
    }
  }
}

export interface MintResult {
  tokenId: string;
  txHash: string;
  contractAddress: string;
  chain: string;
  tokenUri: string;
}

export async function mintStemNFT(params: {
  toAddress: string;
  tokenUri: string;
  contractAddress?: string;
}): Promise<MintResult> {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("MetaMask not found. Please install MetaMask.");

  // Request accounts
  const accounts = await eth.request({ method: "eth_requestAccounts" });
  const account = accounts[0];

  // Switch to Base Sepolia
  await switchToBaseSepolia();

  const contractAddress = params.contractAddress ?? STEM_NFT_CONTRACT;

  // If no real contract deployed, simulate the mint for demo
  if (contractAddress === "0x0000000000000000000000000000000000000000") {
    // Simulate: generate a mock tx hash
    const mockTxHash = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, "0")).join("");
    const mockTokenId = String(Math.floor(Math.random() * 10000));

    return {
      tokenId: mockTokenId,
      txHash: mockTxHash,
      contractAddress,
      chain: "base-sepolia",
      tokenUri: params.tokenUri,
    };
  }

  // Real contract interaction using eth_sendTransaction
  const mintFunctionSelector = "0x40c10f19"; // keccak256("mint(address,string)").slice(0,4)
  const encodedAddress = params.toAddress.slice(2).padStart(64, "0");
  const encodedOffset = (64).toString(16).padStart(64, "0");
  const uriBytes = new TextEncoder().encode(params.tokenUri);
  const uriLen = uriBytes.length.toString(16).padStart(64, "0");
  const uriHex = Array.from(uriBytes).map(b => b.toString(16).padStart(2, "0")).join("").padEnd(Math.ceil(uriBytes.length / 32) * 64, "0");
  const data = mintFunctionSelector + encodedAddress + encodedOffset + uriLen + uriHex;

  const txHash = await eth.request({
    method: "eth_sendTransaction",
    params: [{
      from: account,
      to: contractAddress,
      data,
      gas: "0x30D40", // 200,000 gas
    }],
  });

  // Wait for receipt to get token ID
  let receipt = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    receipt = await eth.request({ method: "eth_getTransactionReceipt", params: [txHash] });
    if (receipt) break;
  }

  const tokenId = receipt?.logs?.[0]?.topics?.[3]
    ? String(parseInt(receipt.logs[0].topics[3], 16))
    : "0";

  return {
    tokenId,
    txHash,
    contractAddress,
    chain: "base-sepolia",
    tokenUri: params.tokenUri,
  };
}
