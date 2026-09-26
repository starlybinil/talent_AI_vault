# FoundryReady (FR) — Advanced Manufacturing Training Programs

> **Trained today. Ready on day one.**

Application and admissions platform for FoundryReady training programs: no-cost, hands-on, non-degree training funded by government and industry, starting with the
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
   - As soon as they've applied (and while admissions screens their application), applicants get the **Practice Lab** (`/portal/practice`) as their next step. It has four practice assessments they can repeat as often as they like, each attempt different:
     - **Cognitive ability** (18 questions): numerical reasoning (percentages, ratios, fractions, costs, efficiency, tables and charts), problem solving and logic (sequences, deduction, rule-based compliance, ordering), and attention to detail. Every question is generated with new values
     - **Situational judgement** (10 of 24 fab scenarios): safety, quality and integrity, teamwork, communication, reliability, learning. Responses are scored 0 to 3, with explanations
     - **Hand tools** (12 questions from 30 illustrated tools): name the tool, spot the tool, and pick the right tool for the job, plus a tool library with a "hide names" self-quiz
     - **Typing speed**: fab-themed passages, live WPM and accuracy
     Recently seen tools and scenarios are used last, results are private to the applicant, and each attempt ends with a full answer review
6. Admissions records the result verified by TSMC Arizona
7. The applicant is emailed next steps
8. **Enrollment** (one step, one page): they rank their **top 3 cohorts** (dates, times, locations, **live seats left**) and are registered in the highest-ranked cohort with a free seat, or **waitlisted** and auto-promoted when a seat opens
9. Right after submitting their choices they **e-sign the program agreements** on the same page (typed name + drawn signature → signed PDF with timestamp/IP/document fingerprint). Waitlisted applicants can sign too, so a promotion goes straight to final confirmation. Signatures are program-wide and carry over if they change cohort
10. The application shows as **Ready to confirm** on the admin dashboard; admissions reviews it and **confirms the enrollment** (individually or in bulk from the queue), which sends the **final confirmation** (with a calendar invite)
11. When the trainee finishes, admissions records **successful program completion** (date + credentials earned)
12. Once they accept an offer, admissions records the **hire** (employer, job title, start date). The trainee and partner employers both see these outcomes, and each one sends a congratulations email

**Status flow:** `screening → exam_invited → exam_passed → cohort_selection → cohort_registered | waitlisted → agreements_pending → agreements_submitted → confirmed → completed → hired` (plus `not_selected`, `exam_failed`, `withdrawn`). Admissions steps, in order:
1. **Screening.** New applications land here automatically; the applicant still gets "application received". Then either **Pass screening & send assessment** or **Not selected**.
2. **Assessment.** Record passed / not passed, or send a reminder.
3. **Acceptance.** A passed assessment waits for **Accept into program & open enrollment**, which emails the applicant to enroll.
4. **Enrollment decision.** The applicant ranks up to 3 cohorts and signs agreements; they hold a seat in their highest choice with space. Admissions sees the choices with live seats, can **move** them to any other cohort in their list, and **accepts** them into the held cohort once agreements are signed (this confirms enrollment).
5. **Reset to start of application process** (any stage before completion) removes the application and emails the applicant to fill in the application form again. Any seat is released to the waitlist, and the old application (timeline, choices, signatures, messages) is kept as a snapshot in the audit log (`application.reset`). **Remove application** withdraws it instead (the applicant sees "Withdrawn").

Applicants can withdraw at any stage up to confirmed; completion and hire can each be undone by admissions if recorded by mistake.
The rules are enforced in the database (`public.transition_allowed`) and mirrored in `src/lib/workflow.ts`.

### User types

| Role | Area | Can |
|---|---|---|
| **Applicant** | `/portal` | Practice Lab (cognitive ability, situational judgement, hand tools, typing), apply, track status (through completion and hire), open the assessment, rank cohorts, e-sign, message admissions, change cohort or withdraw, permanently delete their account (Account settings) |
| **Employer partner** (e.g. TSMC Arizona) | `/employer` | Cohort calendar for partnered programs (where and when trainees learn, how many are admitted/confirmed, graduation dates). Program outcomes (completed, hired by whom) for consenting candidates. See **only the fields the program allows**, and only for applicants who consented, for programs their organization partners on. Pipeline dashboard, shortlist, interview-interest and assessment-result notes to admissions, CSV export. |
| **Program admin** (admissions manager) | `/admin` | Analytics (incl. graduates, hires, placement rate), queue with filters and bulk actions, CSV export, full workflow including recording program completion and hires, cohorts and waitlists, programs, agreements, employer-visibility policy, messaging and internal notes |
| **IT admin** | `/admin` | Read-only cohort calendar; users and roles, employer orgs, audit log, email log, integrations and settings; read-only admissions |
| **Web developer** | `/admin` | Site content CMS (landing copy, FAQs, stats, banners), feature flags, system health. **No access to applicant data.** |

Access is enforced twice: route guards (`src/middleware.ts` + `src/lib/rbac.ts`) and Postgres RLS / SECURITY DEFINER RPCs that check the caller's role.

**Extras included:** an interactive cohort calendar (year timeline by location, month calendar of class days, grid; hover previews and a detail panel tailored to each role), waitlist with auto-promotion, admin analytics (funnel, stage mix, sources, education, visa, cohort fill, 60-day trend), applicant–admin messaging with internal notes, a multi-program catalog, an audit log of sign-ins, record/file views, exports and role changes, and feature flags.

---

## Project layout

```
src/app/
  page.tsx                       FoundryReady home
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
| Confirm signup | `supabase/templates/confirm-signup.html` | Confirm your email to finish joining FoundryReady |
| Magic link | `supabase/templates/magic-link.html` | Your FoundryReady sign-in link |
| Reset password | `supabase/templates/reset-password.html` | Reset your FoundryReady password |
| Change email address | `supabase/templates/change-email.html` | Confirm your new FoundryReady email address |

To change the sender from "Supabase Auth" to "FoundryReady Admissions", and to remove the "powered by Supabase" footer, set up **custom SMTP** under Authentication → Emails → SMTP Settings. Resend works: host `smtp.resend.com`, port 465, user `resend`, password = your Resend API key, sender `admissions@<your verified domain>`, sender name `FoundryReady Admissions`. Custom SMTP also lifts Supabase's low default sending limit.

### 2. Environment

Copy `.env.example` to `.env.local` and fill it in:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project URL and publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only.** Used by the reminder cron, and to email waitlist promotions triggered by an applicant withdrawing |
| `NEXT_PUBLIC_SITE_URL` | Public URL, used in email links |
| `RESEND_API_KEY`, `EMAIL_FROM` | Transactional email. The default sender is `FoundryReady Admissions <admissions@foundryready.org>`: register `foundryready.org` and verify it in Resend, or set `EMAIL_FROM` to another verified address. Without a key, emails are logged as `simulated` in **Admin → Email log** |
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
3. Every push to the production branch deploys automatically. If a push ever doesn't show up under **Deployments**, Vercel missed the GitHub notification: use **Create Deployment** with the branch or commit SHA. Don't use **Redeploy** on an older deployment, which rebuilds that older commit.

### 5. Connect ASU's "Get Started Today" button

Ask ASU Engineering Online to point the button on
<https://asuengineeringonline.com/tsmc-foundations-equipment-technician-program> to:

```
https://<your-domain>/apply/asu-tsmc?utm_source=asu&utm_medium=referral&utm_campaign=tsmc-foundations
```

New visitors land on account creation and go straight into the application after signing in. Signed-in visitors go directly to the application. The source shows up in admin analytics.

---

## Adding a program (e.g. ASU-Amkor, ASU-Intel)

Every partnership is its own row in `programs`, with its own landing page at `/programs/<slug>`, apply link at
`/apply/<slug>`, cohorts, agreements, assessment link and employer-visibility policy. No code changes are needed:

1. **Admin → Programs → New program.** Set the slug (e.g. `asu-amkor`), names, the **academic partner** and
   **employer partner**, industry and career role. Leave landing-page copy blank to get generic wording built from
   those names, or fill in the hero headline, outcome line (e.g. "A guaranteed Amkor interview"), who-should-apply
   list and skills keywords.
2. Add topics, formats, FAQs and stats under **Advanced content (JSON)**, using the ASU-TSMC program as a template.
3. Add agreement templates and cohorts for the program, and link the employer org under partner employers.
4. Tick **Accepting applications** to list it, and **Feature on the home page** to make it the featured program.
   Unticked programs still appear in the catalog as "Coming soon".
5. Give the partner their entry link: `https://<site>/apply/<slug>?utm_source=<partner>`.

Emails, the application form (visa and consent questions) and the applicant portal name the program's own employer
partner automatically.

## Demo accounts

These accounts exist in the Supabase project. They kept their original `@talent-vault.org` login emails after the FoundryReady rebrand. **The password is not stored in the repo.** Your Claude session shared it with you; rotate it, or delete these users, before launch.

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
  - cohort calendar: program and IT admins see every cohort with waitlist numbers, employers see only their partnered programs without waitlist details, and web developers and applicants are refused
  - program outcomes: only program admins record completion/hire, completion must come before hire, graduates can't withdraw, the applicant and consenting candidates' partner employers see the outcome, and undo steps back one stage
  - enrollment: applicants can sign while waitlisted, a promotion with agreements already signed goes straight to awaiting final confirmation, and signatures carry over when changing cohort
  - cohort deletion: program admins only; registered applicants and anyone waitlisted only there go back to cohort selection, and people still on another waitlist stay there

## Security notes

- Every table has RLS. Clients can't write workflow state directly: all transitions go through role-checked SECURITY DEFINER RPCs that record `application_events`.
- Files live in a private bucket under per-user folders. Downloads use 60-second signed URLs that storage RLS authorizes.
- Staff and employer views of applicant records, file access and exports are written to `audit_log`.
- CSV exports neutralize spreadsheet formulas.
