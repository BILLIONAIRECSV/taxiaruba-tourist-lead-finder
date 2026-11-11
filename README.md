# TAXIARUBA Tourist Lead Finder

A separate starter app for the TAXIARUBA lead-management dashboard. It does not modify the existing taxiaruba.com website.

## Files
- `index.html`, `css/`, `js/`: dashboard interface
- `netlify/functions/leads.js`: secure server-side lead API
- `netlify.toml`: Netlify publish and functions configuration
- `supabase-schema.sql`: database table setup

## 1. Create the GitHub repository
Create a new repository named `taxiaruba-tourist-lead-finder`. Private is recommended. Upload all files and folders in this project to the repository root (not inside an extra nested folder).

## 2. Create the Supabase database
1. Create a Supabase project.
2. Open SQL Editor and run the contents of `supabase-schema.sql`.
3. In Project Settings / API, copy the Project URL and the `service_role` key. Keep the service-role key secret.

## 3. Connect to Netlify
1. Open https://app.netlify.com.
2. Choose **Add new project** / **Import an existing project**.
3. Choose GitHub and select `taxiaruba-tourist-lead-finder`.
4. Netlify should detect `netlify.toml`. Publish directory is `.` and functions directory is `netlify/functions`.
5. Deploy the site. Use its temporary `*.netlify.app` address for testing. Do not replace or attach the existing TAXIARUBA.com domain.

## 4. Add Netlify environment variables
In the new Netlify project's environment variable settings, add:
- `SUPABASE_URL` = your Supabase Project URL
- `SUPABASE_SERVICE_ROLE_KEY` = your Supabase service-role key

Then trigger a new deploy so the function receives the variables.

## 5. Test
Open the new Netlify URL. The dashboard should show “Database connected” and “No leads have been received yet.”

To submit a test lead, send a POST request to `/.netlify/functions/leads` with JSON such as:
```json
{
  "name": "Test Tourist",
  "source": "website",
  "pickup": "Queen Beatrix Airport",
  "destination": "Palm Beach",
  "travel_date": "2026-12-01",
  "notes": "Test record only"
}
```
Delete the test row from Supabase when finished.

## Important security and scope notes
- Never put the Supabase service-role key in browser JavaScript, HTML, GitHub, or a committed `.env` file.
- This starter is a lead dashboard and secure intake endpoint. It does not yet connect to Facebook, Reddit, Google, travel forums, or the live TAXIARUBA booking form.
- It does not scrape sites or automatically message people. Add each source using its permitted API/feed and review platform rules before enabling responses.
- Protect the dashboard with authentication before storing real customer information or exposing it beyond your own controlled testing. This starter is not yet an authenticated admin system.
- Do not enter real customer personal data until access control and privacy protections are in place.
