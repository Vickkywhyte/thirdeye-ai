# ThirdEye AI — Build Guide

**Version:** 1.0
**Target:** Production-grade MVP (Free-Tier-First)
**Primary Tools:** Claude Code + VS Code + Mac Terminal
**Author:** Build specification derived from PRD v2.0

---

## Build Philosophy

1. **Security-first.** Every layer assumes hostile input. Auth, RBAC, input validation, CSP, rate limiting — all wired from day one, not bolted on later.
2. **Type-safe end-to-end.** Strict TypeScript everywhere. Zod schemas validate at every boundary (API input, DB output, external API responses). No `any` types.
3. **Convention over configuration.** Consistent file structure, naming patterns, and import aliases mean Claude Code can navigate and modify the codebase predictably.
4. **Progressive complexity.** Each phase produces a working, deployable state. No phase depends on unbuilt future phases.
5. **Automated everything.** Linting, formatting, type-checking, testing, and migrations run automatically on commit and in CI.

---

## Tech Stack (Locked)

| Layer | Technology | Cost |
|---|---|---|
| Framework | Next.js 14+ App Router | Free |
| Language | TypeScript 5+ (strict mode) | Free |
| Styling | Tailwind CSS 3+ | Free |
| UI Components | shadcn/ui + Radix UI | Free |
| Animation | Framer Motion | Free |
| State Management | Zustand (lightweight) | Free |
| Forms | React Hook Form + Zod | Free |
| Tables | TanStack Table v8 | Free |
| Charts | Recharts (dashboard) + D3.js (ownership graph) | Free |
| Command Palette | cmdk | Free |
| Database | Supabase (PostgreSQL + pgvector) | Free tier |
| Auth | Supabase Auth (email + OAuth) | Free tier |
| File Storage | Supabase Storage | Free tier (1GB) |
| LLM (Primary) | Ollama (local) | Free |
| LLM (Fallback) | OpenRouter API | ~$0.001/request |
| Sanctions Data | OpenSanctions.org | Free |
| PEP Data | OpenSanctions.org + Wikidata | Free |
| Adverse Media | GDELT Project + NewsAPI.org | Free tier |
| Sanctions Lists | OFAC SDN, EU, UN, UK HMT | Free (gov feeds) |
| Company Registry | UK Companies House API | Free |
| PDF Generation | @react-pdf/renderer | Free |
| Task Queue | BullMQ + Redis (Upstash free) | Free tier |
| Email | Resend (transactional) | Free tier (100/day) |
| Monitoring | Grafana Cloud free tier | Free tier |
| Deployment | Vercel | Free tier |
| Testing | Vitest + Playwright + MSW | Free |
| CI/CD | GitHub Actions | Free tier |

---

## Project Structure

```
thirdeye-ai/
├── docs/                          # Build guides, ADRs, API docs
│   ├── BUILD_GUIDE.md             # This file
│   ├── SECURITY.md                # Security architecture decisions
│   └── adr/                       # Architecture Decision Records
├── src/
│   ├── app/                       # Next.js App Router pages
│   │   ├── (auth)/                # Auth route group (login, register, reset)
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/           # Authenticated route group
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── investigations/
│   │   │   │   ├── page.tsx       # List view
│   │   │   │   ├── new/page.tsx   # New screening
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx   # Investigation workspace
│   │   │   │       └── layout.tsx
│   │   │   ├── reports/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── edit/page.tsx
│   │   │   ├── settings/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [...slug]/page.tsx
│   │   │   └── layout.tsx         # Authenticated shell (nav rail + workspace)
│   │   ├── api/                   # API routes
│   │   │   ├── auth/
│   │   │   ├── investigations/
│   │   │   ├── screening/
│   │   │   ├── reports/
│   │   │   ├── entities/
│   │   │   └── webhooks/
│   │   ├── layout.tsx             # Root layout (providers, fonts)
│   │   ├── not-found.tsx
│   │   └── error.tsx              # Global error boundary
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components (auto-generated)
│   │   ├── layout/                # Shell components
│   │   │   ├── nav-rail.tsx
│   │   │   ├── contextual-drawer.tsx
│   │   │   ├── command-palette.tsx
│   │   │   └── top-bar.tsx
│   │   ├── investigation/         # Investigation-specific components
│   │   │   ├── risk-score-ring.tsx
│   │   │   ├── ownership-graph.tsx
│   │   │   ├── investigation-timeline.tsx
│   │   │   ├── screening-results.tsx
│   │   │   └── source-evidence-card.tsx
│   │   ├── dashboard/             # Dashboard widgets
│   │   │   ├── metrics-strip.tsx
│   │   │   ├── recent-investigations.tsx
│   │   │   ├── alerts-feed.tsx
│   │   │   └── activity-chart.tsx
│   │   ├── reports/               # Report components
│   │   │   ├── report-editor.tsx
│   │   │   ├── report-preview.tsx
│   │   │   └── report-templates.tsx
│   │   └── shared/                # Cross-cutting components
│   │       ├── data-table.tsx
│   │       ├── empty-state.tsx
│   │       ├── loading-skeleton.tsx
│   │       ├── toast-provider.tsx
│   │       └── error-boundary.tsx
│   ├── lib/                       # Core business logic
│   │   ├── supabase/
│   │   │   ├── client.ts          # Browser client
│   │   │   ├── server.ts          # Server client (RSC + API routes)
│   │   │   ├── admin.ts           # Service role client (migrations, admin)
│   │   │   ├── middleware.ts      # Auth middleware helper
│   │   │   └── types.ts           # Generated DB types
│   │   ├── screening/
│   │   │   ├── sanctions.ts       # OFAC, EU, UN, UK HMT screening
│   │   │   ├── pep.ts             # OpenSanctions PEP check
│   │   │   ├── adverse-media.ts   # GDELT + NewsAPI screening
│   │   │   ├── registry.ts        # Companies House verification
│   │   │   └── orchestrator.ts    # Screening pipeline coordinator
│   │   ├── ai/
│   │   │   ├── provider.ts        # LLM provider abstraction (Ollama/OpenRouter)
│   │   │   ├── prompts.ts         # System prompts for analysis
│   │   │   ├── risk-scoring.ts    # AI-assisted risk calculation
│   │   │   └── report-generation.ts
│   │   ├── auth/
│   │   │   ├── rbac.ts            # Role-based access control
│   │   │   ├── permissions.ts     # Permission definitions
│   │   │   └── session.ts         # Session management utilities
│   │   ├── validation/
│   │   │   ├── schemas.ts         # Zod schemas for all entities
│   │   │   └── sanitize.ts        # Input sanitization utilities
│   │   ├── api/
│   │   │   ├── rate-limit.ts      # Rate limiting middleware
│   │   │   ├── error-handler.ts   # Consistent API error responses
│   │   │   └── response.ts        # Typed response helpers
│   │   └── utils/
│   │       ├── constants.ts
│   │       ├── formatting.ts      # Date, number, currency formatters
│   │       └── cn.ts              # Tailwind class merge utility
│   ├── hooks/                     # Custom React hooks
│   │   ├── use-investigation.ts
│   │   ├── use-screening.ts
│   │   ├── use-reduced-motion.ts
│   │   └── use-keyboard-shortcuts.ts
│   ├── stores/                    # Zustand stores
│   │   ├── investigation-store.ts
│   │   ├── ui-store.ts            # Drawer state, nav state, theme
│   │   └── notification-store.ts
│   ├── types/                     # Global TypeScript types
│   │   ├── database.ts            # Supabase generated types
│   │   ├── entities.ts
│   │   ├── screening.ts
│   │   └── api.ts
│   └── styles/
│       └── globals.css            # Tailwind base + design tokens as CSS vars
├── supabase/
│   ├── migrations/                # SQL migration files (sequential)
│   │   ├── 00001_initial_schema.sql
│   │   ├── 00002_rls_policies.sql
│   │   └── 00003_functions.sql
│   ├── seed.sql                   # Development seed data
│   └── config.toml                # Supabase local config
├── tests/
│   ├── unit/                      # Vitest unit tests
│   ├── integration/               # API integration tests
│   └── e2e/                       # Playwright end-to-end tests
├── public/
│   ├── fonts/                     # Self-hosted Inter + JetBrains Mono
│   └── icons/                     # App icons, favicons
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Lint + type-check + test on PR
│       └── deploy.yml             # Deploy to Vercel on merge to main
├── .env.example                   # Template for environment variables
├── .env.local                     # Local secrets (git-ignored)
├── .eslintrc.json
├── .prettierrc
├── commitlint.config.ts
├── components.json                # shadcn/ui config
├── middleware.ts                   # Next.js middleware (auth + CSP + rate limit)
├── next.config.ts
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vitest.config.ts
```

---

## Build Phases

### PHASE 1 — Project Scaffold + Tooling (Day 1)

**Goal:** Empty shell that builds, lints, type-checks, and deploys to Vercel with zero errors.

**Steps:**

```bash
# 1. Create Next.js project with TypeScript
npx create-next-app@latest thirdeye-ai --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm

# 2. Move into project
cd thirdeye-ai

# 3. Install core dependencies
pnpm add zustand @tanstack/react-table framer-motion recharts d3 cmdk react-hook-form @hookform/resolvers zod sonner date-fns

# 4. Install dev dependencies
pnpm add -D @types/d3 vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom playwright @playwright/test msw prettier prettier-plugin-tailwindcss husky lint-staged @commitlint/cli @commitlint/config-conventional

# 5. Initialize shadcn/ui
pnpm dlx shadcn@latest init

# 6. Add essential shadcn/ui components
pnpm dlx shadcn@latest add button input label card badge dialog dropdown-menu tooltip tabs accordion separator scroll-area sheet popover command avatar skeleton switch select textarea table

# 7. Install Supabase client
pnpm add @supabase/supabase-js @supabase/ssr

# 8. Setup Husky + lint-staged
pnpm dlx husky init
echo 'pnpm lint-staged' > .husky/pre-commit
echo 'npx --no -- commitlint --edit "$1"' > .husky/commit-msg

# 9. Initialize git
git init
git add -A
git commit -m "chore: initial project scaffold"
```

**Configuration files to create (Claude Code generates all of these):**

- `tsconfig.json` — strict mode, path aliases
- `.eslintrc.json` — strict rules, no-explicit-any, consistent-type-imports
- `.prettierrc` — single quotes, trailing commas, 100 print width
- `commitlint.config.ts` — conventional commits enforced
- `middleware.ts` — CSP headers, auth redirect, rate limit stub
- `next.config.ts` — security headers, image domains
- `.env.example` — all required env vars documented
- `vitest.config.ts` — jsdom environment, path aliases
- `tailwind.config.ts` — full ThirdEye design tokens from PRD Section 15.1

**Exit criteria:** `pnpm build` succeeds. `pnpm lint` passes. `pnpm typecheck` passes. Deploys to Vercel preview.

---

### PHASE 2 — Database Schema + Supabase Setup (Day 2)

**Goal:** Complete database schema with Row Level Security (RLS) policies, RBAC, and generated TypeScript types.

**Core Tables:**

```
organisations        — Multi-tenant root (id, name, settings, created_at)
users                — Extended profile (id FK auth.users, org_id, role, full_name)
investigations       — Due diligence cases (id, org_id, entity_id, status, risk_score, assigned_to)
entities             — Screened parties (id, org_id, name, type, jurisdiction, registration_number)
screening_results    — Individual check results (id, investigation_id, type, status, hits, raw_data)
screening_hits       — Individual hits from a screening (id, result_id, source, match_score, data)
documents            — Uploaded files (id, investigation_id, file_path, file_type, uploaded_by)
reports              — Generated reports (id, investigation_id, template, status, content)
timeline_events      — Investigation audit trail (id, investigation_id, event_type, data, created_by)
analyst_notes        — Human notes on investigations (id, investigation_id, content, author_id)
api_keys             — Org-scoped API keys (id, org_id, key_hash, permissions, last_used)
audit_log            — System-wide audit trail (id, org_id, user_id, action, resource, ip_address)
risk_scoring_rules   — Configurable risk weights per org (id, org_id, factor, weight)
ownership_links      — Entity relationship graph edges (id, parent_entity_id, child_entity_id, ownership_pct, link_type)
```

**Security (non-negotiable):**

- RLS enabled on every table
- All policies scope by `org_id` matching the user's org
- Service role key used ONLY server-side, never exposed to client
- API keys stored as bcrypt hashes, never plaintext
- Audit log is append-only (no UPDATE or DELETE policies)
- PII columns (names, addresses) encrypted at rest via Supabase default

**Migration files:** Sequential SQL files in `supabase/migrations/`.

**Exit criteria:** All tables created. RLS policies active. `supabase gen types typescript` produces clean types. Seed data loads.

---

### PHASE 3 — Authentication + RBAC (Day 3)

**Goal:** Complete auth flow with email/password, protected routes, role-based access, and session management.

**Roles:**
- `owner` — Full org access, billing, user management
- `admin` — All features except billing
- `analyst` — Run screenings, write reports, add notes
- `viewer` — Read-only access to investigations and reports

**Implementation:**
- Supabase Auth for identity (email + password initially, OAuth later)
- Custom `users` table extends `auth.users` with role + org_id
- Next.js middleware checks session on every request to `/(dashboard)` routes
- Server-side route guards via `getServerSession()` helper
- RBAC middleware on API routes checks role permissions before executing
- CSRF protection via Supabase's built-in token rotation
- Session timeout: 1 hour idle, 24 hours absolute

**Pages:** Login, Register (with org creation), Password Reset, Email Verification.

**Exit criteria:** Can register, login, logout. Unauthenticated users redirected to /login. Role checked on API routes. Session persists across page refreshes.

---

### PHASE 4 — UI Shell + Theming (Day 4-5)

**Goal:** The three-panel layout, navigation, command palette, dark/light mode, and all design tokens from PRD Section 15 fully implemented.

**Components to build:**
- Root layout with font loading (Inter + JetBrains Mono, self-hosted)
- Theme provider (dark mode default, system preference detection, manual toggle)
- CSS variables for all design tokens (colours, spacing, shadows, radii)
- Navigation rail (collapsed/expanded, active route indicator, frosted glass)
- Top bar (search trigger, notifications, user menu)
- Contextual drawer (slide-in panel with spring animation)
- Command palette (Cmd+K, entity search, page navigation, actions)
- Toast notification system (sonner library, styled to spec)
- Loading skeletons (shimmer animation matching content shapes)
- Empty state templates
- Bottom tab bar (mobile)
- Bottom sheet modal (mobile)

**Exit criteria:** Navigate between all routes. Three-panel layout renders on desktop. Mobile layout collapses correctly. Dark/light toggle works. Command palette opens with Cmd+K. All animations respect prefers-reduced-motion.

---

### PHASE 5 — Entity + Investigation CRUD (Day 6-8)

**Goal:** Create, read, update entities and investigations. Full investigation workspace with tabbed interface.

**Features:**
- Entity creation form with validation
- Investigation creation (links to entity, sets initial status)
- Investigation list view with sorting, filtering, pagination (TanStack Table)
- Investigation workspace with 6 tabs (Overview, Screening, Documents, Ownership, Timeline, Notes)
- File upload to Supabase Storage (documents tab)
- Analyst notes with rich text (basic formatting)
- Timeline event feed (auto-populated + manual entries)
- Status workflow (Active → Pending Review → Completed/Escalated)
- Assignment (assign investigation to analyst)

**Exit criteria:** Full CRUD on entities and investigations. File uploads work. Timeline populates. Notes save and display.

---

### PHASE 6 — Screening Engines (Day 9-13)

**Goal:** All four screening types operational, pulling from real free data sources.

**6A. Sanctions Screening (OFAC, EU, UN, UK HMT):**
- Download and parse OFAC SDN XML feed
- Download and parse EU consolidated sanctions CSV
- Download and parse UN Security Council sanctions XML
- Download and parse UK HMT sanctions list
- Fuzzy name matching (Levenshtein distance + phonetic matching via double-metaphone)
- Store parsed lists in PostgreSQL with pg_trgm index for fast fuzzy search
- Scheduled refresh (daily cron via Vercel Cron or Supabase pg_cron)

**6B. PEP Screening (OpenSanctions):**
- Integrate OpenSanctions bulk data API (free, updated daily)
- Filter for PEP-flagged entities
- Match against investigation entity by name + jurisdiction
- Return match confidence score

**6C. Adverse Media (GDELT + NewsAPI):**
- GDELT Project API for historical adverse media
- NewsAPI.org free tier (100 requests/day) for recent news
- Keyword-based search: entity name + negative terms (fraud, corruption, money laundering, sanctions, etc.)
- Basic sentiment classification (negative headline detection)
- Deduplicate results across sources

**6D. Registry Verification (UK Companies House):**
- Companies House free API (600 requests/5 min)
- Verify entity registration, active status, registered address
- Retrieve officer list (directors, secretaries)
- Retrieve PSC (Persons with Significant Control) for UBO identification
- Map PSC data to ownership_links table

**Screening Orchestrator:**
- Queues all 4 screening types for an entity
- Runs them in parallel where possible
- Streams progress updates to the UI (SSE or polling)
- Aggregates results into a unified risk score
- Creates timeline events for each completed check

**Exit criteria:** All 4 screening types return real results. Orchestrator coordinates them. Progress visible in UI. Results stored in DB.

---

### PHASE 7 — AI/LLM Integration (Day 14-16)

**Goal:** AI-powered risk analysis, report narrative generation, and entity resolution.

**Provider Abstraction:**
- Single interface: `generateCompletion(prompt, options)`
- Primary: Ollama (local, free, requires user to install Ollama)
- Fallback: OpenRouter API (cheap, requires API key)
- Auto-fallback: if Ollama unavailable, switch to OpenRouter with user notification
- Token tracking: log usage per request for cost monitoring

**AI Features:**
- Risk Analysis Summary: given screening results, generate a 2-3 paragraph analysis of key findings, risk factors, and recommended actions
- Report Narrative: given investigation data, generate section text for due diligence reports
- Entity Resolution: given multiple potential matches from screening, rank by likelihood of true match
- Adverse Media Classification: categorise news articles by risk relevance

**Security:**
- All prompts stored server-side, never exposed to client
- User input sanitised before inclusion in prompts (prevent prompt injection)
- AI outputs marked with confidence scores and "AI-generated" labels
- Human-in-the-loop: AI suggestions require analyst approval before inclusion in final reports

**Exit criteria:** AI analysis generates for completed screenings. Reports generate narrative text. Confidence scores display. Ollama and OpenRouter both work.

---

### PHASE 8 — Reports + PDF Generation (Day 17-18)

**Goal:** Generate, edit, preview, and export due diligence reports as PDF.

**Report Templates:**
- Standard Due Diligence Report
- Enhanced Due Diligence Report
- Sanctions Alert Report
- Periodic Review Report

**Features:**
- Template selection with section toggle (include/exclude sections)
- Split-view editor (editable content left, live PDF preview right)
- Auto-populated sections from investigation data + AI narrative
- Manual section editing (rich text)
- Table of Contents auto-generation
- PDF export via @react-pdf/renderer (runs server-side)
- DOCX export (using docx library, free)
- Report versioning (draft → final)
- Share link generation (read-only access)

**Exit criteria:** Reports generate from template. PDF downloads work. Split preview renders. Manual edits persist.

---

### PHASE 9 — Dashboard + Analytics (Day 19-20)

**Goal:** Dashboard with real metrics, charts, and alert feed.

**Widgets:**
- Metrics strip (4 KPI cards with sparklines)
- Recent investigations table
- Alerts requiring attention feed
- Screening activity area chart (30 days)
- Risk distribution breakdown

**Data queries:** All dashboard data via Supabase RPCs (PostgreSQL functions) for performance. No client-side aggregation of large datasets.

**Exit criteria:** Dashboard loads with real data. Charts render. Metrics update in real-time on data changes.

---

### PHASE 10 — Ownership Graph Visualisation (Day 21-22)

**Goal:** Interactive D3.js force-directed graph for UBO structures.

**Features:**
- Force-directed layout with configurable physics
- Node types: Company, Person, Trust (different shapes per PRD)
- Edge types: Ownership, Control, Nominee (different line styles)
- Click-to-select highlights connected subgraph
- Drag-to-reposition, scroll-to-zoom
- Mobile: tree layout fallback
- "View as table" accessible alternative
- PNG/SVG export

**Exit criteria:** Graph renders from ownership_links data. Interactions work. Mobile fallback renders. Accessible table alternative available.

---

### PHASE 11 — Testing + Security Hardening (Day 23-25)

**Goal:** Comprehensive test coverage and security audit.

**Testing:**
- Unit tests (Vitest): all lib/ functions, Zod schemas, utility functions
- Integration tests: API routes with mocked Supabase
- E2E tests (Playwright): critical user flows (login, create investigation, run screening, generate report)
- MSW for mocking external APIs in tests

**Security Hardening:**
- Penetration testing checklist (OWASP Top 10)
- CSP headers tightened (report-only first, then enforced)
- Rate limiting on all API routes (sliding window, per-user)
- Input validation on every API endpoint (Zod + sanitisation)
- SQL injection prevention (parameterised queries only via Supabase client)
- XSS prevention (React's default escaping + DOMPurify for any raw HTML)
- Dependency audit (pnpm audit)
- Environment variable validation at startup (fail fast if missing)
- Error messages: never leak stack traces or internal details to client
- Logging: structured JSON logs, no PII in logs

**Exit criteria:** 80%+ unit test coverage on lib/. All critical E2E flows pass. Zero high/critical vulnerabilities in dependency audit. CSP enforced without breaks.

---

### PHASE 12 — Deployment + Monitoring (Day 26-27)

**Goal:** Production deployment on Vercel with monitoring.

**Deployment:**
- Vercel project connected to GitHub repo
- Preview deployments on PRs
- Production deploy on merge to main
- Environment variables configured in Vercel dashboard

**Monitoring:**
- Grafana Cloud free tier for dashboards
- Vercel Analytics for Web Vitals
- Error tracking via Vercel's built-in error reporting
- Uptime monitoring via Uptime Kuma (self-hosted on Oracle Cloud free tier, or use a free external service initially)

**Exit criteria:** Production URL live. CI/CD pipeline green. Monitoring dashboards show data. Alert on downtime configured.

---

## Security Architecture Summary

| Layer | Protection |
|---|---|
| Network | HTTPS everywhere, CSP headers, HSTS |
| Authentication | Supabase Auth, bcrypt passwords, session rotation |
| Authorisation | RBAC middleware, RLS policies per org_id |
| Input | Zod validation + DOMPurify sanitisation on every endpoint |
| Database | RLS, parameterised queries, no raw SQL from client |
| API | Rate limiting (sliding window), CSRF tokens, API key auth |
| Secrets | .env.local git-ignored, Vercel env vars, no hardcoded secrets |
| Dependencies | pnpm audit in CI, Dependabot alerts, lockfile committed |
| Logging | Structured JSON, no PII, audit trail append-only |
| AI | Server-side prompts, input sanitisation, output labelling |
| Client | React XSS defaults, no dangerouslySetInnerHTML, CSP script-src |

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=           # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=      # Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY=          # Server-only, never expose to client

# AI/LLM
OLLAMA_BASE_URL=http://localhost:11434
OPENROUTER_API_KEY=                 # OpenRouter fallback

# External Data Sources
COMPANIES_HOUSE_API_KEY=            # UK Companies House (free)
NEWSAPI_API_KEY=                    # NewsAPI.org (free tier)

# Application
NEXTAUTH_SECRET=                    # Random 32+ char secret
NEXT_PUBLIC_APP_URL=                # http://localhost:3000 or production URL

# Optional (Phase 12)
GRAFANA_CLOUD_API_KEY=
RESEND_API_KEY=                     # Transactional email
UPSTASH_REDIS_URL=                  # Rate limiting + task queue
UPSTASH_REDIS_TOKEN=
```

---

## Commands Reference

```bash
pnpm dev              # Start dev server (localhost:3000)
pnpm build            # Production build
pnpm lint             # ESLint check
pnpm typecheck        # TypeScript strict check (tsc --noEmit)
pnpm test             # Run Vitest unit tests
pnpm test:e2e         # Run Playwright E2E tests
pnpm format           # Prettier format all files
pnpm db:generate      # Generate Supabase TypeScript types
pnpm db:migrate       # Run pending Supabase migrations
pnpm db:seed          # Load development seed data
```

---

## How to Use This Guide with Claude Code

Each phase is designed so you can hand it to Claude Code as a prompt. Example workflow:

1. Open VS Code with the thirdeye-ai project
2. Open Claude Code terminal
3. Say: "Build Phase 1 of the ThirdEye AI project. Follow the BUILD_GUIDE.md in the docs folder. Create all files for the project scaffold, install dependencies, and configure tooling."
4. Claude Code generates all files, runs commands, and verifies exit criteria
5. Review, commit, and move to the next phase

For each phase, Claude Code should:
- Read this BUILD_GUIDE.md for structure and requirements
- Read the PRD (in your Claude Docs) for detailed specifications
- Generate all code for that phase
- Run the exit criteria checks
- Report any issues

---

## Architecture Decision Records

Track key decisions in `docs/adr/` as numbered markdown files:

- `001-nextjs-app-router.md` — Why App Router over Pages Router
- `002-supabase-over-firebase.md` — Free tier comparison, PostgreSQL need
- `003-ollama-primary-llm.md` — Local-first for cost and data privacy
- `004-rls-over-application-auth.md` — Database-level security vs app-level
- `005-shadcn-over-mui.md` — Customisability and bundle size

---

## Definition of Done (Per Phase)

- [ ] All code compiles with zero TypeScript errors
- [ ] ESLint passes with zero warnings
- [ ] All new functions have JSDoc comments
- [ ] All API endpoints validated with Zod
- [ ] All database queries use parameterised inputs
- [ ] Unit tests written for new lib/ code
- [ ] Mobile responsive check on 375px width
- [ ] Dark mode verified
- [ ] Accessibility: keyboard navigation works, no ARIA warnings
- [ ] Git commit with conventional commit message
