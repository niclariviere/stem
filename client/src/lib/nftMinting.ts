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
  // Pinata JWT — same var the stem-file upload uses (client/src/lib/mediaUpload.ts).
  const token = import.meta.env.VITE_PINATA_JWT ?? "";
  if (!token || !token.startsWith("eyJ")) {
    throw new Error("Cannot pin NFT metadata — VITE_PINATA_JWT is missing or invalid");
  }

  // Pin the JSON as a FILE via pinFileToIPFS, not pinJSONToIPFS: the JWT is scoped to
  // file pinning only (pinJSONToIPFS returns 403). Returns a short gateway URL.
  const fileName = `stem-nft-${metadata.stem_cid?.slice(0, 12) ?? "meta"}.json`;
  const json = JSON.stringify(metadata, null, 2);
  const form = new FormData();
  form.append("file", new Blob([json], { type: "application/json" }), fileName);
  form.append("pinataMetadata", JSON.stringify({ name: fileName }));

  const resp = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (resp.ok) {
    const data = await resp.json();
    const cid = data.IpfsHash ?? "";
    if (cid) return `https://gateway.pinata.cloud/ipfs/${cid}`;
  }
  // No inline data-URI fallback: it embeds the full JSON on-chain and blows past Solana's
  // 1232-byte transaction limit, so the mint always fails. Fail loudly instead.
  throw new Error(`Failed to pin NFT metadata to IPFS (Pinata ${resp.status})`);
}
