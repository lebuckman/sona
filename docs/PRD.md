# Sona — Product Requirements Document

**Version:** 1.0
**Status:** Active  
**Last Updated:** March 2026  
**Author:** Liam Buckman

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

**Persona — The Core User:**

> Maya is a 22-year-old college student who listens to Spotify for 3+ hours a day. She checks her Wrapped every year and always screenshots it. She's curious about what her music says about her and would love something that explains her taste rather than just listing numbers. She doesn't want to read a dashboard — she wants to _ask a question_ and get a real answer.

---

## 6. Feature Breakdown

### Sprint 1 — Foundation & Auth

**Goal:** A working application where a Spotify user can log in, have their session and tokens persisted, and land on a placeholder profile page.

#### F-01 · Spotify OAuth 2.0 (Authorization Code Flow)

- User clicks "Connect with Spotify" and is redirected to Spotify's authorization page
- Spotify redirects back to `/api/auth/callback` with an authorization code
- Server exchanges code for `access_token` and `refresh_token`
- Tokens are encrypted (AES-256) and stored in Neon Postgres — never in localStorage or client state
- Session established via `iron-session` (encrypted, server-side cookie)
- Token refresh handled automatically on expiry (transparent to the user)
- `state` parameter used to prevent CSRF attacks

**Acceptance criteria:** A user can log in, refresh the page, and remain authenticated. Tokens visible in DB are encrypted ciphertext. Logging out clears session and tokens.

#### F-02 · User Record Persistence

- On first login, a user record is created in the `users` table (Spotify ID, display name, email, avatar URL)
- On subsequent logins, the existing record is updated (upsert)
- Schema managed via Drizzle ORM with versioned migrations

#### F-03 · Protected Route Layout

- All `/profile` and `/chat` routes require an active session
- Unauthenticated users are redirected to `/`
- Authenticated users visiting `/` are redirected to `/profile`

#### F-04 · Landing Page

- Communicates Sona's value proposition clearly with a warm animated mesh gradient background
- Rotating headline demonstrating the product's scope
- **Hero input available to all users** — guest and authenticated alike (see F-09)
- Floating minimal nav (no background bar — link-style navigation)
- Two-column FAQ accordion section
- "Connect with Spotify" CTA visible but not forced

---

### Sprint 2 — Core Stats Dashboard

**Goal:** Authenticated users see a meaningful, AI-narrated portfolio layout populated with real Spotify data.

#### F-05 · Top Tracks

- Fetch top tracks via Spotify Web API (`/me/top/tracks`)
- Displayed as a ranked list within the "This Month" portfolio section
- Time range selector: Last 4 Weeks / Last 6 Months / All Time
- Data cached in database (TTL: 1 hour) to minimize redundant API calls

#### F-06 · Top Artists

- Fetch top artists via Spotify Web API (`/me/top/artists`)
- Displayed as an editorial grid in the "Defining Voices" section
- Same time range selector as top tracks
- Short-term and all-time artists both fetched and used in AI context

#### F-07 · Genre Breakdown

- Derived from top artists' genre arrays — aggregated, deduplicated, weighted by rank
- Displayed as animated horizontal bars within the Sound DNA section
- Top 5 genres surfaced; feeds into AI context

#### F-08 · Audio Features Analysis

- Fetch audio features for top tracks (`/audio-features`)
- Compute averages: energy, danceability, valence, acousticness, instrumentalness, tempo, loudness
- Displayed as a visual "sound fingerprint" in the Sound DNA section
- These values are the primary input to AI insight and profile generation

#### F-09 · Guest AI Interaction (Landing Page)

- The landing page hero input is functional for unauthenticated users
- Guest queries receive general music intelligence responses (no personal Spotify data)
- Example: _"Generate me a 1-hour playlist for late-night studying"_ → Claude returns a curated tracklist with reasoning
- If a guest asks something requiring personal data, Sona surfaces a contextual sign-in prompt (non-blocking)
- If a guest wants to act on a response (e.g., import a generated playlist), they are prompted to connect Spotify at that moment — not before
- Guest sessions are rate-limited to prevent token abuse (see F-16)

---

### Sprint 3 — Sona AI Layer

**Goal:** Transform the stats portfolio into a genuinely intelligent experience. The AI is the narrator of every section and the interface users reach for when they want to go deeper.

#### F-10 · Sona Voice (Inline AI Narration)

- Each portfolio section opens with a short Sona-written observation in italic serif typography
- Rendered as a styled `SonaVoice` component — not a card or callout, but prose woven into the layout
- Generated from the user's actual data; cached per section per day
- Tone: second person, specific, grounded in data values, never generic

**Example (Artists section):** _"The Weeknd appears across your short-term, 6-month, and all-time charts. That kind of consistency isn't habit — it's identity."_

#### F-11 · Sona Insights Card (Overview)

- A featured AI-generated summary at the top of the profile page, streamed live
- Synthesizes top genres, audio feature averages, and listening time patterns into a 2–4 sentence observation
- Cached per user per day (24-hour TTL); re-generates at midnight
- Streamed to the UI for a live typing effect

#### F-12 · Sona Profile (Music Personality)

- Full AI-generated music personality profile (3–5 paragraphs)
- Assigns a personality archetype (e.g., "The Restless Explorer")
- Structured around: genre identity, mood tendencies, listening behavior, defining artists
- Regeneratable by user once per 7 days
- Cached with 7-day TTL; overwritten on manual regeneration

#### F-13 · Sona Moods (Playlist Analysis)

- Fetch user's playlists and sample audio features from each
- Classify each playlist into a mood: Hype / Chill / Happy / Melancholy / Focus
- Display as mood-tagged playlist cards in the Playlists section
- AI generates a one-line description per playlist based on its audio fingerprint

#### F-14 · Ask Sona — Agentic Chat Interface

- Dedicated `/chat` page with a full conversational interface
- **Architecture: lightweight agentic tool use.** Rather than pre-loading all user data into context, Claude is given a set of tools it can call based on what the user asks:
  - `get_top_tracks(timeRange)` — fetches top tracks for a given range
  - `get_top_artists(timeRange)` — fetches top artists for a given range
  - `get_genre_breakdown()` — returns weighted genre list
  - `get_audio_features()` — returns audio feature averages
  - `get_playlist_moods()` — returns playlists with mood classifications
- Claude autonomously decides which tools to call to answer each question — this is the agentic pattern
- Conversation history maintained client-side for the session (not persisted in v1)
- AI responses streamed to the UI
- Also accessible via a floating shortcut button on the profile page
- Guest users can access a version of Ask Sona on the landing page with general (non-personal) responses

---

### Sprint 4 — Polish, A11y & Deployment

**Goal:** A publicly deployed, production-quality application ready for use.

#### F-15 · Responsive Design

- All views functional and visually coherent on mobile (≥ 375px), tablet (≥ 768px), and desktop
- Portfolio sections reflow gracefully; charts resize correctly
- Floating Ask Sona shortcut repositions on mobile

#### F-16 · Guest Rate Limiting

- Unauthenticated users are limited to 10 AI requests per hour per IP
- Implemented via Upstash Redis + `@upstash/ratelimit` at the Vercel Edge layer
- Requests over the limit receive a 429 response with a message prompting sign-in for unlimited access
- Authenticated users are not rate-limited in v1

#### F-17 · Accessibility (A11y)

- All interactive elements keyboard-navigable with visible focus indicators
- Semantic HTML throughout (correct heading hierarchy, landmark regions)
- All images and icons have descriptive `alt` or `aria-label`
- Color contrast meets WCAG 2.1 AA minimums
- No motion for users with `prefers-reduced-motion` enabled

#### F-18 · Loading, Error & Empty States

- Every data-fetching component has a skeleton loading state (Shadcn Skeleton)
- API errors surface a user-friendly message with retry option
- Empty states handled gracefully (first-time users with sparse data)

#### F-19 · Vercel Deployment

- Project deployed to Vercel with environment variables configured
- Preview deployments enabled for pull requests
- `SPOTIFY_REDIRECT_URI` updated for production domain

#### F-20 · README & Documentation

- README: project description, tech stack, architecture summary, setup instructions, live demo link, screenshots
- `docs/` folder contains PRD and SYSTEM_DESIGN
- `.env.example` checked in with all required variable names (no values)

---

## 7. Technical Architecture Summary

```
User Browser
    │
    ▼
Next.js 16 (App Router) — Vercel
    │
    ├── / (landing)             Public — guest AI interaction available
    ├── /profile                Protected — portfolio layout, AI narration
    ├── /chat                   Protected — agentic Ask Sona interface
    ├── /api/auth/*             OAuth routes (login, callback, logout)
    ├── /api/spotify/*          Spotify data proxy (server-side, cached)
    └── /api/ai/*               AI generation + agentic chat (server-side)
    │
    ├── Vercel Edge Middleware   Guest rate limiting (Upstash Redis)
    ├── Spotify Web API         OAuth 2.0 + data (server-side only)
    ├── Anthropic API           Claude Haiku 4.5 with tool use (server-side only)
    └── Neon Postgres           Users, encrypted tokens, Spotify cache, AI cache
         └── Drizzle ORM        Type-safe queries + versioned migrations
```

**Key architectural principles:**

- All Spotify API calls are server-side — the client never holds a Spotify access token
- Anthropic API key is server-side only — never exposed to the browser
- Spotify data is cached in Neon to reduce redundant API calls
- AI-generated content is cached to control cost (insights: 24h, profile: 7d)
- Chat context is built dynamically via tool use — Claude fetches only what it needs
- Guest interactions hit the same AI endpoints but without personal context; rate-limited at the edge

---

## 8. Data Model (High-Level)

```
users
  id                uuid, primary key
  spotify_id        varchar, unique
  display_name      varchar
  email             varchar
  avatar_url        varchar
  country           varchar
  spotify_product   varchar        ("premium", "free")
  created_at        timestamp
  updated_at        timestamp

tokens
  id                uuid, primary key
  user_id           uuid, FK → users (CASCADE DELETE)
  access_token      text (AES-256 encrypted)
  refresh_token     text (AES-256 encrypted)
  expires_at        timestamp
  scope             text
  updated_at        timestamp

spotify_cache
  id                uuid, primary key
  user_id           uuid, FK → users (CASCADE DELETE)
  cache_key         varchar        ("top_tracks:short_term", "audio_features", etc.)
  data              jsonb
  cached_at         timestamp
  expires_at        timestamp
  UNIQUE (user_id, cache_key)

ai_cache
  id                uuid, primary key
  user_id           uuid, FK → users (CASCADE DELETE)
  cache_type        varchar        ("daily_insight", "profile", "mood_analysis")
  content           text
  model             varchar
  input_tokens      integer
  output_tokens     integer
  generated_at      timestamp
  expires_at        timestamp
  UNIQUE (user_id, cache_type)
```

**Note:** `recently_played` is intentionally omitted. Spotify surfaces this natively; including it adds API surface and token cost without meaningfully improving the AI context.

---

## 9. Tech Stack

| Layer         | Technology                         | Version      |
| ------------- | ---------------------------------- | ------------ |
| Framework     | Next.js                            | 16.1         |
| Language      | TypeScript                         | 5.x (strict) |
| Styling       | Tailwind CSS                       | v4           |
| Components    | Shadcn UI                          | latest       |
| Data Fetching | TanStack Query                     | v5           |
| Charts        | Recharts                           | v2           |
| ORM           | Drizzle ORM                        | latest       |
| Database      | Neon Postgres                      | serverless   |
| Session       | iron-session                       | latest       |
| Validation    | Zod                                | latest       |
| AI            | Anthropic Claude Haiku 4.5         | latest       |
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
- Codebase demonstrates: OAuth 2.0, encrypted token storage, database caching, agentic LLM integration, TypeScript strict mode, and edge rate limiting
- Conventional commit history is clean and readable as a project narrative
- `docs/` folder contains up-to-date PRD and system design document
- `.env.example` is complete and accurate

---

## 11. Sprint Timeline

| Sprint   | Focus                                             | Target  |
| -------- | ------------------------------------------------- | ------- |
| Sprint 1 | Foundation, Auth, DB schema                       | Week 1  |
| Sprint 2 | Core Stats + Guest AI Interaction                 | Week 2  |
| Sprint 3 | Sona AI Layer (narration, insights, agentic chat) | Week 3  |
| Sprint 4 | Polish, A11y, Rate Limiting, Deploy               | Week 4+ |

---

## 12. Post-v1 Roadmap

Features intentionally deferred but worth building after initial launch:

- **Shareable public profile** (`/u/username`) — a public URL for your music identity page that anyone can view without signing in. A natural viral/social mechanic.
- **Playlist generation with Spotify import** — generate a playlist via AI, then push it directly to the user's Spotify account using the `playlist-modify-public` scope
- **Social listening rooms** — real-time WebSocket-based listening sessions with AI-enhanced activity (e.g., Sona commenting on what the group is hearing)
- **Persistent chat history** — store conversation history per user in the database across sessions
- **Apple Music support** — extend the data pipeline to support Apple Music's API alongside Spotify

---

## 13. Open Questions

- [ ] Should guest AI responses (landing page) use a lighter/faster model than authenticated responses to reduce cost? (e.g., guest → Haiku, authenticated → Sonnet)
- [ ] Should chat history be sent as part of the tool-use message array, or maintained separately from tool results?
- [ ] What is the Upstash Redis plan sufficient for expected guest traffic — is the free tier adequate?
- [ ] Should the public profile page (post-v1) require opt-in from the user, or be opt-out?
