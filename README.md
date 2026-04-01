# Sona

Sona connects to your Spotify account and uses AI to transform your
listening data into something personal — mood analysis, music personality
profiles, and a conversational interface that knows your taste.

**[Live Demo](https://sonamusic.vercel.app)** · **[PRD](./docs/PRD.md)** · **[System Design](./docs/SYSTEM_DESIGN.md)**

## 🚧 Features in Development

**Sona Profile** — AI-generated music personality built from your listening history

**Sound DNA** — Audio feature fingerprint across your top tracks

**Ask Sona** — Conversational AI with agentic tool use over your Spotify data

**Mood Analysis** — Playlist classification by energy, valence, and tempo

## 👾 Tech Stack

| Layer      | Technology                       |
| ---------- | -------------------------------- |
| Framework  | Next.js 16 (App Router)          |
| Language   | TypeScript 5 (strict)            |
| Styling    | Tailwind CSS v4 + Shadcn UI      |
| Database   | Neon Postgres + Drizzle ORM      |
| Auth       | Spotify OAuth 2.0 + iron-session |
| AI         | Anthropic Claude Haiku 4.5       |
| Deployment | Vercel                           |
| CI         | GitHub Actions                   |
