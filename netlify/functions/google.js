// Netlify Function: Google integration status + Search Console performance (read-only).
// Never returns secret values — only whether each integration is configured, and data from official APIs.
//
// Search Console env vars:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GSC_SITE_URL
//   (e.g. GSC_SITE_URL = "sc-domain:taxiaruba.com" or "https://taxiaruba.com/")
// Planned (not yet implemented): Google Business Profile, Google Ads.
const crypto = require("crypto");

const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const reply = (statusCode, payload) => ({ statusCode, headers, body: JSON.stringify(payload) });
const env = (k) => (process.env[k] || "").trim();
const has = (...keys) => keys.every((k) => env(k));

const b64url = (input) => Buffer.from(input).toString("base64url");

async function getGoogleToken(scope) {
  const email = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const key = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({
    iss: email, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600
  }))}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(key).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error("Google sign-in failed: " + (data.error_description || data.error || res.status));
  }
  return data.access_token;
}

const isoDay = (offsetDays) => new Date(Date.now() - offsetDays * 86400000).toISOString().slice(0, 10);

async function searchConsole() {
  const token = await getGoogleToken("https://www.googleapis.com/auth/webmasters.readonly");
  const site = encodeURIComponent(env("GSC_SITE_URL"));
  // Search Console data lags ~2-3 days; use the last 28 complete days.
  const range = { startDate: isoDay(30), endDate: isoDay(3) };
  const query = (body) => fetch(`https://www.googleapis.com/webmasters/v3/sites/${site}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...range, ...body })
  }).then(async (r) => {
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error("Search Console: " + (d.error?.message || r.status));
    return d.rows || [];
  });

  const [totals, queries, pages] = await Promise.all([
    query({}),
    query({ dimensions: ["query"], rowLimit: 15 }),
    query({ dimensions: ["page"], rowLimit: 10 })
  ]);
  const t = totals[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const row = (r) => ({ key: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position });
  return {
    range,
    totals: { clicks: t.clicks, impressions: t.impressions, ctr: t.ctr, position: t.position },
    queries: queries.map(row),
    pages: pages.map(row)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return reply(405, { error: "Method not allowed." });

  const status = {
    supabase: { configured: has("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY") },
    searchConsole: { configured: has("GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "GSC_SITE_URL") },
    businessProfile: { configured: false, note: "Planned — requires Google Business Profile API access approval." },
    googleAds: { configured: false, note: "Planned — requires a Google Ads developer token (read-only reporting)." }
  };

  let searchConsoleData = null;
  if (status.searchConsole.configured) {
    try {
      searchConsoleData = await searchConsole();
      status.searchConsole.connected = true;
    } catch (error) {
      status.searchConsole.connected = false;
      status.searchConsole.error = String(error.message || error).slice(0, 300);
    }
  }
  return reply(200, { checkedAt: new Date().toISOString(), status, searchConsole: searchConsoleData });
};
