import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function wrapText(text, font, size, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function buildEstimatePdf(data, bill, competitors) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // US Letter
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  const ink = rgb(0.12, 0.16, 0.13);
  const soft = rgb(0.36, 0.41, 0.37);
  const accent = rgb(0.18, 0.44, 0.31);

  const left = 56;
  const right = 556;
  let y = 730;

  const text = (str, x, yy, f = font, size = 11, color = ink) =>
    page.drawText(str, { x, y: yy, size, font: f, color });
  const textRight = (str, xRight, yy, f = font, size = 11, color = ink) => {
    const w = f.widthOfTextAtSize(str, size);
    page.drawText(str, { x: xRight - w, y: yy, size, font: f, color });
  };
  const money = (n) => `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  text("MONTHLY BILL ESTIMATE", left, y, bold, 10, soft);
  y -= 24;
  text("Your Harvest Tab", left, y, bold, 24, ink);
  y -= 22;
  const planLabel = data.plan === "teams" ? "Teams" : "Enterprise";
  text(`${planLabel} plan, billed ${data.billing}`, left, y, font, 11, soft);
  y -= 26;

  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: ink });
  y -= 24;

  const rows = [
    ["Seats", `${data.seats} \u00d7 $${bill.seatRate}`, bill.seatCost],
    ["Projects", `${data.projects} used`, bill.projectFee],
    ["Tasks", `${data.tasks} used`, bill.taskFee],
    ["Clients", `${data.clients} used`, bill.clientFee],
    ["Invoices created", `${data.invoices} created`, bill.invoiceFee],
    ["Amount invoiced", `${money(data.amountInvoiced)} invoiced`, bill.amountFee],
  ];
  if (data.forecast === "yes") rows.push(["Forecast add-on", `${data.seats} \u00d7 $5`, bill.forecastCost]);

  rows.forEach(([label, sub, amt]) => {
    text(label, left, y, font, 12);
    text(sub, left + 170, y, font, 9, soft);
    textRight(money(amt), right, y, mono, 12);
    y -= 20;
  });

  y -= 4;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.75, color: soft });
  y -= 22;
  text("Estimated total this month", left, y, bold, 13);
  textRight(money(bill.total), right, y, bold, 15, accent);
  y -= 46;

  text("SAME TEAM, THREE ALTERNATIVES", left, y, bold, 10, soft);
  y -= 18;
  text(`Based on ${data.seats} user(s), per-user rate only \u2014 no usage fees layered on:`, left, y, font, 10, soft);
  y -= 22;

  competitors.forEach((c) => {
    text(c.name, left, y, font, 12);
    text(`$${c.rate.toFixed(2)}/user`, left + 200, y, font, 9, soft);
    textRight(`${money(c.total)}/mo`, right, y, mono, 12);
    y -= 20;
  });

  y -= 4;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.75, color: soft });
  y -= 22;

  const note =
    "Seat fees reflect Harvest's published pricing page. Usage fees for projects, tasks, clients, invoices, and amount invoiced follow Harvest's Flex tiers; Harvest publishes only a few anchor points on that schedule, so the bands between them are an estimate built from reported real-account data, not an official rate card.";
  wrapText(note, font, 9, right - left).forEach((line) => {
    text(line, left, y, font, 9, soft);
    y -= 12;
  });

  y -= 14;
  text(`Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, left, y, font, 8, soft);

  return doc.save();
}
