# TV Player Bugfixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the bugs found in the 2026-07-03 manual evaluation of the `feat/tv-player` frontend, ordered by severity.

**Architecture:** Flask backend (`pikaraoke/`) + React SPA (`bokusu-front/`). Player TV pages talk to the backend via Socket.IO (`register_splash`, `end_song`, `notification`) and REST (TanStack Query). Each task is an isolated fix with its own tests.

**Tech Stack:** React 18 + TypeScript + Vitest + Testing Library (frontend), Flask + Flask-SocketIO + pytest (backend), hls.js for HLS playback.

## Global Constraints

- Python 3.10+ type hints (`str | None`), no `from __future__ import annotations`.
- Strict TypeScript — no `any`, no unjustified type assertions.
- Zustand for UI state; TanStack Query for server state — never mix.
- TailwindCSS + DaisyUI classes; no inline styles.
- Never commit to `main`; work stays on `feat/tv-player`.
- Frontend tests: `cd bokusu-front && npx vitest run <file>`. Backend tests: `uv run pytest <file> -v`.
- All user-facing strings go through i18n (`en.json` + `pt-BR.json` in `bokusu-front/src/locales/`).

## Repro facts (from the evaluation, for context)

- Pause > ~5 min → resume kills the song: Chrome suspends the paused MSE pipeline; on `play()` the video element fires `error` with `MediaError.code = 4` (`MEDIA_ERR_SRC_NOT_SUPPORTED`, `networkState = 3`), hls.js raises a fatal error, and `KaraokePlayer` treats any fatal as end-of-song. Reproduced 3/3.
- `register_splash` re-emitted by the same sid (PlayerPage remount or React StrictMode) demotes the master to slave — nobody drives playback afterwards.
- Server run command for manual verification: `uv run pikaraoke --hide-splash-screen` (port 5555).

---

### Task 1: HLS fatal error recovery in KaraokePlayer

**Files:**
- Modify: `bokusu-front/src/components/player/KaraokePlayer.tsx:37-62` (media loading effect)
- Test: `bokusu-front/src/components/player/KaraokePlayer.test.tsx`

**Interfaces:**
- Consumes: `Hls.ErrorTypes.NETWORK_ERROR` / `Hls.ErrorTypes.MEDIA_ERROR`, `hls.startLoad()`, `hls.recoverMediaError()` (hls.js public API).
- Produces: same `KaraokePlayerProps` — no signature change. `onError` now fires only after recovery attempts are exhausted, and the native `<video>` `onError` is ignored while hls.js is attached.

- [ ] **Step 1: Extend the Hls mock and write the failing tests**

In `KaraokePlayer.test.tsx`, extend the existing `hlsInstance` mock (top of file) with the recovery methods and error types, capturing the ERROR handler:

```tsx
const hlsInstance = {
  loadSource: vi.fn(),
  attachMedia: vi.fn(),
  destroy: vi.fn(),
  startLoad: vi.fn(),
  recoverMediaError: vi.fn(),
  on: vi.fn(),
}
vi.mock('hls.js', () => ({
  default: Object.assign(
    vi.fn().mockImplementation(function () { return hlsInstance }),
    {
      Events: { ERROR: 'hlsError' },
      ErrorTypes: { NETWORK_ERROR: 'networkError', MEDIA_ERROR: 'mediaError', OTHER_ERROR: 'otherError' },
    }
  ),
}))
```

Add the tests (helper `getHlsErrorHandler` extracts the callback registered via `hlsInstance.on`):

```tsx
function getHlsErrorHandler(): (event: string, data: { fatal: boolean; type: string }) => void {
  const call = hlsInstance.on.mock.calls.find(([event]) => event === 'hlsError')
  if (!call) throw new Error('hls ERROR handler not registered')
  return call[1] as (event: string, data: { fatal: boolean; type: string }) => void
}

function renderHlsPlayer(overrides: Partial<typeof baseProps> = {}) {
  window.HTMLMediaElement.prototype.canPlayType = vi.fn().mockReturnValue('')
  return render(<KaraokePlayer {...baseProps} {...overrides} url="/stream/abc.m3u8" />)
}

test('fatal media error triggers recoverMediaError, not onError', () => {
  const onError = vi.fn()
  renderHlsPlayer({ onError })
  getHlsErrorHandler()('hlsError', { fatal: true, type: 'mediaError' })
  expect(hlsInstance.recoverMediaError).toHaveBeenCalledTimes(1)
  expect(onError).not.toHaveBeenCalled()
})

test('fatal network error triggers startLoad, not onError', () => {
  const onError = vi.fn()
  renderHlsPlayer({ onError })
  getHlsErrorHandler()('hlsError', { fatal: true, type: 'networkError' })
  expect(hlsInstance.startLoad).toHaveBeenCalledTimes(1)
  expect(onError).not.toHaveBeenCalled()
})

test('onError fires after media recovery attempts are exhausted', () => {
  const onError = vi.fn()
  renderHlsPlayer({ onError })
  const fire = () => getHlsErrorHandler()('hlsError', { fatal: true, type: 'mediaError' })
  fire()
  fire()
  fire() // 3rd fatal media error: attempts (2) exhausted
  expect(hlsInstance.recoverMediaError).toHaveBeenCalledTimes(2)
  expect(onError).toHaveBeenCalledTimes(1)
})

test('fatal error of unknown type calls onError immediately', () => {
  const onError = vi.fn()
  renderHlsPlayer({ onError })
  getHlsErrorHandler()('hlsError', { fatal: true, type: 'otherError' })
  expect(onError).toHaveBeenCalledTimes(1)
})

test('non-fatal error is ignored', () => {
  const onError = vi.fn()
  renderHlsPlayer({ onError })
  getHlsErrorHandler()('hlsError', { fatal: false, type: 'networkError' })
  expect(onError).not.toHaveBeenCalled()
})

test('native video error is ignored while hls.js is attached', () => {
  const onError = vi.fn()
  const { getByTestId } = renderHlsPlayer({ onError })
  fireEvent.error(getByTestId('karaoke-video'))
  expect(onError).not.toHaveBeenCalled()
})

test('native video error still reaches onError for direct src playback', () => {
  const onError = vi.fn()
  window.HTMLMediaElement.prototype.canPlayType = vi.fn().mockReturnValue('probably')
  const { getByTestId } = render(<KaraokePlayer {...baseProps} onError={onError} url="/stream/abc.mp4" />)
  fireEvent.error(getByTestId('karaoke-video'))
  expect(onError).toHaveBeenCalledTimes(1)
})
```

If an existing test asserts that a fatal hls error calls `onError` directly, update it to match the new behavior (recovery first).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd bokusu-front && npx vitest run src/components/player/KaraokePlayer.test.tsx`
Expected: new tests FAIL (`recoverMediaError` never called; native-error test fails because `onError` fires).

- [ ] **Step 3: Implement recovery in KaraokePlayer**

Replace the media-loading effect and the `<video>` element wiring in `KaraokePlayer.tsx`:

```tsx
const MAX_RECOVERY_ATTEMPTS = 2

export function KaraokePlayer({ ... }: KaraokePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsActiveRef = useRef(false)

  // Carrega a mídia: hls.js para .m3u8 sem suporte nativo; src direto nos demais casos
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let hls: Hls | null = null
    if (url.endsWith('.m3u8') && !video.canPlayType('application/vnd.apple.mpegurl')) {
      hls = new Hls({ startPosition: 0 })
      hlsActiveRef.current = true
      hls.loadSource(url)
      hls.attachMedia(video)
      // Chrome suspende o pipeline MSE após ~5min de pausa; erro fatal de mídia
      // é recuperável — só desiste depois de esgotar as tentativas
      let networkRetries = 0
      let mediaRetries = 0
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal || !hls) return
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < MAX_RECOVERY_ATTEMPTS) {
          networkRetries += 1
          hls.startLoad()
          return
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries < MAX_RECOVERY_ATTEMPTS) {
          mediaRetries += 1
          hls.recoverMediaError()
          return
        }
        onError()
      })
    } else {
      video.src = url
    }
    void video.play().catch(() => {
      // Autoplay bloqueado: uma única nova tentativa (paridade com splash.js)
      setTimeout(() => void videoRef.current?.play().catch(() => undefined), 1000)
    })
    return () => {
      hlsActiveRef.current = false
      hls?.destroy()
      video.removeAttribute('src')
      video.load()
    }
  }, [url, onError])

  const handleNativeError = useCallback(() => {
    // Com hls.js ativo o próprio hls decide se o erro é fatal/recuperável
    if (!hlsActiveRef.current) onError()
  }, [onError])
  // ... demais effects inalterados ...

  return (
    <video
      ref={videoRef}
      data-testid="karaoke-video"
      className="h-full w-full bg-black object-contain"
      onCanPlay={onCanPlay}
      onEnded={onEnded}
      onError={handleNativeError}
    />
  )
}
```

Add `useCallback` to the react import.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd bokusu-front && npx vitest run src/components/player/KaraokePlayer.test.tsx`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add bokusu-front/src/components/player/KaraokePlayer.tsx bokusu-front/src/components/player/KaraokePlayer.test.tsx
git commit -m "fix: recover from fatal hls errors instead of ending the song"
```

- [ ] **Step 6: Manual verification (end of plan re-check)**

After all tasks: `uv run pikaraoke --hide-splash-screen`, open `http://localhost:5555/player`, queue a song, pause via remote, wait 6 minutes, resume. Expected: playback continues (previously: "A música terminou de forma anormal: error").

---

### Task 2: Idempotent splash registration + unregister on unmount

**Files:**
- Modify: `pikaraoke/routes/socket_events.py:43-91`
- Modify: `bokusu-front/src/hooks/useSplashRole.ts`
- Test: `tests/unit/test_splash_socketio.py` (create)
- Test: `bokusu-front/src/hooks/useSplashRole.test.ts` (extend existing `useSplashRole.test.ts`)

**Interfaces:**
- Consumes: existing Socket.IO events `register_splash`, `splash_role`, `disconnect`.
- Produces: new Socket.IO event `unregister_splash` (no payload) handled by the server; re-registration by the current master sid re-emits `"master"`.

- [ ] **Step 1: Write failing backend tests**

Create `tests/unit/test_splash_socketio.py`. Follow the fixture style of `tests/unit/test_queue_socketio.py` (Flask-SocketIO test client against the app with a mocked karaoke instance — reuse its conftest fixtures):

```python
"""Splash screen master/slave election over Socket.IO."""

from pikaraoke.routes import socket_events


def _reset_state():
    socket_events.splash_connections.clear()
    socket_events.master_splash_id = None


def _role_events(received: list) -> list[str]:
    return [e["args"][0] for e in received if e["name"] == "splash_role"]


def test_first_splash_becomes_master(socketio_client):
    _reset_state()
    socketio_client.emit("register_splash")
    assert _role_events(socketio_client.get_received()) == ["master"]


def test_reregistering_master_stays_master(socketio_client):
    _reset_state()
    socketio_client.emit("register_splash")
    socketio_client.get_received()
    socketio_client.emit("register_splash")  # remount / StrictMode double effect
    assert _role_events(socketio_client.get_received()) == ["master"]


def test_unregister_master_elects_remaining_slave(socketio_client, socketio_client_factory):
    _reset_state()
    master = socketio_client
    slave = socketio_client_factory()
    master.emit("register_splash")
    slave.emit("register_splash")
    master.get_received()
    assert _role_events(slave.get_received()) == ["slave"]

    master.emit("unregister_splash")
    assert _role_events(slave.get_received()) == ["master"]
```

If `test_queue_socketio.py` has no `socketio_client` / factory fixtures, create them in this file with the same app/socketio objects that test uses.

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/unit/test_splash_socketio.py -v`
Expected: `test_reregistering_master_stays_master` FAILS (receives `["slave"]`); `test_unregister_master_elects_remaining_slave` FAILS (unknown event, no re-election).

- [ ] **Step 3: Implement server-side fix**

In `pikaraoke/routes/socket_events.py`, make registration idempotent and extract removal shared by `disconnect`/`unregister_splash`:

```python
    @socketio.on("register_splash")
    def register_splash() -> None:
        """Handle splash screen registration and assign master/slave roles."""
        global master_splash_id
        sid = request.sid
        splash_connections.add(sid)
        logging.info(f"Splash screen registered: {sid}")

        if master_splash_id is None or master_splash_id == sid:
            master_splash_id = sid
            socketio.emit("splash_role", "master", room=sid)
            logging.info(f"Master splash screens assigned: {sid}")
        else:
            socketio.emit("splash_role", "slave", room=sid)
            logging.info(f"Slave splash screens assigned: {sid}")

    def _remove_splash(sid: str) -> None:
        global master_splash_id
        if sid not in splash_connections:
            return
        splash_connections.remove(sid)
        logging.info(f"Splash screen removed: {sid}")
        if sid == master_splash_id:
            master_splash_id = None
            logging.info("Master splash removed, electing new master")
            if splash_connections:
                new_master = next(iter(splash_connections))
                master_splash_id = new_master
                socketio.emit("splash_role", "master", room=new_master)
                logging.info(f"New master splash elected: {new_master}")

    @socketio.on("unregister_splash")
    def unregister_splash() -> None:
        """Handle a player page leaving without disconnecting the socket (SPA navigation)."""
        _remove_splash(request.sid)

    @socketio.on("disconnect")
    def handle_disconnect() -> None:
        """Handle Socket.IO client disconnection and manage splash role handover."""
        _remove_splash(request.sid)
```

- [ ] **Step 4: Run backend tests**

Run: `uv run pytest tests/unit/test_splash_socketio.py -v`
Expected: PASS. Also run `uv run pytest tests/unit/test_queue_socketio.py -v` to confirm no regression.

- [ ] **Step 5: Frontend — emit unregister on unmount**

In `bokusu-front/src/hooks/useSplashRole.ts`, add the emit to the effect cleanup:

```ts
    return () => {
      socket.off('connect', register)
      socket.off('splash_role', onRole)
      if (socket.connected) socket.emit('unregister_splash')
    }
```

Extend the existing `useSplashRole` test file with:

```ts
test('emits unregister_splash on unmount', () => {
  const { unmount } = renderHook(() => useSplashRole())
  unmount()
  expect(emit).toHaveBeenCalledWith('unregister_splash')
})
```

(Adapt mock names to the existing file's socket mock.)

- [ ] **Step 6: Run frontend tests**

Run: `cd bokusu-front && npx vitest run src/hooks/useSplashRole.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add pikaraoke/routes/socket_events.py tests/unit/test_splash_socketio.py bokusu-front/src/hooks/useSplashRole.ts bokusu-front/src/hooks/useSplashRole.test.ts
git commit -m "fix: idempotent splash registration and unregister on player unmount"
```

---

### Task 3: Guests can queue local library songs from search

**Files:**
- Modify: `bokusu-front/src/pages/SearchPage.tsx:95-116` (suggestions dropdown)
- Modify: `bokusu-front/src/locales/en.json`, `bokusu-front/src/locales/pt-BR.json` (`search` section)
- Test: `bokusu-front/src/pages/SearchPage.test.tsx`

**Interfaces:**
- Consumes: `useEnqueue()` from `bokusu-front/src/hooks/useQueue.ts` — `mutate({ song_id: string, user: string })`, POST `/api/queue` (no admin required).
- Produces: each local suggestion row shows an add-to-queue button that enqueues `suggestion.path` directly.

- [ ] **Step 1: Write the failing test**

In `SearchPage.test.tsx` (follow the file's existing mocking of hooks; mock `useEnqueue` alongside the other queue/search hooks):

```tsx
test('local suggestion row enqueues the local file directly', async () => {
  const enqueueMutate = vi.fn()
  mockUseEnqueue.mockReturnValue({ mutate: enqueueMutate })
  mockUseAutocomplete.mockReturnValue({
    data: [{ path: '/songs/Tempo Perdido---abc12345678.mp4', fileName: 'Tempo Perdido', type: 'autocomplete' }],
  })
  render(<SearchPage />)
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'tempo' } })
  const addButton = await screen.findByRole('button', { name: /adicionar à fila|add to queue/i })
  fireEvent.click(addButton)
  expect(enqueueMutate).toHaveBeenCalledWith(
    { song_id: '/songs/Tempo Perdido---abc12345678.mp4', user: 'Guest' },
    expect.anything()
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bokusu-front && npx vitest run src/pages/SearchPage.test.tsx`
Expected: FAIL — no add button inside suggestions.

- [ ] **Step 3: Implement**

In `SearchPage.tsx`, import `ListPlus` from `lucide-react` and `useEnqueue` from `../hooks/useQueue`; instantiate `const enqueue = useEnqueue()`. Replace the suggestion `<li>` body:

```tsx
{suggestions.map((s) => (
  <li key={s.path} className="flex flex-row items-center">
    <button
      type="button"
      onClick={() => {
        setQuery(s.fileName)
        setShowSuggestions(false)
      }}
      className="flex-1 truncate text-sm py-2 px-3 hover:bg-base-300"
    >
      {s.fileName}
    </button>
    <button
      type="button"
      aria-label={t('search.addLocalToQueue')}
      className="btn btn-ghost btn-sm btn-circle text-primary"
      onClick={() => {
        setShowSuggestions(false)
        enqueue.mutate(
          { song_id: s.path, user: 'Guest' },
          {
            onSuccess: () => showToast(t('search.added', { title: s.fileName })),
            onError: () => showToast(t('search.error')),
          }
        )
      }}
    >
      <ListPlus size={16} />
    </button>
  </li>
))}
```

Add locale key `search.addLocalToQueue`: en `"Add to queue"`, pt-BR `"Adicionar à fila"`.

- [ ] **Step 4: Run tests**

Run: `cd bokusu-front && npx vitest run src/pages/SearchPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add bokusu-front/src/pages/SearchPage.tsx bokusu-front/src/pages/SearchPage.test.tsx bokusu-front/src/locales/en.json bokusu-front/src/locales/pt-BR.json
git commit -m "feat: queue local library songs directly from search suggestions"
```

---

### Task 4: Fix admin auth race on /library and /library/renamer direct access

**Files:**
- Modify: `bokusu-front/src/store/useAppStore.ts:11,17,29,35` (isAdmin slice)
- Modify: `bokusu-front/src/pages/LibraryPage.tsx:13,28-31`
- Modify: `bokusu-front/src/pages/RenamerPage.tsx:10,25-27`
- Test: `bokusu-front/src/pages/LibraryPage.test.tsx`

**Interfaces:**
- Consumes: `useAuthStatus` (unchanged — calls `setIsAdmin(boolean)` after `/api/auth` resolves).
- Produces: store field `isAdmin: boolean | null` (`null` = auth check pending). All existing truthiness checks (`isAdmin &&`, `if (isAdmin)`) keep working since `null` is falsy; only the two guard pages branch on `null` explicitly.

- [ ] **Step 1: Write the failing test**

In `LibraryPage.test.tsx` (reuse the file's store/router mocking):

```tsx
test('shows loading state while auth check is pending instead of redirecting', () => {
  setStoreState({ isAdmin: null }) // adapt to the file's store-mocking helper
  render(<LibraryPage />, { wrapper: routerWrapper })
  expect(screen.queryByText(/configura/i)).not.toBeInTheDocument() // did not redirect
  expect(document.querySelector('.loading')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bokusu-front && npx vitest run src/pages/LibraryPage.test.tsx`
Expected: FAIL (page redirects immediately when `isAdmin` is falsy).

- [ ] **Step 3: Implement**

`useAppStore.ts` — change the slice type and initial value:

```ts
  isAdmin: boolean | null
  // ...
  isAdmin: null,
```

(`setIsAdmin` signature stays `(isAdmin: boolean) => void`.)

`LibraryPage.tsx` and `RenamerPage.tsx` — replace the guard:

```tsx
  // Aguarda o /api/auth resolver antes de decidir; evita expulsar admin no F5
  if (isAdmin === null) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }
  if (!isAdmin) {
    return <Navigate to="/settings" replace />
  }
```

- [ ] **Step 4: Run tests (full frontend suite — the store type change touches many components)**

Run: `cd bokusu-front && npx vitest run`
Expected: PASS. Fix any test that constructed the store with `isAdmin: false` expecting initial state (update to `null` where it represents "before auth resolves").

- [ ] **Step 5: Commit**

```bash
git add bokusu-front/src/store/useAppStore.ts bokusu-front/src/pages/LibraryPage.tsx bokusu-front/src/pages/RenamerPage.tsx bokusu-front/src/pages/LibraryPage.test.tsx
git commit -m "fix: wait for auth check before redirecting admin-only pages"
```

- [ ] **Step 6: Manual verification note**

With server running and admin active, hit `http://localhost:5555/library` directly (F5). Expected: library renders (previously bounced to /settings).

---

### Task 5: Add missing i18n key `player.nextSinger`

**Files:**
- Modify: `bokusu-front/src/locales/en.json` (`player` section)
- Modify: `bokusu-front/src/locales/pt-BR.json` (`player` section)
- Test: `bokusu-front/src/locales/i18n-keys.test.ts` (create)

**Interfaces:**
- Consumes: `t('player.nextSinger')` at `bokusu-front/src/pages/PlayerPage.tsx:128`.
- Produces: a regression test that fails whenever any `t('...')` literal key is missing from either locale.

- [ ] **Step 1: Write the failing test (covers all keys, not just this one)**

Create `bokusu-front/src/locales/i18n-keys.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import en from './en.json'
import ptBR from './pt-BR.json'

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? flatten(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  )
}

function usedKeys(): string[] {
  const srcDir = path.resolve(__dirname, '..')
  const keys = new Set<string>()
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
        const source = fs.readFileSync(full, 'utf-8')
        for (const match of source.matchAll(/\bt\(\s*['"]([\w.]+)['"]/g)) keys.add(match[1])
      }
    }
  }
  walk(srcDir)
  return [...keys]
}

describe('locale completeness', () => {
  const locales = { en: flatten(en), 'pt-BR': flatten(ptBR) }
  for (const [name, keys] of Object.entries(locales)) {
    test(`every t() key exists in ${name}`, () => {
      const missing = usedKeys().filter((k) => !keys.includes(k))
      expect(missing).toEqual([])
    })
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bokusu-front && npx vitest run src/locales/i18n-keys.test.ts`
Expected: FAIL listing `player.nextSinger`.

- [ ] **Step 3: Add the key to both locales**

In the `"player"` object of `en.json`: `"nextSinger": "Next singer:"`. In `pt-BR.json`: `"nextSinger": "Próximo cantor:"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bokusu-front && npx vitest run src/locales/i18n-keys.test.ts`
Expected: PASS. (If the scan surfaces other missing literal keys, add them in this task too.)

- [ ] **Step 5: Commit**

```bash
git add bokusu-front/src/locales/en.json bokusu-front/src/locales/pt-BR.json bokusu-front/src/locales/i18n-keys.test.ts
git commit -m "fix: add missing player.nextSinger translation and locale completeness test"
```

---

### Task 6: Validate file existence in queue enqueue

**Files:**
- Modify: `pikaraoke/lib/queue_manager.py:97-127` (`enqueue`)
- Test: `tests/unit/test_queue_manager.py`

**Interfaces:**
- Consumes: `os.path.exists`.
- Produces: `enqueue` returns `[False, <translated message>]` for a nonexistent path; API callers (`POST /api/queue`) already convert `[False, msg]` into HTTP 400.

- [ ] **Step 1: Write the failing test**

In `tests/unit/test_queue_manager.py`, follow the file's existing fixture pattern for constructing `QueueManager`:

```python
def test_enqueue_rejects_nonexistent_file(queue_manager):
    success, message = queue_manager.enqueue("/nonexistent/path/song---dQw4w9WgXcQ.mp4", "Guest")
    assert success is False
    assert "not found" in message.lower() or "não encontrado" in message.lower()
    assert queue_manager.queue == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/unit/test_queue_manager.py::test_enqueue_rejects_nonexistent_file -v`
Expected: FAIL (song is enqueued, success is True).

- [ ] **Step 3: Implement**

At the top of `enqueue` in `queue_manager.py` (before the duplicate check), add:

```python
        if not os.path.exists(song_path):
            logging.warning(f"Refusing to enqueue missing file: {song_path}")
            return [False, _("Song file not found: %s") % title]
```

Place it after `title = self._resolve_title(song_path)`. Confirm `os` and `_` (flask_babel gettext) are already imported in the module; add imports if missing, matching the module's existing import style.

- [ ] **Step 4: Run tests**

Run: `uv run pytest tests/unit/test_queue_manager.py -v`
Expected: PASS (all — existing tests may enqueue fake paths; if so, have those tests create temp files via `tmp_path` or monkeypatch `os.path.exists`, keeping assertions intact).

- [ ] **Step 5: Commit**

```bash
git add pikaraoke/lib/queue_manager.py tests/unit/test_queue_manager.py
git commit -m "fix: reject enqueue of nonexistent song files"
```

---

### Task 7: Notifications overwrite instead of being dropped

**Files:**
- Modify: `pikaraoke/karaoke.py:400-417` (`send_notification`)
- Test: `tests/unit/test_karaoke_utils.py` (or the test module that already covers `send_notification` / `log_and_send`; create test there)

**Interfaces:**
- Consumes: existing `self.socketio.emit("notification", ...)`.
- Produces: `send_notification` always updates `now_playing_notification` and emits — newest message wins. `reset_now_playing_notification` behavior unchanged.

- [ ] **Step 1: Write the failing test**

```python
def test_send_notification_overwrites_pending_notification(karaoke_instance):
    karaoke_instance.send_notification("first message", "info")
    karaoke_instance.send_notification("second message", "danger")
    assert karaoke_instance.now_playing_notification == "second message::is-danger"
```

(Use the existing karaoke fixture; if `socketio` is None in tests the emit branch is skipped, which is fine.)

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/unit/test_karaoke_utils.py -v -k overwrite`
Expected: FAIL — `now_playing_notification` still `"first message::is-info"`.

- [ ] **Step 3: Implement**

In `send_notification`, delete the early-return guard:

```python
        hide_notifications = self.preferences.get_or_default("hide_notifications")
        if not hide_notifications:
            self.now_playing_notification = message + "::is-" + color
            # Emit notification via SocketIO for event-driven architecture
            if self.socketio:
                self.socketio.emit("notification", self.now_playing_notification, namespace="/")
```

(Remove the `if self.now_playing_notification is not None: return` block and its comment — the "one message at a time" rule dates from the legacy command channel; with no TV connected it permanently blocked all notifications.)

- [ ] **Step 4: Run tests**

Run: `uv run pytest tests/unit/test_karaoke_utils.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pikaraoke/karaoke.py tests/unit/test_karaoke_utils.py
git commit -m "fix: let new notifications overwrite pending ones instead of dropping them"
```

---

### Task 8: Language selector also sets the server language

**Files:**
- Modify: `bokusu-front/src/components/settings/LanguageSection.tsx`
- Modify: `bokusu-front/src/types/api.ts` (add `preferred_language` to `Preferences` if absent)
- Test: `bokusu-front/src/components/settings/LanguageSection.test.tsx` (create; there is no existing test for this component)

**Interfaces:**
- Consumes: `useSetPreference()` from `bokusu-front/src/hooks/usePreferences.ts` — `mutate({ key: 'preferred_language', value: string })`, PUT `/api/preferences/preferred_language`.
- Produces: server `preferred_language` follows the UI selector (`pt-BR` → `pt_BR`, `en` → `en`), so flask_babel translates notifications in the chosen language regardless of who triggered them.

Background: `get_locale()` in `pikaraoke/app.py:106` already prioritizes the `preferred_language` preference; today nothing in the SPA sets it, so backend-generated notification text falls back to the HTTP requester's `Accept-Language` — the TV shows English messages on a pt-BR install.

- [ ] **Step 1: Write the failing test**

Create `LanguageSection.test.tsx` (mock `useSetPreference` like other settings tests mock their hooks):

```tsx
const setPreferenceMutate = vi.fn()
vi.mock('../../hooks/usePreferences', () => ({
  useSetPreference: () => ({ mutate: setPreferenceMutate }),
}))

test('changing language persists preferred_language on the server', () => {
  render(<LanguageSection />)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en' } })
  expect(setPreferenceMutate).toHaveBeenCalledWith({ key: 'preferred_language', value: 'en' })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bokusu-front && npx vitest run src/components/settings/LanguageSection.test.tsx`
Expected: FAIL — mutate never called.

- [ ] **Step 3: Implement**

In `LanguageSection.tsx`:

```tsx
import { useSetPreference } from '../../hooks/usePreferences'

const BACKEND_LANGUAGE_CODES: Record<string, string> = { 'pt-BR': 'pt_BR', en: 'en' }

export function LanguageSection() {
  const { t, i18n } = useTranslation()
  const setPreference = useSetPreference()

  const currentLanguage = i18n.language.startsWith('pt') ? 'pt-BR' : 'en'

  const handleChange = (lang: string) => {
    setLanguage(lang)
    // Mantém o idioma do backend (notificações via flask_babel) em sincronia com a UI
    setPreference.mutate({ key: 'preferred_language', value: BACKEND_LANGUAGE_CODES[lang] ?? 'en' })
  }
  // ... render inalterado ...
}
```

If `Preferences` in `types/api.ts` lacks `preferred_language: string | null`, add it. Note: PUT `/api/preferences/<key>` requires admin — for guests the mutation fails silently (their local UI language still switches), which is acceptable; the server language is an admin setting.

- [ ] **Step 4: Run tests**

Run: `cd bokusu-front && npx vitest run src/components/settings/LanguageSection.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add bokusu-front/src/components/settings/LanguageSection.tsx bokusu-front/src/components/settings/LanguageSection.test.tsx bokusu-front/src/types/api.ts
git commit -m "fix: sync server preferred_language with UI language selector"
```

---

### Task 9: Server connection info — correct QR URL + hide expand-fs off Raspberry Pi

**Files:**
- Modify: `pikaraoke/routes/api/system.py` (new public endpoint)
- Modify: `bokusu-front/src/hooks/useSystem.ts` (new hook)
- Modify: `bokusu-front/src/pages/PlayerPage.tsx:23` (appUrl source)
- Modify: `bokusu-front/src/components/settings/SystemPanel.tsx` (conditional expand-fs button)
- Test: `tests/unit/api/test_system_routes.py` (extend or create alongside existing api tests in `tests/unit/api/`)
- Test: `bokusu-front/src/pages/PlayerPage.test.tsx`

**Interfaces:**
- Consumes: `k.url` (LAN URL computed at startup, `pikaraoke/karaoke.py:195`), `is_raspberry_pi()` from `pikaraoke/lib/get_platform.py:9`.
- Produces: `GET /api/system/connection-info` (public, no admin) → `{"url": "http://100.119.211.65:5555", "isRaspberryPi": false}`; frontend hook `useConnectionInfo()` returning that payload.

- [ ] **Step 1: Write the failing backend test**

In `tests/unit/api/test_system_routes.py` (match the folder's existing client/karaoke fixtures):

```python
def test_connection_info_is_public_and_returns_url(client, karaoke_instance):
    karaoke_instance.url = "http://192.168.0.10:5555"
    response = client.get("/api/system/connection-info")
    assert response.status_code == 200
    data = response.get_json()
    assert data["url"] == "http://192.168.0.10:5555"
    assert isinstance(data["isRaspberryPi"], bool)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/unit/api/test_system_routes.py -v -k connection_info`
Expected: FAIL 404.

- [ ] **Step 3: Implement backend endpoint**

In `pikaraoke/routes/api/system.py`:

```python
from pikaraoke.lib.get_platform import is_raspberry_pi


@api_system_bp.route("/system/connection-info", methods=["GET"])
def connection_info() -> Response:
    """Public connection metadata for player screens (QR code URL, platform)."""
    k = get_karaoke_instance()
    return jsonify({"url": k.url, "isRaspberryPi": is_raspberry_pi()})
```

Run: `uv run pytest tests/unit/api/test_system_routes.py -v` — expected PASS.

- [ ] **Step 4: Frontend hook + PlayerPage QR**

In `useSystem.ts` add:

```ts
export interface ConnectionInfo {
  url: string
  isRaspberryPi: boolean
}

export function useConnectionInfo() {
  return useQuery({
    queryKey: ['connectionInfo'],
    staleTime: Infinity,
    queryFn: () => apiFetch<ConnectionInfo>('/api/system/connection-info'),
  })
}
```

In `PlayerPage.tsx`, prefer the server URL over `window.location.origin`:

```tsx
export function PlayerPage({ appUrl }: PlayerPageProps) {
  const { data: connectionInfo } = useConnectionInfo()
  const effectiveAppUrl = appUrl ?? connectionInfo?.url ?? window.location.origin
  // usar effectiveAppUrl em todos os pontos que hoje usam appUrl
```

(Remove the `appUrl = window.location.origin` default parameter; keep the prop for tests.)

Add a PlayerPage test (mock `useConnectionInfo` like the file's other hook mocks):

```tsx
test('QR code uses the server-reported URL when no appUrl prop is given', () => {
  mockUseConnectionInfo.mockReturnValue({ data: { url: 'http://192.168.0.10:5555', isRaspberryPi: false } })
  render(<PlayerPage />)
  expect(screen.getByText('192.168.0.10:5555')).toBeInTheDocument()
})
```

- [ ] **Step 5: Hide expand-fs off Pi**

In `SystemPanel.tsx`, wrap the expand-fs button:

```tsx
const { data: connectionInfo } = useConnectionInfo()
// ...
{connectionInfo?.isRaspberryPi && (
  <button /* botão Expandir Armazenamento existente inalterado */ >
    {t('system.expandFs')}
  </button>
)}
```

- [ ] **Step 6: Run frontend tests**

Run: `cd bokusu-front && npx vitest run src/pages/PlayerPage.test.tsx src/components/settings`
Expected: PASS (update any SystemPanel test that asserted the expand-fs button is always present).

- [ ] **Step 7: Commit**

```bash
git add pikaraoke/routes/api/system.py tests/unit/api/test_system_routes.py bokusu-front/src/hooks/useSystem.ts bokusu-front/src/pages/PlayerPage.tsx bokusu-front/src/pages/PlayerPage.test.tsx bokusu-front/src/components/settings/SystemPanel.tsx
git commit -m "feat: expose connection info; fix player QR URL and hide expand-fs off Pi"
```

---

### Task 10: Minor cleanups batch

**Files:**
- Modify: `bokusu-front/index.html:7` (title)
- Modify: `bokusu-front/src/pages/QueuePage.tsx:70-86,147-156,177-193` (dead props, `any`, hardcoded string)
- Modify: `bokusu-front/src/components/QueueItem.tsx:8-15` (drop unused props)
- Delete: `bokusu-front/src/hooks/useAutocomplete.ts` (duplicate of `useSearchAutocomplete` in `useSearch.ts`)
- Modify: `bokusu-front/src/pages/SearchPage.tsx:39-40` (min query length + single autocomplete hook)
- Modify: `bokusu-front/src/hooks/useSearch.ts` (min length in `useSearch`)
- Modify: `bokusu-front/src/pages/PlayerPage.tsx:103` + `bokusu-front/src/components/player/NotificationBanner.tsx` (banner position)
- Modify: `bokusu-front/src/locales/en.json`, `bokusu-front/src/locales/pt-BR.json` (`queue.randomAmount` key)
- Modify: `CLAUDE.md` (backend run command)
- Test: existing suites (`QueuePage`/`SearchPage` tests updated inline)

**Interfaces:**
- Consumes: `useSearchAutocomplete` from `useSearch.ts` (survivor of the dedup).
- Produces: `QueueItemProps` without `onRemove`/`removeDisabled`; `useSearch`/`useSearchAutocomplete` gated by `MIN_QUERY_LENGTH = 3`.

- [ ] **Step 1: Title**

`bokusu-front/index.html`: `<title>Bokusu</title>`.

- [ ] **Step 2: Dead props + `any` in queue components**

In `QueueItem.tsx` remove `onRemove` and `removeDisabled` from `QueueItemProps` (they are destructured nowhere). In `QueuePage.tsx` remove those two props from the `<QueueItem>` call and type the download matcher:

```tsx
import type { DownloadItem } from '../types/api' // usar o tipo que useDownloads já retorna

const matches = (dl: DownloadItem | null | undefined) => {
  if (!dl) return false
  if (ytId && dl.url?.includes(ytId)) return true
  if (dl.title && item.title && dl.title.toLowerCase() === item.title.toLowerCase()) return true
  return false
}
```

(Use the actual element type of `downloads.pending` from `useDownloads`; if none exists, define it in `types/api.ts`.)

- [ ] **Step 3: Hardcoded string in random modal**

In `QueuePage.tsx:183` replace `Quantidade (1-20):` with `{t('queue.randomAmount')}`. Add to locales: en `"randomAmount": "Amount (1-20):"`, pt-BR `"randomAmount": "Quantidade (1-20):"`.

- [ ] **Step 4: Deduplicate autocomplete hook + minimum query length**

Delete `useAutocomplete.ts`. In `SearchPage.tsx` import `useSearchAutocomplete` from `../hooks/useSearch` and rename usage (`const { data: suggestions = [] } = useSearchAutocomplete(debouncedQuery)`). In `useSearch.ts` gate both hooks:

```ts
const MIN_QUERY_LENGTH = 3

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    enabled: query.length >= MIN_QUERY_LENGTH,
    queryFn: () => apiFetch<SearchResult[]>(`/api/search?q=${encodeURIComponent(query)}`),
  })
}
```

Apply the same `enabled` change to `useSearchAutocomplete`. Update `SearchPage.tsx:121` empty-state condition to `debouncedQuery.length >= 3`.

- [ ] **Step 5: Banner must not cover the song title overlay**

The banner renders top-center and overlaps the top-left title (seen in evaluation screenshot). In `NotificationBanner.tsx`, change the wrapper positioning classes from top-center to below-title right side, e.g. `absolute top-6 right-6 z-40 max-w-md` (keep existing animation classes). Visual-only change; adjust its test if it asserts classes.

- [ ] **Step 6: CLAUDE.md run command**

In `CLAUDE.md` Commands section, replace `uv run python run.py` with:

```bash
# Backend (Flask)
uv run pikaraoke                       # produção local (abre browser kiosk na TV)
uv run pikaraoke --hide-splash-screen  # desenvolvimento/testes (sem browser automático)
```

- [ ] **Step 7: Run full frontend suite + lint**

Run: `cd bokusu-front && npx vitest run && npm run lint`
Expected: PASS. Fix fallout from removed props/hook (imports in tests referencing `useAutocomplete`).

- [ ] **Step 8: Commit**

```bash
git add bokusu-front/index.html bokusu-front/src bokusu-front/src/locales CLAUDE.md
git rm bokusu-front/src/hooks/useAutocomplete.ts bokusu-front/src/hooks/useAutocomplete.test.tsx
git commit -m "chore: minor UI fixes — title, i18n, dead props, search min length, banner position"
```

---

### Task 11: Full verification pass

**Files:** none new.

- [ ] **Step 1: Full test suites**

Run: `uv run pytest && cd bokusu-front && npx vitest run && npm run build`
Expected: all PASS, build clean.

- [ ] **Step 2: Pre-commit**

Run: `uv run pre-commit run --all-files`
Expected: clean (Black/isort/pylint etc.).

- [ ] **Step 3: Manual smoke (test plan for the PR)**

Start `uv run pikaraoke --hide-splash-screen`, open `/player` (TV) + a second tab (remote):

- [ ] Queue local song from search suggestion as guest → plays on TV.
- [ ] Pause 6 min → resume → playback continues (Task 1).
- [ ] Navigate TV tab `/player` → `/queue` → `/player` → controls still work, song ends normally (Task 2).
- [ ] F5 on `/library` as admin → no redirect (Task 4).
- [ ] TV overlay shows "Próximo cantor:" translated (Task 5).
- [ ] `POST /api/queue` with bogus path → HTTP 400 (Task 6).
- [ ] Two rapid notifications → second one shows (Task 7).
- [ ] Change language to English → backend notification arrives in English (Task 8).
- [ ] QR on TV shows LAN IP, not localhost (Task 9).
- [ ] Browser tab title "Bokusu"; search only fires with 3+ chars (Task 10).
