# Scholarship Monitoring System (SAD Midterm, Section A)

Browser app: HTML, CSS, JavaScript, Supabase (Auth, Postgres, RLS).

## Setup
1. Supabase: run `sql/schema.sql`, create two test users, set roles (see header of `sql/seed.sql`), then run `sql/seed.sql`.
2. Open `config.js` and set `SUPABASE_URL` and `SUPABASE_ANON_KEY` (anon key only; never the service-role key).
3. Run locally: `python -m http.server 8000`, then open http://localhost:8000
4. Adding scholars: staff use Scholars, then Add scholar (name, student ID, email, temporary password, program). This creates the login with the public key only. In Supabase, Authentication, Providers, Email, turn off "Confirm email" so the new scholar can sign in at once; if it stays on, the scholar must confirm the email first.
5. Test account credentials are supplied privately to the instructor.

## Known defects
(Fill in after running TC01 to TC10.)
