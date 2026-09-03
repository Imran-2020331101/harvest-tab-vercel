import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Simple protection: require a secret header that matches an env var you set
// in Vercel. This is not a full auth system --- if you need real access
// control (multiple admins, roles, etc.) swap this for something proper.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const secret = req.headers["x-admin-secret"];
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const ids = await redis.lrange("submissions:index", 0, 199); // most recent 200
    if (!ids || ids.length === 0) return res.status(200).json({ leads: [] });
    const records = await Promise.all(ids.map((id) => redis.get(`submission:${id}`)));
    return res.status(200).json({ leads: records.filter(Boolean) });
  } catch (e) {
    console.error("Leads fetch error:", e);
    return res.status(500).json({ error: "Failed to fetch leads" });
  }
}
