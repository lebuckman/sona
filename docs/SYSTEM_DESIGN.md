# Sona — System Design Document

**Version:** 1.0  
**Status:** Active  
**Last Updated:** March 2026  
**Companion:** [PRD.md](./PRD.md)

---

## 1. Architecture Overview

Sona is a server-centric Next.js 16 application. The core principle is that **all sensitive operations happen on the server** — Spotify tokens, the Anthropic API key, and token refresh logic never touch the client. The browser only ever sees data that has already been fetched, transformed, and returned by a Next.js API route.

```
┌─────────────────────────────────────────────────────────┐
│                      Browser (Client)                   │
│  Next.js Pages · TanStack Query · Recharts · Shadcn UI  │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS (internal API routes)
┌────────────────────────▼────────────────────────────────┐
│                  Next.js 16 — Vercel Edge               │
│                                                         │
│  App Router (RSC + Client Components)                   │
│  ├── /api/auth/*        OAuth flow & session mgmt       │
│  ├── /api/spotify/*     Spotify data proxy              │
│  └── /api/ai/*          AI generation & chat            │
└──────┬───────────────────────┬───────────────────────── ┘
       │                       │
┌──────▼──────┐     ┌──────────▼──────────┐
│ Spotify     │     │  Anthropic          │
│ Web API     │     │  Claude Haiku 4.5   │
│ (OAuth 2.0) │     │  (server-side only) │
└─────────────┘     └─────────────────────┘
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

| Route                | Type       | Description                              |
| -------------------- | ---------- | ---------------------------------------- |
| `/`                  | Page (RSC) | Landing page — hero input, features, FAQ |
| `/api/auth/login`    | API Route  | Initiates Spotify OAuth redirect         |
| `/api/auth/callback` | API Route  | Handles OAuth code exchange              |

### Protected Routes (require session)

| Route                          | Type       | Description                                   |
| ------------------------------ | ---------- | --------------------------------------------- |
| `/profile`                     | Page (RSC) | Music identity portfolio — all stats sections |
| `/chat`                        | Page (RSC) | Ask Sona — full chat interface                |
| `/generate`                    | Page (RSC) | Playlist generation — _Sprint 4_              |
| `/api/auth/logout`             | API Route  | Clears session and tokens                     |
| `/api/spotify/top-tracks`      | API Route  | Top tracks (time range param)                 |
| `/api/spotify/top-artists`     | API Route  | Top artists (time range param)                |
| `/api/spotify/recently-played` | API Route  | Last 20 played tracks                         |
| `/api/spotify/audio-features`  | API Route  | Audio features for top tracks                 |
| `/api/spotify/playlists`       | API Route  | User's playlists                              |
| `/api/ai/insights`             | API Route  | Daily AI insight card (streamed)              |
| `/api/ai/profile`              | API Route  | AI music personality profile (streamed)       |
| `/api/ai/chat`                 | API Route  | Conversational AI (streamed)                  |

### Route Protection Strategy

A single layout at `app/(protected)/layout.tsx` handles auth guarding for all dashboard routes. It reads the iron-session server-side and redirects unauthenticated users to `/` before any child page renders. Authenticated users visiting `/` are redirected to `/profile`.

---

## 3. Authentication Flow — Spotify OAuth 2.0 (Authorization Code Flow)

```
User                 Sona Server             Spotify
 │                       │                      │
 │  Click "Connect"      │                      │
 ├──────────────────────▶│                      │
 │                       │  Build auth URL      │
 │                       │  + random state val  │
 │  302 → Spotify login  │                      │
 │◀──────────────────────┤                      │
 │                       │                      │
 │  Authorize Sona       │                      │
 ├───────────────────────────────────────────▶  │
 │                       │                      │
 │  302 → /api/auth/callback?code=X&state=Y     │
 ├──────────────────────▶│                      │
 │                       │  Validate state      │
 │                       │  POST /api/token     │
 │                       ├─────────────────────▶│
 │                       │  access + refresh    │
 │                       │◀─────────────────────┤
 │                       │  Upsert user in DB   │
 │                       │  Encrypt + store     │
 │                       │  tokens in DB        │
 │                       │  Set iron-session    │
 │  302 → /profile       │                      │
 │◀──────────────────────┤                      │
```

**Security decisions:**

- `state` parameter is a cryptographic random string stored in session before redirect, verified on callback — prevents CSRF
- Tokens are AES-256 encrypted before storage using `SESSION_SECRET` as the key. Even if the database is compromised, raw tokens are not exposed
- `iron-session` cookie is `httpOnly`, `secure`, and `sameSite: lax`
- Spotify scopes are minimal — only what the product actually needs (see Section 7)

### Token Refresh

Every Spotify API route calls a shared `withValidToken(userId)` helper before executing. This helper:

1. Reads the token record from DB and decrypts it
2. Checks if `expires_at` is within 5 minutes
3. If expiring soon: calls Spotify's refresh endpoint, updates DB with new tokens and new `expires_at`
4. Returns the valid access token

Token refresh is transparent to the client — the API route handles it internally before responding.

---

## 4. Database Schema

Managed via Drizzle ORM. All migrations are versioned in `drizzle/migrations/`.

### `users`

```sql
id              uuid          PRIMARY KEY DEFAULT gen_random_uuid()
spotify_id      varchar(255)  NOT NULL UNIQUE
display_name    varchar(255)
email           varchar(255)
avatar_url      text
country         varchar(10)
spotify_product varchar(50)   -- "premium", "free", etc.
created_at      timestamp     NOT NULL DEFAULT now()
updated_at      timestamp     NOT NULL DEFAULT now()
```

### `tokens`

```sql
id              uuid          PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid          NOT NULL REFERENCES users(id) ON DELETE CASCADE
access_token    text          NOT NULL  -- AES-256 encrypted
refresh_token   text          NOT NULL  -- AES-256 encrypted
expires_at      timestamp     NOT NULL
scope           text          -- space-separated Spotify scopes granted
created_at      timestamp     NOT NULL DEFAULT now()
updated_at      timestamp     NOT NULL DEFAULT now()

UNIQUE (user_id)  -- one token record per user, updated on refresh
```

### `spotify_cache`

```sql
id              uuid          PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid          NOT NULL REFERENCES users(id) ON DELETE CASCADE
cache_key       varchar(200)  NOT NULL
-- Examples: "top_tracks:short_term", "top_tracks:medium_term",
--           "top_artists:short_term", "recently_played",
--           "audio_features", "playlists"
data            jsonb         NOT NULL
cached_at       timestamp     NOT NULL DEFAULT now()
expires_at      timestamp     NOT NULL

UNIQUE (user_id, cache_key)
INDEX  (user_id, cache_key, expires_at)  -- fast lookup + expiry check
```

### `ai_cache`

```sql
id                uuid          PRIMARY KEY DEFAULT gen_random_uuid()
user_id           uuid          NOT NULL REFERENCES users(id) ON DELETE CASCADE
cache_type        varchar(100)  NOT NULL
-- Values: "daily_insight", "profile", "mood_analysis"
content           text          NOT NULL
model             varchar(100)  -- e.g. "claude-haiku-4-5"
input_tokens      integer
output_tokens     integer
generated_at      timestamp     NOT NULL DEFAULT now()
expires_at        timestamp     NOT NULL

UNIQUE (user_id, cache_type)
-- One current record per type per user; overwritten on regeneration
```

### Cache TTL Reference

| Data                 | TTL          | Rationale                                   |
| -------------------- | ------------ | ------------------------------------------- |
| Top tracks / artists | 1 hour       | Changes slowly; reduce Spotify API calls    |
| Recently played      | 15 minutes   | More dynamic; users expect freshness        |
| Playlists            | 30 minutes   | Changes occasionally                        |
| Audio features       | 6 hours      | Static per-track data; rarely needs refresh |
| AI daily insight     | 24 hours     | Regenerates once per day                    |
| AI profile           | 7 days       | User can force regenerate; rate-limited     |
| Chat context         | Session only | Not persisted in v1                         |

---

## 5. Data Flow — Spotify Data

```
Client (TanStack Query hook)
    │
    │ GET /api/spotify/top-tracks?range=short_term
    ▼
Next.js API Route
    │
    ├─ Read iron-session → user_id
    │
    ├─ Query spotify_cache WHERE user_id = ? AND cache_key = 'top_tracks:short_term'
    │         AND expires_at > now()
    │
    ├─ CACHE HIT ──────────────────▶  Return cached data as JSON
    │
    └─ CACHE MISS
          │
          ├─ withValidToken(user_id) → access_token (refreshes if needed)
          │
          ├─ GET https://api.spotify.com/v1/me/top/tracks?time_range=short_term
          │
          ├─ Transform response (select only fields Sona needs)
          │
          ├─ Upsert into spotify_cache with expires_at = now() + 1 hour
          │
          └─ Return transformed data as JSON
```

**Why proxy through Next.js instead of calling Spotify directly from the client?**
The Spotify access token would have to be sent to the browser, where it could be extracted. By proxying server-side, the token never leaves the server. This also lets us add caching, rate limit handling, and response transformation in one place.

---

## 6. Data Flow — AI Generation

### Insight Generation (`/api/ai/insights`)

```
Client requests /api/ai/insights
    │
    ├─ Check ai_cache for today's insight
    │
    ├─ CACHE HIT ──────────────────▶  Stream cached content to client
    │
    └─ CACHE MISS
          │
          ├─ Fetch from spotify_cache (or trigger fetch if stale):
          │     top_tracks:short_term
          │     top_artists:short_term
          │     audio_features
          │     recently_played
          │
          ├─ Build context object:
          │     {
          │       topTracks: [...names and artists],
          │       topArtists: [...names and genres],
          │       audioFeatureAverages: { energy, danceability, valence, ... },
          │       topGenres: [...weighted genre list],
          │       listeningTimePattern: { morning, afternoon, evening, lateNight }
          │     }
          │
          ├─ Construct prompt (see Section 8 for prompt strategy)
          │
          ├─ Stream response from Claude Haiku 4.5
          │
          ├─ On stream complete: store full text in ai_cache
          │         expires_at = next midnight (resets daily)
          │
          └─ Stream tokens to client as they arrive
```

### Chat (`/api/ai/chat`)

```
Client sends { message: string, history: Message[] }
    │
    ├─ Fetch user context from spotify_cache
    │   (same context object as insights, built once per session)
    │
    ├─ Build messages array:
    │     [
    │       { role: "system", content: <user context + behavior instructions> },
    │       ...history (last N turns),
    │       { role: "user", content: message }
    │     ]
    │
    ├─ Stream from Claude Haiku 4.5
    │
    └─ Stream tokens to client
         (conversation history managed client-side by TanStack Query)
```

**Conversation history management:** The client maintains the full conversation history in TanStack Query state and sends it with each request. The server is stateless for chat in v1 — no messages are persisted. This keeps the architecture simple while delivering the full chat experience.

---

## 7. Spotify API Scopes

Only the minimum scopes required are requested. This is both a security principle and a Spotify API requirement — requesting unnecessary scopes can cause app rejection during review.

| Scope                         | Why needed                    |
| ----------------------------- | ----------------------------- |
| `user-top-read`               | Top artists and tracks        |
| `user-read-recently-played`   | Recently played history       |
| `playlist-read-private`       | User's private playlists      |
| `playlist-read-collaborative` | Collaborative playlists       |
| `user-read-email`             | Email for user record         |
| `user-read-private`           | Country, Spotify product type |

**Not requested (intentional):**

- `playlist-modify-*` — No write operations to Spotify in v1
- `user-library-*` — Liked songs not needed for v1
- `streaming` — No playback

---

## 8. AI Prompt Strategy

The AI layer is one of the most important parts of Sona's technical identity. Prompt quality directly determines product quality.

### Context Object (sent with every AI request)

```typescript
type SonaUserContext = {
  displayName: string;
  topTracks: { name: string; artist: string }[]; // top 10, short term
  topArtists: { name: string; genres: string[] }[]; // top 10, short term
  topArtistsLongTerm: { name: string }[]; // top 5, all time
  genreBreakdown: { genre: string; weight: number }[]; // top 5 weighted genres
  audioFeatureAverages: {
    energy: number; // 0–1
    danceability: number; // 0–1
    valence: number; // 0–1  (musical "happiness")
    acousticness: number; // 0–1
    instrumentalness: number;
    tempo: number; // BPM
    loudness: number; // dB
  };
  recentlyPlayed: { name: string; artist: string; playedAt: string }[]; // last 20
  listeningTimePattern: {
    morning: number; // proportion 0–1
    afternoon: number;
    evening: number;
    lateNight: number;
  };
};
```

### System Prompt Principles

- Sona speaks in the **second person** ("You gravitate toward..." not "The user listens to...")
- Observations are **specific and grounded** in actual data values — no generic platitudes
- Tone is **calm, perceptive, slightly poetic** — not clinical or chatbot-like
- Sona **does not overstate certainty** ("suggests" not "means")
- Responses are **concise** — insights are 2–4 sentences, not essays
- Chat responses can be longer but should always **ground claims in the user's actual data**

### Caching & Cost Control

- **Prompt caching:** The system prompt + user context object is the same across all chat turns in a session. Using Anthropic's prompt caching (90% discount on cache hits) keeps chat affordable.
- **Model selection:** Claude Haiku 4.5 for all features. At estimated usage (a few dozen requests per user per month), cost is well under $0.10/user/month.
- **AI cache:** Daily insights and profile are cached 24h/7d respectively — the most token-expensive generation only happens once per period, not on every page load.

---

## 9. Client-Side Data Fetching (TanStack Query)

All data fetching on the client goes through TanStack Query hooks. This provides automatic caching, background refresh, loading/error states, and deduplication.

```typescript
// Example hook — src/hooks/use-top-tracks.ts
export function useTopTracks(timeRange: TimeRange = "short_term") {
  return useQuery({
    queryKey: ["top-tracks", timeRange],
    queryFn: () => fetch(`/api/spotify/top-tracks?range=${timeRange}`).then((r) => r.json()),
    staleTime: 1000 * 60 * 5, // consider fresh for 5 minutes client-side
    gcTime: 1000 * 60 * 60, // keep in memory for 1 hour
  });
}
```

**Query key conventions:**

- `['top-tracks', timeRange]` — top tracks by time range
- `['top-artists', timeRange]` — top artists by time range
- `['recently-played']` — recently played
- `['audio-features']` — audio feature averages
- `['playlists']` — user's playlists
- `['ai', 'insights']` — daily insight
- `['ai', 'profile']` — music personality profile

---

## 10. Project File Structure

```
sona/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   └── page.tsx                  # Landing page
│   │   ├── (protected)/
│   │   │   ├── layout.tsx                # Auth guard → redirect if no session
│   │   │   ├── profile/
│   │   │   │   ├── page.tsx              # Portfolio page (RSC shell)
│   │   │   │   └── _components/          # Page-specific components
│   │   │   │       ├── identity-section.tsx
│   │   │   │       ├── artists-section.tsx
│   │   │   │       ├── sound-section.tsx
│   │   │   │       ├── tracks-section.tsx
│   │   │   │       └── playlists-section.tsx
│   │   │   └── chat/
│   │   │       └── page.tsx              # Ask Sona page
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts
│   │   │   │   ├── callback/route.ts
│   │   │   │   └── logout/route.ts
│   │   │   ├── spotify/
│   │   │   │   ├── top-tracks/route.ts
│   │   │   │   ├── top-artists/route.ts
│   │   │   │   ├── recently-played/route.ts
│   │   │   │   ├── audio-features/route.ts
│   │   │   │   └── playlists/route.ts
│   │   │   └── ai/
│   │   │       ├── insights/route.ts
│   │   │       ├── profile/route.ts
│   │   │       └── chat/route.ts
│   │   ├── globals.css
│   │   └── layout.tsx                    # Root layout (fonts, providers)
│   │
│   ├── components/
│   │   ├── ui/                           # Shadcn components (auto-generated)
│   │   ├── layout/
│   │   │   ├── app-nav.tsx               # Portfolio page nav
│   │   │   └── landing-nav.tsx           # Landing floating nav
│   │   ├── sona/
│   │   │   ├── insight-card.tsx          # Streaming AI insight display
│   │   │   ├── chat-interface.tsx        # Ask Sona chat UI
│   │   │   ├── ask-sona-float.tsx        # Floating shortcut button
│   │   │   └── sona-voice.tsx            # Styled italic Sona narration text
│   │   └── charts/
│   │       ├── genre-bars.tsx
│   │       ├── audio-features.tsx
│   │       └── activity-chart.tsx
│   │
│   ├── hooks/
│   │   ├── use-top-tracks.ts
│   │   ├── use-top-artists.ts
│   │   ├── use-audio-features.ts
│   │   ├── use-playlists.ts
│   │   └── use-ai-insights.ts
│   │
│   ├── lib/
│   │   ├── spotify/
│   │   │   ├── client.ts                 # Fetch wrapper for Spotify API
│   │   │   ├── auth.ts                   # OAuth helpers, token exchange
│   │   │   ├── token.ts                  # withValidToken(), refresh logic
│   │   │   └── types.ts                  # TypeScript types for Spotify responses
│   │   ├── ai/
│   │   │   ├── client.ts                 # Anthropic client init
│   │   │   ├── context.ts                # Build SonaUserContext from DB/cache
│   │   │   └── prompts.ts                # Prompt templates for each feature
│   │   ├── db/
│   │   │   ├── index.ts                  # Drizzle client (Neon serverless)
│   │   │   └── schema.ts                 # Table definitions
│   │   ├── crypto.ts                     # AES-256 encrypt/decrypt for tokens
│   │   ├── session.ts                    # iron-session config + type
│   │   └── utils.ts                      # cn() helper, misc utilities
│   │
│   ├── types/
│   │   └── index.ts                      # Shared app types (SonaUserContext, etc.)
│   │
│   └── middleware.ts                     # Rate limiting (future), logging
│
├── drizzle/
│   └── migrations/                       # Versioned SQL migrations
│
├── docs/
│   ├── PRD.md
│   └── SYSTEM_DESIGN.md                  # This document
│
├── .github/
│   └── workflows/
│       └── ci.yml                        # Lint + type-check on every PR
│
├── .env.local                            # Local secrets (gitignored)
├── .env.example                          # Template checked into repo
├── next.config.ts
├── drizzle.config.ts
└── README.md
```

---

## 11. Environment Variables

```bash
# .env.example

# Spotify OAuth
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Session encryption — generate with:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=

# Token encryption — separate key from session secret
TOKEN_ENCRYPTION_KEY=

# Neon Postgres
DATABASE_URL=

# Anthropic
ANTHROPIC_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 12. Open Questions (Technical)

- [ ] **Token encryption key rotation:** If `TOKEN_ENCRYPTION_KEY` needs to rotate, how do we re-encrypt existing tokens? Define a migration strategy before launch.
- [ ] **Spotify rate limits:** Spotify's API is rate-limited at ~180 requests per minute. The cache layer handles most of this, but aggressive user behavior (rapid time-range switching) could still hit limits. Consider per-user request throttling at the API route level.
- [ ] **Streaming AI responses:** Decide between Vercel AI SDK (`streamText`) vs raw Anthropic streaming API. Vercel AI SDK is easier to wire up; raw API gives more control over the stream format.
- [ ] **Chat history in v2:** When chat history is persisted, the schema will need a `chat_sessions` and `chat_messages` table. Design for this in schema even if not implemented in v1.
- [ ] **Prompt caching eligibility:** Anthropic prompt caching requires the cacheable prefix to be at least 1024 tokens. Verify the user context object consistently meets this threshold.
