/** Probe which Pinata endpoints the JWT is authorized for. */
import "dotenv/config";

const token = process.env.VITE_PINATA_JWT ?? "";
console.log("jwt_present=" + (!!token && token.startsWith("eyJ")));

// 1) pinJSONToIPFS
const j = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ pinataContent: { probe: "json" } }),
});
console.log("pinJSONToIPFS=" + j.status);

// 2) pinFileToIPFS (JSON wrapped as a file)
const form = new FormData();
form.append("file", new Blob([JSON.stringify({ probe: "file" })], { type: "application/json" }), "probe.json");
const f = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
const fbody = f.ok ? (await f.json()).IpfsHash : await f.text();
console.log("pinFileToIPFS=" + f.status + " result=" + JSON.stringify(fbody).slice(0, 80));
