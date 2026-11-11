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
