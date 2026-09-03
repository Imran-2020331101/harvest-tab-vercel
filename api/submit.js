import { Redis } from "@upstash/redis";
import { Resend } from "resend";

// Vercel's Redis (Upstash) integration injects credentials under either
// KV_REST_API_* (stores migrated from the old Vercel KV product) or
// UPSTASH_REDIS_REST_* (fresh Marketplace installs). Check both so this
// works regardless of which one you end up with.
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});
import { computeHarvest, computeCompetitors, validate } from "./_pricing.js";
import { buildEstimatePdf } from "./_pdf.js";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const data = req.body || {};
  const validationError = validate(data);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const bill = computeHarvest(data);
  const competitors = computeCompetitors(data);

  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record = { ...data, computedTotal: bill.total, timestamp: new Date().toISOString() };

  let stored = false;
  try {
    await redis.set(`submission:${id}`, record);
    await redis.lpush("submissions:index", id);
    stored = true;
  } catch (e) {
    console.error("Redis storage error:", e);
    // Don't fail the whole request just because storage hiccupped ---
    // the person still wants their email.
  }

  let emailSent = false;
  let emailError = null;
  try {
    const pdfBytes = await buildEstimatePdf(data, bill, competitors);
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    await resend.emails.send({
      from: process.env.FROM_EMAIL || "onboarding@resend.dev",
      to: data.email,
      subject: "Your Harvest bill estimate",
      html: `
        <p>Hi,</p>
        <p>Here's your estimated Harvest bill for this month, plus what the same team would cost on three alternatives. Full breakdown is in the attached PDF.</p>
        <p><strong>Estimated Harvest total: $${bill.total.toFixed(2)}</strong></p>
      `,
      attachments: [
        {
          filename: "harvest-bill-estimate.pdf",
          content: pdfBase64,
        },
      ],
    });
    emailSent = true;
  } catch (e) {
    console.error("Email send error:", e);
    emailError = e.message || "Unknown email error";
  }

  return res.status(200).json({
    ok: true,
    stored,
    emailSent,
    emailError: emailSent ? undefined : emailError,
    total: bill.total,
    competitors,
  });
}
