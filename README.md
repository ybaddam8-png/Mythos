# 🏛️ Mythos

**An AI-driven interactive storytelling engine and text RPG.**

Mythos generates branching, choice-driven narratives across rich genres — fantasy, sci-fi, mystery, horror, and adventure. Players create a character, choose a world, and make meaningful decisions that shape an evolving story powered by OpenAI (with a built-in procedural fallback engine for offline play).

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Development](#development)
- [Production Build](#production-build)
- [API Overview](#api-overview)
- [Database](#database)
- [Codegen Pipeline](#codegen-pipeline)
- [Project Structure](#project-structure)
- [Scripts](#scripts)
- [License](#license)

---

## Features

- **Rich Genre System** — Fantasy, sci-fi, mystery, horror, and adventure with genre-specific world-building, atmosphere, and narrative guidance.
- **AI-Powered Narratives** — Dynamic story generation via OpenAI with context-aware prompts, character state tracking, and branching choices.
- **Offline Fallback Engine** — Built-in procedural story generator that activates automatically when the API key is missing, rate-limited, or timed out.
- **Character & World State** — Persistent inventory, quests, discovered NPCs, important events, and location tracking across turns.
- **Save & Export** — Export full playthrough history as Markdown (`.md`), plain text (`.txt`), or JSON.
- **Story Library** — Browse, resume, and manage saved adventures.
- **Type-Safe End-to-End** — OpenAPI spec → Orval codegen → Zod validation → React Query hooks → Express routes, all sharing the same contract.

---

## Architecture

Mythos is a **pnpm monorepo** with a clean separation between shared libraries and deployable artifacts:

```
mythos/
├── lib/                          # Shared libraries (no build step)
│   ├── api-spec/                 # OpenAPI 3.1 contract + Orval codegen config
│   ├── api-zod/                  # Auto-generated Zod validation schemas
│   ├── api-client-react/         # Generated React Query hooks + custom fetch
│   └── db/                       # PostgreSQL schema (Drizzle ORM) + migrations
├── artifacts/                    # Deployable applications
│   ├── api-server/               # Express 5 backend — story engine + REST API
│   ├── mythos-storyteller/       # Vite + React frontend — interactive story UI
│   └── mockup-sandbox/           # Component isolation & prototyping sandbox
├── scripts/                      # Workspace utility scripts
├── pnpm-workspace.yaml           # Workspace config with catalog + security policies
└── package.json                  # Root scripts: build, typecheck
```

### Data Flow

```
OpenAPI Spec (lib/api-spec/openapi.yaml)
    │
    ├──► Orval codegen ──► Zod schemas (lib/api-zod)
    │                  ──► React Query hooks (lib/api-client-react)
    │
    ▼
Express API (artifacts/api-server)
    │
    ├── Routes: /api/stories, /api/stories/:id, /api/stories/:id/turn
    ├── Story Generator: OpenAI integration + procedural fallback
    └── Database: PostgreSQL via Drizzle ORM (lib/db)
            │
            ▼
Vite + React UI (artifacts/mythos-storyteller)
    │
    ├── React Query hooks consume /api/* endpoints
    ├── Vite dev server proxies /api → Express backend
    └── Character creation, story playback, library, save/export
```

---

## Prerequisites

| Tool       | Version  | Notes                          |
|------------|----------|--------------------------------|
| Node.js    | ≥ 18     | v24 recommended                |
| pnpm       | ≥ 8      | Enforced via `preinstall` hook |
| PostgreSQL | ≥ 14     | Optional for local dev (in-memory fallback available) |

---

## Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/<your-org>/mythos.git
cd mythos

# 2. Install dependencies
pnpm install

# 3. Set up environment variables (see section below)
cp .env.example .env   # or export them directly

# 4. Push the database schema (requires DATABASE_URL)
pnpm --filter @workspace/db run push

# 5. Start the backend (port 3000)
pnpm --filter @workspace/api-server run dev

# 6. Start the frontend (port 5173) — in a second terminal
pnpm --filter @workspace/mythos-storyteller run dev

# 7. Open http://localhost:5173
```

> **Note:** The backend boots cleanly without `DATABASE_URL` — it falls back to an in-memory store with a console warning. PostgreSQL is only required for persistent story storage.

---

## Environment Variables

| Variable                       | Required | Default                  | Description                                      |
|--------------------------------|----------|--------------------------|--------------------------------------------------|
| `DATABASE_URL`                 | No       | *(in-memory fallback)*   | PostgreSQL connection string                     |
| `OPENAI_API_KEY`               | No       | *(procedural fallback)*  | OpenAI API key for AI-powered story generation   |
| `PORT`                         | No       | `3000` (API) / `5173` (UI) | Server listening port                          |
| `BASE_PATH`                    | No       | `/`                      | Vite base path for deployment                    |
| `API_PORT`                     | No       | `3000`                   | Backend port for the Vite dev proxy target       |
| `STORY_MAX_COMPLETION_TOKENS`  | No       | *(default)*              | Max tokens for OpenAI story completions          |
| `STORY_GENERATION_TIMEOUT_MS`  | No       | *(default)*              | Timeout for OpenAI requests before fallback      |

---

## Development

### Running Both Servers

```bash
# Terminal 1 — Backend API
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend UI
pnpm --filter @workspace/mythos-storyteller run dev
```

The Vite dev server proxies `/api` requests to the Express backend automatically.

### Type Checking

```bash
# Full workspace typecheck (libs first, then artifacts)
pnpm run typecheck

# Single package
pnpm --filter @workspace/api-server run typecheck
```

### Component Sandbox

```bash
pnpm --filter @workspace/mockup-sandbox run dev
```

---

## Production Build

```bash
# Typecheck + build all packages
pnpm run build

# Or build individually
pnpm -r --if-present run build
```

Build outputs:
- `artifacts/api-server/dist/index.mjs` — Bundled Express server (esbuild)
- `artifacts/mythos-storyteller/dist/public/` — Static React SPA (Vite)
- `artifacts/mockup-sandbox/dist/` — Static sandbox SPA (Vite)

### Run in Production

```bash
# Start the built API server
pnpm --filter @workspace/api-server run start
```

---

## API Overview

The API is defined in [`lib/api-spec/openapi.yaml`](lib/api-spec/openapi.yaml) (OpenAPI 3.1). All routes are mounted under `/api`.

| Method | Endpoint               | Description                              |
|--------|------------------------|------------------------------------------|
| GET    | `/api/healthz`         | Health check                             |
| GET    | `/api/stories`         | List saved stories                       |
| POST   | `/api/stories`         | Create a new story with opening scene    |
| GET    | `/api/stories/:id`     | Get a specific story                     |
| PUT    | `/api/stories/:id`     | Update a story                           |
| DELETE | `/api/stories/:id`     | Delete a story                           |
| POST   | `/api/stories/:id/turn`| Submit a choice and generate the next turn |
| GET    | `/api/stories/stats`   | Aggregate story statistics               |

---

## Database

Mythos uses **PostgreSQL** with **Drizzle ORM**. The schema is defined in [`lib/db/src/schema/stories.ts`](lib/db/src/schema/stories.ts).

### Schema

The `stories` table stores the full adventure state:

| Column      | Type                      | Description                     |
|-------------|---------------------------|---------------------------------|
| `id`        | `text` (PK)               | Story identifier                |
| `guest_id`  | `uuid`                    | Guest session identifier        |
| `title`     | `text`                    | Story title                     |
| `genre`     | `text`                    | Genre (fantasy, scifi, etc.)    |
| `world`     | `text`                    | World setting description       |
| `tone`      | `text`                    | Narrative tone                  |
| `character` | `jsonb` → `StoryCharacter`| Player character definition     |
| `scenes`    | `jsonb` → `StoryScene[]`  | Array of story scenes/turns     |
| `state`     | `jsonb` → `StoryWorldState`| Current world state            |
| `status`    | `text`                    | `active` or `completed`        |

### Migrations

```bash
# Push schema changes to the database
pnpm --filter @workspace/db run push

# Force push (destructive — dev only)
pnpm --filter @workspace/db run push-force
```

---

## Codegen Pipeline

The type-safe API contract flows through a codegen pipeline:

1. **Edit** the OpenAPI spec at [`lib/api-spec/openapi.yaml`](lib/api-spec/openapi.yaml)
2. **Run codegen** to regenerate hooks and schemas:
   ```bash
   pnpm --filter @workspace/api-spec run codegen
   ```
3. This generates:
   - `lib/api-zod/src/generated/api.ts` — Zod validation schemas
   - `lib/api-client-react/src/generated/api.ts` — React Query hooks + fetch functions

> **Important:** Files in `*/generated/` directories are auto-generated. Do not edit them manually.

---

## Project Structure

### `lib/api-spec` — OpenAPI Contract
Source-of-truth API specification (`openapi.yaml`) and Orval configuration for code generation.

### `lib/api-zod` — Zod Schemas
Auto-generated Zod validation schemas derived from the OpenAPI spec. Used by the backend for request/response validation.

### `lib/api-client-react` — React Query Client
Auto-generated React Query hooks and a custom fetch wrapper with support for base URL configuration, auth tokens, and guest ID header injection.

### `lib/db` — Database Layer
PostgreSQL schema defined with Drizzle ORM. Exports the `storiesTable`, insert schemas, and type definitions consumed by the API server.

### `artifacts/api-server` — Express Backend
Express 5 REST API with:
- Story CRUD routes
- AI story generation engine (OpenAI + procedural fallback)
- In-memory store fallback when PostgreSQL is unavailable
- Structured logging via Pino

### `artifacts/mythos-storyteller` — React Frontend
Vite + React interactive storytelling UI with:
- Character creation wizard
- Real-time story playback with animated scenes
- Story library with search and filtering
- Export stories as Markdown, text, or JSON
- Tailwind CSS + Radix UI + Framer Motion

### `artifacts/mockup-sandbox` — Component Sandbox
Isolated Vite environment for prototyping and testing UI components independently.

---

## Scripts

### Root-Level

| Command              | Description                                    |
|----------------------|------------------------------------------------|
| `pnpm run build`     | Typecheck all packages, then build all          |
| `pnpm run typecheck` | Full workspace type checking (libs → artifacts) |

### Maintenance

| Command                         | Description                              |
|---------------------------------|------------------------------------------|
| `./scripts/cleanup-caches.sh`   | Remove Vite caches, dist outputs, and stray artifacts |

---

## License

MIT
