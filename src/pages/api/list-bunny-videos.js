// src/pages/api/list-bunny-videos.js
import crypto from "node:crypto";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const libraryId = process.env.BUNNY_LIBRARY_ID;        // e.g. 477365
  const apiKey    = process.env.BUNNY_API_KEY;           // Stream API key
  const cdnHost   = (process.env.BUNNY_STREAM_CDN || "").replace(/\/+$/, ""); // https://vz-xxxx.b-cdn.net
  const tokenKey  = process.env.BUNNY_STREAM_TOKEN_KEY;  // "Token Authentication Key (Direct Play URLs)"

  const page = Number(req.query.page ?? 1);
  const itemsPerPage = Number(req.query.itemsPerPage ?? 100);

  // --- Fetch videos from Bunny Stream API ---
  const r = await fetch(
    `https://video.bunnycdn.com/library/${libraryId}/videos?page=${page}&itemsPerPage=${itemsPerPage}`,
    { headers: { AccessKey: apiKey } }
  );
  if (!r.ok) return res.status(r.status).json({ error: await r.text() });

  const data = await r.json(); // { items, totalItems, ... }

  // --- CORRECT signer for Bunny token-auth (Direct Play) ---
  // Token must hash: tokenKey + path + expires + (tokenPath || "")
  function sign(path, { tokenPath } = {}) {
    const expires = Math.floor(Date.now() / 1000) + 15 * 60; // 15 min
    const hashInput = tokenKey + path + String(expires) + (tokenPath || "");

    const token = crypto.createHash("sha256").update(hashInput).digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

    const qs = new URLSearchParams({ token, expires: String(expires) });
    // token_path appears in the URL ONLY (not in the hash input)
    if (tokenPath) qs.set("token_path", tokenPath);

    const url = `${cdnHost}${path}?${qs.toString()}`;
    return url;
  }

  // --- Build signed URLs for each item ---
  const items = (data.items || []).map((v) => {
    const hlsPath   = `/${v.guid}/playlist.m3u8`;
    const thumbPath = `/${v.guid}/thumbnail.jpg`;

    return {
      ...v,
      signedHls:   sign(hlsPath,   { tokenPath: `/${v.guid}/` }), // authorizes manifest + all segments under /GUID/
      signedThumb: sign(thumbPath),
      embedUrl: `https://iframe.mediadelivery.net/embed/${libraryId}/${v.guid}?autoplay=false`,
    };
  });

  res.status(200).json({ ...data, items });
}
