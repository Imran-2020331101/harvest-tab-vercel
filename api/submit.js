import { Redis } from "@upstash/redis";
import { computeHarvest, computeCompetitors, validate } from "./_pricing.js";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const data = req.body || {};

  // Validate submitted data
  const validationError = validate(data);

  if (validationError) {
    return res.status(400).json({
      error: validationError,
    });
  }

  // Calculate Harvest estimate
  const bill = computeHarvest(data);

  // Calculate competitor estimates
  const competitors = computeCompetitors(data);

  // Generate unique submission ID
  const id = `${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  // Data that will be stored in Upstash
  const record = {
    ...data,
    computedTotal: bill.total,
    timestamp: new Date().toISOString(),
  };

  try {
    // Store complete submission
    await redis.set(`submission:${id}`, record);

    // Store ID in submissions index
    await redis.lpush("submissions:index", id);

    console.log("Submission stored:", id);

    return res.status(200).json({
      ok: true,
      stored: true,
      id,
      total: bill.total,
      competitors,
    });

  } catch (e) {
    console.error("Redis storage error:", e);

    return res.status(500).json({
      ok: false,
      stored: false,
      error: "Failed to save submission",
    });
  }
}