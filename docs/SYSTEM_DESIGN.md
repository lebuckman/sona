# Sona — System Design Document

**Version:** 1.1  
**Status:** Active  
**Last Updated:** April 2026  
**Companion:** [PRD.md](./PRD.md)  
**Changelog:** Added Last.fm integration; removed audio features (deprecated); updated Spotify field changes from Feb 2026; updated cache key reference; added genre breakdown data flow

---

## 1. Architecture Overview

Sona is a server-centric Next.js 16 application. The core principle is that **all sensitive operations happen on the server** — Spotify tokens, the Anthropic API key, the Last.fm API key, and token refresh logic never touch the client. The browser only ever sees data that has already been fetched, transformed, and returned by a Next.js API route.

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Client)                       │
│  Next.js Pages · TanStack Query · Recharts · Shadcn UI      │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS (internal API routes)
┌────────────────────────▼────────────────────────────────────┐
│                  Next.js 16 — Vercel Edge                   │
│                                                             │
│  App Router (RSC + Client Components)                       │
│  ├── /api/auth/*        OAuth flow & session mgmt           │
│  ├── /api/spotify/*     Spotify data proxy                  │
│  ├── /api/lastfm/*      Last.fm genre data                  │
│  └── /api/ai/*          AI generation & chat                │
└──────┬──────────────────┬──────────────────┬───────────────┘
       │                  │                  │
┌──────▼──────┐  ┌────────▼──────┐  ┌───────▼──────────────┐
│ Spotify     │  │  Last.fm      │  │  Anthropic           │
│ Web API     │  │  Web API      │  │  Claude Haiku 4.5    │
│ (OAuth 2.0) │  │  (API key)    │  │  (server-side only)  │
└─────────────┘  └───────────────┘  └──────────────────────┘
       │
┌──────▼──────────────────────────┐
│  Neon Postgres (Serverless)     │
│  Drizzle ORM + Migrations       │
│  ├── users                      │
│  ├── tokens (encrypted)         │
│  ├── spotify_cache              │
│  └── ai_cache                   │
└─────────────────────────────────┘
```

---

## 2. Route & Page Structure

### Public Routes (unauthenticated)

| Route                | Type       | Description                                    |
| -------------------- | ---------- | ---------------------------------------------- |
| `/`                  | Page (RSC) | Landing page — hero input, features, FAQ       |
| `/api/auth/login`    | API Route  | Initiates Spotify OAuth redirect               |
| `/api/auth/callback` | API Route  | Handles OAuth code exchange                    |
| `/api/ai/chat`       | API Route  | Guest AI responses (general, no personal data) |

### Protected Routes (require session)

| Route                         | Type       | Description                           |
| ----------------------------- | ---------- | ------------------------------------- |
| `/profile`                    | Page (RSC) | Music identity portfolio              |
| `/chat`                       | Page (RSC) | Ask Sona — full chat interface        |
| `/api/auth/logout`            | API Route  | Clears session and tokens             |
| `/api/spotify/top-tracks`     | API Route  | Top tracks (time range param)         |
| `/api/spotify/top-artists`    | API Route  | Top artists (time range param)        |
| `/api/spotify/playlists`      | API Route  | User's playlists                      |
| `/api/lastfm/genre-breakdown` | API Route  | Weighted genre tags via Last.fm       |
| `/api/ai/insights`            | API Route  | Daily AI insight (streamed)           |
| `/api/ai/profile`             | API Route  | Music personality profile (streamed)  |
| `/api/ai/chat`                | API Route  | Agentic chat with tool use (streamed) |

**Note:** `/api/spotify/audio-features` was removed. Spotify deprecated this endpoint for new apps in November 2024, returning 403 for all requests. Genre signals are now derived from Last.fm.

---

## 3. Authentication Flow — Spotify OAuth 2.0

```
User                 Sona Server             Spotify
 │                       │                      │
 │  Click "Connect"       │                      │
 ├──────────────────────▶│                      │
 │                       │  Generate random      │
 │                       │  state value, store   │
 │                       │  in iron-session      │
 │  302 → Spotify login  │                      │
 │◀──────────────────────┤                      │
 │  Authorize Sona       │                      │
 ├───────────────────────────────────────────▶  │
 │  302 → /api/auth/callback?code=X&state=Y     │
 ├──────────────────────▶│                      │
 │                       │  Validate state ✓    │
 │                       │  POST /api/token     │
 │                       ├─────────────────────▶│
 │                       │  access + refresh    │
 │                       │◀─────────────────────┤
 │                       │  Upsert user in DB   │
 │                       │  AES-256-GCM encrypt │
 │                       │  Store tokens in DB  │
 │                       │  Set iron-session    │
 │  302 → /profile       │                      │
 │◀──────────────────────┤                      │
```

**Security decisions:**

- `state` parameter is cryptographically random, stored in session, verified on callback — prevents CSRF
- Tokens encrypted with AES-256-GCM before DB storage — nonce + auth tag + ciphertext pattern prevents both unauthorized reads and tampering
- `iron-session` cookie is `httpOnly` (XSS protection), `secure` in production (HTTPS only), `sameSite: lax` (CSRF protection)
- Spotify scopes are minimal — only what the product needs

### Token Refresh

Every Spotify API route calls `withValidToken(userId)` before executing:

1. Reads token record from DB and decrypts it
2. Checks if `expires_at` is within 5 minutes
3. If expiring: calls Spotify's refresh endpoint, updates DB with new tokens
4. Returns valid access token

Token refresh is transparent to the client — handled entirely server-side.

---

## 4. Database Schema

### `users`

```sql
id              uuid          PRIMARY KEY DEFAULT gen_random_uuid()
spotify_id      varchar(255)  NOT NULL UNIQUE
display_name    varchar(255)
email           varchar(255)
avatar_url      text
country         varchar(10)
spotify_product varchar(50)
created_at      timestamp     NOT NULL DEFAULT now()
updated_at      timestamp     NOT NULL DEFAULT now()
```

### `tokens`

```sql
id              uuid          PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid          NOT NULL REFERENCES users(id) ON DELETE CASCADE
access_token    text          NOT NULL  -- AES-256-GCM encrypted
refresh_token   text          NOT NULL  -- AES-256-GCM encrypted
expires_at      timestamp     NOT NULL
scope           text
updated_at      timestamp     NOT NULL DEFAULT now()
UNIQUE (user_id)
```

### `spotify_cache`

```sql
id              uuid          PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid          NOT NULL REFERENCES users(id) ON DELETE CASCADE
cache_key       varchar(200)  NOT NULL
data            jsonb         NOT NULL
cached_at       timestamp     NOT NULL DEFAULT now()
expires_at      timestamp     NOT NULL
UNIQUE (user_id, cache_key)
INDEX (user_id, cache_key, expires_at)
```

### `ai_cache`

```sql
id                uuid          PRIMARY KEY DEFAULT gen_random_uuid()
user_id           uuid          NOT NULL REFERENCES users(id) ON DELETE CASCADE
cache_type        varchar(100)  NOT NULL
content           text          NOT NULL
model             varchar(100)
input_tokens      integer
output_tokens     integer
generated_at      timestamp     NOT NULL DEFAULT now()
expires_at        timestamp     NOT NULL
UNIQUE (user_id, cache_type)
```

### Cache TTL Reference

| Cache Key                  | TTL        | Source  | Rationale                  |
| -------------------------- | ---------- | ------- | -------------------------- |
| `top_tracks:{range}`       | 1 hour     | Spotify | Changes slowly             |
| `top_artists:{range}`      | 1 hour     | Spotify | Changes slowly             |
| `playlists`                | 30 minutes | Spotify | Changes occasionally       |
| `genre_breakdown`          | 7 days     | Last.fm | Genre tags are very stable |
| `daily_insight` (ai_cache) | 24 hours   | Claude  | Regenerates daily          |
| `profile` (ai_cache)       | 7 days     | Claude  | User can force regenerate  |

**Intentionally absent:** `recently_played` (Spotify shows this natively), `audio_features` (deprecated by Spotify Nov 2024).

---

## 5. Data Flow — Spotify + Last.fm

### Spotify Routes (top tracks, top artists, playlists)

```
Client (TanStack Query hook)
    │
    │ GET /api/spotify/top-tracks?range=short_term
    ▼
Next.js API Route
    │
    ├─ Read iron-session → user_id
    ├─ Query spotify_cache WHERE user_id = ? AND cache_key = ?
    │         AND expires_at > now()
    │
    ├─ CACHE HIT ──────────────────▶ Return cached data
    │
    └─ CACHE MISS
          │
          ├─ withValidToken(user_id) → valid access_token
          ├─ Fetch from Spotify API
          ├─ Transform (select only fields Sona needs)
          ├─ Upsert into spotify_cache with TTL
          └─ Return transformed data
```

### Genre Breakdown Route

```
GET /api/lastfm/genre-breakdown
    │
    ├─ Check spotify_cache for 'genre_breakdown' (7-day TTL)
    ├─ CACHE HIT ──────────────────▶ Return immediately
    │
    └─ CACHE MISS
          │
          ├─ Read top_artists:short_term from spotify_cache
          │   (no Spotify API call — reads existing cache)
          │   If not cached → return [] and let client retry
          │
          ├─ For each of top 20 artist names:
          │   → GET ws.audioscrobbler.com/2.0/?method=artist.gettoptags
          │   → 100ms delay between requests (respectful API usage)
          │
          ├─ Filter tags (blocklist + count threshold + artist name exclusion)
          ├─ Normalize tag spelling variants
          ├─ Weight: artist rank × within-artist normalized tag score
          ├─ Aggregate → top 8 weighted genre entries
          │
          ├─ Upsert into spotify_cache with 7-day TTL
          └─ Return genre breakdown

SYSTEM DESIGN NOTE: This route has an implicit dependency on
top_artists:short_term being cached. In the UI, top artists are
always fetched before genre breakdown, so this is always satisfied
in practice. The graceful empty return handles the edge case.
```

**Why Last.fm for genres?**
Spotify deprecated `genres` on artist objects and the `/audio-features` endpoint for new apps in late 2024 and Feb 2026 respectively. Last.fm's `artist.getTopTags` is a stable, free alternative with rich crowd-sourced genre data. We pass raw tags to Claude for interpretation rather than over-engineering our own filtering — Claude is better at understanding that "k-pop" and "korean" are related than any hand-crafted rule system.

---

## 6. Data Flow — AI Generation

### Insight Generation (`/api/ai/insights`)

```
Client requests /api/ai/insights
    │
    ├─ Check ai_cache for today's insight (24hr TTL)
    ├─ CACHE HIT ──────────────────▶ Stream cached content
    │
    └─ CACHE MISS
          │
          ├─ Build SonaUserContext from spotify_cache:
          │   - top_tracks:short_term (names + artists)
          │   - top_artists:short_term (names)
          │   - top_artists:long_term (names, for "all time" context)
          │   - genre_breakdown (weighted tag list from Last.fm)
          │
          ├─ Construct prompt with user context
          ├─ Stream response from Claude Haiku 4.5
          ├─ On complete: store in ai_cache (expires next midnight)
          └─ Stream tokens to client
```

### Chat (`/api/ai/chat`) — Agentic Tool Use

```
Client sends { message: string, history: Message[] }
    │
    ├─ Build system prompt with behavior instructions
    │
    ├─ Define available tools:
    │   - get_top_tracks(timeRange)
    │   - get_top_artists(timeRange)
    │   - get_genre_breakdown()
    │   - get_playlist_moods()
    │
    ├─ Send to Claude with tools defined
    │
    ├─ Claude decides which tools to call based on the question
    │   (this is the agentic pattern — Claude plans before responding)
    │
    ├─ Server executes tool calls → reads from spotify_cache
    │   (no live Spotify API calls during chat — uses cached data)
    │
    ├─ Claude receives tool results → generates response
    └─ Stream response to client

SYSTEM DESIGN NOTE: Tool use is the key architectural difference
between a basic chatbot and an agent. Claude autonomously decides
what data it needs rather than receiving a pre-built context dump.
This is more efficient (less unnecessary data transfer) and more
capable (Claude can reason about what to look up).
```

---

## 7. Spotify API Scopes

| Scope                         | Why needed                    |
| ----------------------------- | ----------------------------- |
| `user-top-read`               | Top artists and tracks        |
| `playlist-read-private`       | User's private playlists      |
| `playlist-read-collaborative` | Collaborative playlists       |
| `user-read-email`             | Email for user record         |
| `user-read-private`           | Country, Spotify product type |

**Not requested (intentional):**

- `playlist-modify-*` — No write operations to Spotify in v1
- `user-library-*` — Liked songs not needed for v1
- `streaming` — No playback

**Note:** Sona is currently in Spotify's Development Mode. Apps in this mode are limited to 25 users who must be manually added to the allowlist in the Spotify Developer Dashboard. Extended Quota Mode requires 250k MAU and a formal application — this is a post-v1 goal.

---

## 8. AI Prompt Strategy

### SonaUserContext Type

```typescript
type SonaUserContext = {
  displayName: string;
  topTracks: { name: string; artist: string }[]; // top 10, short term
  topArtists: { name: string }[]; // top 10, short term
  topArtistsAllTime: { name: string }[]; // top 5, long term
  genreBreakdown: { genre: string; weight: number }[]; // from Last.fm, top 8
};
```

**Note:** `audioFeatureAverages` (energy, danceability, valence, etc.) was removed from the context because Spotify's audio features endpoint is deprecated for new apps. Genre tags from Last.fm serve as the primary mood/character signal for the AI layer.

### System Prompt Principles

- Sona speaks in the **second person** ("You gravitate toward..." not "The user listens to...")
- Observations are **specific and grounded** in actual data — no generic platitudes
- Tone is **calm, perceptive, slightly poetic** — not clinical or chatbot-like
- Claude interprets raw genre tags intelligently — "k-pop", "korean", "thai" are understood as a cohesive regional listening identity, not unrelated labels
- Responses are **concise** — insights are 2–4 sentences, not essays

### Cost Control

- **Prompt caching:** System prompt + user context is cached across chat turns (90% discount on cache hits)
- **Model selection:** Claude Haiku 4.5 for all features — fast, cheap, sufficient capability
- **AI cache:** Insights and profile are cached 24h/7d — expensive generation only happens once per period

---

## 9. Project File Structure

```
sona/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   └── page.tsx                  # Landing page
│   │   ├── (protected)/
│   │   │   ├── layout.tsx                # Auth guard
│   │   │   ├── profile/page.tsx          # Portfolio page
│   │   │   └── chat/page.tsx             # Ask Sona page
│   │   └── api/
│   │       ├── auth/{login,callback,logout}/route.ts
│   │       ├── spotify/{top-tracks,top-artists,playlists}/route.ts
│   │       ├── lastfm/genre-breakdown/route.ts
│   │       └── ai/{insights,profile,chat}/route.ts
│   │
│   ├── components/
│   │   ├── ui/                           # Shadcn components
│   │   ├── layout/                       # Nav components
│   │   ├── sona/                         # AI insight components
│   │   └── charts/                       # Data visualizations
│   │
│   ├── hooks/                            # TanStack Query hooks
│   │   ├── use-top-tracks.ts
│   │   ├── use-top-artists.ts
│   │   ├── use-playlists.ts
│   │   └── use-genre-breakdown.ts
│   │
│   ├── lib/
│   │   ├── spotify/
│   │   │   ├── client.ts                 # Spotify API fetch wrapper
│   │   │   ├── auth.ts                   # OAuth helpers
│   │   │   ├── token.ts                  # withValidToken()
│   │   │   └── cache.ts                  # Cache-aside utilities
│   │   ├── lastfm/
│   │   │   ├── client.ts                 # Last.fm fetch wrapper
│   │   │   └── genres.ts                 # Tag filtering + weighting
│   │   ├── ai/
│   │   │   ├── client.ts                 # Anthropic client
│   │   │   ├── context.ts                # SonaUserContext builder
│   │   │   └── prompts.ts                # Prompt templates
│   │   ├── db/{index.ts,schema.ts}
│   │   ├── crypto.ts                     # AES-256-GCM encrypt/decrypt
│   │   ├── session.ts                    # iron-session config + getSession()
│   │   └── utils.ts
│   │
│   └── types/index.ts                    # Shared types including LastFmTag
│
├── drizzle/                              # Migration files
├── docs/
│   ├── PRD.md
│   └── SYSTEM_DESIGN.md
├── .github/workflows/ci.yml
├── .env.example
└── README.md
```

---

## 10. Environment Variables

```bash
# Spotify OAuth
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=

# Session & token encryption
SESSION_SECRET=           # min 32 chars, generate with crypto.randomBytes(32)
TOKEN_ENCRYPTION_KEY=     # separate from session secret

# Database
DATABASE_URL=             # Neon connection string

# AI
ANTHROPIC_API_KEY=

# Genre data
LASTFM_API_KEY=           # Free key from last.fm/api/account/create

# Rate limiting (guest users)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# App
NEXT_PUBLIC_APP_URL=
```

---

## 11. Open Questions (Technical)

- [ ] **Streaming approach:** Vercel AI SDK (`streamText`) vs raw Anthropic streaming API for chat responses. Vercel AI SDK is easier; raw API gives more control.
- [ ] **Chat history persistence (v2):** When implemented, will need `chat_sessions` and `chat_messages` tables. Design schema now even if not implemented in v1.
- [ ] **Prompt caching eligibility:** Anthropic prompt caching requires cacheable prefix ≥ 1024 tokens. Verify SonaUserContext consistently meets this threshold.
- [ ] **Last.fm rate limits:** Last.fm asks developers to be reasonable with request frequency. Current implementation uses 100ms delay between artist tag lookups with a 20-artist cap. Monitor for any rate limit responses in production.
- [ ] **Spotify quota extension timing:** Extended Quota Mode requires 250k MAU. Apply after v1.0 launch once there's a live product to demonstrate.
