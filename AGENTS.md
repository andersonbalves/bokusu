# AGENTS.md

Context for AI agents working on Bokusu.

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

## Dev Commands

```bash
# Start Flask backend
uv run python pikaraoke/app.py

# Start Vite frontend (hot-reload, separate port — proxies API to Flask)
cd bokusu-front && npm run dev

# Build frontend (injects into Flask static dirs — required before distributing)
cd bokusu-front && npm run build

# Run Python tests
uv run pytest

# Run all linters
uv run pre-commit run --config code_quality/.pre-commit-config.yaml --all-files
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
- Strict TypeScript — no `any`
- Functional components only
- Zustand for UI state, TanStack Query for server state — never mix
- PascalCase components, `use` prefix for hooks, camelCase store slices
- TailwindCSS + DaisyUI utilities; no inline styles

### Python
- PEP 8, 4 spaces, type hints with modern syntax (`str | None`)
- Catch specific exceptions; never bare `except:`
- Use real `EventSystem` and `PreferenceManager` in tests (they're lightweight)

## PR Requirements

Every PR must include a test plan: minimal checklist targeting only the changes made.
