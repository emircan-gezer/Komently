# Komently – Improvements Overview

> Generated: 2026-04-01. Documents what was implemented and what remains for a future pass.

---

## ✅ Completed in This Pass

### 1. SDK – Parallel Auth + Comment Fetching
**File:** `sdk/komently-sdk/src/components/CommentSection.tsx`
- Auth (`/api/commenters/me`) and initial comments are now fetched with **`Promise.allSettled`** — a single parallel request pair rather than sequential calls, saving one full RTT on every page load.
- A unified `apiPost()` helper is shared by all sub-components (vote, post, reply, profile update) — eliminates duplicate header-building logic across the component tree.
- Added **Ctrl+Enter** keyboard shortcut to all textareas.

### 2. SDK CSS – Aligned with Website Theme
**File:** `sdk/komently-sdk/src/styles/komently.css`
- Design tokens now mirror `globals.css` exactly: `oklch(0.20 0 0)` dark background, `oklch(0.65 0.20 255)` primary, `1rem` base radius in dark mode.
- Font stack updated to prefer `DM Sans` (matching `--font-dm-sans`) then system-ui.
- Mono font used on timestamps and pagination for Swiss density.
- Animation for body reveal (`fade-in + slide-down`).

### 3. Dashboard – Auth Guard + Redesigned UI
**File:** `website/next-app/app/dashboard/page.tsx`
- **Auth guard**: checks Supabase session on mount; redirects immediately to `/login?next=/dashboard` if unauthenticated — no flash of content.
- `401` response from API also triggers redirect.
- **Sign-out** button in header.
- **StatCard** components with Lucide icons for each metric.
- **Filter tabs** (All / Active / Paused) on the sections table.
- **Reaction count** column added.
- Per-row hover reveals **Manage** button and **API link** button.
- Shows user email in the header sub-line.

### 4. Security – Zod v4 Validation on All User Inputs
All API routes that accept user input now use Zod schemas before any business logic:

| Route | Schema |
|---|---|
| `POST /api/sections` | name (1-80 chars), publicId (slug format) |
| `PATCH /api/sections/[id]` | name, status enum, typed settings object with ranges, `.strict()` to block unknown keys |
| `POST /api/comments/[id]/post` | body (1-10 000 chars), optional parentId (UUID) |
| `POST /api/comments/vote` | commentId (UUID), value (literal 1 \| -1) |
| `POST /api/commenters/register` | username (alphanum+_-, 2-32), optional color (hex) |
| `POST /api/commenters/me/update` | username (same rules) + uniqueness check excluding self |

### 5. Security – JWT Secret Guard
**File:** `website/next-app/lib/commenter-auth.ts`
- In production, throws at module load time if `COMMENTER_JWT_SECRET` is unset — prevents silent use of hardcoded fallback.
- Accepts both `x-commenter-token` and `X-Commenter-Token` header names (proxy normalisation safety).

### 6. API Performance – Parallel DB Queries
**File:** `website/next-app/app/api/sections/route.ts`
- The 4 aggregate queries (comment counts, reaction counts, last active, recent) are now fired with **`Promise.all`** instead of sequentially — cuts GET wall-clock time by ~3x for users with many sections.

---

## 🔜 Deferred – Larger Scope (v2)

### API Design
| Issue | Recommendation |
|---|---|
| GET `/api/sections` fires 4 DB queries even in parallel | Consolidate into a Supabase RPC / materialised view for a true single round-trip |
| Comments route fetches all top-level IDs then re-sorts in JS | Add a `comment_score` computed column + DB-side ORDER BY |
| `comment_vote_counts` still a separate join | Embed directly in main comment SELECT |
| No HTTP caching headers on public GET routes | Add `Cache-Control: s-maxage=10, stale-while-revalidate=60` |

### SDK Architecture
| Issue | Recommendation |
|---|---|
| `CommentSection.tsx` still makes direct `fetch` calls (not through `KomentlyClient` cache) | Expose optional `client` prop; route internal fetches through it |
| Guest token adds a second round-trip | Pre-fetch guest token at SDK init rather than on demand |

### UI/UX
| Issue | Recommendation |
|---|---|
| No toast on dashboard save success | Add Sonner or a lightweight custom toast |
| No dirty-state indicator on section detail save | Track which fields changed; show delta badge |
| Login page `next` param may not survive full OAuth flow | Audit the OAuth redirect chain end-to-end |
| SDK empty state copy | Expose `emptyStateText` prop for i18n |

### Infrastructure
| Issue | Recommendation |
|---|---|
| No rate-limiting on vote/post endpoints at HTTP layer | Add Redis or edge-function rate limiter |
| Dual `Authorization: Bearer` + `X-API-Key` headers | Pick one convention and document it |
