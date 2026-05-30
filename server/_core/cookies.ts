import type { CookieOptions, Request } from "express";

function isSecureRequest(req: Request): boolean {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");
  return protoList.some(p => p.trim().toLowerCase() === "https");
}

/**
 * Session cookie options. sameSite: "lax" is the right default for a same-origin
 * app served from a single host (e.g. stem.nixmusic.net). It works in dev over
 * http://localhost and in production over HTTPS. Avoid sameSite: "none" here —
 * it requires secure: true, which breaks local dev.
 */
export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(req),
  };
}
