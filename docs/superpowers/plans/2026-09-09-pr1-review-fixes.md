# Correções da Review do PR #1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir todos os achados da revisão do PR #1 (bugs, spec, standards) na branch `feat/tv-player`.

**Architecture:** Correções cirúrgicas backend-first (Flask `/api` + legacy), depois frontend SPA, depois limpeza de artefatos estáticos e rebuild. Cada tarefa fecha com teste + commit próprio.

**Tech Stack:** Flask/Flask-Smorest, itsdangerous (já dependência do Flask), pytest; React/TS, TanStack Query, vitest.

## Global Constraints

- Trabalhar SOMENTE na branch `feat/tv-player` (nunca `main`). Base: `origin/feat/tv-player` @ cd3d0e5.
- Baseline pre-commit conhecida: 4 falhas pré-existentes (ruff E402 em `routes/api/__init__.py`+`_utils.py`, ty unresolved import, osv-scanner uv.lock CVEs, check-json tsconfigs JSONC) — não persegui-las.
- Backend: type hints modernos (`str | None`), sem `from __future__`, exceções específicas, sem emoji, PEP 8.
- Frontend: TS estrito sem `any`; strings user-facing via i18n (`en.json` + `pt-BR.json`).
- Frontend tests: `cd bokusu-front && npx vitest run <file>`. Backend tests: `uv run pytest <file> -v`.
- Rebuild frontend obrigatório ao final (`npm run build`) → commita artefatos (`pikaraoke/templates/index.html` + `pikaraoke/static/assets/`), convenção do repo.
- Módulos backend em `pikaraoke/lib/` (song_manager, preference_manager, youtube_dl, current_app).

---

### Task 1: Corrigir import pendente de score phrases

**Files:**
- Modify: `pikaraoke/routes/api/preferences.py:35`
- Test: `tests/unit/api/test_preferences.py`

**Interfaces:**
- Produces: `PUT /api/preferences/{low,mid,high}_score_phrases` → 200 + broadcast `score_phrases_update` (payload `{low, mid, high}` de `routes.preferences._get_active_score_phrases`).

- [ ] **Step 1: Failing test** — adicionar a `tests/unit/api/test_preferences.py` (seguir pattern de patch de broadcast dos testes existentes e fixtures de `tests/unit/api/conftest.py`):

```python
def test_put_score_phrases_succeeds(client, admin_cookie, tmp_karaoke):
    resp = client.put(
        "/api/preferences/high_score_phrases",
        json={"value": "Parabens, Show, Bravo"},
        cookies={"admin": admin_cookie},
    )
    assert resp.status_code == 200
```

- [ ] **Step 2:** Run `uv run pytest tests/unit/api/test_preferences.py -k score_phrases -v` — Expected: FAIL com `ModuleNotFoundError: No module named 'pikaraoke.routes.splash'`.
- [ ] **Step 3: Fix** — `pikaraoke/routes/api/preferences.py:35`:

```python
# antes
from pikaraoke.routes.splash import _get_active_score_phrases
# depois
from pikaraoke.routes.preferences import _get_active_score_phrases
```

(Mesma origem do handler DELETE linha 51 e de `api/player.py:108`.)
- [ ] **Step 4:** Run `uv run pytest tests/unit/api/test_preferences.py -v` — Expected: PASS (todos).
- [ ] **Step 5:** Commit `git commit -am "fix: import score phrases helper from routes.preferences"`

### Task 2: Deletar rotas legacy órfãs e redirects pendentes

**Files:**
- Delete: `pikaraoke/routes/files.py` (renderiza `files.html`/`edit.html` deletados; único consumidor de `url_for("files.browse")` é ele mesmo — linhas 85, 91, 124, 153, 180)
- Modify: `pikaraoke/app.py:34-44` (remover import e registro de `files_bp`)
- Modify: `pikaraoke/routes/admin.py:67,180,189` — `url_for("info.info")` ×2 e `url_for("admin.login", next=next_url)` → `url_for("home.home")`
- Modify: `pikaraoke/routes/preferences.py:86,103` — `url_for("info.info")` → `url_for("home.home")`
- Test: `tests/unit/test_preference_routes.py` (novo teste); deletar `tests/unit/test_files_routes.py` se existir

**Interfaces:**
- Produces: nenhum redirect levanta `BuildError`; blueprint `files` deixa de existir; SPA catch-all (`home.home` → `/`) é o destino.

- [ ] **Step 1:** Confirmar ausência de outros consumidores: `git grep -n "files_bp\|files\.browse\|url_for(\"files" -- pikaraoke tests` — apenas `files.py` e `app.py` devem aparecer.
- [ ] **Step 2:** Deletar `pikaraoke/routes/files.py` + linhas correspondentes em `app.py`. Substituir nos 5 sites:

```python
# antes (admin.py:67,189; preferences.py:86,103)
return redirect(url_for("info.info"))
# depois
return redirect(url_for("home.home"))

# antes (admin.py:180)
return redirect(url_for("admin.login", next=next_url))
# depois
return redirect(url_for("home.home"))
```

- [ ] **Step 3:** Smoke test em `tests/unit/test_preference_routes.py`:

```python
def test_change_preferences_non_admin_redirects_to_home(client):
    resp = client.get("/change_preferences?pref=volume&val=0.5", follow_redirects=False)
    assert resp.status_code == 302
    assert resp.headers["Location"].endswith("/")
```

- [ ] **Step 4:** Run `uv run pytest tests/unit -k "preference or admin" -v` — Expected: PASS.
- [ ] **Step 5:** Commit `git commit -am "fix: remove orphan legacy files route and dangling url_for redirects"`

### Task 3: Path traversal guard nos endpoints de arquivo

**Files:**
- Modify: `pikaraoke/lib/song_manager.py` (novo método)
- Modify: `pikaraoke/routes/api/files.py:72-130` (DELETE + PATCH), `pikaraoke/routes/api/renamer.py:62-81`
- Test: `tests/unit/api/test_files.py`, `tests/unit/api/test_renamer.py`

**Interfaces:**
- Produces: `SongManager.is_path_in_library(path: str) -> bool` — True se resolved path fica sob `self.download_path`.

- [ ] **Step 1: Helper** em `pikaraoke/lib/song_manager.py`:

```python
def is_path_in_library(self, path: str) -> bool:
    """Check a resolved path stays under the song library directory."""
    try:
        library = os.path.realpath(self.download_path)
        candidate = os.path.realpath(path)
        return os.path.commonpath([candidate, library]) == library
    except ValueError:
        # different drives (Windows) — never contained
        return False
```

- [ ] **Step 2: Failing tests** — `tests/unit/api/test_files.py`:

```python
def test_delete_rejects_path_outside_library(client, admin_cookie):
    resp = client.delete("/api/files?song=/etc/passwd", cookies={"admin": admin_cookie})
    assert resp.status_code == 400

def test_rename_rejects_new_name_with_traversal(client, admin_cookie, sample_song):
    resp = client.patch(
        "/api/files",
        json={"old_file_name": sample_song, "new_file_name": "../../evil"},
        cookies={"admin": admin_cookie},
    )
    assert resp.status_code == 400
```

`tests/unit/api/test_renamer.py`:

```python
def test_rename_rejects_path_outside_library(client, admin_cookie):
    resp = client.post(
        "/api/renamer/rename",
        json={"old_name": "/etc/passwd", "new_name": "x"},
        cookies={"admin": admin_cookie},
    )
    assert resp.status_code == 400
```

(Adaptar às fixtures existentes de `tests/unit/api/conftest.py`; usar o padrão de criação de song dos testes `test_rename_delegates`/`test_rename_refuses_missing_file`.)

- [ ] **Step 3:** Run ambos — Expected: FAIL (hoje 404/500/200, não 400).
- [ ] **Step 4: Guards** — `api/files.py` `delete_file` (após `song = query["song"]`):

```python
if not k.song_manager.is_path_in_library(song):
    return jsonify({"error": "Path is outside the song library"}), 400
```

`api/files.py` `rename_file` (após `old_name = body["old_file_name"]`):

```python
if not k.song_manager.is_path_in_library(old_name):
    return jsonify({"error": "Path is outside the song library"}), 400
if os.path.basename(body["new_file_name"]) != body["new_file_name"] or body["new_file_name"] in (".", ".."):
    return jsonify({"error": "Invalid file name"}), 400
```

`api/renamer.py` `renamer_rename`: mesmo par (guard `old_name` com `is_path_in_library`; `new_name` com `basename` + `(".", "..")`).
- [ ] **Step 5:** Run `uv run pytest tests/unit/api/test_files.py tests/unit/api/test_renamer.py -v` — PASS (pré-existentes + novos).
- [ ] **Step 6:** Commit `git commit -am "fix: reject paths outside the song library in files and renamer APIs"`

### Task 4: `preferred_language` aceito pelo PUT de preferências

**Files:**
- Modify: `pikaraoke/lib/preference_manager.py:24` (DEFAULTS)
- Test: `tests/unit/api/test_preferences.py`

**Interfaces:**
- Consumes: `LanguageSection.tsx` já faz `PUT /api/preferences/preferred_language` (existe, testado frontend-side).
- Produces: PUT retorna 200 e persiste; `app.py:get_locale` lê via `get("preferred_language")`.

- [ ] **Step 1: Failing test:**

```python
def test_put_preferred_language(client, admin_cookie):
    resp = client.put(
        "/api/preferences/preferred_language",
        json={"value": "pt_BR"},
        cookies={"admin": admin_cookie},
    )
    assert resp.status_code == 200
```

- [ ] **Step 2:** Run — Expected: FAIL (404 hoje).
- [ ] **Step 3:** Adicionar ao DEFAULTS (primeira entrada — config global, não por-sessão):

```python
"preferred_language": "en",
```

Nota: `reset_all()` volta o idioma para `en` — aceito (reset de fábrica). `karaoke.py:215` continua funcionando.
- [ ] **Step 4:** Run `uv run pytest tests/unit/api/test_preferences.py tests/unit/test_preference_manager.py -v` — PASS. Se algum teste asserta conteúdo exato de DEFAULTS, atualizar a asserção.
- [ ] **Step 5:** Commit `git commit -am "fix: accept preferred_language in preferences API"`

### Task 5: Cookie admin assinado

**Files:**
- Modify: `pikaraoke/lib/current_app.py` (`is_admin` + novo helper)
- Modify: `pikaraoke/routes/api/auth.py:24-35`, `pikaraoke/routes/admin.py` (site legacy `set_cookie("admin", ...)`)
- Test: `tests/unit/api/test_auth.py` (ou criar), `tests/unit/test_admin_routes.py`

**Interfaces:**
- Produces: `admin_cookie_value(password: str) -> str` em `lib/current_app.py`; cookie `admin` carrega token itsdangerous (payload `{"p": sha256(password)}`, max_age 90d), verificado contra a senha atual.

- [ ] **Step 1: Pré-verificação:** `git grep -n "set_cookie" -- pikaraoke` — localizar TODOS os sites (esperado: `api/auth.py:34`, auth legacy em `routes/admin.py`, logout em `admin.py:189` limpa com `""`). Confirmar `SECRET_KEY`: `git grep -n "SECRET_KEY" -- pikaraoke` — se efêmero (gerado por boot), torná-lo persistido no diretório de config ANTES de prosseguir.
- [ ] **Step 2: Helper + is_admin** em `lib/current_app.py`:

```python
import hashlib
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

def _admin_serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="admin-cookie")

def admin_cookie_value(password: str) -> str:
    """Signed cookie token; never store the password itself."""
    return _admin_serializer().dumps({"p": hashlib.sha256(password.encode()).hexdigest()})
```

`is_admin()` (preservar comportamento atual de `password is None` → True): substituir comparação `cookie == password` por:

```python
token = request.cookies.get("admin")
if not token:
    return False
try:
    data = _admin_serializer().loads(token, max_age=90 * 24 * 3600)
except (BadSignature, SignatureExpired):
    return False
return data["p"] == hashlib.sha256(password.encode()).hexdigest()
```

- [ ] **Step 3: Setters** — `api/auth.py:33-34`:

```python
expires = datetime.datetime.now() + datetime.timedelta(days=90)
resp.set_cookie("admin", admin_cookie_value(admin_password), expires=expires)
```

Mesma troca no site legacy em `routes/admin.py` (Step 1 localizou). Logout (`""`) e `require_admin` não mudam.
- [ ] **Step 4: Tests** (adaptar nomes de fixtures às existentes; fixture `admin_cookie` do conftest passa a usar `admin_cookie_value`):

```python
def test_login_sets_signed_cookie_not_plaintext(client, tmp_karaoke):
    resp = client.post("/api/auth", json={"password": tmp_karaoke.admin_password})
    cookie = resp.headers["Set-Cookie"]
    assert tmp_karaoke.admin_password not in cookie

def test_signed_cookie_grants_admin(client, tmp_karaoke):
    from pikaraoke.lib.current_app import admin_cookie_value
    token = admin_cookie_value(tmp_karaoke.admin_password)
    assert client.get("/api/auth", cookies={"admin": token}).get_json()["isAdmin"] is True

def test_plaintext_password_cookie_rejected(client, tmp_karaoke):
    resp = client.get("/api/auth", cookies={"admin": tmp_karaoke.admin_password})
    assert resp.get_json()["isAdmin"] is False
```

- [ ] **Step 5:** Run `uv run pytest tests/unit -v` — PASS completo (cookies antigos invalidam → re-login; aceito).
- [ ] **Step 6:** Commit `git commit -am "fix: sign admin cookie with itsdangerous instead of plaintext password"`

### Task 6: Upgrade yt-dlp respeita o venv

**Files:**
- Modify: `pikaraoke/lib/youtube_dl.py:94-95`
- Test: `tests/unit/test_youtube_dl.py`

- [ ] **Step 1: Failing test** (estender tests existentes de `upgrade_youtubedl`):

```python
def test_upgrade_uses_uv_with_python_flag(mocker):
    mocker.patch("shutil.which", return_value="/usr/bin/uv")
    run = mocker.patch("subprocess.check_output", side_effect=subprocess.CalledProcessError(1, "yt-dlp", b"pip"))
    mocker.patch("pikaraoke.lib.youtube_dl.get_youtubedl_version", return_value="x")
    import sys as _sys
    upgrade_youtubedl()
    pip_cmd = [c for c in run.call_args_list if c.args[0][0] == "uv"][0].args[0]
    assert "--python" in pip_cmd and _sys.executable in pip_cmd
```

- [ ] **Step 2:** Run — FAIL (`--python` ausente).
- [ ] **Step 3:**

```python
# antes
pip_cmd = ["uv", "pip", "install", "--upgrade", "yt-dlp"]
# depois
pip_cmd = ["uv", "pip", "install", "--upgrade", "--python", sys.executable, "yt-dlp"]
```

- [ ] **Step 4:** Run `uv run pytest tests/unit/test_youtube_dl.py -v` — PASS.
- [ ] **Step 5:** Commit `git commit -am "fix: target current interpreter on uv pip yt-dlp upgrade"`

### Task 7: Queue API — deletar endpoints mortos, delegar moves

**Files:**
- Modify: `pikaraoke/routes/api/queue.py:56-74,96-129`
- Test: `tests/unit/api/test_queue.py` (remover `test_put_queue_item_admin`, `test_delete_queue_item_admin`)

**Interfaces:**
- Consumes: `QueueManager.move_to_top/move_to_bottom(song_path) -> bool` (:224/:235), `queue_edit(song_path, 'up'|'down') -> bool` (:273), `is_song_in_queue(song_path) -> bool` (:39).
- Produces: `PATCH /api/queue/item` sem iterar internals; `PUT/DELETE /api/queue/<item_id>` removidos (frontend nunca chamou — `useQueue.ts` confirma: usa `/reorder`, `/item` PATCH/DELETE?song, `/queue` DELETE, `/random`).

- [ ] **Step 1:** Deletar rotas `PUT /queue/<path:item_id>` e `DELETE /queue/<path:item_id>` + schemas exclusivos + os 2 testes correspondentes.
- [ ] **Step 2: Rewriter** `move_queue_item`:

```python
def move_queue_item(body: dict) -> tuple[Response, int] | Response:
    k = current_app.config["KARAOKE_INSTANCE"]
    song_path = body["song"]
    action = body["action"]

    if not k.queue_manager.is_song_in_queue(song_path):
        return jsonify({"error": "Song not found in queue"}), 404

    if action == "top":
        k.queue_manager.move_to_top(song_path)
    elif action == "bottom":
        k.queue_manager.move_to_bottom(song_path)
    elif action in ("up", "down"):
        k.queue_manager.queue_edit(song_path, action)
    else:
        return jsonify({"error": f"Unknown action: {action}"}), 400
    # False so ocorre como no-op (ja na posicao) — trata como sucesso
    return jsonify({"success": True})
```

- [ ] **Step 3:** Run `uv run pytest tests/unit/api/test_queue.py -v` — PASS (`test_move_queue_item_admin_success` cobre caminho feliz; ajustar mocks se patchavam lista interna).
- [ ] **Step 4:** Commit `git commit -am "refactor: queue item move delegates to QueueManager, drop unused item endpoints"`

### Task 8: Dead code frontend — useFiles e toast duplicado

**Files:**
- Delete: `bokusu-front/src/hooks/useFiles.ts`, `bokusu-front/src/hooks/useFiles.test.tsx`
- Modify: `bokusu-front/src/pages/SearchPage.tsx` (remover toast local linhas 18-19, 44-48, 160-166; usar `pushToast`)

**Interfaces:**
- Consumes: `useAppStore.pushToast(message, 'info' | 'success' | 'danger')`.

- [ ] **Step 1:** `rg -n "useFiles" bokusu-front/src` — só o próprio hook + teste. Deletar ambos.
- [ ] **Step 2: SearchPage** — remover `toastMessage`, `toastTimerRef`, `showToast`, bloco JSX `toastMessage && ...`. Adicionar `const pushToast = useAppStore((s) => s.pushToast)`. Trocar:

```tsx
// sucesso
showToast(t('search.addedToQueue'))  →  pushToast(t('search.addedToQueue'), 'success')
// erro (linhas 69, 124) — ganha severity correta
showToast(t('search.error'))  →  pushToast(t('search.error'), 'danger')
```

- [ ] **Step 3:** Run `cd bokusu-front && npx vitest run src/pages && npx tsc -b` — PASS/clean.
- [ ] **Step 4:** Commit `git commit -am "refactor: drop dead useFiles hook, SearchPage uses global toast"`

### Task 9: Eliminar `any` (7 arquivos)

**Files:**
- Modify: `bokusu-front/src/hooks/useSocketEvent.ts`; `pages/SettingsPage.tsx:33-35`; `pages/LibraryPage.tsx:64,81`; `components/settings/ServerPreferences.tsx:146,169,215,239` (+ assinatura em `hooks/usePreferences.ts`); `components/SystemPanel.tsx:174`; `components/RemoteDrawer.tsx:20`

**Interfaces:**
- Produces: `useSocketEvent<T = unknown>(eventName: string, callback: (data: T) => void)` (todos os emits do backend são payload único — verificado: queue_update/now_playing/notification/preferences_update/preferences_reset/score_phrases_update/sync_*/download_*/restart/playback_position/splash_role).

- [ ] **Step 1: useSocketEvent.ts:**

```ts
export function useSocketEvent<T = unknown>(eventName: string, callback: (data: T) => void) {
  const cbRef = useRef(callback)
  cbRef.current = callback
  useEffect(() => {
    const handler = (data: T) => cbRef.current(data)
    socket.on(eventName, handler)
    return () => {
      socket.off(eventName, handler)
    }
  }, [eventName])
}
```

- [ ] **Step 2: Casts i18n** — SettingsPage/SystemPanel: remover `as any`. Se `tsc -b` reclamar, tipar union:

```tsx
const THEME_KEYS = { aqua: 'settings.aqua', acid: 'settings.acid' } as const
// t(THEME_KEYS[themeName])
```

SystemPanel análogo: mapa `{ reboot: 'system.reboot', shutdown: 'system.shutdown', ... }` cobrindo valores de `confirmAction`.
- [ ] **Step 3: LibraryPage** — `onError: (err: any)` → `onError: (err: Error)` (2 sites; `err.message` direto).
- [ ] **Step 4: ServerPreferences** — alargar tipo do mutate em `hooks/usePreferences.ts`: `value: string | number | boolean`. Remover os 4 `as any`.
- [ ] **Step 5: RemoteDrawer** — `useRef<any>(null)` → `useRef<ReturnType<typeof setTimeout> | null>(null)`.
- [ ] **Step 6:** Run `cd bokusu-front && npx tsc -b && npx vitest run` — clean + PASS.
- [ ] **Step 7:** Commit `git commit -am "refactor: remove any types from hooks and components"`

### Task 10: Remover `high_quality` da UI (backend intacto)

**Files:**
- Modify: `bokusu-front/src/components/settings/ServerPreferences.tsx:34` (linha PrefToggle), `src/types/api.ts:46`, `src/locales/en.json:121`, `src/locales/pt-BR.json:121`

- [ ] **Step 1:** Remover a linha `<PrefToggle prefKey="high_quality" ... />`, campo `high_quality: boolean` do tipo e chaves `prefs.high_quality` dos 2 locales (teste de completude i18n acusta se faltar um lado).
- [ ] **Step 2:** Run `cd bokusu-front && npx vitest run && npx tsc -b` — PASS/clean.
- [ ] **Step 3:** Commit `git commit -am "chore: remove dead high_quality toggle from settings UI"`

### Task 11: Higiene Python (5 itens)

**Files:**
- Modify: `pikaraoke/routes/api/_utils.py:24-25` (imports `re`, `unicodedata` para o topo), `pikaraoke/routes/api/__init__.py` (literal tipado), `pikaraoke/routes/api/player.py` (7× `current_app.config[...]` → `get_karaoke_instance()`), `pikaraoke/routes/api/system.py:29`, `pikaraoke/routes/api/search.py:36-37`, `pyproject.toml:112`

- [ ] **Step 1: _utils.py** — mover `import re` / `import unicodedata` para o topo; deletar linhas 24-25.
- [ ] **Step 2: __init__.py:**

```python
api_blueprints: list[Blueprint] = [
    api_auth_bp, api_prefs_bp, api_player_bp, api_queue_bp, api_search_bp,
    api_downloads_bp, api_files_bp, api_renamer_bp, api_system_bp,
]
```

(substitui `list = []` + 9 `.append`; manter ordem atual).
- [ ] **Step 3: player.py** — `from pikaraoke.lib.current_app import get_karaoke_instance`; trocar 7 sites `k = current_app.config["KARAOKE_INSTANCE"]` por `k = get_karaoke_instance()`.
- [ ] **Step 4: system.py:29** — `except Exception:` → `except psutil.Error:`; search.py:36-37:

```python
from yt_dlp.utils import DownloadError
# ...
except DownloadError as exc:
    logging.error(f"Search failed: {exc}")
    return jsonify({"error": "Search failed"}), 500
```

(mensagem genérica pro cliente, detalhe no log — não vaza `str(exc)`).
- [ ] **Step 5: pyproject.toml** — deletar linha 112 (`batch_song_renamer.py` inexistente).
- [ ] **Step 6:** Run `uv run pytest tests/unit/api -v` — PASS; `uv run ruff check pikaraoke` — sem novos achados.
- [ ] **Step 7:** Commit `git commit -am "refactor: api module hygiene - imports, typing, specific exceptions"`

### Task 12: Purge estáticos órfãos + AGENTS.md

**Files:**
- Delete: `pikaraoke/static/fonts/` (Arial.ttf, DroidSansFallback.ttf), `pikaraoke/static/sounds/` (4 mp3), `pikaraoke/static/images/{microphone.png, now-playing.gif, now-playing.png, stage.jpg, ui-icons_*.png ×6}`, `pikaraoke/static/video/test_autoplay.mp4`
- Modify: `AGENTS.md:86`

**Interfaces:**
- Nenhum — conjunto verificado sem referências (backend, templates, frontend src). Manter: `icons/`, `images/{dolphly.png, logo.png}`, `music/`, `video/{night_sea,the_drive_by_visualdon}.mp4`, `favicon.svg`, `assets/`.

- [ ] **Step 1:** Re-verificar antes de cada `git rm`: `git grep -n "<nome>"` — zero hits obrigatório.
- [ ] **Step 2:** `git rm` dos listados.
- [ ] **Step 3: AGENTS.md:86** — `uv run pre-commit run --config code_quality/.pre-commit-config.yaml --all-files` → `uv run pre-commit run --all-files`.
- [ ] **Step 4:** Run `uv run pytest tests/unit -q` — PASS.
- [ ] **Step 5:** Commit `git commit -am "chore: purge unreferenced legacy static assets, fix pre-commit command in AGENTS.md"`

### Task 13: Rebuild frontend + verificação final

- [ ] **Step 1:** `cd bokusu-front && npm run build` — artefatos em `pikaraoke/templates/index.html` + `pikaraoke/static/assets/`; `git add` dos artefatos.
- [ ] **Step 2:** Full gate: `uv run pytest` (~775+ passed), `npx vitest run` (165+), `npx tsc -b`, `uv run pre-commit run --all-files` (baseline: mesmas 4 falhas pré-existentes, zero novas).
- [ ] **Step 3:** Commit `git commit -am "chore: rebuild frontend assets"`
- [ ] **Step 4:** Atualizar PR body #1: nota c9b7931 mantido deliberadamente + itens corrigidos; test plan com novos casos (cookie assinado, traversal 400, preferred_language 200).
