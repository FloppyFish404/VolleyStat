// src/pages/api/create-bunny-video.js
import crypto from "node:crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { title } = req.body || {};
  if (!title) return res.status(400).json({ error: "Missing title" });

  const libraryId = process.env.BUNNY_LIBRARY_ID; // set in .env.local
  const apiKey = process.env.BUNNY_API_KEY;

  // 1) Create video -> get GUID
  const r = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
    method: "POST",
    headers: { AccessKey: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!r.ok) return res.status(r.status).json({ error: await r.text() });
  const { guid } = await r.json();

  // 2) Sign TUS
  const expires = Math.floor(Date.now() / 1000) + 60 * 30; // 30 min
  const signature = crypto
    .createHash("sha256")
    .update(`${libraryId}${apiKey}${expires}${guid}`)
    .digest("hex");

  // 3) Return to client
  res.status(200).json({
    tusEndpoint: "https://video.bunnycdn.com/tusupload",
    libraryId,
    videoId: guid,
    expires,
    signature,
  });
}
