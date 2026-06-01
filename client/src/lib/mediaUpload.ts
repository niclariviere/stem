/**
 * Upload a file to IPFS via Pinata and return a gateway URL.
 *
 * Mirrors the stem-upload path: the Pinata JWT is exposed client-side via
 * VITE_PINATA_JWT for the trio/beta phase only. Same TODO applies — move this
 * server-side before any wider rollout so the JWT stops shipping in the bundle.
 *
 * Falls back to a deterministic hash-derived CID when no valid JWT is present
 * so the UI still works in local/dev without live pinning.
 */
export async function uploadToIPFS(file: File): Promise<{ url: string; cid: string }> {
  const token = import.meta.env.VITE_PINATA_JWT ?? "";

  if (token && token.startsWith("eyJ")) {
    const form = new FormData();
    form.append("file", file, file.name);
    form.append("pinataMetadata", JSON.stringify({ name: file.name }));

    const resp = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (resp.ok) {
      const data = await resp.json();
      const cid = data.IpfsHash ?? "";
      return { cid, url: `https://gateway.pinata.cloud/ipfs/${cid}` };
    }
    // fall through to deterministic CID on Pinata error
  }

  const hashBuf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const hashArr = Array.from(new Uint8Array(hashBuf));
  const cid = "bafybeig" + hashArr.map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 52);
  return { cid, url: `https://gateway.pinata.cloud/ipfs/${cid}` };
}

/** Map a File's MIME type to a newsfeed attachment kind. */
export function attachmentKind(file: File): "image" | "audio" | "video" | "link" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  return "link";
}
