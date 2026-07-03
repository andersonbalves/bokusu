# TV Player (paridade total) e Purge do Legado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reprodução real de karaokê na tela da TV (`/player`) com paridade total com o `splash.js` legado, seguida do purge dos templates Jinja e assets estáticos legados.

**Architecture:** O backend já transcoda tudo via ffmpeg (rotas `/stream/*`); o frontend só reproduz `<video>`. A fonte de verdade do playback é o payload `now_playing` (socket + `GET /api/player`): mudança de `now_playing_url` inicia mídia, `is_paused`/`volume` são aplicados por diff. Máquina de estados `IDLE → LOADING → PLAYING → SCORING → IDLE` como hook puro testável. Dois complementos aditivos de backend: `GET /api/player/score-phrases` e `broadcast_event("restart")`.

**Tech Stack:** React + TypeScript (Vite), TanStack Query, socket.io-client, hls.js, libass-wasm (SubtitlesOctopus), qrcode.react, vitest + React Testing Library; Flask + flask-smorest + Marshmallow, pytest.

**Spec:** `docs/superpowers/specs/2026-07-02-tv-player-e-purge-design.md` (revisada em 2026-07-03 contra o código real).

## Global Constraints

- TypeScript estrito — sem `any`, sem type assertions sem justificativa (exceção preexistente: `useSocketEvent` usa `any[]` nos args).
- Componentes React funcionais; Zustand para estado de UI global; TanStack Query para estado de servidor — nunca misturar.
- TailwindCSS + DaisyUI; sem estilos inline (exceção: posições dinâmicas calculadas em runtime, ex. screensaver).
- Strings de UI via `react-i18next` (`pt-BR` e `en`); todo texto sobre vídeo usa a classe `text-outlined` existente.
- Python: type hints modernos (`str | None`), PEP 8, exceções específicas, sem `flash()`/redirect nas rotas `/api`.
- Erro de API JSON: `{"error": "<mensagem>"}` + status (403 sem admin, 422 validação).
- Testes frontend: vitest + RTL, colocados ao lado do arquivo (`X.test.tsx`). Backend: pytest em `tests/unit/api/`, I/O mockado, `PreferenceManager` real.
- Comandos: backend `uv run pytest <path> -v`; frontend `cd bokusu-front && npx vitest run <path>`.
- Nunca commitar em `main` — trabalhar em branch `feat/tv-player`.
- Rotas Python legadas ficam intocadas (mergeability com upstream); o purge deleta só templates e static.
- Commits frequentes: um por task, mensagem convencional (`feat:`, `chore:`, `test:`).

## Contexto essencial (leia antes de qualquer task)

Fatos do código real que as tasks assumem:

- `GET /api/player` responde `NowPlaying` (tipo já em `bokusu-front/src/types/api.ts`): `now_playing_url` (string com sufixo `.m3u8` ou `.mp4`, ou `null`), `now_playing_subtitle_url`, `is_paused`, `volume`, `up_next`, `next_user`, `now_playing_position`, etc.
- Hooks já existentes e funcionais: `useNowPlaying()` (query `['nowPlaying']`, atualizado pelo socket `now_playing`), `usePreferences()`, `useSocketEvent(name, cb)`, `useQueue()`.
- O evento socket `play` legado NÃO tem payload — não usar. Pause/skip/volume via `/api` propagam pelo próprio `now_playing`.
- Handlers socket do servidor (`pikaraoke/routes/socket_events.py`): `register_splash` → responde `splash_role` (`"master"`/`"slave"`); `start_song`; `end_song(reason)`; `clear_notification`; `playback_position(position)` (só aceito do master, rebroadcast para slaves).
- Rotas de mídia legadas (mantidas): `/stream/<id>.m3u8|.mp4`, `/stream/bg_video`, `/bg_playlist` (JSON array de URLs), `/bg_music/<file>`, `/subtitle/<id>`.
- Payload de `notification`: string `"mensagem::is-<cor>"` (cores: `info|success|warning|danger`) — mesmo parse do `ToastHost.tsx` existente.
- `PlayerLayout` (`src/layouts/PlayerLayout.tsx`) já envolve a rota `/player` com fullscreen preto.
- O `PlayerPage.tsx` atual só renderiza a splash (modos integration/cinematic) — vira o `IdleScreen` na Task 7.

---

### Task 1: Backend — `GET /api/player/score-phrases` + broadcast `restart`

**Files:**
- Modify: `pikaraoke/routes/api/player.py`
- Test: `tests/unit/api/test_player.py`

**Interfaces:**
- Consumes: `_get_active_score_phrases(k)` de `pikaraoke/routes/splash.py` (retorna `dict[str, list[str]]` com chaves `low`/`mid`/`high`); `broadcast_event(event)` de `pikaraoke/lib/current_app.py`.
- Produces: `GET /api/player/score-phrases` → `200 {"low": [...], "mid": [...], "high": [...]}` (público, sem admin); `POST /api/player/action {"action": "restart"}` passa a broadcastar o evento socket `restart` quando bem-sucedido.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `tests/unit/api/test_player.py`:

```python
from unittest.mock import patch


def test_get_score_phrases_public(client, fake_karaoke):
    resp = client.get("/api/player/score-phrases")
    assert resp.status_code == 200
    assert set(resp.json.keys()) == {"low", "mid", "high"}
    assert all(isinstance(v, list) and len(v) > 0 for v in resp.json.values())


def test_get_score_phrases_custom(client, fake_karaoke):
    fake_karaoke.high_score_phrases = "Incrivel!|Mandou bem!"
    resp = client.get("/api/player/score-phrases")
    assert resp.json["high"] == ["Incrivel!", "Mandou bem!"]


@patch("pikaraoke.routes.api.player.broadcast_event")
def test_post_player_action_restart_broadcasts_restart(mock_broadcast, admin_client, fake_karaoke):
    fake_karaoke.restart.return_value = True
    resp = admin_client.post("/api/player/action", json={"action": "restart"})
    assert resp.status_code == 200
    mock_broadcast.assert_called_once_with("restart")


@patch("pikaraoke.routes.api.player.broadcast_event")
def test_post_player_action_restart_failure_no_broadcast(
    mock_broadcast, admin_client, fake_karaoke
):
    fake_karaoke.restart.return_value = False
    resp = admin_client.post("/api/player/action", json={"action": "restart"})
    assert resp.status_code == 409
    mock_broadcast.assert_not_called()
```

Nota: o `fake_karaoke` da conftest roda `preferences.apply_all()` com `target=k`, então `low/mid/high_score_phrases` já existem como atributos (default `""` → o helper devolve as frases built-in traduzidas).

- [ ] **Step 2: Rodar e ver falhar**

Run: `uv run pytest tests/unit/api/test_player.py -v`
Expected: os 4 testes novos FALHAM (404 na rota nova; `broadcast_event` não chamado).

- [ ] **Step 3: Implementar**

Em `pikaraoke/routes/api/player.py`, adicionar o import no topo:

```python
from pikaraoke.lib.current_app import broadcast_event
```

Alterar o branch `restart` de `player_action`:

```python
    elif action == "restart":
        success = k.restart()
        if success:
            broadcast_event("restart")
```

Adicionar a rota no final do arquivo:

```python
@api_player_bp.route("/score-phrases", methods=["GET"])
def get_score_phrases():
    """Active score phrases for the TV score screen. Public: the TV is not an admin client."""
    from pikaraoke.routes.splash import _get_active_score_phrases

    k = current_app.config["KARAOKE_INSTANCE"]
    return jsonify(_get_active_score_phrases(k))
```

(Import dentro da função segue o padrão já usado em `routes/api/preferences.py` para o mesmo helper.)

- [ ] **Step 4: Rodar e ver passar**

Run: `uv run pytest tests/unit/api/test_player.py -v`
Expected: PASS em todos (novos e preexistentes).

- [ ] **Step 5: Commit**

```bash
git add pikaraoke/routes/api/player.py tests/unit/api/test_player.py
git commit -m "feat: score-phrases endpoint and restart broadcast in player API"
```

---

### Task 2: Tipo `ScorePhrases` + hook `useScorePhrases`

**Files:**
- Modify: `bokusu-front/src/types/api.ts`
- Create: `bokusu-front/src/hooks/useScorePhrases.ts`
- Test: `bokusu-front/src/hooks/useScorePhrases.test.tsx`

**Interfaces:**
- Consumes: `apiFetch` (`src/lib/api.ts`), `useSocketEvent` (`src/hooks/useSocketEvent.ts`), endpoint da Task 1.
- Produces: `interface ScorePhrases { low: string[]; mid: string[]; high: string[] }` em `types/api.ts`; `useScorePhrases(): UseQueryResult<ScorePhrases>` — usado pelo `ScoreScreen` (Task 6) e `PlayerPage` (Task 9).

- [ ] **Step 1: Escrever o teste que falha**

`bokusu-front/src/hooks/useScorePhrases.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useScorePhrases } from './useScorePhrases'
import type { ReactNode } from 'react'
import type { ScorePhrases } from '../types/api'

vi.mock('./useSocketEvent', () => ({ useSocketEvent: vi.fn() }))

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

afterEach(() => vi.unstubAllGlobals())

const mockPhrases: ScorePhrases = {
  low: ['Nunca mais cante.'],
  mid: ['Ok... só ok.'],
  high: ['Incrível!'],
}

test('useScorePhrases fetches from /api/player/score-phrases', async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockPhrases),
  })
  const { result } = renderHook(() => useScorePhrases(), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.high).toEqual(['Incrível!'])
  expect(fetch).toHaveBeenCalledWith('/api/player/score-phrases', expect.any(Object))
})

test('useScorePhrases subscribes to score_phrases_update', async () => {
  const { useSocketEvent } = await import('./useSocketEvent')
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockPhrases),
  })
  renderHook(() => useScorePhrases(), { wrapper })
  expect(useSocketEvent).toHaveBeenCalledWith('score_phrases_update', expect.any(Function))
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd bokusu-front && npx vitest run src/hooks/useScorePhrases.test.tsx`
Expected: FAIL — módulo `./useScorePhrases` não existe.

- [ ] **Step 3: Implementar**

Adicionar ao `bokusu-front/src/types/api.ts`:

```ts
export interface ScorePhrases {
  low: string[]
  mid: string[]
  high: string[]
}
```

`bokusu-front/src/hooks/useScorePhrases.ts`:

```ts
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { useSocketEvent } from './useSocketEvent'
import type { ScorePhrases } from '../types/api'

export function useScorePhrases() {
  const queryClient = useQueryClient()
  useSocketEvent('score_phrases_update', (phrases: ScorePhrases) => {
    queryClient.setQueryData(['scorePhrases'], phrases)
  })
  return useQuery({
    queryKey: ['scorePhrases'],
    queryFn: () => apiFetch<ScorePhrases>('/api/player/score-phrases'),
  })
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd bokusu-front && npx vitest run src/hooks/useScorePhrases.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add bokusu-front/src/types/api.ts bokusu-front/src/hooks/useScorePhrases.ts bokusu-front/src/hooks/useScorePhrases.test.tsx
git commit -m "feat: useScorePhrases hook with socket sync"
```

---

### Task 3: Hook `useSplashRole` (registro master/slave)

**Files:**
- Create: `bokusu-front/src/hooks/useSplashRole.ts`
- Test: `bokusu-front/src/hooks/useSplashRole.test.ts`

**Interfaces:**
- Consumes: `socket` de `src/lib/socket.ts`.
- Produces: `type SplashRole = 'master' | 'slave'`; `useSplashRole(): SplashRole | null` — `null` até o servidor responder. Usado pelo `PlayerPage` (Task 9). Emite `register_splash` a cada `connect` (cobre reconexões) e imediatamente se já conectado.

- [ ] **Step 1: Escrever o teste que falha**

`bokusu-front/src/hooks/useSplashRole.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react'

type Handler = (...args: unknown[]) => void
const handlers: Record<string, Handler[]> = {}
const emit = vi.fn()

vi.mock('../lib/socket', () => ({
  socket: {
    connected: true,
    emit: (...args: unknown[]) => emit(...args),
    on: (event: string, cb: Handler) => {
      handlers[event] = [...(handlers[event] ?? []), cb]
    },
    off: (event: string, cb: Handler) => {
      handlers[event] = (handlers[event] ?? []).filter((h) => h !== cb)
    },
  },
}))

import { useSplashRole } from './useSplashRole'

const fire = (event: string, ...args: unknown[]) => {
  for (const h of handlers[event] ?? []) h(...args)
}

beforeEach(() => {
  emit.mockClear()
  for (const key of Object.keys(handlers)) delete handlers[key]
})

test('registers as splash on mount when already connected', () => {
  const { result } = renderHook(() => useSplashRole())
  expect(emit).toHaveBeenCalledWith('register_splash')
  expect(result.current).toBeNull()
})

test('stores role from splash_role event', () => {
  const { result } = renderHook(() => useSplashRole())
  act(() => fire('splash_role', 'master'))
  expect(result.current).toBe('master')
})

test('re-registers on reconnect', () => {
  renderHook(() => useSplashRole())
  emit.mockClear()
  act(() => fire('connect'))
  expect(emit).toHaveBeenCalledWith('register_splash')
})

test('cleans up listeners on unmount', () => {
  const { unmount } = renderHook(() => useSplashRole())
  unmount()
  expect(handlers['connect'] ?? []).toHaveLength(0)
  expect(handlers['splash_role'] ?? []).toHaveLength(0)
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd bokusu-front && npx vitest run src/hooks/useSplashRole.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`bokusu-front/src/hooks/useSplashRole.ts`:

```ts
import { useEffect, useState } from 'react'
import { socket } from '../lib/socket'

export type SplashRole = 'master' | 'slave'

/** Registra a tela como splash no servidor e devolve o papel atribuído (master controla o playback). */
export function useSplashRole(): SplashRole | null {
  const [role, setRole] = useState<SplashRole | null>(null)

  useEffect(() => {
    const register = () => socket.emit('register_splash')
    const onRole = (assigned: SplashRole) => setRole(assigned)

    socket.on('connect', register)
    socket.on('splash_role', onRole)
    if (socket.connected) register()

    return () => {
      socket.off('connect', register)
      socket.off('splash_role', onRole)
    }
  }, [])

  return role
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd bokusu-front && npx vitest run src/hooks/useSplashRole.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add bokusu-front/src/hooks/useSplashRole.ts bokusu-front/src/hooks/useSplashRole.test.ts
git commit -m "feat: useSplashRole hook for master/slave splash election"
```

---

### Task 4: Hook `usePlayerStateMachine`

**Files:**
- Create: `bokusu-front/src/hooks/usePlayerStateMachine.ts`
- Test: `bokusu-front/src/hooks/usePlayerStateMachine.test.ts`

**Interfaces:**
- Consumes: `socket` de `src/lib/socket.ts`.
- Produces:

```ts
export type PlayerState = 'idle' | 'loading' | 'playing' | 'scoring'
export interface PlayerStateMachine {
  state: PlayerState
  mediaUrl: string | null
  handleCanPlay: () => void
  handleEnded: () => void
  handleError: () => void
  handleScoreFinished: () => void
}
export function usePlayerStateMachine(args: {
  nowPlayingUrl: string | null
  disableScore: boolean
  isMaster: boolean
}): PlayerStateMachine
```

Regras (da spec revisada): url nova → `loading`; `handleCanPlay` → `playing` + emite `start_song`; `handleEnded` → `scoring` (ou emite `end_song("complete")` direto se `disableScore`); `handleScoreFinished` → emite `end_song("complete")` → `idle`; `handleError` ou timeout de 10s em `loading` → emite `end_song("error")` → `idle`; url `null` durante `loading`/`playing` → `idle` sem emitir nada (skip veio do servidor); url `null` durante `scoring` NÃO corta o score; url nova durante `scoring` cancela o score e vai a `loading`. Slaves nunca emitem.

- [ ] **Step 1: Escrever os testes que falham**

`bokusu-front/src/hooks/usePlayerStateMachine.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react'

const emit = vi.fn()
vi.mock('../lib/socket', () => ({
  socket: { emit: (...args: unknown[]) => emit(...args) },
}))

import { usePlayerStateMachine } from './usePlayerStateMachine'

beforeEach(() => {
  emit.mockClear()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

const setup = (initialUrl: string | null = null, disableScore = false, isMaster = true) =>
  renderHook(
    ({ url }: { url: string | null }) =>
      usePlayerStateMachine({ nowPlayingUrl: url, disableScore, isMaster }),
    { initialProps: { url: initialUrl } }
  )

test('starts idle and enters loading on new url', () => {
  const { result, rerender } = setup()
  expect(result.current.state).toBe('idle')
  rerender({ url: '/stream/abc.m3u8' })
  expect(result.current.state).toBe('loading')
  expect(result.current.mediaUrl).toBe('/stream/abc.m3u8')
})

test('canplay moves to playing and emits start_song', () => {
  const { result, rerender } = setup()
  rerender({ url: '/stream/abc.m3u8' })
  act(() => result.current.handleCanPlay())
  expect(result.current.state).toBe('playing')
  expect(emit).toHaveBeenCalledWith('start_song')
})

test('slave never emits', () => {
  const { result, rerender } = setup(null, false, false)
  rerender({ url: '/stream/abc.m3u8' })
  act(() => result.current.handleCanPlay())
  act(() => result.current.handleEnded())
  act(() => result.current.handleScoreFinished())
  expect(emit).not.toHaveBeenCalled()
})

test('ended goes to scoring, scoreFinished emits end_song complete and returns to idle', () => {
  const { result, rerender } = setup()
  rerender({ url: '/stream/abc.m3u8' })
  act(() => result.current.handleCanPlay())
  act(() => result.current.handleEnded())
  expect(result.current.state).toBe('scoring')
  expect(emit).not.toHaveBeenCalledWith('end_song', expect.anything())
  act(() => result.current.handleScoreFinished())
  expect(emit).toHaveBeenCalledWith('end_song', 'complete')
  expect(result.current.state).toBe('idle')
})

test('ended with score disabled emits end_song complete directly', () => {
  const { result, rerender } = setup(null, true)
  rerender({ url: '/stream/abc.m3u8' })
  act(() => result.current.handleCanPlay())
  act(() => result.current.handleEnded())
  expect(emit).toHaveBeenCalledWith('end_song', 'complete')
  expect(result.current.state).toBe('idle')
})

test('error emits end_song error and returns to idle', () => {
  const { result, rerender } = setup()
  rerender({ url: '/stream/abc.m3u8' })
  act(() => result.current.handleCanPlay())
  act(() => result.current.handleError())
  expect(emit).toHaveBeenCalledWith('end_song', 'error')
  expect(result.current.state).toBe('idle')
})

test('loading timeout emits end_song error', () => {
  const { result, rerender } = setup()
  rerender({ url: '/stream/abc.m3u8' })
  act(() => vi.advanceTimersByTime(10_000))
  expect(emit).toHaveBeenCalledWith('end_song', 'error')
  expect(result.current.state).toBe('idle')
})

test('server-side skip (url null while playing) goes idle without emitting end_song', () => {
  const { result, rerender } = setup()
  rerender({ url: '/stream/abc.m3u8' })
  act(() => result.current.handleCanPlay())
  emit.mockClear()
  rerender({ url: null })
  expect(result.current.state).toBe('idle')
  expect(emit).not.toHaveBeenCalled()
})

test('url null during scoring does not cut the score', () => {
  const { result, rerender } = setup()
  rerender({ url: '/stream/abc.m3u8' })
  act(() => result.current.handleCanPlay())
  act(() => result.current.handleEnded())
  rerender({ url: null })
  expect(result.current.state).toBe('scoring')
})

test('new url during scoring cancels score and loads new media', () => {
  const { result, rerender } = setup()
  rerender({ url: '/stream/abc.m3u8' })
  act(() => result.current.handleCanPlay())
  act(() => result.current.handleEnded())
  rerender({ url: '/stream/next.m3u8' })
  expect(result.current.state).toBe('loading')
  expect(result.current.mediaUrl).toBe('/stream/next.m3u8')
})

test('stale callbacks are ignored outside their state', () => {
  const { result } = setup()
  act(() => result.current.handleEnded())
  act(() => result.current.handleScoreFinished())
  expect(result.current.state).toBe('idle')
  expect(emit).not.toHaveBeenCalled()
})

test('does not re-enter loading for the same url after the song ends', () => {
  // Após end_song o servidor demora alguns ms para zerar o now_playing;
  // a URL antiga ainda presente não pode recomeçar a música
  const { result, rerender } = setup(null, true)
  rerender({ url: '/stream/abc.m3u8' })
  act(() => result.current.handleCanPlay())
  act(() => result.current.handleEnded()) // disableScore: end_song direto + idle
  rerender({ url: '/stream/abc.m3u8' }) // rerender com a URL antiga ainda não limpa
  expect(result.current.state).toBe('idle')
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd bokusu-front && npx vitest run src/hooks/usePlayerStateMachine.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

`bokusu-front/src/hooks/usePlayerStateMachine.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { socket } from '../lib/socket'

export type PlayerState = 'idle' | 'loading' | 'playing' | 'scoring'

const LOADING_TIMEOUT_MS = 10_000

export interface PlayerStateMachine {
  state: PlayerState
  mediaUrl: string | null
  handleCanPlay: () => void
  handleEnded: () => void
  handleError: () => void
  handleScoreFinished: () => void
}

interface UsePlayerStateMachineArgs {
  nowPlayingUrl: string | null
  disableScore: boolean
  isMaster: boolean
}

/**
 * Máquina de estados da TV. Dirigida por diffs de now_playing_url — não pelo
 * evento socket `play` legado, que não tem payload. Slaves são espelho passivo
 * e nunca emitem eventos de controle.
 */
export function usePlayerStateMachine({
  nowPlayingUrl,
  disableScore,
  isMaster,
}: UsePlayerStateMachineArgs): PlayerStateMachine {
  const [state, setState] = useState<PlayerState>('idle')
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  // Última URL já tratada. Diferente de mediaUrl: sobrevive ao fim da música,
  // para a URL antiga (que o servidor ainda não limpou) não recomeçar o playback.
  const lastUrlRef = useRef<string | null>(null)

  const emitAsMaster = useCallback(
    (event: string, ...args: unknown[]) => {
      if (isMaster) socket.emit(event, ...args)
    },
    [isMaster]
  )

  useEffect(() => {
    if (nowPlayingUrl && nowPlayingUrl !== lastUrlRef.current) {
      lastUrlRef.current = nowPlayingUrl
      setMediaUrl(nowPlayingUrl)
      setState('loading')
    } else if (!nowPlayingUrl) {
      lastUrlRef.current = null
      if (stateRef.current !== 'idle' && stateRef.current !== 'scoring') {
        // Skip/stop vindo do servidor: sem score, sem end_song (o servidor já encerrou)
        setMediaUrl(null)
        setState('idle')
      }
    }
  }, [nowPlayingUrl])

  useEffect(() => {
    if (state !== 'loading') return
    const timer = setTimeout(() => {
      emitAsMaster('end_song', 'error')
      setMediaUrl(null)
      setState('idle')
    }, LOADING_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [state, mediaUrl, emitAsMaster])

  const handleCanPlay = useCallback(() => {
    if (stateRef.current !== 'loading') return
    emitAsMaster('start_song')
    setState('playing')
  }, [emitAsMaster])

  const handleEnded = useCallback(() => {
    if (stateRef.current !== 'playing') return
    if (disableScore) {
      emitAsMaster('end_song', 'complete')
      setMediaUrl(null)
      setState('idle')
    } else {
      setState('scoring')
    }
  }, [disableScore, emitAsMaster])

  const handleError = useCallback(() => {
    if (stateRef.current !== 'loading' && stateRef.current !== 'playing') return
    emitAsMaster('end_song', 'error')
    setMediaUrl(null)
    setState('idle')
  }, [emitAsMaster])

  const handleScoreFinished = useCallback(() => {
    if (stateRef.current !== 'scoring') return
    emitAsMaster('end_song', 'complete')
    setMediaUrl(null)
    setState('idle')
  }, [emitAsMaster])

  return { state, mediaUrl, handleCanPlay, handleEnded, handleError, handleScoreFinished }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd bokusu-front && npx vitest run src/hooks/usePlayerStateMachine.test.ts`
Expected: PASS (12 testes).

- [ ] **Step 5: Commit**

```bash
git add bokusu-front/src/hooks/usePlayerStateMachine.ts bokusu-front/src/hooks/usePlayerStateMachine.test.ts
git commit -m "feat: player state machine hook driven by now_playing diffs"
```

---

### Task 5: Dependências + `<KaraokePlayer />`

**Files:**
- Modify: `bokusu-front/package.json` (via npm install)
- Create: `bokusu-front/src/types/libass-wasm.d.ts`
- Create: `bokusu-front/src/assets/fonts/Arial.ttf`, `bokusu-front/src/assets/fonts/DroidSansFallback.ttf` (cópias)
- Create: `bokusu-front/src/components/player/KaraokePlayer.tsx`
- Test: `bokusu-front/src/components/player/KaraokePlayer.test.tsx`

**Interfaces:**
- Consumes: `useSocketEvent`, `socket`; hls.js; libass-wasm.
- Produces:

```ts
export interface KaraokePlayerProps {
  url: string
  subtitleUrl: string | null
  isPaused: boolean
  volume: number
  isMaster: boolean
  onCanPlay: () => void
  onEnded: () => void
  onError: () => void
}
export function KaraokePlayer(props: KaraokePlayerProps): JSX.Element
```

Elemento `<video>` com `data-testid="karaoke-video"`. HLS decidido por sufixo `.m3u8` da URL (hls.js quando sem suporte nativo); MP4 = `src` direto. Legendas via SubtitlesOctopus quando `subtitleUrl` presente. `restart` do socket → seek 0. Master emite `playback_position` a cada 1s; slave sincroniza quando drift > 2s.

- [ ] **Step 1: Instalar dependências e copiar assets**

```bash
cd bokusu-front && npm install hls.js libass-wasm
mkdir -p src/assets/fonts
cp ../pikaraoke/static/fonts/Arial.ttf ../pikaraoke/static/fonts/DroidSansFallback.ttf src/assets/fonts/
```

- [ ] **Step 2: Declarar tipos do libass-wasm**

`bokusu-front/src/types/libass-wasm.d.ts` (o pacote não publica types próprios):

```ts
declare module 'libass-wasm' {
  interface SubtitlesOctopusOptions {
    video: HTMLVideoElement
    subUrl: string
    fonts?: string[]
    workerUrl: string
  }

  export default class SubtitlesOctopus {
    constructor(options: SubtitlesOctopusOptions)
    dispose(): void
  }
}
```

- [ ] **Step 3: Escrever os testes que falham**

`bokusu-front/src/components/player/KaraokePlayer.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react'

const hlsInstance = { loadSource: vi.fn(), attachMedia: vi.fn(), destroy: vi.fn() }
vi.mock('hls.js', () => ({
  default: vi.fn(() => hlsInstance),
}))
vi.mock('libass-wasm', () => ({
  default: vi.fn(() => ({ dispose: vi.fn() })),
}))
const socketHandlers: Record<string, (...args: unknown[]) => void> = {}
vi.mock('../../hooks/useSocketEvent', () => ({
  useSocketEvent: (event: string, cb: (...args: unknown[]) => void) => {
    socketHandlers[event] = cb
  },
}))
const emit = vi.fn()
vi.mock('../../lib/socket', () => ({
  socket: { emit: (...args: unknown[]) => emit(...args) },
}))

import Hls from 'hls.js'
import SubtitlesOctopus from 'libass-wasm'
import { KaraokePlayer } from './KaraokePlayer'

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom não implementa play/pause de mídia
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  window.HTMLMediaElement.prototype.pause = vi.fn()
  window.HTMLMediaElement.prototype.load = vi.fn()
})

const baseProps = {
  url: '/stream/abc.mp4',
  subtitleUrl: null,
  isPaused: false,
  volume: 0.8,
  isMaster: true,
  onCanPlay: vi.fn(),
  onEnded: vi.fn(),
  onError: vi.fn(),
}

test('mp4 url is set directly as video src', () => {
  const { getByTestId } = render(<KaraokePlayer {...baseProps} />)
  const video = getByTestId('karaoke-video') as HTMLVideoElement
  expect(video.src).toContain('/stream/abc.mp4')
  expect(Hls).not.toHaveBeenCalled()
})

test('m3u8 url without native support goes through hls.js', () => {
  window.HTMLMediaElement.prototype.canPlayType = vi.fn().mockReturnValue('')
  render(<KaraokePlayer {...baseProps} url="/stream/abc.m3u8" />)
  expect(Hls).toHaveBeenCalled()
  expect(hlsInstance.loadSource).toHaveBeenCalledWith('/stream/abc.m3u8')
  expect(hlsInstance.attachMedia).toHaveBeenCalled()
})

test('subtitleUrl instantiates SubtitlesOctopus', () => {
  render(<KaraokePlayer {...baseProps} subtitleUrl="/subtitle/abc" />)
  expect(SubtitlesOctopus).toHaveBeenCalledWith(
    expect.objectContaining({ subUrl: '/subtitle/abc' })
  )
})

test('isPaused pauses the media element', () => {
  const { rerender, getByTestId } = render(<KaraokePlayer {...baseProps} />)
  rerender(<KaraokePlayer {...baseProps} isPaused={true} />)
  const video = getByTestId('karaoke-video') as HTMLVideoElement
  expect(video.pause).toHaveBeenCalled()
})

test('volume prop is applied to the media element', () => {
  const { getByTestId } = render(<KaraokePlayer {...baseProps} volume={0.3} />)
  const video = getByTestId('karaoke-video') as HTMLVideoElement
  expect(video.volume).toBe(0.3)
})

test('media events call the state machine callbacks', () => {
  const { getByTestId } = render(<KaraokePlayer {...baseProps} />)
  const video = getByTestId('karaoke-video')
  fireEvent(video, new Event('canplay'))
  fireEvent(video, new Event('ended'))
  fireEvent(video, new Event('error'))
  expect(baseProps.onCanPlay).toHaveBeenCalled()
  expect(baseProps.onEnded).toHaveBeenCalled()
  expect(baseProps.onError).toHaveBeenCalled()
})

test('restart socket event seeks to 0', () => {
  const { getByTestId } = render(<KaraokePlayer {...baseProps} />)
  const video = getByTestId('karaoke-video') as HTMLVideoElement
  video.currentTime = 42
  socketHandlers['restart']()
  expect(video.currentTime).toBe(0)
})

test('slave syncs position on playback_position drift > 2s', () => {
  const { getByTestId } = render(<KaraokePlayer {...baseProps} isMaster={false} />)
  const video = getByTestId('karaoke-video') as HTMLVideoElement
  video.currentTime = 10
  socketHandlers['playback_position'](20)
  expect(video.currentTime).toBe(20)
})

test('master ignores playback_position events', () => {
  const { getByTestId } = render(<KaraokePlayer {...baseProps} />)
  const video = getByTestId('karaoke-video') as HTMLVideoElement
  video.currentTime = 10
  socketHandlers['playback_position'](20)
  expect(video.currentTime).toBe(10)
})
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `cd bokusu-front && npx vitest run src/components/player/KaraokePlayer.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 5: Implementar**

`bokusu-front/src/components/player/KaraokePlayer.tsx`:

```tsx
import Hls from 'hls.js'
import SubtitlesOctopus from 'libass-wasm'
import { useEffect, useRef } from 'react'
import workerUrl from 'libass-wasm/dist/js/subtitles-octopus-worker.js?url'
import arialFontUrl from '../../assets/fonts/Arial.ttf?url'
import fallbackFontUrl from '../../assets/fonts/DroidSansFallback.ttf?url'
import { useSocketEvent } from '../../hooks/useSocketEvent'
import { socket } from '../../lib/socket'

const POSITION_HEARTBEAT_MS = 1000
const SLAVE_DRIFT_TOLERANCE_S = 2

export interface KaraokePlayerProps {
  url: string
  subtitleUrl: string | null
  isPaused: boolean
  volume: number
  isMaster: boolean
  onCanPlay: () => void
  onEnded: () => void
  onError: () => void
}

export function KaraokePlayer({
  url,
  subtitleUrl,
  isPaused,
  volume,
  isMaster,
  onCanPlay,
  onEnded,
  onError,
}: KaraokePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Carrega a mídia: hls.js para .m3u8 sem suporte nativo; src direto nos demais casos
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let hls: Hls | null = null
    if (url.endsWith('.m3u8') && !video.canPlayType('application/vnd.apple.mpegurl')) {
      hls = new Hls({ startPosition: 0 })
      hls.loadSource(url)
      hls.attachMedia(video)
    } else {
      video.src = url
    }
    void video.play().catch(() => {
      // Autoplay bloqueado: uma única nova tentativa (paridade com splash.js)
      setTimeout(() => void videoRef.current?.play().catch(() => undefined), 1000)
    })
    return () => {
      hls?.destroy()
      video.removeAttribute('src')
      video.load()
    }
  }, [url])

  // Legendas ASS (CDG e afins chegam como vídeo; ASS chega por now_playing_subtitle_url)
  useEffect(() => {
    const video = videoRef.current
    if (!video || !subtitleUrl) return
    const octopus = new SubtitlesOctopus({
      video,
      subUrl: subtitleUrl,
      fonts: [arialFontUrl, fallbackFontUrl],
      workerUrl,
    })
    return () => octopus.dispose()
  }, [subtitleUrl])

  // Pause/resume dirigido pelo is_paused do now_playing
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isPaused) video.pause()
    else void video.play().catch(() => undefined)
  }, [isPaused])

  useEffect(() => {
    const video = videoRef.current
    if (video) video.volume = volume
  }, [volume])

  useSocketEvent('restart', () => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = 0
    if (video.paused) void video.play().catch(() => undefined)
  })

  // Master: heartbeat de posição para sync de slaves e do transcode
  useEffect(() => {
    if (!isMaster) return
    const interval = setInterval(() => {
      const video = videoRef.current
      if (video && !video.paused && !video.ended) {
        socket.emit('playback_position', video.currentTime)
      }
    }, POSITION_HEARTBEAT_MS)
    return () => clearInterval(interval)
  }, [isMaster])

  // Slave: sincroniza com a posição reportada pelo master
  useSocketEvent('playback_position', (position: number) => {
    if (isMaster) return
    const video = videoRef.current
    if (video && Math.abs(video.currentTime - position) > SLAVE_DRIFT_TOLERANCE_S) {
      video.currentTime = position
    }
  })

  return (
    <video
      ref={videoRef}
      data-testid="karaoke-video"
      className="h-full w-full bg-black object-contain"
      onCanPlay={onCanPlay}
      onEnded={onEnded}
      onError={onError}
    />
  )
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd bokusu-front && npx vitest run src/components/player/KaraokePlayer.test.tsx`
Expected: PASS (9 testes). Se o vitest reclamar do import `?url` do worker, adicionar mock no topo do teste: `vi.mock('libass-wasm/dist/js/subtitles-octopus-worker.js?url', () => ({ default: '/worker.js' }))`.

- [ ] **Step 7: Commit**

```bash
git add bokusu-front/package.json bokusu-front/package-lock.json bokusu-front/src/types/libass-wasm.d.ts bokusu-front/src/assets/fonts bokusu-front/src/components/player/KaraokePlayer.tsx bokusu-front/src/components/player/KaraokePlayer.test.tsx
git commit -m "feat: KaraokePlayer component with hls.js and ASS subtitles"
```

---

### Task 6: Fireworks (port TS) + `<ScoreScreen />`

**Files:**
- Create: `bokusu-front/src/lib/fireworks.ts`
- Create: `bokusu-front/src/assets/sounds/applause-l.mp3`, `applause-m.mp3`, `applause-h.mp3`, `score-drums.mp3` (cópias)
- Create: `bokusu-front/src/components/player/ScoreScreen.tsx`
- Test: `bokusu-front/src/components/player/ScoreScreen.test.tsx`

**Interfaces:**
- Consumes: `ScorePhrases` (Task 2).
- Produces:
  - `launchFireworkShow(canvas: HTMLCanvasElement, score: number, durationMs?: number): () => void` — inicia o show, retorna função de cleanup.
  - `computeScore(random?: number): number` — nota 0–99 com viés para cima (paridade com `score.js`: `Math.pow(r, 1/2) * 99`).
  - `pickScoreAssets(score: number, phrases: ScorePhrases): { applause: string; phrase: string }` — cortes: `<30` low, `<60` mid, resto high.
  - `<ScoreScreen phrases={ScorePhrases} onFinished={() => void} />` — mostra número rodando com bateria (~3s), revela nota + frase + fireworks + aplausos; `onFinished` no `ended` do aplauso (fallback 15s).

- [ ] **Step 1: Copiar os sons**

```bash
mkdir -p bokusu-front/src/assets/sounds
cp pikaraoke/static/sounds/applause-l.mp3 pikaraoke/static/sounds/applause-m.mp3 pikaraoke/static/sounds/applause-h.mp3 pikaraoke/static/sounds/score-drums.mp3 bokusu-front/src/assets/sounds/
```

- [ ] **Step 2: Escrever os testes que falham**

`bokusu-front/src/components/player/ScoreScreen.test.tsx`:

```tsx
import { render, act, screen } from '@testing-library/react'
import type { ScorePhrases } from '../../types/api'

vi.mock('../../lib/fireworks', () => ({ launchFireworkShow: vi.fn(() => vi.fn()) }))
// Vite transforma .mp3 em URL; nos testes basta uma string
vi.mock('../../assets/sounds/applause-l.mp3', () => ({ default: '/applause-l.mp3' }))
vi.mock('../../assets/sounds/applause-m.mp3', () => ({ default: '/applause-m.mp3' }))
vi.mock('../../assets/sounds/applause-h.mp3', () => ({ default: '/applause-h.mp3' }))
vi.mock('../../assets/sounds/score-drums.mp3', () => ({ default: '/score-drums.mp3' }))

import { ScoreScreen, computeScore, pickScoreAssets } from './ScoreScreen'

class FakeAudio {
  static instances: FakeAudio[] = []
  src: string
  listeners: Record<string, () => void> = {}
  play = vi.fn().mockResolvedValue(undefined)
  pause = vi.fn()
  constructor(src: string) {
    this.src = src
    FakeAudio.instances.push(this)
  }
  addEventListener(event: string, cb: () => void) {
    this.listeners[event] = cb
  }
  removeEventListener(event: string) {
    delete this.listeners[event]
  }
}

const phrases: ScorePhrases = { low: ['fraco'], mid: ['ok'], high: ['brilhante'] }

beforeEach(() => {
  FakeAudio.instances = []
  vi.stubGlobal('Audio', FakeAudio)
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('computeScore is 0-99 with upward bias', () => {
  expect(computeScore(0)).toBe(0)
  expect(computeScore(0.25)).toBe(49) // sqrt(0.25) * 99 = 49.5
  expect(computeScore(1)).toBe(99)
})

test('pickScoreAssets picks tier by score', () => {
  expect(pickScoreAssets(10, phrases).phrase).toBe('fraco')
  expect(pickScoreAssets(45, phrases).phrase).toBe('ok')
  expect(pickScoreAssets(90, phrases).phrase).toBe('brilhante')
})

test('reveals score and phrase after rotation, finishes when applause ends', () => {
  const onFinished = vi.fn()
  render(<ScoreScreen phrases={phrases} onFinished={onFinished} />)
  // fase de rotação: bateria tocando, nota ainda não revelada
  expect(screen.queryByTestId('score-phrase')).toBeNull()
  act(() => vi.advanceTimersByTime(3000))
  expect(screen.getByTestId('score-phrase').textContent).not.toBe('')
  expect(onFinished).not.toHaveBeenCalled()
  // aplauso termina → onFinished
  const applause = FakeAudio.instances.find((a) => a.src.includes('applause'))
  act(() => applause?.listeners['ended']?.())
  expect(onFinished).toHaveBeenCalledTimes(1)
})

test('safety timeout finishes even if applause never ends', () => {
  const onFinished = vi.fn()
  render(<ScoreScreen phrases={phrases} onFinished={onFinished} />)
  act(() => vi.advanceTimersByTime(15_000))
  expect(onFinished).toHaveBeenCalled()
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd bokusu-front && npx vitest run src/components/player/ScoreScreen.test.tsx`
Expected: FAIL — módulos não existem.

- [ ] **Step 4: Implementar fireworks**

`bokusu-front/src/lib/fireworks.ts` (port do `pikaraoke/static/fireworks.js` legado):

```ts
interface Particle {
  x: number
  y: number
  angle: number
  speed: number
  radius: number
}

class Firework {
  particles: Particle[]

  constructor(
    x: number,
    y: number,
    private color: string
  ) {
    this.particles = Array.from({ length: 50 }, () => ({
      x,
      y,
      angle: Math.random() * 2 * Math.PI,
      speed: Math.random() * 2 + 1,
      radius: Math.random() * 6 + 3,
    }))
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const particle of this.particles) {
      particle.x += Math.cos(particle.angle) * particle.speed
      particle.y += Math.sin(particle.angle) * particle.speed
      particle.radius *= 0.98
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
      ctx.fillStyle = this.color
      ctx.fill()
    }
  }
}

/** Show de fogos proporcional à nota. Retorna função de cleanup que interrompe o show. */
export function launchFireworkShow(
  canvas: HTMLCanvasElement,
  score: number,
  durationMs = 5000
): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => undefined
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  let simultaneous = 3
  let intensity = 500
  if (score < 30) {
    simultaneous = 1
    intensity = 1300
  } else if (score < 60) {
    simultaneous = 2
    intensity = 800
  }

  const fireworks: Firework[] = []
  let animating = false
  let stopped = false
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const animate = () => {
    if (stopped) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (let i = fireworks.length - 1; i >= 0; i--) {
      fireworks[i].draw(ctx)
      fireworks[i].particles = fireworks[i].particles.filter((p) => p.radius > 0.5)
      if (fireworks[i].particles.length === 0) fireworks.splice(i, 1)
    }
    if (fireworks.length > 0) requestAnimationFrame(animate)
    else animating = false
  }

  const addFireworks = (count: number) => {
    for (let i = 0; i < count; i++) {
      fireworks.push(
        new Firework(
          Math.random() * canvas.width,
          Math.random() * canvas.height * 0.6,
          `hsl(${Math.random() * 360}, 100%, 60%)`
        )
      )
    }
    if (!animating) {
      animating = true
      requestAnimationFrame(animate)
    }
  }

  const startTime = Date.now()
  const launchInterval = () => {
    if (stopped || Date.now() - startTime > durationMs) return
    addFireworks(Math.floor(Math.random() * simultaneous) + simultaneous)
    timeoutId = setTimeout(launchInterval, Math.random() * intensity + 200)
  }
  launchInterval()

  return () => {
    stopped = true
    if (timeoutId) clearTimeout(timeoutId)
  }
}
```

- [ ] **Step 5: Implementar ScoreScreen**

`bokusu-front/src/components/player/ScoreScreen.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { launchFireworkShow } from '../../lib/fireworks'
import type { ScorePhrases } from '../../types/api'
import applauseLowUrl from '../../assets/sounds/applause-l.mp3'
import applauseMidUrl from '../../assets/sounds/applause-m.mp3'
import applauseHighUrl from '../../assets/sounds/applause-h.mp3'
import scoreDrumsUrl from '../../assets/sounds/score-drums.mp3'

const ROTATION_MS = 3000
const ROLL_INTERVAL_MS = 100
const SAFETY_TIMEOUT_MS = 15_000

/** Nota 0-99 com viés para cima (paridade com o score.js legado). */
export function computeScore(random: number = Math.random()): number {
  return Math.floor(Math.pow(random, 1 / 2) * 99)
}

function pickPhrase(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)] ?? ''
}

export function pickScoreAssets(
  score: number,
  phrases: ScorePhrases
): { applause: string; phrase: string } {
  if (score < 30) return { applause: applauseLowUrl, phrase: pickPhrase(phrases.low) }
  if (score < 60) return { applause: applauseMidUrl, phrase: pickPhrase(phrases.mid) }
  return { applause: applauseHighUrl, phrase: pickPhrase(phrases.high) }
}

interface ScoreScreenProps {
  phrases: ScorePhrases
  onFinished: () => void
}

export function ScoreScreen({ phrases, onFinished }: ScoreScreenProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onFinishedRef = useRef(onFinished)
  onFinishedRef.current = onFinished
  const [rollingNumber, setRollingNumber] = useState(0)
  const [revealed, setRevealed] = useState<{ score: number; phrase: string } | null>(null)

  useEffect(() => {
    const score = computeScore()
    const { applause, phrase } = pickScoreAssets(score, phrases)

    const drums = new Audio(scoreDrumsUrl)
    void drums.play().catch(() => undefined)
    const roll = setInterval(() => setRollingNumber(Math.floor(Math.random() * 100)), ROLL_INTERVAL_MS)

    const applauseAudio = new Audio(applause)
    const finish = () => onFinishedRef.current()
    applauseAudio.addEventListener('ended', finish)
    const safety = setTimeout(finish, SAFETY_TIMEOUT_MS)

    let stopFireworks: () => void = () => undefined
    const reveal = setTimeout(() => {
      clearInterval(roll)
      drums.pause()
      setRevealed({ score, phrase })
      if (canvasRef.current) stopFireworks = launchFireworkShow(canvasRef.current, score)
      void applauseAudio.play().catch(() => undefined)
    }, ROTATION_MS)

    return () => {
      clearInterval(roll)
      clearTimeout(reveal)
      clearTimeout(safety)
      applauseAudio.removeEventListener('ended', finish)
      applauseAudio.pause()
      drums.pause()
      stopFireworks()
    }
  }, [phrases])

  return (
    <div
      data-testid="score-screen"
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-black"
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />
      <p className="text-outlined font-display text-4xl font-bold uppercase tracking-widest text-white">
        {t('player.yourScore')}
      </p>
      <p
        data-testid="score-number"
        className="text-outlined font-display text-[10rem] font-bold leading-none text-white"
      >
        {String(revealed?.score ?? rollingNumber).padStart(2, '0')}
      </p>
      {revealed && (
        <p data-testid="score-phrase" className="text-outlined max-w-3xl text-center text-3xl text-white/90">
          {revealed.phrase}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd bokusu-front && npx vitest run src/components/player/ScoreScreen.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 7: Adicionar as chaves i18n**

Em `bokusu-front/src/locales/pt-BR.json`, dentro do objeto `player`: `"yourScore": "Sua nota"`.
Em `bokusu-front/src/locales/en.json`, dentro do objeto `player`: `"yourScore": "Your score"`.

- [ ] **Step 8: Commit**

```bash
git add bokusu-front/src/lib/fireworks.ts bokusu-front/src/assets/sounds bokusu-front/src/components/player/ScoreScreen.tsx bokusu-front/src/components/player/ScoreScreen.test.tsx bokusu-front/src/locales
git commit -m "feat: score screen with fireworks port and bundled applause audio"
```

---

### Task 7: IDLE completo — `IdleScreen`, relógio, screensaver, mídia de fundo

**Files:**
- Create: `bokusu-front/src/lib/url.ts` (helper `extractHost` movido do PlayerPage)
- Create: `bokusu-front/src/components/player/SplashClock.tsx`
- Create: `bokusu-front/src/components/player/Screensaver.tsx`
- Create: `bokusu-front/src/components/player/BackgroundMedia.tsx`
- Create: `bokusu-front/src/components/player/IdleScreen.tsx` (conteúdo movido do `PlayerPage.tsx` atual)
- Test: `bokusu-front/src/components/player/IdleScreen.test.tsx`, `bokusu-front/src/components/player/BackgroundMedia.test.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `useQuery`, `QueueItem`; `QRCodeSVG` de `qrcode.react` (já instalado); chaves i18n `player.scanToSing`/`player.upNext` (já existem).
- Produces:

```ts
export function extractHost(url: string): string // lib/url.ts

interface IdleScreenProps {
  appUrl: string
  mode: 'integration' | 'cinematic'
  upcoming: QueueItem[]
  hideUrl: boolean
  showClock: boolean
  screensaverTimeout: number   // segundos; 0 desativa
  disableBgMusic: boolean
  disableBgVideo: boolean
  bgMusicVolume: number
  isLoading: boolean           // true em LOADING: mantém splash + spinner
}
export function IdleScreen(props: IdleScreenProps): JSX.Element
```

- [ ] **Step 1: Escrever os testes que falham**

`bokusu-front/src/components/player/BackgroundMedia.test.tsx`:

```tsx
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { BackgroundMedia } from './BackgroundMedia'

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  window.HTMLMediaElement.prototype.pause = vi.fn()
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(['/bg_music/a.mp3', '/bg_music/b.mp3']),
  })
})
afterEach(() => vi.unstubAllGlobals())

const baseProps = {
  active: true,
  disableBgMusic: false,
  disableBgVideo: false,
  bgMusicVolume: 0.5,
}

test('plays bg music from /bg_playlist when active', async () => {
  const { getByTestId } = render(<BackgroundMedia {...baseProps} />, { wrapper })
  const audio = getByTestId('bg-music') as HTMLAudioElement
  await waitFor(() => expect(audio.src).toContain('/bg_music/a.mp3'))
  expect(audio.play).toHaveBeenCalled()
  expect(audio.volume).toBe(0.5)
})

test('pauses bg music when inactive', async () => {
  const { getByTestId, rerender } = render(<BackgroundMedia {...baseProps} />, { wrapper })
  rerender(<BackgroundMedia {...baseProps} active={false} />)
  const audio = getByTestId('bg-music') as HTMLAudioElement
  await waitFor(() => expect(audio.pause).toHaveBeenCalled())
})

test('does not play when disableBgMusic', async () => {
  const { getByTestId } = render(
    <BackgroundMedia {...baseProps} disableBgMusic={true} />,
    { wrapper }
  )
  const audio = getByTestId('bg-music') as HTMLAudioElement
  await waitFor(() => expect(fetch).toHaveBeenCalled())
  expect(audio.play).not.toHaveBeenCalled()
})

test('renders bg video loop unless disabled', () => {
  const { getByTestId, rerender, queryByTestId } = render(
    <BackgroundMedia {...baseProps} />,
    { wrapper }
  )
  expect(getByTestId('bg-video')).toBeTruthy()
  rerender(<BackgroundMedia {...baseProps} disableBgVideo={true} />)
  expect(queryByTestId('bg-video')).toBeNull()
})
```

`bokusu-front/src/components/player/IdleScreen.test.tsx` — portar os testes do `PlayerPage.test.tsx` atual (modos integration/cinematic, QR, upcoming) trocando o componente por `IdleScreen` com props explícitas, e adicionar:

```tsx
import { render, act, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { IdleScreen } from './IdleScreen'

vi.mock('./BackgroundMedia', () => ({ BackgroundMedia: () => null }))

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const baseProps = {
  appUrl: 'http://10.0.0.5:5555',
  mode: 'integration' as const,
  upcoming: [],
  hideUrl: false,
  showClock: true,
  screensaverTimeout: 30,
  disableBgMusic: true,
  disableBgVideo: true,
  bgMusicVolume: 0.5,
  isLoading: false,
}

test('shows QR code and host in integration mode', () => {
  render(<IdleScreen {...baseProps} />, { wrapper })
  expect(screen.getByTestId('qr-code')).toBeTruthy()
  expect(screen.getByText('10.0.0.5:5555')).toBeTruthy()
})

test('hideUrl hides the QR code', () => {
  render(<IdleScreen {...baseProps} hideUrl={true} />, { wrapper })
  expect(screen.queryByTestId('qr-code')).toBeNull()
})

test('shows clock when showClock', () => {
  render(<IdleScreen {...baseProps} />, { wrapper })
  expect(screen.getByTestId('splash-clock')).toBeTruthy()
})

test('screensaver appears after timeout and clears on prop change', () => {
  vi.useFakeTimers()
  const { rerender } = render(<IdleScreen {...baseProps} />, { wrapper })
  expect(screen.queryByTestId('screensaver')).toBeNull()
  act(() => vi.advanceTimersByTime(30_000))
  expect(screen.getByTestId('screensaver')).toBeTruthy()
  rerender(
    <IdleScreen
      {...baseProps}
      upcoming={[{ user: 'Alice', file: 'a.mp4', title: 'Song', semitones: 0 }]}
    />
  )
  expect(screen.queryByTestId('screensaver')).toBeNull()
  vi.useRealTimers()
})

test('screensaverTimeout 0 disables the screensaver', () => {
  vi.useFakeTimers()
  render(<IdleScreen {...baseProps} screensaverTimeout={0} />, { wrapper })
  act(() => vi.advanceTimersByTime(120_000))
  expect(screen.queryByTestId('screensaver')).toBeNull()
  vi.useRealTimers()
})

test('isLoading shows a loading indicator', () => {
  render(<IdleScreen {...baseProps} isLoading={true} />, { wrapper })
  expect(screen.getByTestId('player-loading')).toBeTruthy()
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd bokusu-front && npx vitest run src/components/player/IdleScreen.test.tsx src/components/player/BackgroundMedia.test.tsx`
Expected: FAIL — módulos não existem.

- [ ] **Step 3: Implementar os componentes**

`bokusu-front/src/lib/url.ts`:

```ts
export function extractHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
```

`bokusu-front/src/components/player/SplashClock.tsx`:

```tsx
import { useEffect, useState } from 'react'

export function SplashClock() {
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      data-testid="splash-clock"
      className="text-outlined absolute left-6 top-6 z-20 font-display text-3xl text-white"
    >
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </div>
  )
}
```

`bokusu-front/src/components/player/Screensaver.tsx` (port do bounce DVD do `screensaver.js` legado):

```tsx
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useRef } from 'react'
import { extractHost } from '../../lib/url'

const PALETTE = ['#ff8800', '#e124ff', '#6a19ff', '#ff2188']
const FPS = 30

interface ScreensaverProps {
  appUrl: string
  hideUrl: boolean
}

export function Screensaver({ appUrl, hideUrl }: ScreensaverProps) {
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    let x = 0
    let y = 0
    let dirX = 1
    let dirY = 1
    let colorIndex = 0
    let running = true

    const step = () => {
      if (!running) return
      setTimeout(() => {
        if (!running || !box.parentElement) return
        const { clientWidth: sw, clientHeight: sh } = box.parentElement
        if (y + box.clientHeight >= sh || y < 0) {
          dirY *= -1
          colorIndex = (colorIndex + 1) % PALETTE.length
        }
        if (x + box.clientWidth >= sw || x < 0) {
          dirX *= -1
          colorIndex = (colorIndex + 1) % PALETTE.length
        }
        x += dirX
        y += dirY
        box.style.left = `${x}px`
        box.style.top = `${y}px`
        box.style.backgroundColor = PALETTE[colorIndex]
        requestAnimationFrame(step)
      }, 1000 / FPS)
    }
    requestAnimationFrame(step)
    return () => {
      running = false
    }
  }, [])

  return (
    <div data-testid="screensaver" className="absolute inset-0 z-40 bg-black">
      <div ref={boxRef} className="absolute rounded-xl p-4" style={{ left: 0, top: 0 }}>
        {!hideUrl && (
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-lg bg-white p-2">
              <QRCodeSVG value={appUrl} size={96} />
            </div>
            <p className="text-outlined text-sm text-white">{extractHost(appUrl)}</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

`bokusu-front/src/components/player/BackgroundMedia.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../../lib/api'

interface BackgroundMediaProps {
  active: boolean
  disableBgMusic: boolean
  disableBgVideo: boolean
  bgMusicVolume: number
}

export function BackgroundMedia({
  active,
  disableBgMusic,
  disableBgVideo,
  bgMusicVolume,
}: BackgroundMediaProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const indexRef = useRef(0)
  const [bgVideoFailed, setBgVideoFailed] = useState(false)

  const { data: playlist = [] } = useQuery({
    queryKey: ['bgPlaylist'],
    queryFn: () => apiFetch<string[]>('/bg_playlist'),
    staleTime: Infinity,
  })

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (active && !disableBgMusic && playlist.length > 0) {
      if (!audio.getAttribute('src')) audio.src = playlist[0]
      audio.volume = bgMusicVolume
      void audio.play().catch(() => undefined)
    } else {
      audio.pause()
    }
  }, [active, disableBgMusic, bgMusicVolume, playlist])

  const playNext = () => {
    const audio = audioRef.current
    if (!audio || playlist.length === 0) return
    indexRef.current = (indexRef.current + 1) % playlist.length
    audio.src = playlist[indexRef.current]
    void audio.play().catch(() => undefined)
  }

  return (
    <>
      <audio ref={audioRef} data-testid="bg-music" onEnded={playNext} />
      {active && !disableBgVideo && !bgVideoFailed && (
        <video
          data-testid="bg-video"
          className="absolute inset-0 h-full w-full object-cover"
          src="/stream/bg_video"
          autoPlay
          muted
          loop
          onError={() => setBgVideoFailed(true)}
        />
      )}
    </>
  )
}
```

`bokusu-front/src/components/player/IdleScreen.tsx` — mover `IntegrationMode`/`CinematicMode` do `PlayerPage.tsx` atual para cá sem alterações visuais, aplicando `hideUrl` no bloco do QR, e compor:

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import { extractHost } from '../../lib/url'
import { BackgroundMedia } from './BackgroundMedia'
import { Screensaver } from './Screensaver'
import { SplashClock } from './SplashClock'
import type { QueueItem } from '../../types/api'

interface IdleScreenProps {
  appUrl: string
  mode: 'integration' | 'cinematic'
  upcoming: QueueItem[]
  hideUrl: boolean
  showClock: boolean
  screensaverTimeout: number
  disableBgMusic: boolean
  disableBgVideo: boolean
  bgMusicVolume: number
  isLoading: boolean
}

export function IdleScreen({
  appUrl,
  mode,
  upcoming,
  hideUrl,
  showClock,
  screensaverTimeout,
  disableBgMusic,
  disableBgVideo,
  bgMusicVolume,
  isLoading,
}: IdleScreenProps) {
  const { t } = useTranslation()
  const [screensaverActive, setScreensaverActive] = useState(false)

  // Screensaver: ativa após screensaverTimeout segundos ociosos; qualquer
  // mudança de fila/loading reinicia a contagem (mudança de estado desmonta a tela)
  useEffect(() => {
    setScreensaverActive(false)
    if (screensaverTimeout <= 0 || isLoading) return
    const timer = setTimeout(() => setScreensaverActive(true), screensaverTimeout * 1000)
    return () => clearTimeout(timer)
  }, [screensaverTimeout, isLoading, upcoming])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <BackgroundMedia
        active={!isLoading}
        disableBgMusic={disableBgMusic}
        disableBgVideo={disableBgVideo}
        bgMusicVolume={bgMusicVolume}
      />
      {mode === 'integration' ? (
        <IntegrationMode appUrl={appUrl} upcoming={upcoming} hideUrl={hideUrl} t={t} />
      ) : (
        <CinematicMode appUrl={appUrl} upcoming={upcoming} hideUrl={hideUrl} t={t} />
      )}
      {showClock && <SplashClock />}
      {isLoading && (
        <div
          data-testid="player-loading"
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/60"
        >
          <span className="loading loading-spinner loading-lg text-white" />
        </div>
      )}
      {screensaverActive && <Screensaver appUrl={appUrl} hideUrl={hideUrl} />}
    </div>
  )
}
```

(`IntegrationMode`/`CinematicMode`: copiar do `PlayerPage.tsx` atual, adicionando a prop `hideUrl: boolean` e envolvendo o bloco do QR + host com `{!hideUrl && (...)}`. O `PlayerPage.tsx` só será alterado na Task 9 — até lá o código antigo continua lá e o build permanece verde.)

- [ ] **Step 4: Rodar e ver passar**

Run: `cd bokusu-front && npx vitest run src/components/player/IdleScreen.test.tsx src/components/player/BackgroundMedia.test.tsx`
Expected: PASS (10 testes).

- [ ] **Step 5: Commit**

```bash
git add bokusu-front/src/lib/url.ts bokusu-front/src/components/player/SplashClock.tsx bokusu-front/src/components/player/Screensaver.tsx bokusu-front/src/components/player/BackgroundMedia.tsx bokusu-front/src/components/player/IdleScreen.tsx bokusu-front/src/components/player/IdleScreen.test.tsx bokusu-front/src/components/player/BackgroundMedia.test.tsx
git commit -m "feat: idle screen with clock, screensaver and background media"
```

---

### Task 8: `<NotificationBanner />` (overlay de notificação da TV)

**Files:**
- Create: `bokusu-front/src/components/player/NotificationBanner.tsx`
- Test: `bokusu-front/src/components/player/NotificationBanner.test.tsx`

**Interfaces:**
- Consumes: `useSocketEvent`, `socket`. Payload `notification`: string `"mensagem::is-<cor>"`.
- Produces: `<NotificationBanner isMaster={boolean} hideNotifications={boolean} />`. Mostra banner com severidade; master emite `clear_notification` ao receber (paridade com splash.js); auto-dismiss em 8s; `hideNotifications` suprime a renderização (mas o master ainda limpa).

- [ ] **Step 1: Escrever os testes que falham**

`bokusu-front/src/components/player/NotificationBanner.test.tsx`:

```tsx
import { render, act, screen } from '@testing-library/react'

const socketHandlers: Record<string, (...args: unknown[]) => void> = {}
vi.mock('../../hooks/useSocketEvent', () => ({
  useSocketEvent: (event: string, cb: (...args: unknown[]) => void) => {
    socketHandlers[event] = cb
  },
}))
const emit = vi.fn()
vi.mock('../../lib/socket', () => ({
  socket: { emit: (...args: unknown[]) => emit(...args) },
}))

import { NotificationBanner } from './NotificationBanner'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

test('shows notification with severity and master clears it on the server', () => {
  render(<NotificationBanner isMaster={true} hideNotifications={false} />)
  act(() => socketHandlers['notification']('Pulando música::is-danger'))
  const banner = screen.getByTestId('tv-notification')
  expect(banner.textContent).toContain('Pulando música')
  expect(banner.className).toContain('alert-error')
  expect(emit).toHaveBeenCalledWith('clear_notification')
})

test('slave does not emit clear_notification', () => {
  render(<NotificationBanner isMaster={false} hideNotifications={false} />)
  act(() => socketHandlers['notification']('Oi::is-info'))
  expect(emit).not.toHaveBeenCalled()
})

test('auto-dismisses after 8s', () => {
  render(<NotificationBanner isMaster={true} hideNotifications={false} />)
  act(() => socketHandlers['notification']('Oi::is-info'))
  expect(screen.getByTestId('tv-notification')).toBeTruthy()
  act(() => vi.advanceTimersByTime(8000))
  expect(screen.queryByTestId('tv-notification')).toBeNull()
})

test('hideNotifications suppresses rendering', () => {
  render(<NotificationBanner isMaster={true} hideNotifications={true} />)
  act(() => socketHandlers['notification']('Oi::is-info'))
  expect(screen.queryByTestId('tv-notification')).toBeNull()
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd bokusu-front && npx vitest run src/components/player/NotificationBanner.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Implementar**

`bokusu-front/src/components/player/NotificationBanner.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useSocketEvent } from '../../hooks/useSocketEvent'
import { socket } from '../../lib/socket'

const DISMISS_MS = 8000

type Severity = 'info' | 'success' | 'danger'

interface NotificationBannerProps {
  isMaster: boolean
  hideNotifications: boolean
}

export function NotificationBanner({ isMaster, hideNotifications }: NotificationBannerProps) {
  const [notification, setNotification] = useState<{ message: string; severity: Severity } | null>(
    null
  )

  useSocketEvent('notification', (payload: unknown) => {
    if (typeof payload !== 'string') return
    const [message, color] = payload.split('::is-')
    let severity: Severity = 'info'
    if (color === 'success') severity = 'success'
    else if (color === 'danger' || color === 'warning') severity = 'danger'
    setNotification({ message, severity })
    // Paridade com splash.js: o master confirma o recebimento para o servidor limpar
    if (isMaster) socket.emit('clear_notification')
  })

  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(() => setNotification(null), DISMISS_MS)
    return () => clearTimeout(timer)
  }, [notification])

  if (!notification || hideNotifications) return null

  let alertClass = 'alert-info'
  if (notification.severity === 'success') alertClass = 'alert-success'
  else if (notification.severity === 'danger') alertClass = 'alert-error'

  return (
    <div
      data-testid="tv-notification"
      role="status"
      className={`alert ${alertClass} absolute left-1/2 top-6 z-50 w-auto max-w-3xl -translate-x-1/2 text-lg shadow-xl`}
    >
      {notification.message}
    </div>
  )
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd bokusu-front && npx vitest run src/components/player/NotificationBanner.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add bokusu-front/src/components/player/NotificationBanner.tsx bokusu-front/src/components/player/NotificationBanner.test.tsx
git commit -m "feat: TV notification banner overlay"
```

---

### Task 9: Integração no `PlayerPage`

**Files:**
- Modify: `bokusu-front/src/pages/PlayerPage.tsx` (reescrita: splash sai para `IdleScreen`, entra a máquina de estados)
- Modify: `bokusu-front/src/pages/PlayerPage.test.tsx` (reescrita)
- Modify: `bokusu-front/src/locales/pt-BR.json`, `bokusu-front/src/locales/en.json`
- Delete: testes de modos integration/cinematic do `PlayerPage.test.tsx` antigo (já portados ao `IdleScreen.test.tsx` na Task 7)

**Interfaces:**
- Consumes: tudo das Tasks 2–8: `useNowPlaying`, `usePreferences`, `useQueue`, `useScorePhrases`, `useSplashRole`, `usePlayerStateMachine`, `KaraokePlayer`, `ScoreScreen`, `IdleScreen`, `NotificationBanner`.
- Produces: `PlayerPage({ appUrl?: string })` — página completa da TV na rota `/player`.

- [ ] **Step 1: Escrever os testes que falham**

Reescrever `bokusu-front/src/pages/PlayerPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import type { NowPlaying, Preferences } from '../types/api'

const mockNowPlaying: Partial<NowPlaying> = {
  now_playing: null,
  now_playing_url: null,
  now_playing_subtitle_url: null,
  is_paused: false,
  volume: 0.8,
  up_next: null,
  next_user: null,
}
const mockPrefs: Partial<Preferences> = {
  splash_display_mode: 'integration',
  disable_score: false,
  hide_url: false,
  hide_overlay: false,
  hide_notifications: false,
  show_splash_clock: false,
  screensaver_timeout: 0,
  disable_bg_music: true,
  disable_bg_video: true,
  bg_music_volume: 0.5,
}

const nowPlayingState = { data: mockNowPlaying }
const prefsState = { data: mockPrefs }

vi.mock('../hooks/useNowPlaying', () => ({ useNowPlaying: () => nowPlayingState }))
vi.mock('../hooks/usePreferences', () => ({ usePreferences: () => prefsState }))
vi.mock('../hooks/useQueue', () => ({ useQueue: () => ({ data: [] }) }))
vi.mock('../hooks/useScorePhrases', () => ({
  useScorePhrases: () => ({ data: { low: ['a'], mid: ['b'], high: ['c'] } }),
}))
vi.mock('../hooks/useSplashRole', () => ({ useSplashRole: () => 'master' }))
vi.mock('../components/player/IdleScreen', () => ({
  IdleScreen: (props: { isLoading: boolean }) => (
    <div data-testid="idle-screen" data-loading={props.isLoading} />
  ),
}))
vi.mock('../components/player/KaraokePlayer', () => ({
  KaraokePlayer: (props: { url: string; onCanPlay: () => void }) => (
    <button data-testid="karaoke-video" data-url={props.url} onClick={props.onCanPlay} />
  ),
}))
vi.mock('../components/player/ScoreScreen', () => ({
  ScoreScreen: () => <div data-testid="score-screen" />,
}))
vi.mock('../components/player/NotificationBanner', () => ({
  NotificationBanner: () => <div data-testid="tv-notification-host" />,
}))

import { fireEvent } from '@testing-library/react'
import { PlayerPage } from './PlayerPage'

beforeEach(() => {
  nowPlayingState.data = { ...mockNowPlaying }
  prefsState.data = { ...mockPrefs }
})

test('renders idle screen when nothing is playing', () => {
  render(<PlayerPage appUrl="http://10.0.0.5:5555" />)
  expect(screen.getByTestId('idle-screen')).toBeTruthy()
  expect(screen.queryByTestId('karaoke-video')).toBeNull()
})

test('mounts KaraokePlayer in loading and shows it after canplay', () => {
  nowPlayingState.data = { ...mockNowPlaying, now_playing_url: '/stream/abc.m3u8' }
  render(<PlayerPage appUrl="http://10.0.0.5:5555" />)
  const video = screen.getByTestId('karaoke-video')
  expect(video.getAttribute('data-url')).toBe('/stream/abc.m3u8')
  // loading: idle screen ainda visível como fundo com spinner
  expect(screen.getByTestId('idle-screen').getAttribute('data-loading')).toBe('true')
  fireEvent.click(video) // dispara onCanPlay
  expect(screen.queryByTestId('idle-screen')).toBeNull()
})

test('playing overlay shows title and up next unless hide_overlay', () => {
  nowPlayingState.data = {
    ...mockNowPlaying,
    now_playing: 'Bohemian Rhapsody',
    now_playing_user: 'Alice',
    now_playing_url: '/stream/abc.m3u8',
    up_next: 'Hotel California',
    next_user: 'Bob',
  }
  render(<PlayerPage appUrl="http://10.0.0.5:5555" />)
  fireEvent.click(screen.getByTestId('karaoke-video'))
  expect(screen.getByText('Bohemian Rhapsody')).toBeTruthy()
  expect(screen.getByText(/Hotel California/)).toBeTruthy()

  prefsState.data = { ...mockPrefs, hide_overlay: true }
  render(<PlayerPage appUrl="http://10.0.0.5:5555" />)
})

test('always renders the notification banner host', () => {
  render(<PlayerPage appUrl="http://10.0.0.5:5555" />)
  expect(screen.getByTestId('tv-notification-host')).toBeTruthy()
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd bokusu-front && npx vitest run src/pages/PlayerPage.test.tsx`
Expected: FAIL — PlayerPage atual não tem máquina de estados.

- [ ] **Step 3: Reescrever o PlayerPage**

`bokusu-front/src/pages/PlayerPage.tsx` (substitui o conteúdo inteiro; `IntegrationMode`/`CinematicMode`/`extractHost` já moveram na Task 7):

```tsx
import { useTranslation } from 'react-i18next'
import { useNowPlaying } from '../hooks/useNowPlaying'
import { usePreferences } from '../hooks/usePreferences'
import { useQueue } from '../hooks/useQueue'
import { useScorePhrases } from '../hooks/useScorePhrases'
import { useSplashRole } from '../hooks/useSplashRole'
import { usePlayerStateMachine } from '../hooks/usePlayerStateMachine'
import { IdleScreen } from '../components/player/IdleScreen'
import { KaraokePlayer } from '../components/player/KaraokePlayer'
import { NotificationBanner } from '../components/player/NotificationBanner'
import { ScoreScreen } from '../components/player/ScoreScreen'
import type { NowPlaying, ScorePhrases } from '../types/api'

const EMPTY_PHRASES: ScorePhrases = { low: [], mid: [], high: [] }

interface PlayerPageProps {
  appUrl?: string
}

export function PlayerPage({ appUrl = window.location.origin }: PlayerPageProps) {
  const { data: nowPlaying } = useNowPlaying()
  const { data: preferences } = usePreferences()
  const { data: phrases } = useScorePhrases()
  const { data: queue = [] } = useQueue()
  const role = useSplashRole()
  const isMaster = role !== 'slave' // enquanto o servidor não responde, age como master (tela única)

  const machine = usePlayerStateMachine({
    nowPlayingUrl: nowPlaying?.now_playing_url ?? null,
    disableScore: preferences?.disable_score ?? false,
    isMaster,
  })

  return (
    <div className="relative h-full w-full">
      {(machine.state === 'idle' || machine.state === 'loading') && (
        <IdleScreen
          appUrl={appUrl}
          mode={preferences?.splash_display_mode ?? 'integration'}
          upcoming={queue.slice(0, 3)}
          hideUrl={preferences?.hide_url ?? false}
          showClock={preferences?.show_splash_clock ?? false}
          screensaverTimeout={preferences?.screensaver_timeout ?? 0}
          disableBgMusic={preferences?.disable_bg_music ?? false}
          disableBgVideo={preferences?.disable_bg_video ?? false}
          bgMusicVolume={preferences?.bg_music_volume ?? 0.5}
          isLoading={machine.state === 'loading'}
        />
      )}

      {(machine.state === 'loading' || machine.state === 'playing') &&
        machine.mediaUrl &&
        nowPlaying && (
          <div className={machine.state === 'playing' ? 'absolute inset-0' : 'invisible absolute inset-0'}>
            <KaraokePlayer
              url={machine.mediaUrl}
              subtitleUrl={nowPlaying.now_playing_subtitle_url}
              isPaused={nowPlaying.is_paused}
              volume={nowPlaying.volume}
              isMaster={isMaster}
              onCanPlay={machine.handleCanPlay}
              onEnded={machine.handleEnded}
              onError={machine.handleError}
            />
            {machine.state === 'playing' && !(preferences?.hide_overlay ?? false) && (
              <PlayingOverlay nowPlaying={nowPlaying} />
            )}
          </div>
        )}

      {machine.state === 'scoring' && (
        <ScoreScreen phrases={phrases ?? EMPTY_PHRASES} onFinished={machine.handleScoreFinished} />
      )}

      <NotificationBanner
        isMaster={isMaster}
        hideNotifications={preferences?.hide_notifications ?? false}
      />
    </div>
  )
}

function PlayingOverlay({ nowPlaying }: { nowPlaying: NowPlaying }) {
  const { t } = useTranslation()
  return (
    <>
      <div className="absolute left-6 top-6 z-30">
        <p className="text-outlined text-2xl font-bold text-white">{nowPlaying.now_playing}</p>
        {nowPlaying.now_playing_user && (
          <p className="text-outlined text-white/70">{nowPlaying.now_playing_user}</p>
        )}
      </div>
      {nowPlaying.up_next && (
        <div className="absolute bottom-6 left-6 z-30">
          <p className="text-outlined text-white/70">
            {t('player.upNext')}: {nowPlaying.up_next}
            {nowPlaying.next_user ? ` — ${nowPlaying.next_user}` : ''}
          </p>
        </div>
      )}
    </>
  )
}
```

Nota sobre `isMaster` antes da resposta do servidor: com uma única TV (caso normal), tratar `null` como master evita perder o `start_song` da primeira música. Uma segunda tela aberta recebe `slave` na resposta do `register_splash` antes de qualquer emissão relevante.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd bokusu-front && npx vitest run src/pages/PlayerPage.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 5: Rodar a suíte inteira do frontend + build**

Run: `cd bokusu-front && npx vitest run && npm run build`
Expected: todos os testes PASS; build sem erros de tipo. O build gera `pikaraoke/templates/index.html` e `pikaraoke/static/assets/` — commitar junto se o repo versiona esses artefatos (segue o padrão dos commits anteriores).

- [ ] **Step 6: Verificação manual (smoke)**

Rodar `uv run python run.py`, abrir `http://localhost:5555/player` numa aba e o app de gestão noutra; enfileirar uma música e verificar: vídeo toca, pause/skip/volume do celular funcionam, score aparece ao fim.

- [ ] **Step 7: Commit**

```bash
git add bokusu-front/src/pages/PlayerPage.tsx bokusu-front/src/pages/PlayerPage.test.tsx bokusu-front/src/locales pikaraoke/templates/index.html pikaraoke/static/assets
git commit -m "feat: TV player page with full playback state machine"
```

---

### Task 10: Purge do legado

**Pré-condição:** paridade validada em TV real — checklist de verificação manual da spec (seção "Erros e testes") executado e aprovado pelo usuário. NÃO executar esta task na mesma sessão sem essa confirmação explícita.

**Files:**
- Delete: `pikaraoke/templates/{base,batch-song-renamer,edit,files,home,info,queue,search,splash}.html`
- Delete: `pikaraoke/static/`: `bulma.min.css`, `bulma-dark.css`, `custom.css`, `score.css`, `score.js`, `screensaver.css`, `screensaver.js`, `fireworks.js`, `hls-1.6.15.min.js`, `jquery-3.7.1.min.js`, `js.cookie-3.0.5.min.js`, `selectize-0.12.6.min.js`, `selectize.min.css`, `socket.io-4.8.3.min.js`, `spa-navigation.js`, `js/` (inteiro), `fontello/`, `fonts/`, `sounds/`, `images/ui-icons_*.png`
- Keep: `static/assets/`, `favicon.svg`, `icons.svg`, `icons/`, `images/logo.png`, `images/dolphly.png`, `music/`, `video/`, `templates/index.html`

- [ ] **Step 1: Greps de pré-condição**

```bash
# 1. Templates: só as rotas Jinja órfãs (que ficam intocadas) podem referenciar os deletados
grep -rn "render_template" pikaraoke --include="*.py"
# Esperado: home.py -> index.html (mantido); splash.py, files.py, info.py, queue.py,
# search.py, admin.py, batch_song_renamer.py -> templates órfãos (rotas ficam, templates saem)

# 2. Nenhum código Python monta caminho para os assets deletados
grep -rn "url_for('static'\|url_for(\"static\"" pikaraoke --include="*.py"
# Esperado: nenhuma ocorrência fora de templates

# 3. Nada mantido (SPA, index.html gerado) referencia os assets deletados
grep -rln "bulma\|fontello\|splash.js\|screensaver\|selectize\|jquery\|subtitles-octopus\|spa-navigation\|score.js\|fireworks.js" pikaraoke/templates/index.html bokusu-front/src pikaraoke/static/assets 2>/dev/null
# Esperado: nenhuma ocorrência (os ports do frontend usam npm/assets bundled)

# 4. Confirmar que sounds/ e fonts/ foram de fato bundled (Tasks 5-6)
ls bokusu-front/src/assets/fonts bokusu-front/src/assets/sounds
```

Se qualquer grep devolver referência inesperada, PARAR e investigar antes de deletar.

- [ ] **Step 2: Deletar templates**

```bash
git rm pikaraoke/templates/base.html pikaraoke/templates/batch-song-renamer.html pikaraoke/templates/edit.html pikaraoke/templates/files.html pikaraoke/templates/home.html pikaraoke/templates/info.html pikaraoke/templates/queue.html pikaraoke/templates/search.html pikaraoke/templates/splash.html
```

- [ ] **Step 3: Deletar static legado**

```bash
git rm pikaraoke/static/bulma.min.css pikaraoke/static/bulma-dark.css pikaraoke/static/custom.css pikaraoke/static/score.css pikaraoke/static/score.js pikaraoke/static/screensaver.css pikaraoke/static/screensaver.js pikaraoke/static/fireworks.js pikaraoke/static/hls-1.6.15.min.js pikaraoke/static/jquery-3.7.1.min.js pikaraoke/static/js.cookie-3.0.5.min.js pikaraoke/static/selectize-0.12.6.min.js pikaraoke/static/selectize.min.css pikaraoke/static/socket.io-4.8.3.min.js pikaraoke/static/spa-navigation.js
git rm -r pikaraoke/static/js pikaraoke/static/fontello pikaraoke/static/fonts pikaraoke/static/sounds
git rm pikaraoke/static/images/ui-icons_444444_256x240.png pikaraoke/static/images/ui-icons_555555_256x240.png pikaraoke/static/images/ui-icons_777620_256x240.png pikaraoke/static/images/ui-icons_777777_256x240.png pikaraoke/static/images/ui-icons_cc0000_256x240.png pikaraoke/static/images/ui-icons_ffffff_256x240.png
# stage.jpg, microphone.png, now-playing.*: deletar SOMENTE se o grep do Step 1 confirmar
# que nada fora dos templates deletados os referencia
grep -rn "stage.jpg\|microphone.png\|now-playing" pikaraoke --include="*.py" bokusu-front/src
```

- [ ] **Step 4: Rebuild + suíte completa**

```bash
cd bokusu-front && npm run build && npx vitest run
cd .. && uv run pytest
uv run pre-commit run --all-files
```

Expected: build limpo, todos os testes PASS, pre-commit verde.

- [ ] **Step 5: Smoke manual pós-purge**

Rodar `uv run python run.py`; abrir `/`, `/player`, `/library`, `/settings` — nenhum 404 de asset no console do browser; player funcional.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: purge legacy Jinja templates and static assets"
```

---

## Test plan do PR (obrigatório no corpo do PR)

- [ ] TV real reproduzindo `.mp4` e `.zip` (CDG) — letras visíveis, áudio sincronizado
- [ ] Transpose no meio da música: stream reinicia com pitch novo
- [ ] Skip, pause, restart e volume a partir do celular (RemoteDrawer → `/api`)
- [ ] Score aparece com fireworks, frase e aplauso; suprimido com `disable_score`
- [ ] Screensaver após timeout; bg music/vídeo no idle; relógio com `show_splash_clock`
- [ ] Modos integração/cinemático trocados pelo celular refletem na TV via socket
- [ ] `hide_url` esconde QR; `hide_overlay` esconde overlays durante PLAYING
- [ ] Arquivo corrompido → TV emite `end_song("error")` e a fila avança sozinha
- [ ] Duas telas abertas: segunda vira espelho (sem eco de eventos)
- [ ] (Pós-purge) app completa funcional, build limpo, nenhum 404 de asset
