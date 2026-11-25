[Uploading README.md…]()
# WIZO POS — HTML Web App (Milestone 1)

Responsive WIZO POS starter for phone, tablet and computer.

## Files
- `index.html` — app structure
- `style.css` — responsive Teal / White / Dark Navy theme
- `app.js` — Supabase authentication, workspace setup and product management
- `config.js` — Supabase project URL and publishable key
- `database.sql` — initial schema, business creation RPC and RLS policies

## Setup
1. Open the Supabase project SQL Editor.
2. Create a new query, paste the complete `database.sql`, and run it.
3. Upload these files to the root of the GitHub repository.
4. Enable GitHub Pages for the repository (Settings → Pages → Deploy from branch → main → /(root)).
5. Open the published site and register an account. Confirm the email if Supabase asks.
6. Sign in, create the supermarket workspace, then add products.

## Security
- `config.js` contains only the Supabase URL and publishable key provided for this project.
- Never place a `service_role` / secret key or database password in browser files or GitHub.
- RLS is enabled on all business tables. Do not disable RLS.
- Review and strengthen role-specific permissions before production deployment.

## Current scope / limitations
Milestone 1 implements authentication, business workspace creation and product CRUD/listing.
Sales, purchases, expenses, cashier roles, reports, offline synchronization, full translations and exchange-rate accounting are not implemented yet. Dashboard financial metrics remain placeholders.
The app requires an internet connection for Supabase features; offline transaction queue is a later milestone.
