/**
 * Stem NFT metadata helpers.
 *
 * Minting itself is handled server-side by the Solana relayer (see server/lib/mintStemCNFT.ts
 * and the mintQueue flow): the client builds the metadata JSON, pins it to IPFS, and passes the
 * resulting metadataUri to `stems.queueMint`. The relayer pays gas and mints the cNFT — no wallet
 * popup, no user-paid gas. These helpers only build + upload that metadata JSON.
 */

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
    external_url: params.ipfsUrl ?? `https://gateway.pinata.cloud/ipfs/${params.ipfsCid}`,
    attributes: [
      { trait_type: "Artist", value: params.artistName },
      { trait_type: "BPM", value: params.bpm ?? 0 },
      { trait_type: "Key", value: params.key ?? "Unknown" },
      { trait_type: "Instrument", value: params.instrumentType ?? "Unknown" },
      { trait_type: "Chain", value: "Solana" },
      { trait_type: "Storage", value: "IPFS" },
    ],
    stem_cid: params.ipfsCid,
    stem_uri: `stem://${params.ipfsCid}`,
  };
}

export async function uploadMetadataToIPFS(metadata: StemNFTMetadata): Promise<string> {
  const json = JSON.stringify(metadata, null, 2);
  const token = import.meta.env.stemstorage ?? import.meta.env.NFTSTORAGE_API_KEY ?? import.meta.env.VITE_WEB3_STORAGE_TOKEN ?? "";

  if (token && token.startsWith("eyJ")) {
    try {
      // Pinata — pin JSON metadata to IPFS
      const resp = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pinataContent: metadata,
          pinataMetadata: { name: `stem-nft-${metadata.stem_cid?.slice(0, 12) ?? "meta"}.json` },
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const cid = data.IpfsHash ?? "";
        if (cid) return `https://gateway.pinata.cloud/ipfs/${cid}`;
      }
    } catch {
      // Fall through to base64 fallback
    }
  }

  // Fallback: base64 data URI (works without API key, still a valid metadata URI)
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return `data:application/json;base64,${b64}`;
}
