const body = document.getElementById("leads-body");
const notice = document.getElementById("notice");
const refreshButton = document.getElementById("refresh-button");
document.getElementById("year").textContent = new Date().getFullYear();

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[char]);
}
function showNotice(message, isError = false) {
  notice.textContent = message;
  notice.classList.toggle("error", isError);
}
function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}
async function loadLeads() {
  refreshButton.disabled = true;
  showNotice("Loading leads…");
  try {
    const response = await fetch("/.netlify/functions/leads");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load leads.");
    const leads = result.leads || [];
    document.getElementById("total-count").textContent = leads.length;
    document.getElementById("new-count").textContent = leads.filter(x => x.status === "new").length;
    document.getElementById("contacted-count").textContent = leads.filter(x => x.status === "contacted").length;
    document.getElementById("converted-count").textContent = leads.filter(x => x.status === "converted").length;
    if (!leads.length) {
      body.innerHTML = '<tr><td colspan="5" class="empty">No leads have been received yet.</td></tr>';
    } else {
      body.innerHTML = leads.map(lead => `
        <tr>
          <td>${safe(formatDate(lead.created_at))}</td>
          <td>${safe(lead.name || "Not provided")}</td>
          <td>${safe(lead.source || "Website")}</td>
          <td>${safe([lead.pickup, lead.destination, lead.travel_date].filter(Boolean).join(" · ") || "Details not provided")}</td>
          <td><span class="status">${safe(lead.status || "new")}</span></td>
        </tr>`).join("");
    }
    showNotice("Database connected. Showing " + leads.length + " saved lead(s).");
  } catch (error) {
    body.innerHTML = '<tr><td colspan="5" class="empty">Leads are unavailable until the database is configured.</td></tr>';
    ["total-count","new-count","contacted-count","converted-count"].forEach(id => document.getElementById(id).textContent = "—");
    showNotice(error.message, true);
  } finally {
    refreshButton.disabled = false;
  }
}
refreshButton.addEventListener("click", loadLeads);
loadLeads();

// Google visibility & marketing panel
const fmt = n => Number(n || 0).toLocaleString();
function pill(label, state, title) {
  return `<span class="pill ${state}" title="${safe(title || "")}">${safe(label)}</span>`;
}
async function loadGoogle() {
  const box = document.getElementById("integrations");
  const gscNotice = document.getElementById("gsc-notice");
  try {
    const res = await fetch("/.netlify/functions/google");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not check integrations.");
    const s = data.status;
    const gscState = !s.searchConsole.configured ? ["Search Console: not connected", ""]
      : s.searchConsole.connected ? ["Search Console: connected", "ok"] : ["Search Console: error", "bad"];
    box.innerHTML = [
      pill("Lead database: " + (s.supabase.configured ? "configured" : "not configured"), s.supabase.configured ? "ok" : "bad"),
      pill(gscState[0], gscState[1], s.searchConsole.error),
      pill("Business Profile: not connected", "", s.businessProfile.note),
      pill("Google Ads: not connected", "", s.googleAds.note)
    ].join("");
    const gsc = data.searchConsole;
    if (!gsc) {
      gscNotice.classList.toggle("error", !!s.searchConsole.error);
      gscNotice.textContent = s.searchConsole.error || "Google Search Console is not connected yet. Add the Google service account variables in Netlify to show search data.";
      return;
    }
    gscNotice.classList.remove("error");
    gscNotice.textContent = `Google Search data from ${gsc.range.startDate} to ${gsc.range.endDate}.`;
    document.getElementById("gsc-stats").hidden = false;
    document.getElementById("gsc-tables").hidden = false;
    document.getElementById("gsc-clicks").textContent = fmt(gsc.totals.clicks);
    document.getElementById("gsc-impressions").textContent = fmt(gsc.totals.impressions);
    document.getElementById("gsc-ctr").textContent = (gsc.totals.ctr * 100).toFixed(1) + "%";
    document.getElementById("gsc-position").textContent = gsc.totals.position ? gsc.totals.position.toFixed(1) : "—";
    const rows = (list, empty) => list.length ? list.map(r => `<tr><td>${safe(r.key)}</td><td>${fmt(r.clicks)}</td><td>${fmt(r.impressions)}</td><td>${r.position.toFixed(1)}</td></tr>`).join("")
      : `<tr><td colspan="4" class="empty">${empty}</td></tr>`;
    document.getElementById("gsc-queries").innerHTML = rows(gsc.queries, "No search terms recorded yet.");
    document.getElementById("gsc-pages").innerHTML = rows(gsc.pages, "No pages with Google traffic yet.");
  } catch (error) {
    box.innerHTML = pill("Integration check failed", "bad");
    gscNotice.classList.add("error");
    gscNotice.textContent = error.message;
  }
}
document.getElementById("google-refresh").addEventListener("click", loadGoogle);
loadGoogle();
