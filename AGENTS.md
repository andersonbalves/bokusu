# AGENTS.md

Context for AI agents working on Bokusu. **This file is the single source of truth** — `CLAUDE.md` just points here.

## Project

Bokusu is a karaoke system (PiKaraoke fork) for Raspberry Pi, Windows, macOS, and Linux. Full-stack: Python/Flask backend + React SPA frontend. Users search YouTube, queue songs, and sing with pitch-shifted audio. Real-time queue sync via Socket.IO.

## Architecture

```
bokusu/
├── bokusu-front/              # React SPA — all UI lives here
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── layouts/           # App layout (management) vs Player layout (TV/display)
│   │   └── store/             # Zustand slices for global UI state
│   ├── package.json
│   ├── vite.config.ts         # Build target: ../pikaraoke/templates/index.html + ../pikaraoke/static/assets/
│   └── tailwind.config.js     # DaisyUI themes: Aqua, Acid; fonts: Michroma, Space Grotesk
│
└── pikaraoke/                 # Flask backend
    ├── app.py                 # App factory
    ├── routes/
    │   ├── home.py            # Catch-all /<path:path> → serves index.html (SPA routing)
    │   └── *.py               # REST JSON APIs + Socket.IO event emitters
    ├── templates/index.html   # AUTO-GENERATED — never edit manually
    └── static/assets/         # AUTO-GENERATED — JS/CSS from Vite build
```

**Boundary:** Flask owns data, queues, downloads, SQLite, media files. React owns all UI. They communicate via REST (TanStack Query) and WebSocket events (Flask-SocketIO).

Jinja templates (except `index.html`) are progressively obsoleted by the SPA.

## Frontend Stack

| Concern | Library |
|---------|---------|
| Framework | React 18+ (functional components, strict TypeScript) |
| Build | Vite |
| Routing | React Router DOM v6+ |
| Global UI state | Zustand |
| Server state | TanStack Query (React Query) |
| Realtime | Custom hooks wrapping Flask-SocketIO events → TanStack Query invalidation |
| Styling | TailwindCSS + DaisyUI |
| Icons | Lucide React |

## Backend Stack

| Concern | Library |
|---------|---------|
| Framework | Flask |
| Realtime | Flask-SocketIO |
| Database | SQLite |
| Package manager | uv |
| Python | 3.10+ |

## Frontend/Backend Boundary

- **Flask owns:** song files, download queue, SQLite DB, media playback process, system config
- **React owns:** all UI rendering, routing, user interactions
- **Communication:** REST (JSON) for queries/mutations; Socket.IO events for real-time push (queue changes, playback state, download progress)
- TanStack Query invalidates on relevant Socket.IO events — do not poll

## Core Principles

**Single-owner maintainability:** Code clarity over documentation. Simplicity over flexibility. One source of truth.

## Dev Commands

```bash
# Backend (Flask)
uv run pikaraoke                       # produção local (abre browser kiosk na TV)
uv run pikaraoke --hide-splash-screen  # desenvolvimento/testes (sem browser automático)

# Frontend dev server (hot-reload, separate port — proxies API to Flask)
cd bokusu-front && npm run dev

# Frontend build (outputs into Flask static dirs — required before distributing)
cd bokusu-front && npm run build

# Run Python tests
uv run pytest

# Code quality
uv run pre-commit run --all-files
```

## Key Conventions

**YouTube filenames** use exactly 11-character IDs — two supported patterns only:

- `Title---dQw4w9WgXcQ.mp4` (triple dash, PiKaraoke legacy)
- `Title [dQw4w9WgXcQ].mp4` (brackets, yt-dlp)

**`pikaraoke/templates/index.html` and `pikaraoke/static/assets/`** are build artifacts. Do not edit. Do not commit unless rebuilding is not feasible.

**Two React Router layouts:**

- App/Management layout — controls, admin, queue management
- Player/TV layout — fullscreen display for the screen facing singers

## Code Style

### TypeScript/React

- Strict TypeScript — no `any`, no type assertions without justification
- React functional components only; no class components
- Zustand for global UI state; TanStack Query for server state — never mix the two
- Component files: PascalCase. Hooks: `use` prefix. Store slices: camelCase
- TailwindCSS + DaisyUI utility classes; no inline styles

### Python

- PEP 8, 4 spaces, meaningful names
- Type hints required: modern syntax (`str | None`) — Python 3.10+ is the minimum, no `from __future__ import annotations` needed
- Concise docstrings for public APIs — explain "why", not "how"
- No emoji or unicode emoji substitutes

## Error Handling

- Catch specific exceptions, never bare `except:`
- Log errors, never swallow silently
- Use context managers for resources

## Testing

- pytest with mocked external I/O and subprocess operations only
- Test business logic and integration points
- Skip trivial getters/setters
- Use real `EventSystem` and `PreferenceManager` instances (they're lightweight)

## Code Quality

Tools: Black (100 char), isort, pycln, pylint, mdformat.

Never commit to `main` directly.

## Refactoring

**Refactor iteratively as you work.** When touching code:

- Extract classes when a module has multiple responsibilities (like `Browser` was extracted from utilities)
- Extract functions when logic is repeated or a function exceeds ~50 lines
- Rename unclear variables/functions immediately
- Delete dead code - never comment it out. When new code supersedes existing methods, remove the old methods and their tests in the same commit
- Update related code consistently (no half-migrations)

**When to refactor:**

- Code you're modifying is hard to understand
- You're adding a third similar pattern (rule of three)
- A function/class is doing too many things

**When NOT to refactor:**

- Unrelated code "while you're in the area"
- Working code that you're not modifying
- To add flexibility you don't need yet

## PR Requirements

Every PR must include a test plan: a minimal checklist targeting only the changes made, enabling quick manual verification.

## What NOT to Do

- Add unrequested features
- Add error handling for impossible states
- Create abstractions for single uses
- Write speculative "future-proofing" code
- Commit debug prints or commented code

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`andersonbalves/bokusu`, via `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary, label string = role name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.
