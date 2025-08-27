// src/pages/api/list-bunny-videos.js
import crypto from "node:crypto";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const libraryId = process.env.BUNNY_LIBRARY_ID;
  const apiKey = process.env.BUNNY_API_KEY;
  const cdn = process.env.BUNNY_STREAM_CDN;
  const tokenKey = process.env.BUNNY_STREAM_TOKEN_KEY;

  const page = Number(req.query.page ?? 1);
  const itemsPerPage = Number(req.query.itemsPerPage ?? 100);

  const r = await fetch(
    `https://video.bunnycdn.com/library/${libraryId}/videos?page=${page}&itemsPerPage=${itemsPerPage}`,
    { headers: { AccessKey: apiKey } }
  );
  if (!r.ok) {
    return res.status(r.status).json({ error: await r.text() });
  }

  const data = await r.json(); // { items, totalItems, ... }
  const expires = Math.floor(Date.now() / 1000) + 60 * 15; // 15 min

  function sign(path) {
    // Token = sha256(tokenKey + path + expires)
    const token = crypto
      .createHmac("sha256", tokenKey)
      .update(path + expires)
      .digest("hex");
    return `${cdn}${path}?token=${token}&expires=${expires}`;
  }

  const items = (data.items || []).map((v) => {
    const pathThumb = `/${libraryId}/${v.guid}/thumbnail.jpg`;
    const pathHls   = `/${libraryId}/${v.guid}/playlist.m3u8`;
    return {
      ...v,
      signedThumb: sign(pathThumb),
      signedHls: sign(pathHls),
      embedUrl: `https://iframe.mediadelivery.net/embed/${libraryId}/${v.guid}?autoplay=false`
    };
  });

  res.status(200).json({ ...data, items });
}
