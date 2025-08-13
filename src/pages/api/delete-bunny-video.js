// src/pages/api/delete-bunny-video.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { videoId } = req.body || {};
  if (!videoId) return res.status(400).json({ error: "Missing videoId" });

  const libraryId = process.env.BUNNY_LIBRARY_ID;
  const apiKey = process.env.BUNNY_API_KEY;

  const r = await fetch(
    `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
    { method: "DELETE", headers: { AccessKey: apiKey } }
  );
  if (!r.ok) return res.status(r.status).json({ error: await r.text() });
  res.status(200).json({ ok: true });
}
