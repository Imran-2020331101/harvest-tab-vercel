// Server-side pricing logic. Kept separate from the frontend copy so the
// authoritative calculation (and the number that gets emailed/stored) can
// never be tampered with by editing client-side state.

export const SEAT_RATE = {
  teams: { annual: 9, monthly: 11 },
  enterprise: { annual: 14, monthly: 17.5 },
};

export const FORECAST_ADDON = 5; // $ per seat / month

// Anchor points (free allowance, first paid band, top band) come from a
// reported real Harvest Flex account. Harvest doesn't publish a full rate
// card, so the bands in between are an estimate, not an official schedule.
const COUNT_TABLE = [[10, 15], [25, 50], [50, 150], [100, 400], [150, 700], [Infinity, 1000]];
const INVOICE_TABLE = [[10, 15], [20, 75], [50, 300], [Infinity, 650]];
const AMOUNT_TABLE = [[20000, 15], [75000, 150], [200000, 350], [Infinity, 650]];

function bandedFee(value, freeAllowance, table) {
  if (value <= freeAllowance) return 0;
  for (const [upper, fee] of table) {
    if (value <= upper) return fee;
  }
  return table[table.length - 1][1];
}

export const COMPETITORS = [
  { name: "OneSuite", rate: 9 },
  { name: "Productive", rate: 29 },
  { name: "Teamwork.com", rate: 29.99 },
];

export function computeHarvest(data) {
  const seats = Number(data.seats);
  const seatRate = SEAT_RATE[data.plan][data.billing];
  const seatCost = seatRate * seats;
  const projectFee = bandedFee(Number(data.projects), 4, COUNT_TABLE);
  const taskFee = bandedFee(Number(data.tasks), 3, COUNT_TABLE);
  const clientFee = bandedFee(Number(data.clients), 3, COUNT_TABLE);
  const invoiceFee = bandedFee(Number(data.invoices), 4, INVOICE_TABLE);
  const amountFee = bandedFee(Number(data.amountInvoiced), 3000, AMOUNT_TABLE);
  const forecastCost = data.forecast === "yes" ? FORECAST_ADDON * seats : 0;
  const total = seatCost + projectFee + taskFee + clientFee + invoiceFee + amountFee + forecastCost;
  return { seatRate, seatCost, projectFee, taskFee, clientFee, invoiceFee, amountFee, forecastCost, total };
}

export function computeCompetitors(data) {
  const seats = Number(data.seats);
  return COMPETITORS.map((c) => ({ ...c, total: c.rate * seats }));
}

export function validate(data) {
  const required = ["plan", "billing", "seats", "projects", "tasks", "clients", "invoices", "amountInvoiced", "forecast", "email"];
  for (const k of required) {
    if (data[k] === undefined || data[k] === null || data[k] === "") return `Missing field: ${k}`;
  }
  if (!["teams", "enterprise"].includes(data.plan)) return "Invalid plan";
  if (!["annual", "monthly"].includes(data.billing)) return "Invalid billing";
  if (!["yes", "no"].includes(data.forecast)) return "Invalid forecast value";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return "Invalid email";
  const numeric = ["seats", "projects", "tasks", "clients", "invoices", "amountInvoiced"];
  for (const k of numeric) {
    if (isNaN(Number(data[k])) || Number(data[k]) < 0) return `Invalid value for ${k}`;
  }
  if (Number(data.seats) < 1) return "Seats must be at least 1";
  return null;
}
