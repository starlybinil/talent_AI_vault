# Talent-Vault — Advanced Manufacturing Training Programs

Application and admissions platform for Talent-Vault training programs, starting with the
**ASU-TSMC Foundations for Equipment Technician Program** ($0 · 192+ hands-on hours · a guaranteed
TSMC Arizona interview upon successful completion of ASU & TSMC program milestones).

Built with Next.js 15 (App Router, Server Actions), Tailwind CSS 4, Framer Motion, Supabase (Auth, Postgres + RLS, Storage) and Resend.

---

## What it does

**Admissions journey** (every step is visible to the applicant in their portal and sends an email):

1. A prospective learner arrives from ASU's **Get Started Today** button → `/apply/asu-tsmc`
2. Signs in with **Google (Gmail), Facebook, Apple (iCloud)**, or **any email address** (Yahoo, Outlook, etc.) with a password or magic link
3. Completes the application: first/last name, phone, highest diploma/degree (+ major if a degree), **resume upload**, visa sponsorship now/future, 18+ by completion, consent to share with employer partners
4. Admissions screens it in the **queue** (table or kanban) and moves it through the workflow
5. Passing applicants get the **TestGorilla** assessment link by email, plus automatic reminders (day 3 and day 7) and a manual "send reminder" button
6. Admissions records the result verified by TSMC Arizona
7. The applicant is emailed next steps
8. They rank their **top 3 cohorts** (dates, times, locations, **live seats left**)
9. They are registered in the highest-ranked cohort with a free seat, or **waitlisted** and auto-promoted when a seat opens
10. They **e-sign the program agreements** (typed name + drawn signature → signed PDF with timestamp/IP/document fingerprint)
11. Admissions verifies the documents and sends the **final confirmation** (with a calendar invite)

**Status flow:** `submitted → screening → screening_passed → exam_invited → exam_passed → cohort_selection → cohort_registered | waitlisted → agreements_pending → agreements_submitted → confirmed` (plus `not_selected`, `exam_failed`, `withdrawn`).
The rules are enforced in the database (`public.transition_allowed`) and mirrored in `src/lib/workflow.ts`.

### User types

| Role | Area | Can |
|---|---|---|
| **Applicant** | `/portal` | Apply, track status, open the assessment, rank cohorts, e-sign, message admissions, change cohort or withdraw, permanently delete their account (Account settings) |
| **Employer partner** (e.g. TSMC Arizona) | `/employer` | See **only the fields the program allows**, and only for applicants who consented, for programs their organization partners on. Pipeline dashboard, shortlist, interview-interest and assessment-result notes to admissions, CSV export. |
| **Program admin** (admissions manager) | `/admin` | Analytics, queue with filters and bulk actions, CSV export, full workflow, cohorts and waitlists, programs, agreements, employer-visibility policy, messaging and internal notes |
| **IT admin** | `/admin` | Users and roles, employer orgs, audit log, email log, integrations and settings; read-only admissions |
| **Web developer** | `/admin` | Site content CMS (landing copy, FAQs, stats, banners), feature flags, system health. **No access to applicant data.** |

Access is enforced twice: route guards (`src/middleware.ts` + `src/lib/rbac.ts`) and Postgres RLS / SECURITY DEFINER RPCs that check the caller's role.

**Extras included:** waitlist with auto-promotion, admin analytics (funnel, stage mix, sources, education, visa, cohort fill, 60-day trend), applicant–admin messaging with internal notes, a multi-program catalog, an audit log of sign-ins, record/file views, exports and role changes, and feature flags.

---

## Project layout

```
src/app/
  page.tsx                       Talent-Vault home
  programs/[slug]/               Program landing (hero video, curriculum, formats, cohorts, FAQ)
  apply/[slug]/route.ts          Partner entry link → register/apply (keeps UTM)
  (auth)/login|register|…        Auth pages
  auth/callback|after|signout    OAuth/magic-link callback, role-based landing
  portal/                        Applicant portal
  admin/                         Admin, IT and web developer console
  employer/                      Employer partner portal
  api/files                      Short-lived signed file links (storage RLS decides access)
  api/cron/reminders             Daily assessment reminders
src/lib/                         workflow, rbac, session, email, notify, pdf, ics, audit, validation
supabase/migrations/             Schema, functions, RLS, storage
supabase/seed.sql                Program, cohorts, agreements, TSMC Arizona partner, flags
scripts/create-demo-users.sql    One demo login per role
tests/unit                       Vitest
tests/e2e                        Playwright happy path (needs a reachable Supabase project)
```

---

## Setup

### 1. Supabase

A project named **talent-vault-training** (ref `oyyksxbizrzmzdtwlucn`, us-west-1) has already been created. The migrations, seed data and demo users are already applied.

For a fresh project, run these in order in the SQL editor (or use `supabase db push`):

1. `supabase/migrations/*.sql`, in filename order
2. `supabase/seed.sql`
3. `scripts/create-demo-users.sql`, after replacing `__DEMO_PASSWORD__`

**Authentication settings** (Dashboard → Authentication):

- **URL Configuration:** set the Site URL to your domain, and add `https://<domain>/auth/callback` (plus `http://localhost:3000/auth/callback`) to the redirect URLs.
- **Providers:**
  - **Google** (Gmail): create an OAuth client in Google Cloud Console. The redirect URI is `https://oyyksxbizrzmzdtwlucn.supabase.co/auth/v1/callback`.
  - **Facebook**: create a Meta app with Facebook Login, using the same redirect URI.
  - **Apple** (iCloud): needs a Services ID, a key and your Team ID from the Apple Developer account.
  - **Yahoo / Outlook / any other email**: works out of the box with email + password or magic link. Supabase has no Yahoo OAuth provider.
- **Passwords:** turn on **Leaked Password Protection**. The Supabase security advisor flags it.
- **Email confirmation** is on by default. Keep it on in production. For automated E2E runs, turn it off or confirm test users with SQL.
- For production email volume, configure custom SMTP under Auth → SMTP. Resend works well here.

**Branded authentication emails** (Dashboard → Authentication → Emails → Templates). Supabase sends these, not the app. Paste each file's HTML into the matching template and set the subject:

| Template | File | Subject |
|---|---|---|
| Confirm signup | `supabase/templates/confirm-signup.html` | Confirm your email to finish joining Talent-Vault |
| Magic link | `supabase/templates/magic-link.html` | Your Talent-Vault sign-in link |
| Reset password | `supabase/templates/reset-password.html` | Reset your Talent-Vault password |
| Change email address | `supabase/templates/change-email.html` | Confirm your new Talent-Vault email address |

To change the sender from "Supabase Auth" to "Talent-Vault Admissions", and to remove the "powered by Supabase" footer, set up **custom SMTP** under Authentication → Emails → SMTP Settings. Resend works: host `smtp.resend.com`, port 465, user `resend`, password = your Resend API key, sender `admissions@<your verified domain>`, sender name `Talent-Vault Admissions`. Custom SMTP also lifts Supabase's low default sending limit.

### 2. Environment

Copy `.env.example` to `.env.local` and fill it in:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project URL and publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only.** Used by the reminder cron, and to email waitlist promotions triggered by an applicant withdrawing |
| `NEXT_PUBLIC_SITE_URL` | Public URL, used in email links |
| `RESEND_API_KEY`, `EMAIL_FROM` | Transactional email. Without a key, emails are logged as `simulated` in **Admin → Email log** |
| `CRON_SECRET` | Protects `/api/cron/reminders` |
| `NEXT_PUBLIC_HERO_CLIPS` | Optional comma-separated hero video URLs |

### 3. Run

```bash
npm install
npm run dev          # http://localhost:3000
npm run lint && npm run typecheck && npm test
npm run build
```

### 4. Deploy (Vercel)

1. Import the repo and add the env vars above.
2. `vercel.json` schedules `/api/cron/reminders` daily at 16:00 UTC (9 AM Arizona). Vercel sends `CRON_SECRET` as a Bearer token.

### 5. Connect ASU's "Get Started Today" button

Ask ASU Engineering Online to point the button on
<https://asuengineeringonline.com/tsmc-foundations-equipment-technician-program> to:

```
https://<your-domain>/apply/asu-tsmc?utm_source=asu&utm_medium=referral&utm_campaign=tsmc-foundations
```

New visitors land on account creation and go straight into the application after signing in. Signed-in visitors go directly to the application. The source shows up in admin analytics.

---

## Demo accounts

These accounts exist in the Supabase project. **The password is not stored in the repo.** Your Claude session shared it with you; rotate it, or delete these users, before launch.

| Email | Role |
|---|---|
| `applicant.demo@talent-vault.org` | Applicant |
| `admissions.demo@talent-vault.org` | Program admin |
| `it.demo@talent-vault.org` | IT admin |
| `webdev.demo@talent-vault.org` | Web developer |
| `employer.demo@talent-vault.org` | Employer partner (TSMC Arizona) |

---

## Content to confirm before launch

These values are **seeded placeholders**. Program admins can edit them in the admin console:

- **Training locations**: Admin → Training locations (name + address, managed once; cohorts pick one from a dropdown). The seeded campuses are examples; locations are "spread across the Phoenix metro".
- **Cohort dates, times and capacities**: Admin → Cohorts. Program admins can also delete a cohort there (affected applicants are emailed and sent back to cohort selection).
- **Agreement text**: Admin → Programs → ASU-TSMC → Program agreements. Each agreement is marked `PLACEHOLDER`. Editing the text creates a new version.
- **TestGorilla link**: Admin → Programs (default link), or per applicant when sending the invite.
- **Curriculum topic names**: the published topics include electronics, sensors, pneumatics, vacuum systems and safety. The other three names are best guesses, editable under Admin → Site content.
- **Employer-visible fields**: Admin → Programs (checklist).
- ASU and TSMC are mentioned only as text ("in partnership with"). Add official logos only with written brand approval.

## Media

The hero clips and section images were generated with Higgsfield and are served from its CDN (`src/lib/media.ts`). To self-host them:

1. Download them into `public/media/`.
2. Set `NEXT_PUBLIC_HERO_CLIPS=/media/hero-1.mp4,/media/hero-2.mp4,…` and update the `IMAGES` entries.

## Testing

- `npm test` runs the Vitest unit tests: workflow transitions, RBAC matrix, validation, CSV and ICS.
- `npm run test:e2e` runs the Playwright happy path across applicant, admin and employer. It needs `E2E_BASE_URL`, `E2E_DEMO_PASSWORD` and a reachable Supabase project.
- Database behavior was verified with SQL impersonation tests. They cover:
  - cohort rank fallback, waitlisting and promotion
  - no overbooking
  - applicant isolation
  - the employer field policy and consent filter
  - that web developers can't read applications
  - that IT admins can't change status
  - applicant self-deletion: wrong email and staff accounts are refused; a confirmed applicant's seat goes to the waitlist; all their rows and their login are removed
  - training locations: cohorts copy the chosen location, edits sync to every cohort there, and a location in use can't be deleted
  - cohort deletion: program admins only; registered applicants and anyone waitlisted only there go back to cohort selection, and people still on another waitlist stay there

## Security notes

- Every table has RLS. Clients can't write workflow state directly: all transitions go through role-checked SECURITY DEFINER RPCs that record `application_events`.
- Files live in a private bucket under per-user folders. Downloads use 60-second signed URLs that storage RLS authorizes.
- Staff and employer views of applicant records, file access and exports are written to `audit_log`.
- CSV exports neutralize spreadsheet formulas.
