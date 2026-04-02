# Sona — Product Requirements Document

**Version:** 1.1
**Status:** Active  
**Last Updated:** April 2026  
**Author:** Liam Buckman  
**Changelog:**

- v1.1: Removed audio features (Spotify deprecated Nov 2024); added Last.fm genre integration; updated Spotify field changes from Feb 2026 API changelog; noted Spotify development mode 25-user limit

---

## 1. Overview

Sona is an AI-first music insights web application that connects to a user's Spotify account and transforms their listening data into meaningful, personalized intelligence. Where conventional music stat tools display raw numbers and charts, Sona adds an intelligent layer on top — surfacing mood patterns, generating music personality profiles, and enabling natural conversation with your own listening history through an LLM-powered interface.

Sona is designed to feel less like a dashboard and more like a companion that listens and responds. The AI is not a separate tab — it is the narrator of every section, the voice behind every insight, and the interface through which users can explore their own taste.

> _"Understand your music."_

---

## 2. Problem Statement

Spotify provides users with a single annual "Wrapped" summary, and third-party tools like stats.fm surface raw listening statistics on demand. Neither approach answers the questions users actually have about their own taste:

- _Why do I keep coming back to certain artists?_
- _What does my music say about my mood patterns?_
- _What do I actually sound like as a listener?_
- _Which of my playlists fits how I'm feeling right now?_

There is no tool that uses AI to make listening data feel personal, expressive, and conversational. Sona fills that gap.

---

## 3. Goals

### Primary Goals

- Deliver a polished, production-grade full-stack web application that solves a real user need and is publicly accessible
- Implement Spotify OAuth 2.0 (Authorization Code Flow) with secure, encrypted token management
- Surface key listening stats (top tracks, top artists, genre breakdown) in a clean, accessible portfolio-style layout where Sona's AI voice narrates each section
- Integrate an LLM (Claude Haiku 4.5) with an agentic tool-use architecture for the chat interface, enabling Claude to dynamically decide which user data to fetch based on the question
- Allow unauthenticated (guest) users to interact with Sona's AI on the landing page with general music knowledge — no sign-in required unless personal data or account actions are needed
- Deploy publicly on Vercel with a live URL

### Secondary Goals

- Demonstrate exemplary repository practices: conventional commits, CI/CD via GitHub Actions, typed schema, Zod validation, documented architecture in `docs/`
- Serve as a learning vehicle for: Spotify OAuth, relational database design, LLM API integration, agentic AI patterns, prompt engineering, rate limiting, and caching strategies
- Build a foundation extensible to future features (playlist generation, social listening, shareable public profiles)

---

## 4. Non-Goals (Explicit Scope Boundaries)

- **No music playback** — Sona surfaces insights about music, it does not play it
- **No recently played data** — omitted to reduce API surface and token cost; Spotify natively displays this for users
- **No audio features** — Spotify deprecated this endpoint for new apps in November 2024; genre signals are derived from Last.fm instead
- **No social features in v1** — friend comparisons, shared profiles, and listening rooms are post-v1
- **No Apple Music support** — Spotify-only for initial release
- **No mobile app** — web-only; responsive design supports mobile browsers
- **No AI-generated playlists pushed to Spotify in v1** — insight and suggestion only; write operations to Spotify are post-v1
- **No persistent chat history in v1** — conversation history is session-only, managed client-side

---

## 5. Target Users

**Primary:** Music-engaged individuals aged 18–30 who use Spotify regularly and are curious about their own listening habits. They want to understand their taste, not just see it.

**Guest users:** People who arrive from a link or search and want to try Sona without commitment — they can ask one-off music questions (genre recommendations, playlist ideas) without signing in.

**Secondary:** Developers and recruiters viewing the project as a portfolio piece. The application must be immediately understandable and impressive on first load.

> **Note:** Sona is currently in Spotify's Development Mode, which limits access to 25 users who must be manually allowlisted in the Spotify Developer Dashboard. A quota extension request will be submitted prior to public launch.

---

## 6. Feature Breakdown

### Sprint 1 — Foundation & Auth ✅

**Goal:** A working application where a Spotify user can log in, have their session and tokens persisted, and land on a placeholder profile page.

#### F-01 · Spotify OAuth 2.0 (Authorization Code Flow) ✅

- User clicks "Connect with Spotify" and is redirected to Spotify's authorization page
- Spotify redirects back to `/api/auth/callback` with an authorization code
- Server exchanges code for `access_token` and `refresh_token`
- Tokens are encrypted (AES-256-GCM) and stored in Neon Postgres — never in localStorage or client state
- Session established via `iron-session` (encrypted, server-side cookie)
- Token refresh handled automatically on expiry (transparent to the user)
- `state` parameter used to prevent CSRF attacks

#### F-02 · User Record Persistence ✅

- On first login, a user record is created in the `users` table
- On subsequent logins, the existing record is updated (upsert)
- Schema managed via Drizzle ORM with versioned migrations

#### F-03 · Protected Route Layout ✅

- All `/profile` and `/chat` routes require an active session
- Unauthenticated users are redirected to `/`
- Authenticated users visiting `/` are redirected to `/profile`

#### F-04 · Landing Page ✅ (placeholder — full design Sprint 4)

---

### Sprint 2 — Core Stats Data Layer ✅ (in progress)

**Goal:** Authenticated users have real Spotify data available via typed, cached API routes.

#### F-05 · Top Tracks ✅

- Fetch via `/me/top/tracks` for short, medium, and long term
- Cached in DB (1-hour TTL)
- Transformed to lean shape before caching

#### F-06 · Top Artists ✅

- Fetch via `/me/top/artists` for all time ranges
- `genres` and `popularity` fields removed — deprecated by Spotify Feb 2026
- Cached in DB (1-hour TTL)

#### F-07 · Genre Breakdown via Last.fm ✅

- Spotify's audio features and genre fields are deprecated for new apps
- Artist names from cached top artists are sent to Last.fm `artist.getTopTags`
- Tags are filtered (blocklist + count threshold + artist name exclusion) and weighted
- Within-artist normalization removes Last.fm popularity bias
- Claude interprets raw tags for the AI narrative — no over-engineering of filtering
- Cached in DB (7-day TTL)

#### F-08 · Playlists ✅

- Fetch via `/me/playlists`
- `tracks` field renamed to `items` in Spotify's Feb 2026 changelog — updated
- Cached in DB (30-minute TTL)

#### F-09 · Guest AI Interaction (Landing Page) — Sprint 3

- Landing page hero input functional for unauthenticated users
- General music intelligence responses (no personal Spotify data)
- Contextual sign-in prompt when personal data is needed

#### F-10 · Profile Page UI — in progress

- TanStack Query provider and hooks
- Portfolio layout with real data sections

---

### Sprint 3 — Sona AI Layer

**Goal:** Transform the stats portfolio into a genuinely intelligent experience.

#### F-11 · Sona Voice (Inline AI Narration)

- Each portfolio section opens with a short Sona-written observation
- Generated from real user data; cached per section per day
- Tone: second person, specific, grounded in data, never generic

#### F-12 · Sona Insights Card

- Featured AI-generated summary at top of profile page, streamed live
- Synthesizes top artists, genre breakdown, and listening patterns
- Cached per user per day (24-hour TTL)

#### F-13 · Sona Profile (Music Personality)

- Full AI-generated music personality profile
- Assigns a personality archetype
- Regeneratable once per 7 days; cached with 7-day TTL

#### F-14 · Sona Moods (Playlist Analysis)

- Classify playlists by mood using AI interpretation of names, track counts, and genre context
- Display as mood-tagged playlist cards

#### F-15 · Ask Sona — Agentic Chat Interface

- Dedicated `/chat` page with conversational interface
- Claude uses tool use to fetch only the data needed per question
- Available tools: `get_top_tracks`, `get_top_artists`, `get_genre_breakdown`, `get_playlist_moods`
- Floating shortcut button on profile page
- Guest version on landing page with general (non-personal) responses

---

### Sprint 4 — Polish, A11y & Deployment

#### F-16 · Guest Rate Limiting

- 10 AI requests per hour per IP via Upstash Redis at the Vercel Edge layer

#### F-17 · Responsive Design

- All views functional on mobile (≥ 375px), tablet (≥ 768px), and desktop

#### F-18 · Accessibility (A11y)

- Keyboard navigation, semantic HTML, ARIA labels, WCAG 2.1 AA contrast
- No motion for `prefers-reduced-motion`

#### F-19 · Loading, Error & Empty States

- Skeleton loading states for all data-fetching components
- User-friendly error messages with retry
- Graceful empty states for first-time users

#### F-20 · Vercel Deployment ✅

- Live at `https://sonamusic.vercel.app`
- Preview deployments on all PRs

#### F-21 · README & Documentation ✅

- README with tech stack, setup instructions, live demo link
- `docs/` folder with PRD and SYSTEM_DESIGN

---

## 7. Technical Architecture Summary

```
User Browser
    │
    ▼
Next.js 16 (App Router) — Vercel
    │
    ├── / (landing)             Public — guest AI interaction
    ├── /profile                Protected — portfolio layout, AI narration
    ├── /chat                   Protected — agentic Ask Sona interface
    ├── /api/auth/*             OAuth routes
    ├── /api/spotify/*          Spotify data proxy (cached)
    ├── /api/lastfm/*           Last.fm genre data (cached)
    └── /api/ai/*               AI generation + agentic chat
    │
    ├── Vercel Edge Middleware   Guest rate limiting (Upstash Redis)
    ├── Spotify Web API         OAuth 2.0 + top tracks/artists/playlists
    ├── Last.fm API             Artist genre tags (artist.getTopTags)
    ├── Anthropic API           Claude Haiku 4.5 with tool use
    └── Neon Postgres           Users, tokens, Spotify cache, AI cache
         └── Drizzle ORM        Type-safe queries + versioned migrations
```

---

## 8. Data Model

```
users
  id, spotify_id, display_name, email, avatar_url,
  country, spotify_product, created_at, updated_at

tokens
  id, user_id (FK), access_token (encrypted), refresh_token (encrypted),
  expires_at, scope, updated_at

spotify_cache
  id, user_id (FK), cache_key, data (jsonb), cached_at, expires_at
  UNIQUE (user_id, cache_key)

  Cache keys and TTLs:
  - top_tracks:{short|medium|long}_term  →  1 hour
  - top_artists:{short|medium|long}_term →  1 hour
  - playlists                            →  30 minutes
  - genre_breakdown                      →  7 days (Last.fm tags, very stable)

ai_cache
  id, user_id (FK), cache_type, content, model,
  input_tokens, output_tokens, generated_at, expires_at
  UNIQUE (user_id, cache_type)

  Cache types and TTLs:
  - daily_insight  →  24 hours
  - profile        →  7 days
```

**Note:** `recently_played` and `audio_features` are intentionally absent. Recently played is shown natively by Spotify. Audio features are deprecated for new apps as of November 2024.

---

## 9. Tech Stack

| Layer         | Technology                         | Version      |
| ------------- | ---------------------------------- | ------------ |
| Framework     | Next.js                            | 16.1         |
| Language      | TypeScript                         | 5.x (strict) |
| Styling       | Tailwind CSS                       | v4           |
| Components    | Shadcn UI                          | latest       |
| Data Fetching | TanStack Query                     | v5           |
| ORM           | Drizzle ORM                        | latest       |
| Database      | Neon Postgres                      | serverless   |
| Session       | iron-session                       | latest       |
| Validation    | Zod                                | latest       |
| AI            | Anthropic Claude Haiku 4.5         | latest       |
| Genre Data    | Last.fm API                        | v2           |
| Rate Limiting | Upstash Redis + @upstash/ratelimit | latest       |
| Deployment    | Vercel                             | —            |
| CI            | GitHub Actions                     | —            |

---

## 10. Success Metrics

**Product quality**

- All Sprint 1–3 features complete and functional with real Spotify data
- Guest AI interaction works without sign-in; rate limiting is enforced
- Application loads within acceptable performance budgets
- Zero TypeScript errors or console errors in production build
- WCAG 2.1 AA accessibility compliance on all primary views

**Engineering quality**

- CI pipeline is green on `main` with every commit
- Codebase demonstrates: OAuth 2.0, AES-256-GCM encryption, DB caching with multiple TTLs, agentic LLM integration, multi-API orchestration, TypeScript strict mode, and edge rate limiting
- Conventional commit history is clean and readable as a project narrative
- `docs/` folder contains up-to-date PRD and system design document

---

## 11. Sprint Timeline

| Sprint   | Focus                               | Status         |
| -------- | ----------------------------------- | -------------- |
| Sprint 1 | Foundation, Auth, DB schema         | ✅ Complete    |
| Sprint 2 | Core Stats + Data Layer             | 🔄 In Progress |
| Sprint 3 | Sona AI Layer                       | Upcoming       |
| Sprint 4 | Polish, A11y, Rate Limiting, Deploy | Upcoming       |

---

## 12. Post-v1 Roadmap

- **Shareable public profile** (`/u/username`) — public URL for your music identity
- **Playlist generation with Spotify import** — AI-generated playlists pushed to Spotify
- **Social listening rooms** — real-time WebSocket sessions with AI commentary
- **Persistent chat history** — store conversations across sessions
- **Apple Music support** — extend data pipeline beyond Spotify
- **Spotify quota extension** — apply for Extended Quota Mode to remove 25-user limit

---

## 13. Open Questions

- [ ] Should guest AI responses use a lighter model than authenticated responses?
- [ ] Should chat history be sent as part of the tool-use message array or maintained separately?
- [ ] Should the public profile page (post-v1) require explicit opt-in from the user?
- [ ] When should we apply for Spotify quota extension — before or after v1.0 launch?
