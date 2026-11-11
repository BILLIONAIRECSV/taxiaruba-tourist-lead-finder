// Netlify Function: secure lead intake and dashboard retrieval.
// Required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};
const reply = (statusCode, payload) => ({
  statusCode,
  headers,
  body: JSON.stringify(payload)
});

// Turn Supabase errors into actionable messages without exposing secrets.
const describeFailure = (status, data) => {
  const message = (data && (data.message || data.error)) || "";
  if (status === 401 || /invalid api key/i.test(message)) {
    return "Supabase rejected the API key. Make sure SUPABASE_SERVICE_ROLE_KEY is the service_role key from the same project as SUPABASE_URL, then redeploy.";
  }
  if (status === 404 || /relation .* does not exist|could not find the table/i.test(message)) {
    return "The leads table was not found. Run supabase-schema.sql in the Supabase SQL Editor.";
  }
  return "Database request failed" + (message ? ": " + message : ".");
};

exports.handler = async (event) => {
  const supabaseUrl = (process.env.SUPABASE_URL || "").trim().replace(/\/rest\/v1\/?$/, "");
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceKey) {
    return reply(503, { error: "Database is not configured. Add the Supabase environment variables in Netlify." });
  }

  const tableUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/leads`;
  const commonHeaders = {
    "apikey": serviceKey,
    "Authorization": `Bearer ${serviceKey}`,
    "Content-Type": "application/json"
  };

  try {
    if (event.httpMethod === "GET") {
      const response = await fetch(`${tableUrl}?select=id,name,source,pickup,destination,travel_date,status,created_at&order=created_at.desc&limit=200`, {
        headers: { ...commonHeaders, "Accept": "application/json" }
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) return reply(502, { error: describeFailure(response.status, data) });
      return reply(200, { leads: data });
    }

    if (event.httpMethod === "POST") {
      let input;
      try { input = JSON.parse(event.body || "{}"); }
      catch { return reply(400, { error: "Request body must be valid JSON." }); }

      const name = typeof input.name === "string" ? input.name.trim().slice(0, 120) : "";
      const source = typeof input.source === "string" ? input.source.trim().slice(0, 40) : "website";
      const pickup = typeof input.pickup === "string" ? input.pickup.trim().slice(0, 180) : "";
      const destination = typeof input.destination === "string" ? input.destination.trim().slice(0, 180) : "";
      const travel_date = typeof input.travel_date === "string" ? input.travel_date.trim().slice(0, 40) : "";
      const notes = typeof input.notes === "string" ? input.notes.trim().slice(0, 1000) : "";
      const source_url = typeof input.source_url === "string" ? input.source_url.trim().slice(0, 1000) : "";

      if (!name && !pickup && !destination && !notes) {
        return reply(400, { error: "Please provide at least one useful enquiry detail." });
      }
      if (source_url && !/^https:\/\//i.test(source_url)) {
        return reply(400, { error: "source_url must be an HTTPS URL." });
      }

      const response = await fetch(tableUrl, {
        method: "POST",
        headers: { ...commonHeaders, "Prefer": "return=representation" },
        body: JSON.stringify([{
          name, source, pickup, destination, travel_date, notes, source_url,
          status: "new"
        }])
      });
      const data = await response.json().catch(() => []);
      if (!response.ok) return reply(502, { error: describeFailure(response.status, data) });
      return reply(201, { ok: true, lead: data[0] || null });
    }

    return {
      statusCode: 405,
      headers: { ...headers, "Allow": "GET, POST" },
      body: JSON.stringify({ error: "Method not allowed." })
    };
  } catch {
    return reply(500, { error: "Unexpected server error." });
  }
};
