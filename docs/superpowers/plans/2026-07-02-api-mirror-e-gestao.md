# API Mirror e App de Gestão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Espelho REST `/api/*` aditivo no Flask + features restantes do app de gestão React (infra de dados, mini-player/remote, fila avançada, busca completa, arquivos locais, settings completo, i18n).

**Architecture:** Package novo `pikaraoke/routes/api/` com blueprints flask-smorest que delegam direto às classes de domínio (`Karaoke`, `QueueManager`, `PlaybackController`, `DownloadManager`, `PreferenceManager`). Frontend consome via `apiFetch` tipado + TanStack Query; socket.IO existente invalida caches. Rotas legadas ficam intocadas.

**Tech Stack:** Flask + flask-smorest + Marshmallow (backend); React 18, TypeScript estrito, TanStack Query v5, Zustand, @dnd-kit, react-i18next, TailwindCSS/DaisyUI (frontend); pytest e vitest+RTL (testes).

**Spec:** `docs/superpowers/specs/2026-07-02-api-mirror-e-gestao-design.md`

## Global Constraints

- Python 3.10+, type hints modernos (`str | None`), sem `from __future__ import annotations` novo.
- TypeScript estrito: sem `any`, sem type assertion não justificada.
- Zustand para estado de UI; TanStack Query para estado de servidor — nunca misturar.
- TailwindCSS + DaisyUI; sem inline styles. Ícones: `lucide-react` apenas, sem emoji.
- Rotas legadas do Flask NÃO são modificadas. Únicos toques fora de `pikaraoke/routes/api/`: registro de blueprints no `app.py` e a chave `splash_display_mode` em `PreferenceManager.DEFAULTS`.
- Erros da API: `{"error": "<mensagem>"}` + status (403 sem admin, 404, 422 validação). Sem `flash()`/redirect no `/api`.
- pytest: I/O e subprocess mockados; `PreferenceManager`/`EventSystem` reais.
- Nunca commitar em `main`. Branch de trabalho: `feat/data-layer` (ou nova a partir dela).
- Strings de UI novas: SEMPRE via i18n (`t('...')`) a partir da Task 11.

## Mapa de Paralelização (para subagents)

```
Fase 0 (serial):        T1 (scaffold API + fixture pytest)
                              │
Fase 1 ┌─ Lane Backend: T2 auth │ T3 preferences │ T4 player │ T5 queue   (4 subagents em paralelo)
       └─ Lane Front:   T6 apiFetch → T7 auth-front → {T8 usePreferences ∥ T9 useNowPlaying+hooks ∥ T10 toasts} ∥ T11 i18n
                        (Lane Front roda em paralelo à Lane Backend — testes mockam fetch, dependem só dos CONTRATOS)
════ CHECKPOINT A: code review estratégico (backend core + infra front) ════
Fase 2 (serial):        T12 MiniPlayer → T13 RemoteDrawer
Fase 3 ┌─ Lane Backend: T14 search+downloads │ T15 files │ T16 renamer │ T17 system   (4 subagents em paralelo)
       └─ Lane Front:   T18 fila DnD → T19 fila ações+downloads ∥ T20 busca completa
════ CHECKPOINT B: code review estratégico (features de fila/busca + backend restante) ════
Fase 4:                 T21 settings prefs ∥ T22 settings sistema ∥ T23 página library ∥ T24 página renamer
════ CHECKPOINT C: review final + verificação manual ════
```

Regras para o dispatcher:
- Tasks na mesma lane separadas por `│` ou `∥` são independentes entre si → um subagent por task, simultâneos.
- `→` indica dependência dura (aguardar conclusão).
- Lane Front da Fase 1 só depende de T6 internamente; NÃO espera a Lane Backend (contratos estão fixados neste plano).
- Code review APENAS nos checkpoints A, B e C — não entre tasks individuais.

## Contratos `/api/*` (fonte de verdade para todas as tasks)

| Endpoint | Req | Resp 200 | Admin? |
|---|---|---|---|
| `POST /api/auth` | `{"password": str}` | `{"isAdmin": true}` + cookie `admin` 90d | não |
| `GET /api/auth` | — | `{"isAdmin": bool}` | não |
| `GET /api/preferences` | — | `{"preferences": {<24 chaves + splash_display_mode>}}` | não |
| `PUT /api/preferences/<key>` | `{"value": str\|int\|float\|bool}` | `{"success": bool, "message": str}` | sim |
| `DELETE /api/preferences` | — | `{"success": bool, "message": str}` | sim |
| `GET /api/player` | — | payload de `k.get_now_playing()` (ver T4) | não |
| `GET /api/player/score-phrases` | — | `{"low": [str], "mid": [str], "high": [str]}` | não |
| `POST /api/player/skip` | — | `{"success": bool}` | não* |
| `POST /api/player/pause` | — | `{"success": bool}` | não* |
| `POST /api/player/restart` | — | `{"success": bool}` | não* |
| `PUT /api/player/volume` | `{"volume": float 0..1}` | `{"success": bool}` | não* |
| `PUT /api/player/transpose` | `{"semitones": int}` | `{"success": bool}` | não* |
| `GET /api/queue` | — | `{"queue": [{"user","file","title","semitones"}]}` | não |
| `POST /api/queue` | `{"song": str, "user": str}` | `{"success": bool, "message": str}` | não |
| `PUT /api/queue/reorder` | `{"old_index": int, "new_index": int}` | `{"success": bool}` | sim |
| `PATCH /api/queue/item` | `{"song": str, "action": "up"\|"down"\|"top"\|"bottom"}` | `{"success": bool}` | sim |
| `DELETE /api/queue/item?song=<path>` | — | `{"success": bool}` | sim |
| `DELETE /api/queue` | — | `{"success": true}` (limpar fila) | sim |
| `POST /api/queue/random` | `{"amount": int}` | `{"success": bool}` | sim |
| `GET /api/search?q=&non_karaoke=` | — | `{"results": [[title, url, id], ...]}` (shape do yt-dlp legado) | não |
| `GET /api/search/autocomplete?q=` | — | `[{"path","fileName","type"}]` | não |
| `GET /api/search/preview?url=` | — | `{"stream_url": str}` (500 se falhar) | não |
| `POST /api/downloads` | `{"song_url","song_added_by","song_title","queue": bool}` | `{"status": "ok"}` | não |
| `GET /api/downloads` | — | `{"active": {...}\|null, "pending": [...], "errors": [{"id",...}]}` | não |
| `DELETE /api/downloads/errors/<id>` | — | `{"success": bool}` | não |
| `GET /api/files/browse?q=&letter=&sort=&page=` | — | `{"files": [{"path","displayName"}], "total", "page", "perPage"}` | não |
| `PATCH /api/files` | `{"old_file_name": str, "new_file_name": str}` | `{"success": bool, "message": str}` | sim |
| `DELETE /api/files?song=<path>` | — | `{"success": bool, "message": str}` | sim |
| `GET /api/renamer/songs?page=&only_mismatched=` | — | `{"songs": [{"file","currentName","suggestedName","isEqual"}], "total", "page"}` | sim |
| `POST /api/renamer/rename` | `{"old_name": str, "new_name": str}` | `{"success": bool, "message": str}` | sim |
| `GET /api/system/info` | — | `{"cpu": str, "memory": str, "disk": str, "youtubedlVersion": str, "pikaraokeVersion": str}` | sim |
| `GET /api/system/library-stats` | — | `{"song_count": int}` | sim |
| `POST /api/system/update-ytdl` | — | `{"status": "started"}` | sim |
| `POST /api/system/sync-library` | — | `{"status": "started"\|"already_syncing"}` | sim |
| `POST /api/system/quit` \| `/shutdown` \| `/reboot` \| `/expand-fs` | — | `{"status": "started"}` | sim |

\* Controles de player não são admin-enforced no legado; espelhamos o comportamento (gate fica na UI, como hoje).

## File Structure

**Backend (tudo novo exceto 2 modificações):**
```
pikaraoke/routes/api/__init__.py     # lista api_blueprints
pikaraoke/routes/api/_utils.py       # decorator require_admin
pikaraoke/routes/api/auth.py         pikaraoke/routes/api/preferences.py
pikaraoke/routes/api/player.py       pikaraoke/routes/api/queue.py
pikaraoke/routes/api/search.py       pikaraoke/routes/api/downloads.py
pikaraoke/routes/api/files.py        pikaraoke/routes/api/renamer.py
pikaraoke/routes/api/system.py
pikaraoke/app.py                     # MODIFICAR: registrar api_blueprints
pikaraoke/lib/preference_manager.py  # MODIFICAR: splash_display_mode em DEFAULTS
tests/unit/api/conftest.py           # fixture app de teste
tests/unit/api/test_<módulo>.py      # um por módulo
```

**Frontend:**
```
src/lib/api.ts                       # MODIFICAR: ApiError tipado
src/lib/i18n.ts + src/locales/{pt-BR,en}.json
src/types/api.ts                     # MODIFICAR: tipos reais dos contratos
src/hooks/{usePreferences,useNowPlaying,usePlayerControls,useDownloads,useLibrary,useRenamer,useSystem}.ts
src/hooks/{useQueue,useSearch}.ts    # MODIFICAR: contratos reais
src/components/{MiniPlayer,RemoteDrawer,ToastHost,QueueActionsMenu,DownloadErrorsCard,PreviewModal,ConfirmModal}.tsx
src/components/settings/{ServerPreferences,SystemPanel,LanguageSection}.tsx
src/pages/{LibraryPage,RenamerPage}.tsx
src/store/useAppStore.ts             # MODIFICAR: toasts, remover playerMode local
src/layouts/AppLayout.tsx            # MODIFICAR: MiniPlayer + ToastHost
src/App.tsx                          # MODIFICAR: rotas /library, /library/renamer
```

---

### Task 1: Scaffold do package `/api` + fixture de testes

**Files:**
- Create: `pikaraoke/routes/api/__init__.py`, `pikaraoke/routes/api/_utils.py`
- Modify: `pikaraoke/app.py` (após o loop de `_internal_blueprints`)
- Create: `tests/unit/api/__init__.py`, `tests/unit/api/conftest.py`, `tests/unit/api/test_scaffold.py`

**Interfaces:**
- Produces: `require_admin` (decorator Flask que retorna `{"error": "Unauthorized"}, 403` se `is_admin()` falso); fixtures pytest `app`, `client`, `admin_client`, `fake_karaoke` (MagicMock com specs reais); lista `api_blueprints` em `pikaraoke.routes.api`.
- Todos os módulos T2–T5 e T14–T17 adicionam seu blueprint em `api_blueprints`.

- [ ] **Step 1: Escrever teste que falha**

```python
# tests/unit/api/test_scaffold.py
"""Tests for the /api scaffold: blueprint registry and admin guard."""


def test_api_blueprints_list_exists():
    from pikaraoke.routes.api import api_blueprints

    assert isinstance(api_blueprints, list)


def test_require_admin_blocks_without_cookie(client):
    resp = client.get("/api/_test_admin")
    assert resp.status_code == 403
    assert resp.get_json() == {"error": "Unauthorized"}


def test_require_admin_allows_with_cookie(admin_client):
    resp = admin_client.get("/api/_test_admin")
    assert resp.status_code == 200
```

```python
# tests/unit/api/conftest.py
"""Shared fixtures for /api route tests."""

from unittest.mock import MagicMock

import pytest
from flask import Flask
from flask_smorest import Api

from pikaraoke.lib.preference_manager import PreferenceManager


@pytest.fixture
def fake_karaoke(tmp_path):
    """Karaoke fake: PreferenceManager real (leve), resto MagicMock."""
    k = MagicMock()
    k.preferences = PreferenceManager(config_file_path=str(tmp_path / "config.ini"))
    k.volume = 0.85
    return k


@pytest.fixture
def app(fake_karaoke):
    app = Flask(__name__)
    app.secret_key = "test"
    app.config["API_TITLE"] = "test"
    app.config["API_VERSION"] = "0"
    app.config["OPENAPI_VERSION"] = "3.0.2"
    app.config["KARAOKE_INSTANCE"] = fake_karaoke
    app.config["ADMIN_PASSWORD"] = "secret"
    app.config["SITE_NAME"] = "PiKaraoke"
    api = Api(app)

    from pikaraoke.routes.api import api_blueprints

    for bp in api_blueprints:
        api.register_blueprint(bp)

    # Rota sentinela para testar o decorator isoladamente
    from pikaraoke.routes.api._utils import require_admin

    @app.route("/api/_test_admin")
    @require_admin
    def _test_admin():
        return {"ok": True}

    return app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def admin_client(app):
    c = app.test_client()
    c.set_cookie("admin", "secret")
    return c
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `uv run pytest tests/unit/api/ -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'pikaraoke.routes.api'`

- [ ] **Step 3: Implementar scaffold**

```python
# pikaraoke/routes/api/_utils.py
"""Shared helpers for the /api mirror blueprints."""

from collections.abc import Callable
from functools import wraps
from typing import Any

from flask import jsonify

from pikaraoke.lib.current_app import is_admin


def require_admin(fn: Callable[..., Any]) -> Callable[..., Any]:
    """Return 403 JSON when the request lacks the admin cookie."""

    @wraps(fn)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        if not is_admin():
            return jsonify({"error": "Unauthorized"}), 403
        return fn(*args, **kwargs)

    return wrapper
```

```python
# pikaraoke/routes/api/__init__.py
"""Additive /api mirror: clean JSON contracts delegating to domain classes.

Legacy routes stay untouched; only app.py registers these blueprints.
"""

api_blueprints: list = []
```

Em `pikaraoke/app.py`, logo após o loop `for bp in _internal_blueprints:`:

```python
from pikaraoke.routes.api import api_blueprints

for bp in api_blueprints:
    api.register_blueprint(bp)
```

- [ ] **Step 4: Rodar e ver passar**

Run: `uv run pytest tests/unit/api/ -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add pikaraoke/routes/api tests/unit/api pikaraoke/app.py
git commit -m "feat: scaffold additive /api blueprint package with admin guard"
```

---

### Task 2: `/api/auth` (Lane Backend — paralela com T3, T4, T5)

**Files:**
- Create: `pikaraoke/routes/api/auth.py`
- Modify: `pikaraoke/routes/api/__init__.py` (registrar blueprint)
- Test: `tests/unit/api/test_auth.py`

**Interfaces:**
- Consumes: `get_admin_password` de `pikaraoke.lib.current_app`.
- Produces: `POST /api/auth {"password"}` → 200 `{"isAdmin": true}` + cookie `admin` (90 dias, mesmo valor do legado) ou 403 `{"error": "Incorrect admin password"}`; `GET /api/auth` → `{"isAdmin": bool}`.

- [ ] **Step 1: Teste que falha**

```python
# tests/unit/api/test_auth.py
"""Tests for /api/auth."""


def test_get_auth_reports_admin_status(client, admin_client):
    assert client.get("/api/auth").get_json() == {"isAdmin": False}
    assert admin_client.get("/api/auth").get_json() == {"isAdmin": True}


def test_post_auth_correct_password_sets_cookie(client):
    resp = client.post("/api/auth", json={"password": "secret"})
    assert resp.status_code == 200
    assert resp.get_json() == {"isAdmin": True}
    cookie = next(h for h in resp.headers.getlist("Set-Cookie") if h.startswith("admin="))
    assert "admin=secret" in cookie


def test_post_auth_wrong_password_403(client):
    resp = client.post("/api/auth", json={"password": "nope"})
    assert resp.status_code == 403
    assert resp.get_json() == {"error": "Incorrect admin password"}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `uv run pytest tests/unit/api/test_auth.py -v`
Expected: FAIL — 404 nas rotas

- [ ] **Step 3: Implementar**

```python
# pikaraoke/routes/api/auth.py
"""Admin authentication endpoints for the /api mirror."""

import datetime

from flask import jsonify, make_response
from flask_smorest import Blueprint
from marshmallow import Schema, fields

from pikaraoke.lib.current_app import get_admin_password, is_admin

api_auth_bp = Blueprint("api_auth", __name__, url_prefix="/api")


class AuthBody(Schema):
    password = fields.String(required=True, metadata={"description": "Admin password"})


@api_auth_bp.route("/auth", methods=["GET"])
def auth_status():
    """Report whether the current request is authenticated as admin."""
    return jsonify({"isAdmin": is_admin()})


@api_auth_bp.route("/auth", methods=["POST"])
@api_auth_bp.arguments(AuthBody, location="json")
def auth_login(body):
    """Validate the admin password and set the legacy admin cookie."""
    admin_password = get_admin_password()
    if admin_password is not None and body["password"] != admin_password:
        return jsonify({"error": "Incorrect admin password"}), 403
    resp = make_response(jsonify({"isAdmin": True}))
    if admin_password is not None:
        expires = datetime.datetime.now() + datetime.timedelta(days=90)
        resp.set_cookie("admin", admin_password, expires=expires)
    return resp
```

Em `pikaraoke/routes/api/__init__.py`:

```python
from pikaraoke.routes.api.auth import api_auth_bp

api_blueprints: list = [api_auth_bp]
```

- [ ] **Step 4: Rodar e ver passar**

Run: `uv run pytest tests/unit/api/ -v`
Expected: todos passam

- [ ] **Step 5: Commit**

```bash
git add pikaraoke/routes/api tests/unit/api/test_auth.py
git commit -m "feat: add /api/auth login and status endpoints"
```

---

### Task 3: `/api/preferences` + `splash_display_mode` (Lane Backend — paralela)

**Files:**
- Create: `pikaraoke/routes/api/preferences.py`
- Modify: `pikaraoke/lib/preference_manager.py` (uma linha em DEFAULTS), `pikaraoke/routes/api/__init__.py`
- Test: `tests/unit/api/test_preferences.py`

**Interfaces:**
- Consumes: `require_admin`; `k.preferences` (PreferenceManager real na fixture); `broadcast_event`; `_get_active_score_phrases` de `pikaraoke.routes.splash`.
- Produces: `GET /api/preferences` → `{"preferences": {...}}` com TODAS as chaves de `PreferenceManager.DEFAULTS` (valores efetivos via `get_or_default`); `PUT /api/preferences/<key>` e `DELETE /api/preferences` conforme tabela de contratos. Broadcasts: `preferences_update {"key","value"}`, `preferences_reset`, e `score_phrases_update` quando a chave for de frases de score (mesma regra do legado).

- [ ] **Step 1: Teste que falha**

```python
# tests/unit/api/test_preferences.py
"""Tests for /api/preferences."""

from unittest.mock import patch

from pikaraoke.lib.preference_manager import PreferenceManager


def test_defaults_include_splash_display_mode():
    assert PreferenceManager.DEFAULTS["splash_display_mode"] == "integration"


def test_get_preferences_returns_all_keys(client):
    data = client.get("/api/preferences").get_json()["preferences"]
    assert set(PreferenceManager.DEFAULTS.keys()) == set(data.keys())
    assert data["volume"] == 0.85


def test_put_preference_requires_admin(client):
    resp = client.put("/api/preferences/volume", json={"value": 0.5})
    assert resp.status_code == 403


def test_put_preference_sets_and_broadcasts(admin_client, fake_karaoke):
    with patch("pikaraoke.routes.api.preferences.broadcast_event") as broadcast:
        resp = admin_client.put("/api/preferences/splash_delay", json={"value": 5})
    assert resp.status_code == 200
    assert resp.get_json()["success"] is True
    assert fake_karaoke.preferences.get_or_default("splash_delay") == 5
    broadcast.assert_any_call("preferences_update", {"key": "splash_delay", "value": 5})


def test_put_score_phrase_also_broadcasts_phrases(admin_client):
    with patch("pikaraoke.routes.api.preferences.broadcast_event") as broadcast:
        admin_client.put("/api/preferences/low_score_phrases", json={"value": "eita"})
    events = [c.args[0] for c in broadcast.call_args_list]
    assert "score_phrases_update" in events


def test_delete_preferences_resets(admin_client, fake_karaoke):
    fake_karaoke.preferences.set("splash_delay", "9")
    with patch("pikaraoke.routes.api.preferences.broadcast_event"):
        resp = admin_client.delete("/api/preferences")
    assert resp.get_json()["success"] is True
    assert fake_karaoke.preferences.get_or_default("splash_delay") == 2
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `uv run pytest tests/unit/api/test_preferences.py -v`
Expected: FAIL (chave inexistente + 404)

- [ ] **Step 3: Implementar**

Em `pikaraoke/lib/preference_manager.py`, adicionar ao final de `DEFAULTS`:

```python
        "splash_display_mode": "integration",
```

```python
# pikaraoke/routes/api/preferences.py
"""Preference endpoints for the /api mirror."""

from flask import jsonify
from flask_smorest import Blueprint
from marshmallow import Schema, fields

from pikaraoke.lib.current_app import broadcast_event, get_karaoke_instance
from pikaraoke.lib.preference_manager import PreferenceManager
from pikaraoke.routes.api._utils import require_admin
from pikaraoke.routes.splash import _get_active_score_phrases

_SCORE_PHRASE_KEYS = {"low_score_phrases", "mid_score_phrases", "high_score_phrases"}

api_preferences_bp = Blueprint("api_preferences", __name__, url_prefix="/api")


class PreferenceValueBody(Schema):
    value = fields.Raw(required=True, metadata={"description": "New preference value"})


@api_preferences_bp.route("/preferences", methods=["GET"])
def get_preferences():
    """Return every preference with its effective value."""
    k = get_karaoke_instance()
    prefs = {key: k.preferences.get_or_default(key) for key in PreferenceManager.DEFAULTS}
    return jsonify({"preferences": prefs})


@api_preferences_bp.route("/preferences/<key>", methods=["PUT"])
@api_preferences_bp.arguments(PreferenceValueBody, location="json")
@require_admin
def put_preference(body, key):
    """Set a single preference and broadcast the change."""
    k = get_karaoke_instance()
    if key not in PreferenceManager.DEFAULTS:
        return jsonify({"error": f"Unknown preference: {key}"}), 404
    success, message = k.preferences.set(key, str(body["value"]))
    if success:
        broadcast_event("preferences_update", {"key": key, "value": body["value"]})
        if key in _SCORE_PHRASE_KEYS:
            broadcast_event("score_phrases_update", _get_active_score_phrases(k))
    return jsonify({"success": success, "message": message})


@api_preferences_bp.route("/preferences", methods=["DELETE"])
@require_admin
def reset_preferences():
    """Reset every preference to defaults and broadcast."""
    k = get_karaoke_instance()
    success, message = k.preferences.reset_all()
    if success:
        broadcast_event("preferences_reset", PreferenceManager.DEFAULTS)
        broadcast_event("score_phrases_update", _get_active_score_phrases(k))
    return jsonify({"success": success, "message": message})
```

Registrar em `__init__.py` (adicionar à lista `api_blueprints`):

```python
from pikaraoke.routes.api.preferences import api_preferences_bp
```

Nota: `PreferenceManager.set` já faz coerção de tipo a partir de string (mesmo fluxo do legado `/change_preferences?val=`). Se `set` não aceitar booleans como `"True"`, espelhar exatamente a conversão usada pelo legado — verificar `PreferenceManager.set` antes de ajustar.

- [ ] **Step 4: Rodar e ver passar**

Run: `uv run pytest tests/unit/api/ -v`
Expected: todos passam

- [ ] **Step 5: Commit**

```bash
git add pikaraoke/routes/api pikaraoke/lib/preference_manager.py tests/unit/api/test_preferences.py
git commit -m "feat: add /api/preferences endpoints and splash_display_mode pref"
```

---

### Task 4: `/api/player` (Lane Backend — paralela)

**Files:**
- Create: `pikaraoke/routes/api/player.py`
- Modify: `pikaraoke/routes/api/__init__.py`
- Test: `tests/unit/api/test_player.py`

**Interfaces:**
- Consumes: `k.get_now_playing()` (dict com `now_playing, now_playing_user, now_playing_duration, now_playing_transpose, now_playing_url, now_playing_subtitle_url, now_playing_position, is_paused, up_next, next_user, volume`); `k.playback_controller.skip()/pause()`; `k.restart()`; `k.volume_change(float)`; `k.transpose_current(int)`; `_get_active_score_phrases`.
- Produces: endpoints da tabela de contratos. O payload de `GET /api/player` é o dict de `k.get_now_playing()` sem transformação (o front tipa como `NowPlaying`, T9).

- [ ] **Step 1: Teste que falha**

```python
# tests/unit/api/test_player.py
"""Tests for /api/player."""


def test_get_player_returns_now_playing(client, fake_karaoke):
    fake_karaoke.get_now_playing.return_value = {"now_playing": "Song", "volume": 0.85}
    data = client.get("/api/player").get_json()
    assert data["now_playing"] == "Song"


def test_post_skip_delegates(client, fake_karaoke):
    fake_karaoke.playback_controller.skip.return_value = True
    resp = client.post("/api/player/skip")
    assert resp.get_json() == {"success": True}
    fake_karaoke.playback_controller.skip.assert_called_once()


def test_post_pause_delegates(client, fake_karaoke):
    fake_karaoke.playback_controller.pause.return_value = True
    assert client.post("/api/player/pause").get_json() == {"success": True}


def test_post_restart_delegates(client, fake_karaoke):
    fake_karaoke.restart.return_value = True
    assert client.post("/api/player/restart").get_json() == {"success": True}


def test_put_volume_validates_range(client, fake_karaoke):
    assert client.put("/api/player/volume", json={"volume": 1.5}).status_code == 422
    fake_karaoke.volume_change.return_value = True
    resp = client.put("/api/player/volume", json={"volume": 0.5})
    assert resp.get_json() == {"success": True}
    fake_karaoke.volume_change.assert_called_once_with(0.5)


def test_put_transpose_delegates(client, fake_karaoke):
    resp = client.put("/api/player/transpose", json={"semitones": 2})
    assert resp.get_json() == {"success": True}
    fake_karaoke.transpose_current.assert_called_once_with(2)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `uv run pytest tests/unit/api/test_player.py -v`
Expected: FAIL — 404

- [ ] **Step 3: Implementar**

```python
# pikaraoke/routes/api/player.py
"""Playback control endpoints for the /api mirror."""

from flask import jsonify
from flask_smorest import Blueprint
from marshmallow import Schema, fields, validate

from pikaraoke.lib.current_app import get_karaoke_instance
from pikaraoke.routes.splash import _get_active_score_phrases

api_player_bp = Blueprint("api_player", __name__, url_prefix="/api")


class VolumeBody(Schema):
    volume = fields.Float(required=True, validate=validate.Range(min=0.0, max=1.0))


class TransposeBody(Schema):
    semitones = fields.Integer(required=True, validate=validate.Range(min=-12, max=12))


@api_player_bp.route("/player", methods=["GET"])
def get_player():
    """Current playback state (now playing, up next, volume)."""
    k = get_karaoke_instance()
    return jsonify(k.get_now_playing())


@api_player_bp.route("/player/score-phrases", methods=["GET"])
def get_score_phrases():
    """Active score phrases for the TV score screen."""
    k = get_karaoke_instance()
    return jsonify(_get_active_score_phrases(k))


@api_player_bp.route("/player/skip", methods=["POST"])
def skip():
    """Skip the current song."""
    k = get_karaoke_instance()
    return jsonify({"success": k.playback_controller.skip()})


@api_player_bp.route("/player/pause", methods=["POST"])
def pause():
    """Toggle pause on the current song."""
    k = get_karaoke_instance()
    return jsonify({"success": k.playback_controller.pause()})


@api_player_bp.route("/player/restart", methods=["POST"])
def restart():
    """Restart the current song from the beginning."""
    k = get_karaoke_instance()
    return jsonify({"success": bool(k.restart())})


@api_player_bp.route("/player/volume", methods=["PUT"])
@api_player_bp.arguments(VolumeBody, location="json")
def set_volume(body):
    """Set absolute playback volume (0..1)."""
    k = get_karaoke_instance()
    return jsonify({"success": bool(k.volume_change(body["volume"]))})


@api_player_bp.route("/player/transpose", methods=["PUT"])
@api_player_bp.arguments(TransposeBody, location="json")
def set_transpose(body):
    """Transpose the current song by N semitones (restarts the stream)."""
    k = get_karaoke_instance()
    k.transpose_current(body["semitones"])
    return jsonify({"success": True})
```

Registrar `api_player_bp` em `__init__.py`.

- [ ] **Step 4: Rodar e ver passar**

Run: `uv run pytest tests/unit/api/ -v`
Expected: todos passam

- [ ] **Step 5: Commit**

```bash
git add pikaraoke/routes/api tests/unit/api/test_player.py
git commit -m "feat: add /api/player playback control endpoints"
```

---

### Task 5: `/api/queue` (Lane Backend — paralela)

**Files:**
- Create: `pikaraoke/routes/api/queue.py`
- Modify: `pikaraoke/routes/api/__init__.py`
- Test: `tests/unit/api/test_queue.py`

**Interfaces:**
- Consumes: `k.queue_manager.queue` (list de `{"user","file","title","semitones"}`); `.enqueue(song_path, user)` → `[success, message]`; `.reorder(old, new)`; `.queue_edit(song, "up"|"down"|"delete")`; `.move_to_top(song)`; `.move_to_bottom(song)`; `.queue_clear()`; `.queue_add_random(amount)`; `broadcast_event`.
- Produces: endpoints da tabela. Broadcast `queue_update` após mutações que o domínio não emite sozinho via socket (o `QueueManager` emite eventos internos; o espelho re-broadcasta `queue_update` como o legado faz em `/enqueue`; para `clear`, broadcast extra `skip` como o legado).

- [ ] **Step 1: Teste que falha**

```python
# tests/unit/api/test_queue.py
"""Tests for /api/queue."""

from unittest.mock import patch


def test_get_queue(client, fake_karaoke):
    fake_karaoke.queue_manager.queue = [
        {"user": "Ana", "file": "/x/a.mp4", "title": "A", "semitones": 0}
    ]
    data = client.get("/api/queue").get_json()
    assert data["queue"][0]["title"] == "A"


def test_post_queue_enqueues(client, fake_karaoke):
    fake_karaoke.queue_manager.enqueue.return_value = [True, "ok"]
    with patch("pikaraoke.routes.api.queue.broadcast_event"):
        resp = client.post("/api/queue", json={"song": "/x/a.mp4", "user": "Ana"})
    assert resp.get_json() == {"success": True, "message": "ok"}
    fake_karaoke.queue_manager.enqueue.assert_called_once_with("/x/a.mp4", "Ana")


def test_reorder_requires_admin(client):
    assert (
        client.put("/api/queue/reorder", json={"old_index": 0, "new_index": 1}).status_code == 403
    )


def test_reorder_delegates(admin_client, fake_karaoke):
    fake_karaoke.queue_manager.reorder.return_value = True
    resp = admin_client.put("/api/queue/reorder", json={"old_index": 0, "new_index": 2})
    assert resp.get_json() == {"success": True}
    fake_karaoke.queue_manager.reorder.assert_called_once_with(0, 2)


def test_patch_item_top(admin_client, fake_karaoke):
    fake_karaoke.queue_manager.move_to_top.return_value = True
    resp = admin_client.patch("/api/queue/item", json={"song": "/x/a.mp4", "action": "top"})
    assert resp.get_json() == {"success": True}


def test_delete_item(admin_client, fake_karaoke):
    fake_karaoke.queue_manager.queue_edit.return_value = True
    resp = admin_client.delete("/api/queue/item?song=/x/a.mp4")
    assert resp.get_json() == {"success": True}
    fake_karaoke.queue_manager.queue_edit.assert_called_once_with("/x/a.mp4", "delete")


def test_clear_queue(admin_client, fake_karaoke):
    with patch("pikaraoke.routes.api.queue.broadcast_event") as broadcast:
        resp = admin_client.delete("/api/queue")
    assert resp.get_json() == {"success": True}
    fake_karaoke.queue_manager.queue_clear.assert_called_once()
    broadcast.assert_any_call("skip", "clear queue")


def test_add_random(admin_client, fake_karaoke):
    fake_karaoke.queue_manager.queue_add_random.return_value = True
    resp = admin_client.post("/api/queue/random", json={"amount": 3})
    assert resp.get_json() == {"success": True}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `uv run pytest tests/unit/api/test_queue.py -v`
Expected: FAIL — 404

- [ ] **Step 3: Implementar**

```python
# pikaraoke/routes/api/queue.py
"""Queue endpoints for the /api mirror."""

from flask import jsonify
from flask_smorest import Blueprint
from marshmallow import Schema, fields, validate

from pikaraoke.lib.current_app import broadcast_event, get_karaoke_instance
from pikaraoke.routes.api._utils import require_admin

api_queue_bp = Blueprint("api_queue", __name__, url_prefix="/api")


class EnqueueBody(Schema):
    song = fields.String(required=True)
    user = fields.String(load_default="")


class ReorderBody(Schema):
    old_index = fields.Integer(required=True)
    new_index = fields.Integer(required=True)


class QueueItemBody(Schema):
    song = fields.String(required=True)
    action = fields.String(
        required=True, validate=validate.OneOf(["up", "down", "top", "bottom"])
    )


class QueueItemQuery(Schema):
    song = fields.String(required=True)


class RandomBody(Schema):
    amount = fields.Integer(required=True, validate=validate.Range(min=1, max=50))


@api_queue_bp.route("/queue", methods=["GET"])
def get_queue():
    """Current queue in play order."""
    k = get_karaoke_instance()
    return jsonify({"queue": k.queue_manager.queue})


@api_queue_bp.route("/queue", methods=["POST"])
@api_queue_bp.arguments(EnqueueBody, location="json")
def enqueue(body):
    """Add a local song to the queue."""
    k = get_karaoke_instance()
    success, message = k.queue_manager.enqueue(body["song"], body["user"])
    if success:
        broadcast_event("queue_update")
    return jsonify({"success": success, "message": message})


@api_queue_bp.route("/queue/reorder", methods=["PUT"])
@api_queue_bp.arguments(ReorderBody, location="json")
@require_admin
def reorder(body):
    """Move a queue item from old_index to new_index."""
    k = get_karaoke_instance()
    return jsonify({"success": k.queue_manager.reorder(body["old_index"], body["new_index"])})


@api_queue_bp.route("/queue/item", methods=["PATCH"])
@api_queue_bp.arguments(QueueItemBody, location="json")
@require_admin
def edit_item(body):
    """Move a queue item (up/down/top/bottom)."""
    k = get_karaoke_instance()
    action = body["action"]
    if action == "top":
        success = k.queue_manager.move_to_top(body["song"])
    elif action == "bottom":
        success = k.queue_manager.move_to_bottom(body["song"])
    else:
        success = k.queue_manager.queue_edit(body["song"], action)
    return jsonify({"success": success})


@api_queue_bp.route("/queue/item", methods=["DELETE"])
@api_queue_bp.arguments(QueueItemQuery, location="query")
@require_admin
def delete_item(query):
    """Remove a song from the queue."""
    k = get_karaoke_instance()
    return jsonify({"success": k.queue_manager.queue_edit(query["song"], "delete")})


@api_queue_bp.route("/queue", methods=["DELETE"])
@require_admin
def clear_queue():
    """Clear the entire queue."""
    k = get_karaoke_instance()
    k.queue_manager.queue_clear()
    broadcast_event("skip", "clear queue")
    return jsonify({"success": True})


@api_queue_bp.route("/queue/random", methods=["POST"])
@api_queue_bp.arguments(RandomBody, location="json")
@require_admin
def add_random(body):
    """Add N random songs from the library to the queue."""
    k = get_karaoke_instance()
    success = k.queue_manager.queue_add_random(body["amount"])
    broadcast_event("queue_update")
    return jsonify({"success": success})
```

Registrar `api_queue_bp` em `__init__.py`.

- [ ] **Step 4: Rodar e ver passar**

Run: `uv run pytest tests/unit/api/ -v`
Expected: todos passam

- [ ] **Step 5: Commit**

```bash
git add pikaraoke/routes/api tests/unit/api/test_queue.py
git commit -m "feat: add /api/queue endpoints"
```

---

### Task 6: `apiFetch` tipado com `ApiError` (Lane Front — início; paralela à Lane Backend)

**Files:**
- Modify: `bokusu-front/src/lib/api.ts`
- Test: `bokusu-front/src/lib/api.test.ts` (adicionar casos)

**Interfaces:**
- Produces: `apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T>`; `class ApiError extends Error { status: number }` — mensagem vem de `{"error": "..."}` do corpo quando presente. Todos os hooks das tasks seguintes usam esses dois símbolos.

- [ ] **Step 1: Testes que falham (adicionar ao arquivo existente)**

```typescript
// bokusu-front/src/lib/api.test.ts — acrescentar
import { apiFetch, ApiError } from './api'

it('throws ApiError with server-provided message', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 })
    )
  )
  await expect(apiFetch('/api/queue')).rejects.toMatchObject({
    status: 403,
    message: 'Unauthorized',
  })
})

it('throws ApiError with generic message when body is not JSON', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('boom', { status: 500 }))
  )
  await expect(apiFetch('/api/queue')).rejects.toBeInstanceOf(ApiError)
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd bokusu-front && npx vitest run src/lib/api.test.ts`
Expected: FAIL — `ApiError` não exportado

- [ ] **Step 3: Implementar**

```typescript
// bokusu-front/src/lib/api.ts
export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  const response = await fetch(endpoint, { ...options, headers })

  if (!response.ok) {
    let message = `API error: ${response.status} ${response.statusText}`
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // corpo não-JSON: mantém a mensagem genérica
    }
    throw new ApiError(response.status, message)
  }

  if (response.status === 204) {
    return null as T
  }

  return response.json() as Promise<T>
}
```

Nota: chamadas com corpo passam `body: JSON.stringify(payload)` explicitamente (remoção do auto-stringify atual — atualizar os call sites existentes que dependem dele, se houver; `rtk grep -rn "apiFetch" src/` para listar).

- [ ] **Step 4: Rodar todos os testes front e ver passar**

Run: `cd bokusu-front && npx vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add bokusu-front/src/lib
git commit -m "feat: typed apiFetch with ApiError carrying server messages"
```

---

### Task 7: Auth real no front (`/api/auth`) — depende de T6

**Files:**
- Modify: `bokusu-front/src/components/AdminModal.tsx`, `bokusu-front/src/App.tsx` (hidratação no boot), `bokusu-front/src/types/api.ts`
- Test: `bokusu-front/src/components/AdminModal.test.tsx` (ajustar), novo `bokusu-front/src/hooks/useAuthStatus.test.tsx`
- Create: `bokusu-front/src/hooks/useAuthStatus.ts`

**Interfaces:**
- Consumes: `apiFetch`, `ApiError` (T6); `useAppStore` (`isAdmin`, `setIsAdmin`).
- Produces: `useAuthStatus(): void` — hook chamado uma vez no `App` que faz `GET /api/auth` e chama `setIsAdmin(resp.isAdmin)`; `AdminModal` envia `POST /api/auth {"password"}` e trata 403 como "senha incorreta".

- [ ] **Step 1: Testes que falham**

```typescript
// bokusu-front/src/hooks/useAuthStatus.test.tsx
import { renderHook, waitFor } from '@testing-library/react'
import { useAuthStatus } from './useAuthStatus'
import { useAppStore } from '../store/useAppStore'

it('hydrates isAdmin from GET /api/auth', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ isAdmin: true }), { status: 200 })
    )
  )
  useAppStore.setState({ isAdmin: false })
  renderHook(() => useAuthStatus())
  await waitFor(() => expect(useAppStore.getState().isAdmin).toBe(true))
})
```

Em `AdminModal.test.tsx`, trocar o mock de `/api/admin/verify` por `/api/auth` e cobrir: sucesso seta `isAdmin` e executa `pendingAdminAction`; 403 exibe mensagem de senha incorreta e mantém modal aberto.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd bokusu-front && npx vitest run src/hooks/useAuthStatus.test.tsx src/components/AdminModal.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar**

```typescript
// bokusu-front/src/hooks/useAuthStatus.ts
import { useEffect } from 'react'
import { apiFetch } from '../lib/api'
import { useAppStore } from '../store/useAppStore'

interface AuthStatus {
  isAdmin: boolean
}

export function useAuthStatus() {
  const setIsAdmin = useAppStore((s) => s.setIsAdmin)

  useEffect(() => {
    apiFetch<AuthStatus>('/api/auth')
      .then((resp) => setIsAdmin(resp.isAdmin))
      .catch(() => setIsAdmin(false))
  }, [setIsAdmin])
}
```

No `AdminModal.tsx`, substituir o fetch atual por:

```typescript
import { apiFetch, ApiError } from '../lib/api'

// dentro do handler de submit:
try {
  await apiFetch<{ isAdmin: boolean }>('/api/auth', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
  setIsAdmin(true)
  pendingAdminAction?.()
  closeAdminModal()
} catch (err) {
  if (err instanceof ApiError && err.status === 403) {
    setError('Senha incorreta')
  } else {
    setError('Erro ao autenticar')
  }
}
```

No `App.tsx`, chamar `useAuthStatus()` no topo do componente `App`.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd bokusu-front && npx vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add bokusu-front/src
git commit -m "feat: hydrate admin state from /api/auth and wire AdminModal to real login"
```

---

### Task 8: `usePreferences` (Lane Front — paralela com T9, T10 após T7)

**Files:**
- Create: `bokusu-front/src/hooks/usePreferences.ts`
- Modify: `bokusu-front/src/types/api.ts`, `bokusu-front/src/store/useAppStore.ts` (remover `playerMode` local)
- Test: `bokusu-front/src/hooks/usePreferences.test.tsx`

**Interfaces:**
- Consumes: `apiFetch` (T6), `useSocketEvent` (existente), `queryClient`.
- Produces:
  ```typescript
  interface Preferences {
    splash_display_mode: 'integration' | 'cinematic'
    volume: number; splash_delay: number; screensaver_timeout: number
    bg_music_volume: number; disable_bg_music: boolean; disable_bg_video: boolean
    disable_score: boolean; hide_url: boolean; hide_notifications: boolean
    hide_overlay: boolean; show_splash_clock: boolean; normalize_audio: boolean
    high_quality: boolean; complete_transcode_before_play: boolean; buffer_size: number
    limit_user_songs_by: number; enable_fair_queue: boolean; cdg_pixel_scaling: boolean
    avsync: number; browse_results_per_page: number; enable_title_tidy: boolean
    low_score_phrases: string; mid_score_phrases: string; high_score_phrases: string
  }
  usePreferences(): UseQueryResult<Preferences>
  useSetPreference(): UseMutationResult  // mutate({ key, value }) — otimista com rollback
  ```
- `SettingsPage` (T21) e a spec da TV consomem exatamente esses nomes.

- [ ] **Step 1: Teste que falha**

```typescript
// bokusu-front/src/hooks/usePreferences.test.tsx
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePreferences, useSetPreference } from './usePreferences'
import type { ReactNode } from 'react'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

it('fetches preferences from /api/preferences', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ preferences: { splash_display_mode: 'cinematic', volume: 0.85 } }),
        { status: 200 }
      )
    )
  )
  const { result } = renderHook(() => usePreferences(), { wrapper })
  await waitFor(() => expect(result.current.data?.splash_display_mode).toBe('cinematic'))
})

it('useSetPreference PUTs to /api/preferences/<key>', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ success: true, message: 'ok' }), { status: 200 })
  )
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => useSetPreference(), { wrapper })
  result.current.mutate({ key: 'volume', value: 0.5 })
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/preferences/volume',
      expect.objectContaining({ method: 'PUT' })
    )
  )
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd bokusu-front && npx vitest run src/hooks/usePreferences.test.tsx`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implementar**

```typescript
// bokusu-front/src/hooks/usePreferences.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { useSocketEvent } from './useSocketEvent'
import type { Preferences } from '../types/api'

const QUERY_KEY = ['preferences'] as const

export function usePreferences() {
  const queryClient = useQueryClient()

  useSocketEvent('preferences_update', (change: { key: string; value: unknown }) => {
    queryClient.setQueryData<Preferences>(QUERY_KEY, (old) =>
      old ? { ...old, [change.key]: change.value } : old
    )
  })
  useSocketEvent('preferences_reset', () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  })

  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const resp = await apiFetch<{ preferences: Preferences }>('/api/preferences')
      return resp.preferences
    },
  })
}

export function useSetPreference() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ key, value }: { key: keyof Preferences; value: unknown }) =>
      apiFetch<{ success: boolean; message: string }>(`/api/preferences/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      }),
    onMutate: async ({ key, value }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const previous = queryClient.getQueryData<Preferences>(QUERY_KEY)
      queryClient.setQueryData<Preferences>(QUERY_KEY, (old) =>
        old ? { ...old, [key]: value } : old
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous)
    },
  })
}
```

Adicionar a interface `Preferences` (bloco de Interfaces acima) em `types/api.ts`. Remover `playerMode`/`setPlayerMode` de `useAppStore.ts` e ajustar `SettingsPage`/`PlayerPage` para lerem `splash_display_mode` de `usePreferences()` (mudança mínima: manter UI atual funcionando; forms completos vêm em T21).

- [ ] **Step 4: Rodar e ver passar**

Run: `cd bokusu-front && npx vitest run`
Expected: PASS (ajustar testes de store/SettingsPage que referenciam `playerMode`)

- [ ] **Step 5: Commit**

```bash
git add bokusu-front/src
git commit -m "feat: usePreferences with socket sync and optimistic writes; TV mode moves to backend pref"
```

---

### Task 9: `useNowPlaying` + hooks de fila/busca nos contratos reais (paralela com T8, T10)

**Files:**
- Create: `bokusu-front/src/hooks/useNowPlaying.ts`, `bokusu-front/src/hooks/usePlayerControls.ts`
- Modify: `bokusu-front/src/hooks/useQueue.ts`, `bokusu-front/src/hooks/useSearch.ts`, `bokusu-front/src/types/api.ts`, `bokusu-front/src/pages/QueuePage.tsx`, `bokusu-front/src/components/{QueueItem,NowPlayingCard,SearchResultItem}.tsx` (props renomeadas)
- Test: `bokusu-front/src/hooks/useNowPlaying.test.tsx` + ajustar `useQueue.test.tsx`/`useSearch.test.tsx`

**Interfaces:**
- Produces:
  ```typescript
  interface QueueItem { user: string; file: string; title: string; semitones: number }
  interface NowPlaying {
    now_playing: string | null; now_playing_user: string | null
    now_playing_duration: number | null; now_playing_transpose: number
    now_playing_url: string | null; now_playing_subtitle_url: string | null
    now_playing_position: number | null; is_paused: boolean
    up_next: string | null; next_user: string | null; volume: number
  }
  interface SearchResult { title: string; url: string; id: string }  // de [[title,url,id],...]
  useQueue(): UseQueryResult<QueueItem[]>          // GET /api/queue; socket queue_update invalida; SEM polling
  useEnqueue(): UseMutationResult                  // POST /api/queue {song, user}
  useNowPlaying(): UseQueryResult<NowPlaying>      // GET /api/player; socket now_playing invalida
  usePlayerControls(): { skip; pause; restart; setVolume(v: number); setTranspose(n: number) }  // mutations POST/PUT /api/player/*
  useSearch(query: string): UseQueryResult<SearchResult[]>  // GET /api/search?q=
  ```
- T12/T13 (mini-player/drawer) consomem `useNowPlaying` + `usePlayerControls`; T18/T19 consomem `useQueue`.

- [ ] **Step 1: Testes que falham**

```typescript
// bokusu-front/src/hooks/useNowPlaying.test.tsx
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useNowPlaying } from './useNowPlaying'
import type { ReactNode } from 'react'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

it('fetches now playing from /api/player', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ now_playing: 'Song A', is_paused: false, volume: 0.85 }),
        { status: 200 }
      )
    )
  )
  const { result } = renderHook(() => useNowPlaying(), { wrapper })
  await waitFor(() => expect(result.current.data?.now_playing).toBe('Song A'))
})
```

Atualizar `useQueue.test.tsx`: mock responde `{"queue": [...]}` em `/api/queue`; assert de que NÃO há `refetchInterval` (fila atualiza via socket). Atualizar `useSearch.test.tsx`: mock em `/api/search?q=...` respondendo `{"results": [["Title","http://u","id1"]]}` e assert do mapeamento para `SearchResult`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd bokusu-front && npx vitest run src/hooks`
Expected: FAIL

- [ ] **Step 3: Implementar**

```typescript
// bokusu-front/src/hooks/useNowPlaying.ts
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { useSocketEvent } from './useSocketEvent'
import type { NowPlaying } from '../types/api'

export function useNowPlaying() {
  const queryClient = useQueryClient()

  useSocketEvent('now_playing', (payload: NowPlaying) => {
    queryClient.setQueryData(['nowPlaying'], payload)
  })

  return useQuery({
    queryKey: ['nowPlaying'],
    queryFn: () => apiFetch<NowPlaying>('/api/player'),
  })
}
```

```typescript
// bokusu-front/src/hooks/usePlayerControls.ts
import { useMutation } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'

function post(path: string) {
  return apiFetch<{ success: boolean }>(path, { method: 'POST' })
}

export function usePlayerControls() {
  const skip = useMutation({ mutationFn: () => post('/api/player/skip') })
  const pause = useMutation({ mutationFn: () => post('/api/player/pause') })
  const restart = useMutation({ mutationFn: () => post('/api/player/restart') })
  const setVolume = useMutation({
    mutationFn: (volume: number) =>
      apiFetch<{ success: boolean }>('/api/player/volume', {
        method: 'PUT',
        body: JSON.stringify({ volume }),
      }),
  })
  const setTranspose = useMutation({
    mutationFn: (semitones: number) =>
      apiFetch<{ success: boolean }>('/api/player/transpose', {
        method: 'PUT',
        body: JSON.stringify({ semitones }),
      }),
  })
  return { skip, pause, restart, setVolume, setTranspose }
}
```

```typescript
// bokusu-front/src/hooks/useQueue.ts (reescrita)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { useSocketEvent } from './useSocketEvent'
import type { QueueItem } from '../types/api'

export function useQueue() {
  const queryClient = useQueryClient()

  useSocketEvent('queue_update', () => {
    queryClient.invalidateQueries({ queryKey: ['queue'] })
  })

  return useQuery({
    queryKey: ['queue'],
    queryFn: async () => {
      const resp = await apiFetch<{ queue: QueueItem[] }>('/api/queue')
      return resp.queue
    },
  })
}

export function useEnqueue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ song, user }: { song: string; user: string }) =>
      apiFetch<{ success: boolean; message: string }>('/api/queue', {
        method: 'POST',
        body: JSON.stringify({ song, user }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queue'] }),
  })
}
```

```typescript
// bokusu-front/src/hooks/useSearch.ts (reescrita, preservando o debounce existente)
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { SearchResult } from '../types/api'

type RawResults = { results: [string, string, string][] }

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    enabled: query.length > 0,
    queryFn: async () => {
      const resp = await apiFetch<RawResults>(`/api/search?q=${encodeURIComponent(query)}`)
      return resp.results.map(([title, url, id]): SearchResult => ({ title, url, id }))
    },
  })
}
```

Atualizar `types/api.ts` com `QueueItem`, `NowPlaying`, `SearchResult` (removendo `Song` antigo) e propagar renomeações em `QueuePage`, `QueueItem.tsx`, `NowPlayingCard.tsx`, `SearchResultItem.tsx` (título/cantor vêm de `title`/`user`; chave de lista é `file`).

- [ ] **Step 4: Rodar e ver passar**

Run: `cd bokusu-front && npx vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add bokusu-front/src
git commit -m "feat: real API contracts for queue, search, now playing and player controls"
```

---

### Task 10: Toasts globais (socket `notification` + `sync_*`) — paralela com T8, T9

**Files:**
- Create: `bokusu-front/src/components/ToastHost.tsx`
- Modify: `bokusu-front/src/store/useAppStore.ts`, `bokusu-front/src/layouts/AppLayout.tsx`
- Test: `bokusu-front/src/components/ToastHost.test.tsx`

**Interfaces:**
- Consumes: `useSocketEvent`.
- Produces: no store — `toasts: Toast[]`, `pushToast(message: string, severity: 'info' | 'success' | 'danger')`, `dismissToast(id: number)` com `Toast = { id: number; message: string; severity }`; auto-dismiss após 4s. Qualquer task posterior usa `useAppStore.getState().pushToast(...)` para feedback.

- [ ] **Step 1: Teste que falha**

```typescript
// bokusu-front/src/components/ToastHost.test.tsx
import { render, screen, act } from '@testing-library/react'
import { ToastHost } from './ToastHost'
import { useAppStore } from '../store/useAppStore'

it('renders a toast pushed to the store and auto-dismisses', () => {
  vi.useFakeTimers()
  render(<ToastHost />)
  act(() => useAppStore.getState().pushToast('Download concluído', 'success'))
  expect(screen.getByText('Download concluído')).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(4500))
  expect(screen.queryByText('Download concluído')).not.toBeInTheDocument()
  vi.useRealTimers()
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd bokusu-front && npx vitest run src/components/ToastHost.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar**

No `useAppStore.ts`, adicionar:

```typescript
export interface Toast {
  id: number
  message: string
  severity: 'info' | 'success' | 'danger'
}

// no AppState:
toasts: Toast[]
pushToast: (message: string, severity: Toast['severity']) => void
dismissToast: (id: number) => void

// na store (com contador módulo-level `let nextToastId = 1`):
toasts: [],
pushToast: (message, severity) =>
  set((s) => ({ toasts: [...s.toasts, { id: nextToastId++, message, severity }] })),
dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
```

```tsx
// bokusu-front/src/components/ToastHost.tsx
import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useSocketEvent } from '../hooks/useSocketEvent'

const SEVERITY_CLASS = {
  info: 'alert-info',
  success: 'alert-success',
  danger: 'alert-error',
} as const

export function ToastHost() {
  const { toasts, pushToast, dismissToast } = useAppStore()

  useSocketEvent('notification', (message: string, severity?: string) => {
    const s = severity === 'success' || severity === 'danger' ? severity : 'info'
    pushToast(message, s)
  })
  useSocketEvent('sync_started', () => pushToast('Sincronizando biblioteca...', 'info'))
  useSocketEvent('sync_finished', () => pushToast('Biblioteca sincronizada', 'success'))

  useEffect(() => {
    if (toasts.length === 0) return
    const timer = setTimeout(() => dismissToast(toasts[0].id), 4000)
    return () => clearTimeout(timer)
  }, [toasts, dismissToast])

  if (toasts.length === 0) return null
  return (
    <div className="toast toast-bottom toast-center z-50">
      {toasts.map((t) => (
        <div key={t.id} role="status" className={`alert ${SEVERITY_CLASS[t.severity]}`}>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
```

Montar `<ToastHost />` no `AppLayout` (irmão do `<Outlet />`). Payload real do evento `notification` legado: conferir assinatura emitida em `lib/current_app.py::broadcast_event` com `karaoke.send_notification` (mensagem + cor) e adaptar o listener se vier como objeto único.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd bokusu-front && npx vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add bokusu-front/src
git commit -m "feat: global toast host wired to server notification and sync events"
```

---

### Task 11: i18n (react-i18next) — paralela com toda a Fase 1

**Files:**
- Create: `bokusu-front/src/lib/i18n.ts`, `bokusu-front/src/locales/pt-BR.json`, `bokusu-front/src/locales/en.json`
- Modify: `bokusu-front/src/main.tsx` (import side-effect), `bokusu-front/package.json`, e TODOS os componentes/páginas existentes com strings hardcoded (`AppLayout`, `QueuePage`, `SearchPage`, `SettingsPage`, `AdminModal`, `NowPlayingCard`, `QueueItem`, `SearchResultItem`, `PlayerPage`)
- Test: `bokusu-front/src/lib/i18n.test.ts`

**Interfaces:**
- Produces: instância i18next inicializada com `resources: { 'pt-BR', en }`, `fallbackLng: 'en'`, detecção por `navigator.language` com override persistido em `localStorage('bokusu-lang')`. Componentes usam `useTranslation()` → `t('queue.title')` etc. Todas as tasks seguintes escrevem strings novas nos DOIS arquivos de locale.

- [ ] **Step 1: Instalar dependências**

```bash
cd bokusu-front && npm install react-i18next i18next
```

- [ ] **Step 2: Teste que falha**

```typescript
// bokusu-front/src/lib/i18n.test.ts
import i18n from './i18n'

it('resolves pt-BR and en keys', () => {
  i18n.changeLanguage('pt-BR')
  expect(i18n.t('nav.queue')).toBe('Fila')
  i18n.changeLanguage('en')
  expect(i18n.t('nav.queue')).toBe('Queue')
})
```

Run: `cd bokusu-front && npx vitest run src/lib/i18n.test.ts` — Expected: FAIL

- [ ] **Step 3: Implementar**

```typescript
// bokusu-front/src/lib/i18n.ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ptBR from '../locales/pt-BR.json'
import en from '../locales/en.json'

const stored = localStorage.getItem('bokusu-lang')

i18n.use(initReactI18next).init({
  resources: { 'pt-BR': { translation: ptBR }, en: { translation: en } },
  lng: stored ?? navigator.language,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export function setLanguage(lang: string) {
  localStorage.setItem('bokusu-lang', lang)
  i18n.changeLanguage(lang)
}

export default i18n
```

Criar os dois JSONs cobrindo TODAS as strings hoje hardcoded (varrer com `rtk grep -rn "'[A-ZÀ-Ú]" src/pages src/components src/layouts`). Estrutura de chaves por domínio: `nav.*`, `queue.*`, `search.*`, `settings.*`, `admin.*`, `player.*`, `toasts.*`, `common.*` (ex.: `common.cancel`, `common.confirm`). Migrar cada componente para `useTranslation()`.

`main.tsx`: `import './lib/i18n'` antes do render.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd bokusu-front && npx vitest run` — Expected: PASS (testes existentes que asseriam texto pt-BR continuam passando pois pt-BR é o locale dos testes; se o ambiente jsdom reportar `navigator.language` = 'en-US', fixar `lng: 'pt-BR'` no `test-setup.ts` via `i18n.changeLanguage('pt-BR')`)

- [ ] **Step 5: Commit**

```bash
git add bokusu-front
git commit -m "feat: i18n with react-i18next, pt-BR and en locales"
```

---

## ═══ CHECKPOINT A — Code review estratégico ═══

Após T1–T11 concluídas (não antes):

- [ ] Rodar suites completas: `uv run pytest tests/unit/api/ -v` e `cd bokusu-front && npx vitest run && npm run lint && npm run build`
- [ ] Dispatch de UM subagent revisor cobrindo o diff acumulado desde o início do plano. Foco: consistência dos contratos entre backend e front, admin enforcement correto, ausência de `any`, rollback das mutações otimistas, imports circulares no package api (`routes/splash` importado por `preferences`/`player`).
- [ ] Corrigir apontamentos antes de iniciar a Fase 2.

---

### Task 12: `<MiniPlayer />` (Fase 2 — serial após Checkpoint A)

**Files:**
- Create: `bokusu-front/src/components/MiniPlayer.tsx`
- Modify: `bokusu-front/src/layouts/AppLayout.tsx`
- Test: `bokusu-front/src/components/MiniPlayer.test.tsx`

**Interfaces:**
- Consumes: `useNowPlaying`, `usePlayerControls` (T9); `useAppStore` (`isAdmin`, `openAdminModal`); i18n (T11).
- Produces: `<MiniPlayer onExpand={() => void} />` — T13 passa o handler que abre o drawer.

- [ ] **Step 1: Testes que falham**

```typescript
// bokusu-front/src/components/MiniPlayer.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MiniPlayer } from './MiniPlayer'
import { useAppStore } from '../store/useAppStore'
import type { ReactNode } from 'react'

const nowPlaying = {
  now_playing: 'Bohemian Rhapsody',
  now_playing_user: 'Ana',
  is_paused: false,
  volume: 0.85,
}

function renderWithClient(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(['nowPlaying'], nowPlaying)
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(nowPlaying))))
})

it('shows title and singer when a song plays', () => {
  renderWithClient(<MiniPlayer onExpand={() => {}} />)
  expect(screen.getByText('Bohemian Rhapsody')).toBeInTheDocument()
  expect(screen.getByText('Ana')).toBeInTheDocument()
})

it('renders nothing when idle', () => {
  const qc = new QueryClient()
  qc.setQueryData(['nowPlaying'], { ...nowPlaying, now_playing: null })
  const { container } = render(
    <QueryClientProvider client={qc}>
      <MiniPlayer onExpand={() => {}} />
    </QueryClientProvider>
  )
  expect(container).toBeEmptyDOMElement()
})

it('non-admin skip click opens admin modal instead of firing', () => {
  useAppStore.setState({ isAdmin: false })
  const openSpy = vi.spyOn(useAppStore.getState(), 'openAdminModal')
  renderWithClient(<MiniPlayer onExpand={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: /skip|pular/i }))
  expect(openSpy).toHaveBeenCalled()
})

it('tapping the body calls onExpand', () => {
  const onExpand = vi.fn()
  renderWithClient(<MiniPlayer onExpand={onExpand} />)
  fireEvent.click(screen.getByText('Bohemian Rhapsody'))
  expect(onExpand).toHaveBeenCalled()
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd bokusu-front && npx vitest run src/components/MiniPlayer.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar**

```tsx
// bokusu-front/src/components/MiniPlayer.tsx
import { Pause, Play, SkipForward, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNowPlaying } from '../hooks/useNowPlaying'
import { usePlayerControls } from '../hooks/usePlayerControls'
import { useAppStore } from '../store/useAppStore'

interface MiniPlayerProps {
  onExpand: () => void
}

export function MiniPlayer({ onExpand }: MiniPlayerProps) {
  const { t } = useTranslation()
  const { data } = useNowPlaying()
  const { skip, pause } = usePlayerControls()
  const { isAdmin, openAdminModal } = useAppStore()

  if (!data?.now_playing) return null

  const guarded = (action: () => void) => () => {
    if (isAdmin) action()
    else openAdminModal(action)
  }

  return (
    <div className="bg-base-200 border-t border-base-300 flex items-center gap-3 px-3 py-2">
      <button type="button" className="flex-1 min-w-0 text-left" onClick={onExpand}>
        <p className="truncate font-medium">{data.now_playing}</p>
        <p className="truncate text-sm text-base-content/60">{data.now_playing_user}</p>
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-circle btn-sm"
        aria-label={data.is_paused ? t('player.play') : t('player.pause')}
        onClick={guarded(() => pause.mutate())}
      >
        {!isAdmin && <Lock size={10} className="absolute -top-1 -right-1" />}
        {data.is_paused ? <Play size={18} /> : <Pause size={18} />}
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-circle btn-sm"
        aria-label={t('player.skip')}
        onClick={guarded(() => skip.mutate())}
      >
        {!isAdmin && <Lock size={10} className="absolute -top-1 -right-1" />}
        <SkipForward size={18} />
      </button>
    </div>
  )
}
```

Nota de spec: a spec menciona thumbnail no mini-player, mas o payload de `GET /api/player` não fornece URL de imagem — o mini-player exibe título + cantor (sem thumb). Adicionar thumb exigiria mudança de backend fora do escopo.

No `AppLayout.tsx`: renderizar `<MiniPlayer onExpand={() => setDrawerOpen(true)} />` imediatamente acima da bottom-nav no mobile e no rodapé da sidebar no desktop (estado `drawerOpen` local do layout; o drawer chega em T13 — até lá `onExpand` é no-op). Marquee do título: adicionar keyframes CSS `marquee` no `index.css` aplicada quando o texto estoura (medida via `scrollWidth > clientWidth` fica para T13 se necessário; truncate é aceitável no mini).

Chaves i18n novas em ambos os locales: `player.play`, `player.pause`, `player.skip`.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd bokusu-front && npx vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add bokusu-front/src
git commit -m "feat: global mini-player with JIT-gated play/pause and skip"
```

---

### Task 13: `<RemoteDrawer />` — depende de T12

**Files:**
- Create: `bokusu-front/src/components/RemoteDrawer.tsx`
- Modify: `bokusu-front/src/layouts/AppLayout.tsx` (conectar `drawerOpen`)
- Test: `bokusu-front/src/components/RemoteDrawer.test.tsx`

**Interfaces:**
- Consumes: `useNowPlaying`, `usePlayerControls` (T9); `useAppStore`; i18n.
- Produces: `<RemoteDrawer open={boolean} onClose={() => void} />`.

- [ ] **Step 1: Testes que falham**

```typescript
// bokusu-front/src/components/RemoteDrawer.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RemoteDrawer } from './RemoteDrawer'
import { useAppStore } from '../store/useAppStore'
import type { ReactNode } from 'react'

function renderOpen(ui?: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(['nowPlaying'], {
    now_playing: 'Song',
    now_playing_transpose: 0,
    is_paused: false,
    volume: 0.8,
  })
  useAppStore.setState({ isAdmin: true })
  return render(
    <QueryClientProvider client={qc}>
      {ui ?? <RemoteDrawer open onClose={() => {}} />}
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })))
  )
})

it('volume slider PUTs with debounce', async () => {
  vi.useFakeTimers()
  renderOpen()
  fireEvent.change(screen.getByRole('slider'), { target: { value: '0.5' } })
  vi.advanceTimersByTime(350)
  vi.useRealTimers()
  await waitFor(() =>
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/player/volume',
      expect.objectContaining({ method: 'PUT' })
    )
  )
})

it('transpose buttons PUT semitones', async () => {
  renderOpen()
  fireEvent.click(screen.getByRole('button', { name: '+1' }))
  await waitFor(() =>
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/player/transpose',
      expect.objectContaining({ body: JSON.stringify({ semitones: 1 }) })
    )
  )
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd bokusu-front && npx vitest run src/components/RemoteDrawer.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar**

```tsx
// bokusu-front/src/components/RemoteDrawer.tsx
import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, SkipForward, Volume2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNowPlaying } from '../hooks/useNowPlaying'
import { usePlayerControls } from '../hooks/usePlayerControls'
import { useAppStore } from '../store/useAppStore'

interface RemoteDrawerProps {
  open: boolean
  onClose: () => void
}

export function RemoteDrawer({ open, onClose }: RemoteDrawerProps) {
  const { t } = useTranslation()
  const { data } = useNowPlaying()
  const { skip, pause, restart, setVolume, setTranspose } = usePlayerControls()
  const { isAdmin, openAdminModal } = useAppStore()
  const [volume, setLocalVolume] = useState(data?.volume ?? 0.85)
  const volumeTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (data) setLocalVolume(data.volume)
  }, [data?.volume])

  if (!open || !data?.now_playing) return null

  const guarded = (action: () => void) => () => {
    if (isAdmin) action()
    else openAdminModal(action)
  }

  const onVolumeChange = (value: number) => {
    setLocalVolume(value)
    clearTimeout(volumeTimer.current)
    volumeTimer.current = setTimeout(() => guarded(() => setVolume.mutate(value))(), 300)
  }

  const transpose = data.now_playing_transpose

  return (
    <div className="modal modal-open modal-bottom" role="dialog">
      <div className="modal-box h-[90vh] flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg truncate">{data.now_playing}</h2>
          <button type="button" className="btn btn-ghost btn-circle" aria-label={t('common.close')} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex justify-center gap-4">
          <button type="button" className="btn btn-circle btn-lg" aria-label={t('player.restart')} onClick={guarded(() => restart.mutate())}>
            <RotateCcw size={24} />
          </button>
          <button
            type="button"
            className="btn btn-circle btn-lg btn-primary"
            aria-label={data.is_paused ? t('player.play') : t('player.pause')}
            onClick={guarded(() => pause.mutate())}
          >
            {data.is_paused ? <Play size={28} /> : <Pause size={28} />}
          </button>
          <button type="button" className="btn btn-circle btn-lg" aria-label={t('player.skip')} onClick={guarded(() => skip.mutate())}>
            <SkipForward size={24} />
          </button>
        </div>

        <label className="flex items-center gap-3">
          <Volume2 size={20} />
          <input
            type="range"
            className="range range-primary flex-1"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            aria-label={t('player.volume')}
          />
        </label>

        <div className="flex items-center justify-center gap-4">
          <span className="text-sm">{t('player.transpose')}</span>
          <button type="button" className="btn btn-sm" onClick={guarded(() => setTranspose.mutate(transpose - 1))}>
            -1
          </button>
          <span className="badge badge-lg">{transpose > 0 ? `+${transpose}` : transpose}</span>
          <button type="button" className="btn btn-sm" onClick={guarded(() => setTranspose.mutate(transpose + 1))}>
            +1
          </button>
        </div>
      </div>
      <button type="button" className="modal-backdrop" aria-label={t('common.close')} onClick={onClose} />
    </div>
  )
}
```

`AppLayout`: `<RemoteDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />`. Chaves i18n: `player.restart`, `player.volume`, `player.transpose`, `common.close`.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd bokusu-front && npx vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add bokusu-front/src
git commit -m "feat: expanded remote drawer with volume, transpose and restart"
```

---

### Task 14: `/api/search` + `/api/downloads` (Fase 3, Lane Backend — paralela com T15–T17)

**Files:**
- Create: `pikaraoke/routes/api/search.py`, `pikaraoke/routes/api/downloads.py`
- Modify: `pikaraoke/routes/api/__init__.py`
- Test: `tests/unit/api/test_search.py`, `tests/unit/api/test_downloads.py`

**Interfaces:**
- Consumes: `get_search_results`, `get_stream_url` de `pikaraoke.lib.youtube_dl` (mesmos imports de `routes/search.py`); `k.song_manager.songs`, `.display_name_from_path`; `k.download_manager.queue_download(song, queue, user, title)`, `.get_downloads_status()`, `.remove_error(id)`.
- Produces: endpoints da tabela de contratos.

- [ ] **Step 1: Testes que falham**

```python
# tests/unit/api/test_search.py
"""Tests for /api/search."""

from unittest.mock import patch


def test_search_appends_karaoke_by_default(client):
    with patch("pikaraoke.routes.api.search.get_search_results") as gsr:
        gsr.return_value = [["Title", "http://u", "id1"]]
        data = client.get("/api/search?q=queen").get_json()
    gsr.assert_called_once_with("queen karaoke")
    assert data == {"results": [["Title", "http://u", "id1"]]}


def test_search_non_karaoke_skips_suffix(client):
    with patch("pikaraoke.routes.api.search.get_search_results") as gsr:
        gsr.return_value = []
        client.get("/api/search?q=queen&non_karaoke=true")
    gsr.assert_called_once_with("queen")


def test_autocomplete_matches_local_songs(client, fake_karaoke):
    fake_karaoke.song_manager.songs = ["/x/Queen - Bohemian.mp4", "/x/Other.mp4"]
    fake_karaoke.song_manager.display_name_from_path.side_effect = lambda p: p.split("/")[-1]
    data = client.get("/api/search/autocomplete?q=queen").get_json()
    assert len(data) == 1
    assert data[0]["path"] == "/x/Queen - Bohemian.mp4"


def test_preview_returns_stream_url(client):
    with patch("pikaraoke.routes.api.search.get_stream_url", return_value="http://s"):
        assert client.get("/api/search/preview?url=http://y").get_json() == {
            "stream_url": "http://s"
        }


def test_preview_500_when_unavailable(client):
    with patch("pikaraoke.routes.api.search.get_stream_url", return_value=None):
        assert client.get("/api/search/preview?url=http://y").status_code == 500
```

```python
# tests/unit/api/test_downloads.py
"""Tests for /api/downloads."""


def test_post_download_queues(client, fake_karaoke):
    resp = client.post(
        "/api/downloads",
        json={
            "song_url": "http://y",
            "song_added_by": "Ana",
            "song_title": "T",
            "queue": True,
        },
    )
    assert resp.get_json() == {"status": "ok"}
    fake_karaoke.download_manager.queue_download.assert_called_once_with(
        "http://y", True, "Ana", "T"
    )


def test_get_downloads_passthrough(client, fake_karaoke):
    fake_karaoke.download_manager.get_downloads_status.return_value = {
        "active": None,
        "pending": [],
        "errors": [{"id": "e1"}],
    }
    assert client.get("/api/downloads").get_json()["errors"] == [{"id": "e1"}]


def test_delete_error(client, fake_karaoke):
    fake_karaoke.download_manager.remove_error.return_value = True
    assert client.delete("/api/downloads/errors/e1").get_json() == {"success": True}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `uv run pytest tests/unit/api/test_search.py tests/unit/api/test_downloads.py -v`
Expected: FAIL — 404

- [ ] **Step 3: Implementar**

```python
# pikaraoke/routes/api/search.py
"""YouTube/local search endpoints for the /api mirror."""

from flask import jsonify
from flask_smorest import Blueprint
from marshmallow import Schema, fields

from pikaraoke.lib.current_app import get_karaoke_instance
from pikaraoke.lib.youtube_dl import get_search_results, get_stream_url

api_search_bp = Blueprint("api_search", __name__, url_prefix="/api")


class SearchQuery(Schema):
    q = fields.String(required=True)
    non_karaoke = fields.Boolean(load_default=False)


class AutocompleteQuery(Schema):
    q = fields.String(required=True)


class PreviewQuery(Schema):
    url = fields.String(required=True)


@api_search_bp.route("/search", methods=["GET"])
@api_search_bp.arguments(SearchQuery, location="query")
def search(query):
    """Search YouTube for karaoke videos."""
    term = query["q"] if query["non_karaoke"] else query["q"] + " karaoke"
    return jsonify({"results": get_search_results(term)})


@api_search_bp.route("/search/autocomplete", methods=["GET"])
@api_search_bp.arguments(AutocompleteQuery, location="query")
def autocomplete(query):
    """Match local library songs for typeahead."""
    k = get_karaoke_instance()
    q = query["q"].lower()
    result = [
        {
            "path": song,
            "fileName": k.song_manager.display_name_from_path(song),
            "type": "autocomplete",
        }
        for song in k.song_manager.songs
        if q in song.lower()
    ]
    return jsonify(result)


@api_search_bp.route("/search/preview", methods=["GET"])
@api_search_bp.arguments(PreviewQuery, location="query")
def preview(query):
    """Resolve a direct stream URL for previewing a YouTube video."""
    stream_url = get_stream_url(query["url"])
    if stream_url is None:
        return jsonify({"error": "Could not fetch stream URL"}), 500
    return jsonify({"stream_url": stream_url})
```

```python
# pikaraoke/routes/api/downloads.py
"""Download queue endpoints for the /api mirror."""

from flask import jsonify
from flask_smorest import Blueprint
from marshmallow import Schema, fields

from pikaraoke.lib.current_app import get_karaoke_instance

api_downloads_bp = Blueprint("api_downloads", __name__, url_prefix="/api")


class DownloadBody(Schema):
    song_url = fields.String(required=True)
    song_added_by = fields.String(required=True)
    song_title = fields.String(required=True)
    queue = fields.Boolean(load_default=False)


@api_downloads_bp.route("/downloads", methods=["POST"])
@api_downloads_bp.arguments(DownloadBody, location="json")
def start_download(body):
    """Queue a YouTube download, optionally enqueueing after."""
    k = get_karaoke_instance()
    k.download_manager.queue_download(
        body["song_url"], body["queue"], body["song_added_by"], body["song_title"]
    )
    return jsonify({"status": "ok"})


@api_downloads_bp.route("/downloads", methods=["GET"])
def downloads_status():
    """Active, pending and failed downloads."""
    k = get_karaoke_instance()
    return jsonify(k.download_manager.get_downloads_status())


@api_downloads_bp.route("/downloads/errors/<error_id>", methods=["DELETE"])
def dismiss_error(error_id):
    """Dismiss a download error by id."""
    k = get_karaoke_instance()
    return jsonify({"success": k.download_manager.remove_error(error_id)})
```

Registrar ambos em `__init__.py`.

- [ ] **Step 4: Rodar e ver passar**

Run: `uv run pytest tests/unit/api/ -v`
Expected: todos passam

- [ ] **Step 5: Commit**

```bash
git add pikaraoke/routes/api tests/unit/api
git commit -m "feat: add /api/search and /api/downloads endpoints"
```

---

### Task 15: `/api/files` (Fase 3, Lane Backend — paralela)

**Files:**
- Create: `pikaraoke/routes/api/files.py`
- Modify: `pikaraoke/routes/api/__init__.py`
- Test: `tests/unit/api/test_files.py`

**Interfaces:**
- Consumes: `k.song_manager.songs`, `.display_name_from_path`, `.delete(path)`, `.rename(old, new)`, `.download_path`; `k.queue_manager.is_song_in_queue`; `youtube_id_suffix` de `pikaraoke.lib.metadata_parser`; `k.browse_results_per_page`.
- Produces: endpoints da tabela. Regras espelhadas do legado: não deletar/renomear música na fila; rename preserva sufixo de ID do YouTube e extensão; rename falha se destino já existe.

- [ ] **Step 1: Testes que falham**

```python
# tests/unit/api/test_files.py
"""Tests for /api/files."""


def _setup_songs(fake_karaoke):
    fake_karaoke.song_manager.songs = ["/x/Alpha.mp4", "/x/Beta.mp4"]
    fake_karaoke.song_manager.display_name_from_path.side_effect = (
        lambda p: p.rsplit("/", 1)[-1].removesuffix(".mp4")
    )
    fake_karaoke.browse_results_per_page = 100


def test_browse_lists_files(client, fake_karaoke):
    _setup_songs(fake_karaoke)
    data = client.get("/api/files/browse").get_json()
    assert data["total"] == 2
    assert data["files"][0] == {"path": "/x/Alpha.mp4", "displayName": "Alpha"}


def test_browse_filters_by_query(client, fake_karaoke):
    _setup_songs(fake_karaoke)
    data = client.get("/api/files/browse?q=beta").get_json()
    assert data["total"] == 1
    assert data["files"][0]["path"] == "/x/Beta.mp4"


def test_delete_requires_admin(client):
    assert client.delete("/api/files?song=/x/Alpha.mp4").status_code == 403


def test_delete_refuses_queued_song(admin_client, fake_karaoke):
    _setup_songs(fake_karaoke)
    fake_karaoke.queue_manager.is_song_in_queue.return_value = True
    resp = admin_client.delete("/api/files?song=/x/Alpha.mp4")
    assert resp.status_code == 409
    fake_karaoke.song_manager.delete.assert_not_called()


def test_delete_removes_song(admin_client, fake_karaoke):
    _setup_songs(fake_karaoke)
    fake_karaoke.queue_manager.is_song_in_queue.return_value = False
    resp = admin_client.delete("/api/files?song=/x/Alpha.mp4")
    assert resp.get_json()["success"] is True
    fake_karaoke.song_manager.delete.assert_called_once_with("/x/Alpha.mp4")


def test_rename_delegates(admin_client, fake_karaoke, tmp_path):
    _setup_songs(fake_karaoke)
    fake_karaoke.queue_manager.is_song_in_queue.return_value = False
    fake_karaoke.song_manager.download_path = str(tmp_path)
    resp = admin_client.patch(
        "/api/files",
        json={"old_file_name": "/x/Alpha---dQw4w9WgXcQ.mp4", "new_file_name": "Alpha Nova"},
    )
    assert resp.get_json()["success"] is True
    fake_karaoke.song_manager.rename.assert_called_once()
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `uv run pytest tests/unit/api/test_files.py -v`
Expected: FAIL — 404

- [ ] **Step 3: Implementar**

```python
# pikaraoke/routes/api/files.py
"""Local library file endpoints for the /api mirror."""

import logging
import os

from flask import jsonify
from flask_smorest import Blueprint
from marshmallow import Schema, fields

from pikaraoke.lib.current_app import get_karaoke_instance
from pikaraoke.lib.metadata_parser import youtube_id_suffix
from pikaraoke.routes.api._utils import require_admin

api_files_bp = Blueprint("api_files", __name__, url_prefix="/api")


class BrowseQuery(Schema):
    q = fields.String(load_default="")
    letter = fields.String(load_default="")
    sort = fields.String(load_default="alpha")
    page = fields.Integer(load_default=1)


class RenameBody(Schema):
    old_file_name = fields.String(required=True)
    new_file_name = fields.String(required=True)


class SongQuery(Schema):
    song = fields.String(required=True)


@api_files_bp.route("/files/browse", methods=["GET"])
@api_files_bp.arguments(BrowseQuery, location="query")
def browse(query):
    """Paginated, filterable list of library files."""
    k = get_karaoke_instance()
    songs = list(k.song_manager.songs)

    if query["q"]:
        q = query["q"].lower()
        songs = [s for s in songs if q in s.lower()]
    if query["letter"]:
        letter = query["letter"].lower()
        songs = [
            s for s in songs if k.song_manager.display_name_from_path(s).lower().startswith(letter)
        ]
    if query["sort"] == "date":
        songs = sorted(songs, key=os.path.getmtime, reverse=True)

    per_page = k.browse_results_per_page
    page = max(query["page"], 1)
    start = (page - 1) * per_page
    page_songs = songs[start : start + per_page]

    return jsonify(
        {
            "files": [
                {"path": s, "displayName": k.song_manager.display_name_from_path(s)}
                for s in page_songs
            ],
            "total": len(songs),
            "page": page,
            "perPage": per_page,
        }
    )


@api_files_bp.route("/files", methods=["DELETE"])
@api_files_bp.arguments(SongQuery, location="query")
@require_admin
def delete_file(query):
    """Delete a library file unless it is queued."""
    k = get_karaoke_instance()
    song = query["song"]
    if k.queue_manager.is_song_in_queue(song):
        return jsonify({"error": "Song is in the current queue"}), 409
    k.song_manager.delete(song)
    return jsonify({"success": True, "message": "Song deleted"})


@api_files_bp.route("/files", methods=["PATCH"])
@api_files_bp.arguments(RenameBody, location="json")
@require_admin
def rename_file(body):
    """Rename a library file, preserving the YouTube id suffix."""
    k = get_karaoke_instance()
    old_name = body["old_file_name"]
    if k.queue_manager.is_song_in_queue(old_name):
        return jsonify({"error": "Song is in the current queue"}), 409

    new_name_full = body["new_file_name"] + youtube_id_suffix(old_name)
    extension = os.path.splitext(old_name)[1]
    target = os.path.join(k.song_manager.download_path, new_name_full + extension)
    if os.path.isfile(target):
        return jsonify({"error": "Filename already exists"}), 409

    try:
        k.song_manager.rename(old_name, new_name_full)
    except OSError as exc:
        logging.error(f"Error renaming file: {exc}")
        return jsonify({"error": f"Error renaming file: {exc}"}), 500
    return jsonify({"success": True, "message": "Song renamed"})
```

Registrar `api_files_bp` em `__init__.py`.

- [ ] **Step 4: Rodar e ver passar**

Run: `uv run pytest tests/unit/api/ -v`
Expected: todos passam

- [ ] **Step 5: Commit**

```bash
git add pikaraoke/routes/api tests/unit/api/test_files.py
git commit -m "feat: add /api/files browse, rename and delete endpoints"
```

---

### Task 16: `/api/renamer` (Fase 3, Lane Backend — paralela)

**Files:**
- Create: `pikaraoke/routes/api/renamer.py`
- Modify: `pikaraoke/routes/api/__init__.py`
- Test: `tests/unit/api/test_renamer.py`

**Interfaces:**
- Consumes: `get_song_correct_name` de `pikaraoke.lib.metadata_parser`; `_names_match` e `RESULTS_PER_PAGE` de `pikaraoke.routes.batch_song_renamer` (reuso direto — helpers puros); `k.song_manager.filename_from_path`, `.rename`; `k.queue_manager.is_song_in_queue`.
- Produces: `GET /api/renamer/songs?page=&only_mismatched=` → `{"songs": [{"file","currentName","suggestedName","isEqual"}], "total", "page"}` (JSON puro — sem os fragmentos HTML do legado); `POST /api/renamer/rename {"old_name","new_name"}`.

- [ ] **Step 1: Testes que falham**

```python
# tests/unit/api/test_renamer.py
"""Tests for /api/renamer."""

from unittest.mock import patch


def _setup(fake_karaoke):
    fake_karaoke.song_manager.songs = ["/x/bad_name_720p.mp4", "/x/Good Name.mp4"]
    fake_karaoke.song_manager.filename_from_path.side_effect = (
        lambda p: p.rsplit("/", 1)[-1].removesuffix(".mp4")
    )


def test_songs_requires_admin(client):
    assert client.get("/api/renamer/songs").status_code == 403


def test_songs_lists_with_suggestions(admin_client, fake_karaoke):
    _setup(fake_karaoke)
    with patch(
        "pikaraoke.routes.api.renamer.get_song_correct_name",
        side_effect=["Bad Name", "Good Name"],
    ):
        data = admin_client.get("/api/renamer/songs").get_json()
    assert data["total"] == 2
    assert data["songs"][0]["suggestedName"] == "Bad Name"
    assert data["songs"][0]["isEqual"] is False
    assert data["songs"][1]["isEqual"] is True


def test_only_mismatched_filters(admin_client, fake_karaoke):
    _setup(fake_karaoke)
    with patch(
        "pikaraoke.routes.api.renamer.get_song_correct_name",
        side_effect=["Bad Name", "Good Name"],
    ):
        data = admin_client.get("/api/renamer/songs?only_mismatched=true").get_json()
    assert len(data["songs"]) == 1


def test_rename_delegates(admin_client, fake_karaoke):
    fake_karaoke.queue_manager.is_song_in_queue.return_value = False
    resp = admin_client.post(
        "/api/renamer/rename", json={"old_name": "/x/bad.mp4", "new_name": "Good"}
    )
    assert resp.get_json()["success"] is True
    fake_karaoke.song_manager.rename.assert_called_once_with("/x/bad.mp4", "Good")
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `uv run pytest tests/unit/api/test_renamer.py -v`
Expected: FAIL — 404

- [ ] **Step 3: Implementar**

```python
# pikaraoke/routes/api/renamer.py
"""Batch song renamer endpoints for the /api mirror."""

import logging

from flask import jsonify
from flask_smorest import Blueprint
from marshmallow import Schema, fields

from pikaraoke.lib.current_app import get_karaoke_instance
from pikaraoke.lib.metadata_parser import get_song_correct_name
from pikaraoke.routes.api._utils import require_admin
from pikaraoke.routes.batch_song_renamer import RESULTS_PER_PAGE, _names_match

api_renamer_bp = Blueprint("api_renamer", __name__, url_prefix="/api")


class RenamerQuery(Schema):
    page = fields.Integer(load_default=1)
    only_mismatched = fields.Boolean(load_default=False)


class RenamerRenameBody(Schema):
    old_name = fields.String(required=True)
    new_name = fields.String(required=True)


@api_renamer_bp.route("/renamer/songs", methods=["GET"])
@api_renamer_bp.arguments(RenamerQuery, location="query")
@require_admin
def renamer_songs(query):
    """Library files with rename suggestions (before/after)."""
    k = get_karaoke_instance()
    entries = []
    for song in k.song_manager.songs:
        current = k.song_manager.filename_from_path(song)
        suggested = get_song_correct_name(current, raw_filename=song)
        is_equal = _names_match(current, suggested)
        if query["only_mismatched"] and is_equal:
            continue
        entries.append(
            {
                "file": song,
                "currentName": current,
                "suggestedName": suggested,
                "isEqual": is_equal,
            }
        )

    page = max(query["page"], 1)
    start = (page - 1) * RESULTS_PER_PAGE
    return jsonify(
        {
            "songs": entries[start : start + RESULTS_PER_PAGE],
            "total": len(entries),
            "page": page,
        }
    )


@api_renamer_bp.route("/renamer/rename", methods=["POST"])
@api_renamer_bp.arguments(RenamerRenameBody, location="json")
@require_admin
def renamer_rename(body):
    """Apply a single rename suggestion."""
    k = get_karaoke_instance()
    if k.queue_manager.is_song_in_queue(body["old_name"]):
        return jsonify({"error": "Song is in the current queue"}), 409
    try:
        k.song_manager.rename(body["old_name"], body["new_name"])
    except OSError as exc:
        logging.error(f"Error renaming file: {exc}")
        return jsonify({"error": f"Error renaming file: {exc}"}), 500
    return jsonify({"success": True, "message": "Song renamed"})
```

Registrar `api_renamer_bp` em `__init__.py`. Nota: se `_names_match`/`RESULTS_PER_PAGE` não forem importáveis sem efeito colateral do módulo legado, duplicá-los em `_utils.py` (são ~10 linhas puras) — decidir na implementação pelo menor acoplamento.

- [ ] **Step 4: Rodar e ver passar**

Run: `uv run pytest tests/unit/api/ -v`
Expected: todos passam

- [ ] **Step 5: Commit**

```bash
git add pikaraoke/routes/api tests/unit/api/test_renamer.py
git commit -m "feat: add /api/renamer endpoints with pure JSON contracts"
```

---

### Task 17: `/api/system` (Fase 3, Lane Backend — paralela)

**Files:**
- Create: `pikaraoke/routes/api/system.py`
- Modify: `pikaraoke/routes/api/__init__.py`
- Test: `tests/unit/api/test_system.py`

**Interfaces:**
- Consumes: `psutil` (mesmo uso de `routes/info.py`); `upgrade_youtubedl` de `pikaraoke.lib.youtube_dl`; `delayed_halt` de `pikaraoke.lib.current_app`; `k.sync_library()`; `k.youtubedl_version`; `pikaraoke.version.VERSION`; `threading`.
- Produces: endpoints da tabela. Ações destrutivas rodam em `threading.Thread` (como o legado) e retornam imediatamente `{"status": "started"}`.

- [ ] **Step 1: Testes que falham**

```python
# tests/unit/api/test_system.py
"""Tests for /api/system."""

from unittest.mock import patch


def test_info_requires_admin(client):
    assert client.get("/api/system/info").status_code == 403


def test_info_returns_stats(admin_client, fake_karaoke):
    fake_karaoke.youtubedl_version = "2026.01.01"
    data = admin_client.get("/api/system/info").get_json()
    assert set(data) == {"cpu", "memory", "disk", "youtubedlVersion", "pikaraokeVersion"}


def test_library_stats(admin_client, fake_karaoke):
    fake_karaoke.song_manager.songs = ["/x/a.mp4"]
    assert admin_client.get("/api/system/library-stats").get_json() == {"song_count": 1}


def test_sync_library(admin_client, fake_karaoke):
    fake_karaoke.sync_library.return_value = True
    assert admin_client.post("/api/system/sync-library").get_json() == {"status": "started"}
    fake_karaoke.sync_library.return_value = False
    assert admin_client.post("/api/system/sync-library").get_json() == {
        "status": "already_syncing"
    }


def test_update_ytdl_spawns_thread(admin_client):
    with patch("pikaraoke.routes.api.system.threading.Thread") as thread:
        resp = admin_client.post("/api/system/update-ytdl")
    assert resp.get_json() == {"status": "started"}
    thread.return_value.start.assert_called_once()


def test_reboot_spawns_halt_thread(admin_client):
    with patch("pikaraoke.routes.api.system.threading.Thread") as thread:
        resp = admin_client.post("/api/system/reboot")
    assert resp.get_json() == {"status": "started"}
    thread.assert_called_once()
    assert thread.call_args.kwargs["args"] == [2]
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `uv run pytest tests/unit/api/test_system.py -v`
Expected: FAIL — 404

- [ ] **Step 3: Implementar**

```python
# pikaraoke/routes/api/system.py
"""System administration endpoints for the /api mirror."""

import threading
import time

import psutil
from flask import jsonify
from flask_smorest import Blueprint

from pikaraoke.lib.current_app import delayed_halt, get_karaoke_instance
from pikaraoke.lib.youtube_dl import upgrade_youtubedl
from pikaraoke.routes.api._utils import require_admin
from pikaraoke.version import VERSION

api_system_bp = Blueprint("api_system", __name__, url_prefix="/api")

# delayed_halt cmd codes (see lib/current_app.py)
_HALT_ACTIONS = {"quit": 0, "shutdown": 1, "reboot": 2, "expand-fs": 3}


@api_system_bp.route("/system/info", methods=["GET"])
@require_admin
def system_info():
    """CPU, memory, disk stats plus component versions."""
    k = get_karaoke_instance()
    try:
        cpu = f"{psutil.cpu_percent(interval=1)}%"
    except Exception:
        cpu = "unsupported"
    memory = psutil.virtual_memory()
    mem_str = (
        f"{round(memory.available / 1024.0 / 1024.0, 1)}MB free / "
        f"{round(memory.total / 1024.0 / 1024.0, 1)}MB total ({memory.percent}%)"
    )
    disk = psutil.disk_usage("/")
    disk_str = (
        f"{round(disk.free / 1024.0**3, 1)}GB free / "
        f"{round(disk.total / 1024.0**3, 1)}GB total ({disk.percent}%)"
    )
    return jsonify(
        {
            "cpu": cpu,
            "memory": mem_str,
            "disk": disk_str,
            "youtubedlVersion": k.youtubedl_version,
            "pikaraokeVersion": VERSION,
        }
    )


@api_system_bp.route("/system/library-stats", methods=["GET"])
@require_admin
def library_stats():
    """Song count of the local library."""
    k = get_karaoke_instance()
    return jsonify({"song_count": len(k.song_manager.songs)})


@api_system_bp.route("/system/sync-library", methods=["POST"])
@require_admin
def sync_library():
    """Trigger a background library scan."""
    k = get_karaoke_instance()
    started = k.sync_library()
    return jsonify({"status": "started" if started else "already_syncing"})


@api_system_bp.route("/system/update-ytdl", methods=["POST"])
@require_admin
def update_ytdl():
    """Upgrade yt-dlp in a background thread."""
    k = get_karaoke_instance()

    def do_update() -> None:
        time.sleep(3)
        k.youtubedl_version = upgrade_youtubedl()

    threading.Thread(target=do_update).start()
    return jsonify({"status": "started"})


@api_system_bp.route("/system/<action>", methods=["POST"])
@require_admin
def halt_action(action):
    """Quit, shutdown, reboot or expand-fs via delayed halt."""
    if action not in _HALT_ACTIONS:
        return jsonify({"error": f"Unknown action: {action}"}), 404
    threading.Thread(target=delayed_halt, args=[_HALT_ACTIONS[action]]).start()
    return jsonify({"status": "started"})
```

Registrar `api_system_bp` em `__init__.py`. Atenção à ordem das rotas: `/system/<action>` deve vir DEPOIS das rotas específicas no arquivo (Flask resolve por especificidade de regra, mas manter específicas primeiro evita surpresa).

- [ ] **Step 4: Rodar e ver passar**

Run: `uv run pytest tests/unit/api/ -v`
Expected: todos passam

- [ ] **Step 5: Commit**

```bash
git add pikaraoke/routes/api tests/unit/api/test_system.py
git commit -m "feat: add /api/system info, stats and admin action endpoints"
```

---

### Task 18: Fila — drag and drop (Fase 3, Lane Front)

**Files:**
- Modify: `bokusu-front/src/pages/QueuePage.tsx`, `bokusu-front/src/components/QueueItem.tsx`, `bokusu-front/src/hooks/useQueue.ts` (adicionar `useReorderQueue`), `bokusu-front/package.json`
- Test: `bokusu-front/src/hooks/useQueue.test.tsx` (casos novos)

**Interfaces:**
- Consumes: `useQueue` (T9); `useAppStore` (`isAdmin`, `openAdminModal`); `@dnd-kit/core` + `@dnd-kit/sortable`.
- Produces: `useReorderQueue(): UseMutationResult` — `mutate({ oldIndex, newIndex })`, otimista com rollback; T19 reusa o mesmo `QueueItem` estendido.

- [ ] **Step 1: Instalar dependências**

```bash
cd bokusu-front && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Teste que falha**

```typescript
// adicionar a bokusu-front/src/hooks/useQueue.test.tsx
import { useReorderQueue } from './useQueue'

it('useReorderQueue PUTs old/new index and applies optimistic move', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ success: true }), { status: 200 })
  )
  vi.stubGlobal('fetch', fetchMock)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(['queue'], [
    { user: 'A', file: '/a', title: 'A', semitones: 0 },
    { user: 'B', file: '/b', title: 'B', semitones: 0 },
  ])
  const { result } = renderHook(() => useReorderQueue(), {
    wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
  })
  result.current.mutate({ oldIndex: 0, newIndex: 1 })
  // otimista: aplica antes da resposta
  expect((qc.getQueryData(['queue']) as { file: string }[])[0].file).toBe('/b')
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/queue/reorder',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ old_index: 0, new_index: 1 }),
      })
    )
  )
})
```

Run: `cd bokusu-front && npx vitest run src/hooks/useQueue.test.tsx` — Expected: FAIL

- [ ] **Step 3: Implementar**

Adicionar em `useQueue.ts`:

```typescript
import { arrayMove } from '@dnd-kit/sortable'

export function useReorderQueue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) =>
      apiFetch<{ success: boolean }>('/api/queue/reorder', {
        method: 'PUT',
        body: JSON.stringify({ old_index: oldIndex, new_index: newIndex }),
      }),
    onMutate: async ({ oldIndex, newIndex }) => {
      await queryClient.cancelQueries({ queryKey: ['queue'] })
      const previous = queryClient.getQueryData<QueueItem[]>(['queue'])
      queryClient.setQueryData<QueueItem[]>(['queue'], (old) =>
        old ? arrayMove(old, oldIndex, newIndex) : old
      )
      return { previous }
    },
    onError: (_e, _v, context) => {
      if (context?.previous) queryClient.setQueryData(['queue'], context.previous)
    },
  })
}
```

`QueuePage.tsx`: envolver a lista com `<DndContext onDragEnd={...}>` + `<SortableContext items={queue.map(q => q.file)} strategy={verticalListSortingStrategy}>`. No `onDragEnd`, mapear `active.id`/`over.id` para índices e chamar `reorder.mutate({ oldIndex, newIndex })` — com gate JIT (`openAdminModal`) quando não-admin. `QueueItem.tsx`: `useSortable({ id: item.file })`, drag handle à esquerda com `<GripVertical size={18} />` (`{...attributes} {...listeners}` só no handle), `transform`/`transition` via `CSS.Transform.toString(transform)` de `@dnd-kit/utilities`.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd bokusu-front && npx vitest run && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add bokusu-front
git commit -m "feat: queue drag-and-drop reorder with optimistic updates"
```

---

### Task 19: Fila — menu contextual, limpar, aleatórias, estados de download (depende de T18; paralela com T20)

**Files:**
- Create: `bokusu-front/src/components/QueueActionsMenu.tsx`, `bokusu-front/src/components/DownloadErrorsCard.tsx`, `bokusu-front/src/components/ConfirmModal.tsx`, `bokusu-front/src/hooks/useDownloads.ts`
- Modify: `bokusu-front/src/pages/QueuePage.tsx`, `bokusu-front/src/components/QueueItem.tsx`, `bokusu-front/src/hooks/useQueue.ts` (mutações item/clear/random), `bokusu-front/src/types/api.ts` (adicionar `DownloadsStatus`)
- Test: `bokusu-front/src/components/QueueActionsMenu.test.tsx`, `bokusu-front/src/hooks/useDownloads.test.tsx`

**Interfaces:**
- Consumes: contratos `PATCH/DELETE /api/queue/item`, `DELETE /api/queue`, `POST /api/queue/random`, `GET /api/downloads`, `DELETE /api/downloads/errors/<id>`; `useSocketEvent` (`download_started`, `download_stopped`); `pushToast` (T10); `ConfirmModal` (criado aqui, reusado em T22/T23).
- Produces:
  ```typescript
  useQueueItemAction(): UseMutationResult   // mutate({ song, action: 'top'|'up'|'down' }) e deleteItem(song)
  useClearQueue(): UseMutationResult
  useAddRandom(): UseMutationResult          // mutate(amount)
  useDownloads(): UseQueryResult<DownloadsStatus>  // polling 3s APENAS quando active/pending não-vazios
  interface DownloadsStatus { active: Record<string, unknown> | null; pending: unknown[]; errors: { id: string; [k: string]: unknown }[] }
  <ConfirmModal open title message onConfirm onCancel />  // componente genérico de confirmação dupla
  ```

- [ ] **Step 1: Testes que falham**

```typescript
// bokusu-front/src/components/QueueActionsMenu.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { QueueActionsMenu } from './QueueActionsMenu'
import { useAppStore } from '../store/useAppStore'

function renderMenu() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  useAppStore.setState({ isAdmin: true })
  return render(
    <QueryClientProvider client={qc}>
      <QueueActionsMenu song="/x/a.mp4" />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })))
  )
})

it('"play next" PATCHes item to top', async () => {
  renderMenu()
  fireEvent.click(screen.getByRole('button', { name: /opções|options/i }))
  fireEvent.click(screen.getByText(/tocar a seguir|play next/i))
  await waitFor(() =>
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/queue/item',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ song: '/x/a.mp4', action: 'top' }),
      })
    )
  )
})

it('"delete" DELETEs item', async () => {
  renderMenu()
  fireEvent.click(screen.getByRole('button', { name: /opções|options/i }))
  fireEvent.click(screen.getByText(/apagar|delete/i))
  await waitFor(() =>
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/api/queue/item?song='),
      expect.objectContaining({ method: 'DELETE' })
    )
  )
})
```

```typescript
// bokusu-front/src/hooks/useDownloads.test.tsx
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDownloads } from './useDownloads'
import type { ReactNode } from 'react'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

it('fetches downloads status', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ active: null, pending: [], errors: [{ id: 'e1' }] }))
    )
  )
  const { result } = renderHook(() => useDownloads(), { wrapper })
  await waitFor(() => expect(result.current.data?.errors).toHaveLength(1))
})
```

Run: `cd bokusu-front && npx vitest run src/components/QueueActionsMenu.test.tsx src/hooks/useDownloads.test.tsx` — Expected: FAIL

- [ ] **Step 2: Implementar hooks**

Adicionar em `useQueue.ts`:

```typescript
export function useQueueItemAction() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['queue'] })
  const move = useMutation({
    mutationFn: ({ song, action }: { song: string; action: 'top' | 'bottom' | 'up' | 'down' }) =>
      apiFetch<{ success: boolean }>('/api/queue/item', {
        method: 'PATCH',
        body: JSON.stringify({ song, action }),
      }),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (song: string) =>
      apiFetch<{ success: boolean }>(`/api/queue/item?song=${encodeURIComponent(song)}`, {
        method: 'DELETE',
      }),
    onSuccess: invalidate,
  })
  return { move, remove }
}

export function useClearQueue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<{ success: boolean }>('/api/queue', { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queue'] }),
  })
}

export function useAddRandom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (amount: number) =>
      apiFetch<{ success: boolean }>('/api/queue/random', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queue'] }),
  })
}
```

```typescript
// bokusu-front/src/hooks/useDownloads.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { useSocketEvent } from './useSocketEvent'
import type { DownloadsStatus } from '../types/api'

export function useDownloads() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['downloads'] })
  useSocketEvent('download_started', invalidate)
  useSocketEvent('download_stopped', invalidate)

  return useQuery({
    queryKey: ['downloads'],
    queryFn: () => apiFetch<DownloadsStatus>('/api/downloads'),
    refetchInterval: (query) => {
      const data = query.state.data
      const busy = data && (data.active !== null || data.pending.length > 0)
      return busy ? 3000 : false
    },
  })
}

export function useDismissDownloadError() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/downloads/errors/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['downloads'] }),
  })
}
```

- [ ] **Step 3: Implementar componentes**

```tsx
// bokusu-front/src/components/QueueActionsMenu.tsx
import { MoreVertical, ArrowUpToLine, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQueueItemAction } from '../hooks/useQueue'
import { useAppStore } from '../store/useAppStore'

interface QueueActionsMenuProps {
  song: string
}

export function QueueActionsMenu({ song }: QueueActionsMenuProps) {
  const { t } = useTranslation()
  const { move, remove } = useQueueItemAction()
  const { isAdmin, openAdminModal } = useAppStore()

  const guarded = (action: () => void) => () => {
    if (isAdmin) action()
    else openAdminModal(action)
  }

  return (
    <div className="dropdown dropdown-end">
      <button type="button" tabIndex={0} className="btn btn-ghost btn-circle btn-sm" aria-label={t('queue.options')}>
        <MoreVertical size={18} />
      </button>
      <ul className="dropdown-content menu bg-base-200 rounded-box z-10 w-48 shadow">
        <li>
          <button type="button" onClick={guarded(() => move.mutate({ song, action: 'top' }))}>
            <ArrowUpToLine size={16} />
            {t('queue.playNext')}
          </button>
        </li>
        <li>
          <button type="button" className="text-error" onClick={guarded(() => remove.mutate(song))}>
            <Trash2 size={16} />
            {t('queue.delete')}
          </button>
        </li>
      </ul>
    </div>
  )
}
```

```tsx
// bokusu-front/src/components/DownloadErrorsCard.tsx
import { AlertTriangle, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDownloads, useDismissDownloadError } from '../hooks/useDownloads'

export function DownloadErrorsCard() {
  const { t } = useTranslation()
  const { data } = useDownloads()
  const dismiss = useDismissDownloadError()

  if (!data || data.errors.length === 0) return null
  return (
    <div className="collapse collapse-arrow bg-error/10 border border-error/30">
      <input type="checkbox" aria-label={t('queue.downloadErrors')} />
      <div className="collapse-title flex items-center gap-2 text-error">
        <AlertTriangle size={16} />
        {t('queue.downloadErrors')} ({data.errors.length})
      </div>
      <div className="collapse-content flex flex-col gap-2">
        {data.errors.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{String(e.title ?? e.id)}</span>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              aria-label={t('common.dismiss')}
              onClick={() => dismiss.mutate(e.id)}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

`ConfirmModal.tsx` (genérico, DaisyUI `modal`): props `open, title, message, onConfirm, onCancel`; botão confirmar `btn-error`. Usar no botão "Limpar fila".

`QueuePage.tsx`: topo ganha `DownloadErrorsCard`, botão "Limpar fila" (admin, com `ConfirmModal`) e botão "Adicionar aleatórias" (admin, `input type=number` 1–20 + confirmar). `QueueItem.tsx`: renderiza `QueueActionsMenu` à direita; quando o item estiver em download (heurística: `file` presente em `downloads.pending`/`active` OU título marcado — conferir shape real de `active`/`pending` no runtime e ajustar o matcher), aplicar `opacity-50` + spinner no lugar da thumb.

Chaves i18n novas nos dois locales: `queue.options`, `queue.playNext`, `queue.delete`, `queue.clear`, `queue.clearConfirm`, `queue.addRandom`, `queue.downloadErrors`, `common.dismiss`, `common.confirm`, `common.cancel`.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd bokusu-front && npx vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add bokusu-front/src
git commit -m "feat: queue context menu, clear, random add and download states"
```

---

### Task 20: Busca completa — autocomplete, preview, download direto, badges (paralela com T18/T19)

**Files:**
- Create: `bokusu-front/src/components/PreviewModal.tsx`, `bokusu-front/src/hooks/useAutocomplete.ts`
- Modify: `bokusu-front/src/pages/SearchPage.tsx`, `bokusu-front/src/components/SearchResultItem.tsx`, `bokusu-front/src/hooks/useSearch.ts`
- Test: `bokusu-front/src/hooks/useAutocomplete.test.tsx`, `bokusu-front/src/components/PreviewModal.test.tsx`

**Interfaces:**
- Consumes: `GET /api/search/autocomplete`, `GET /api/search/preview`, `POST /api/downloads`; debounce existente do SearchPage; `pushToast`.
- Produces:
  ```typescript
  useAutocomplete(query: string): UseQueryResult<{ path: string; fileName: string }[]>
  useStartDownload(): UseMutationResult  // mutate({ songUrl, singer, title, queue })
  <PreviewModal url={string | null} onClose={() => void} />
  ```

- [ ] **Step 1: Testes que falham**

```typescript
// bokusu-front/src/hooks/useAutocomplete.test.tsx
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAutocomplete } from './useAutocomplete'
import type { ReactNode } from 'react'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

it('queries /api/search/autocomplete', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ path: '/x/a.mp4', fileName: 'A', type: 'autocomplete' }]))
    )
  )
  const { result } = renderHook(() => useAutocomplete('a'), { wrapper })
  await waitFor(() => expect(result.current.data?.[0].fileName).toBe('A'))
})

it('is disabled for short queries', () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  renderHook(() => useAutocomplete(''), { wrapper })
  expect(fetchMock).not.toHaveBeenCalled()
})
```

```typescript
// bokusu-front/src/components/PreviewModal.test.tsx
import { render, screen } from '@testing-library/react'
import { PreviewModal } from './PreviewModal'

it('renders video with stream url after fetch', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ stream_url: 'http://s/v' })))
  )
  render(<PreviewModal url="http://youtube/w" onClose={() => {}} />)
  const video = await screen.findByTestId('preview-video')
  expect(video).toHaveAttribute('src', 'http://s/v')
})

it('renders nothing when url is null', () => {
  const { container } = render(<PreviewModal url={null} onClose={() => {}} />)
  expect(container).toBeEmptyDOMElement()
})
```

Run: `cd bokusu-front && npx vitest run src/hooks/useAutocomplete.test.tsx src/components/PreviewModal.test.tsx` — Expected: FAIL

- [ ] **Step 2: Implementar**

```typescript
// bokusu-front/src/hooks/useAutocomplete.ts
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'

interface AutocompleteEntry {
  path: string
  fileName: string
  type: string
}

export function useAutocomplete(query: string) {
  return useQuery({
    queryKey: ['autocomplete', query],
    enabled: query.length > 0,
    queryFn: () =>
      apiFetch<AutocompleteEntry[]>(
        `/api/search/autocomplete?q=${encodeURIComponent(query)}`
      ),
  })
}
```

Adicionar em `useSearch.ts`:

```typescript
export function useStartDownload() {
  return useMutation({
    mutationFn: (args: { songUrl: string; singer: string; title: string; queue: boolean }) =>
      apiFetch<{ status: string }>('/api/downloads', {
        method: 'POST',
        body: JSON.stringify({
          song_url: args.songUrl,
          song_added_by: args.singer,
          song_title: args.title,
          queue: args.queue,
        }),
      }),
  })
}
```

```tsx
// bokusu-front/src/components/PreviewModal.tsx
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'

interface PreviewModalProps {
  url: string | null
  onClose: () => void
}

export function PreviewModal({ url, onClose }: PreviewModalProps) {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['preview', url],
    enabled: url !== null,
    queryFn: () =>
      apiFetch<{ stream_url: string }>(
        `/api/search/preview?url=${encodeURIComponent(url as string)}`
      ),
  })

  if (url === null) return null
  return (
    <div className="modal modal-open" role="dialog">
      <div className="modal-box max-w-2xl">
        <div className="flex justify-end">
          <button type="button" className="btn btn-ghost btn-circle btn-sm" aria-label={t('common.close')} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {isLoading && <span className="loading loading-spinner mx-auto block" />}
        {isError && <p className="text-error">{t('search.previewError')}</p>}
        {data && (
          <video data-testid="preview-video" src={data.stream_url} controls autoPlay className="w-full rounded-box" />
        )}
      </div>
      <button type="button" className="modal-backdrop" aria-label={t('common.close')} onClick={onClose} />
    </div>
  )
}
```

`SearchPage.tsx`: dropdown de autocomplete sob o input (resultados de `useAutocomplete(debouncedQuery)`; clique enfileira direto via `useEnqueue` — item local, badge `search.local`). `SearchResultItem.tsx`: badge `search.youtube`; botões: play (abre `PreviewModal`), adicionar à fila (`useStartDownload` com `queue: true` + toast), e "só baixar" (admin JIT, `queue: false`). Prompt de nome do cantor: manter o padrão atual da página (campo existente ou `singerName` da store, conforme já implementado — não inventar fluxo novo).

Chaves i18n: `search.local`, `search.youtube`, `search.preview`, `search.previewError`, `search.downloadOnly`.

- [ ] **Step 3: Rodar e ver passar**

Run: `cd bokusu-front && npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add bokusu-front/src
git commit -m "feat: search autocomplete, video preview and direct download"
```

---

## ═══ CHECKPOINT B — Code review estratégico ═══

Após T12–T20 concluídas:

- [ ] Suites completas: `uv run pytest tests/unit/ -v` e `cd bokusu-front && npx vitest run && npm run lint && npm run build`
- [ ] Verificação integrada manual mínima: subir `uv run python run.py` + `npm run dev`; fila reordena por drag; busca → preview → adicionar; mini-player controla playback.
- [ ] UM subagent revisor no diff desde o Checkpoint A. Foco: acessibilidade do DnD, condições de corrida das mutações otimistas vs invalidação por socket, vazamento de listeners, i18n completo (nenhuma string hardcoded nova).
- [ ] Corrigir apontamentos antes da Fase 4.

---

### Task 21: Settings — Preferências do Servidor (Fase 4 — paralela com T22–T24)

**Files:**
- Create: `bokusu-front/src/components/settings/ServerPreferences.tsx`
- Modify: `bokusu-front/src/pages/SettingsPage.tsx`
- Test: `bokusu-front/src/components/settings/ServerPreferences.test.tsx`

**Interfaces:**
- Consumes: `usePreferences`, `useSetPreference` (T8); `useAppStore.isAdmin`; `ConfirmModal` (T19); i18n.
- Produces: seção admin-only em Settings com os grupos: Player (`volume` slider 0–1, `avsync` number, `normalize_audio`, `complete_transcode_before_play` toggles, `buffer_size` number, `high_quality` toggle), Splash (`splash_display_mode` radio integração/cinemático — substitui o radio local atual, `splash_delay`, `screensaver_timeout` numbers, `hide_url`, `hide_overlay`, `hide_notifications`, `show_splash_clock`, `disable_bg_music`, `disable_bg_video` toggles, `bg_music_volume` slider), Fila (`limit_user_songs_by` number, `enable_fair_queue` toggle), Score (`disable_score` toggle, `low/mid/high_score_phrases` textareas), Avançado (`cdg_pixel_scaling`, `enable_title_tidy` toggles, `browse_results_per_page` number). Botão "Restaurar padrões" → `DELETE /api/preferences` com `ConfirmModal`.

- [ ] **Step 1: Teste que falha**

```typescript
// bokusu-front/src/components/settings/ServerPreferences.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ServerPreferences } from './ServerPreferences'
import { useAppStore } from '../../store/useAppStore'

it('toggling disable_score PUTs the preference', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ success: true, message: 'ok' }))
  )
  vi.stubGlobal('fetch', fetchMock)
  useAppStore.setState({ isAdmin: true })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(['preferences'], { disable_score: false, splash_display_mode: 'integration' })
  render(
    <QueryClientProvider client={qc}>
      <ServerPreferences />
    </QueryClientProvider>
  )
  fireEvent.click(screen.getByRole('checkbox', { name: /score/i }))
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/preferences/disable_score',
      expect.objectContaining({ method: 'PUT' })
    )
  )
})
```

Run: `cd bokusu-front && npx vitest run src/components/settings` — Expected: FAIL

- [ ] **Step 2: Implementar**

`ServerPreferences.tsx`: componente com sub-componentes locais `PrefToggle`, `PrefSlider`, `PrefNumber`, `PrefTextarea` — cada um recebe `prefKey` (tipado `keyof Preferences`) + label i18n e chama `useSetPreference().mutate({ key, value })` no change (sliders com debounce de 300ms igual ao RemoteDrawer). Grupos em `<section className="card bg-base-200 border border-base-300">` seguindo o padrão visual do SettingsPage atual. Renderiza `null` quando `!isAdmin`, exceto que a seção inteira só é montada pelo SettingsPage quando admin.

`SettingsPage.tsx`: remover o radio local de "Modo da TV" (agora dentro de ServerPreferences via pref) e montar `<ServerPreferences />` após a seção Admin.

Chaves i18n: `settings.player`, `settings.splash`, `settings.queue`, `settings.score`, `settings.advanced`, `settings.restoreDefaults`, `settings.restoreConfirm` + uma por preferência (`prefs.volume`, `prefs.disable_score`, ...) nos DOIS locales.

- [ ] **Step 3: Rodar e ver passar**

Run: `cd bokusu-front && npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add bokusu-front/src
git commit -m "feat: server preferences forms in settings"
```

---

### Task 22: Settings — Sistema (paralela)

**Files:**
- Create: `bokusu-front/src/components/settings/SystemPanel.tsx`, `bokusu-front/src/hooks/useSystem.ts`
- Modify: `bokusu-front/src/pages/SettingsPage.tsx`
- Test: `bokusu-front/src/hooks/useSystem.test.tsx`

**Interfaces:**
- Consumes: contratos `/api/system/*`; `ConfirmModal`; `pushToast`; i18n.
- Produces:
  ```typescript
  useSystemInfo(): UseQueryResult<{ cpu: string; memory: string; disk: string; youtubedlVersion: string; pikaraokeVersion: string }>  // refetchInterval 10s, enabled só com isAdmin
  useLibraryStats(): UseQueryResult<{ song_count: number }>
  useSystemAction(): UseMutationResult  // mutate('update-ytdl' | 'sync-library' | 'quit' | 'shutdown' | 'reboot' | 'expand-fs')
  ```

- [ ] **Step 1: Teste que falha**

```typescript
// bokusu-front/src/hooks/useSystem.test.tsx
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSystemAction } from './useSystem'
import type { ReactNode } from 'react'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

it('useSystemAction POSTs to the action endpoint', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ status: 'started' }))
  )
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => useSystemAction(), { wrapper })
  result.current.mutate('update-ytdl')
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/system/update-ytdl',
      expect.objectContaining({ method: 'POST' })
    )
  )
})
```

Run: `cd bokusu-front && npx vitest run src/hooks/useSystem.test.tsx` — Expected: FAIL

- [ ] **Step 2: Implementar**

```typescript
// bokusu-front/src/hooks/useSystem.ts
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { useAppStore } from '../store/useAppStore'

export interface SystemInfo {
  cpu: string
  memory: string
  disk: string
  youtubedlVersion: string
  pikaraokeVersion: string
}

export type SystemAction =
  | 'update-ytdl'
  | 'sync-library'
  | 'quit'
  | 'shutdown'
  | 'reboot'
  | 'expand-fs'

export function useSystemInfo() {
  const isAdmin = useAppStore((s) => s.isAdmin)
  return useQuery({
    queryKey: ['systemInfo'],
    enabled: isAdmin,
    refetchInterval: 10000,
    queryFn: () => apiFetch<SystemInfo>('/api/system/info'),
  })
}

export function useLibraryStats() {
  const isAdmin = useAppStore((s) => s.isAdmin)
  return useQuery({
    queryKey: ['libraryStats'],
    enabled: isAdmin,
    queryFn: () => apiFetch<{ song_count: number }>('/api/system/library-stats'),
  })
}

export function useSystemAction() {
  return useMutation({
    mutationFn: (action: SystemAction) =>
      apiFetch<{ status: string }>(`/api/system/${action}`, { method: 'POST' }),
  })
}
```

`SystemPanel.tsx`: stats (cpu/mem/disk + versões + song_count) em `stat` do DaisyUI; botões: "Atualizar yt-dlp" e "Sincronizar biblioteca" (diretos, toast no sucesso), "Reiniciar", "Desligar", "Sair do PiKaraoke", "Expandir FS" — os quatro últimos atrás de `ConfirmModal` com texto explícito da consequência. Montar no `SettingsPage` (admin-only).

Chaves i18n: `system.title`, `system.updateYtdl`, `system.syncLibrary`, `system.reboot`, `system.shutdown`, `system.quit`, `system.expandFs`, `system.confirmDanger`, `system.songCount`.

- [ ] **Step 3: Rodar e ver passar**

Run: `cd bokusu-front && npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add bokusu-front/src
git commit -m "feat: system panel with stats and admin actions in settings"
```

---

### Task 23: Página `/library` (paralela)

**Files:**
- Create: `bokusu-front/src/pages/LibraryPage.tsx`, `bokusu-front/src/hooks/useLibrary.ts`, `bokusu-front/src/components/EditMetadataModal.tsx`
- Modify: `bokusu-front/src/App.tsx` (rota), `bokusu-front/src/pages/SettingsPage.tsx` (link "Gerenciar Biblioteca")
- Test: `bokusu-front/src/hooks/useLibrary.test.tsx`

**Interfaces:**
- Consumes: contratos `/api/files/*`; `useEnqueue` (T9); `ConfirmModal`; `pushToast`.
- Produces:
  ```typescript
  useLibrary(params: { q: string; page: number }): UseQueryResult<{ files: { path: string; displayName: string }[]; total: number; page: number; perPage: number }>
  useRenameFile(): UseMutationResult   // mutate({ oldFileName, newFileName })
  useDeleteFile(): UseMutationResult   // mutate(path)
  ```
- Rota `/library` dentro do `AppLayout`, protegida: se `!isAdmin`, redirect para `/settings`.

- [ ] **Step 1: Teste que falha**

```typescript
// bokusu-front/src/hooks/useLibrary.test.tsx
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useLibrary, useDeleteFile } from './useLibrary'
import type { ReactNode } from 'react'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

it('fetches library with query and page', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({ files: [{ path: '/a', displayName: 'A' }], total: 1, page: 2, perPage: 100 })
    )
  )
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => useLibrary({ q: 'abba', page: 2 }), { wrapper })
  await waitFor(() => expect(result.current.data?.total).toBe(1))
  expect(fetchMock).toHaveBeenCalledWith('/api/files/browse?q=abba&page=2', expect.anything())
})

it('useDeleteFile DELETEs by path', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ success: true, message: 'ok' }))
  )
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => useDeleteFile(), { wrapper })
  result.current.mutate('/x/a.mp4')
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/files?song=%2Fx%2Fa.mp4',
      expect.objectContaining({ method: 'DELETE' })
    )
  )
})
```

Run: `cd bokusu-front && npx vitest run src/hooks/useLibrary.test.tsx` — Expected: FAIL

- [ ] **Step 2: Implementar**

```typescript
// bokusu-front/src/hooks/useLibrary.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'

export interface LibraryFile {
  path: string
  displayName: string
}

export interface LibraryPageData {
  files: LibraryFile[]
  total: number
  page: number
  perPage: number
}

export function useLibrary(params: { q: string; page: number }) {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  search.set('page', String(params.page))
  return useQuery({
    queryKey: ['library', params],
    queryFn: () => apiFetch<LibraryPageData>(`/api/files/browse?${search.toString()}`),
  })
}

export function useRenameFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { oldFileName: string; newFileName: string }) =>
      apiFetch<{ success: boolean; message: string }>('/api/files', {
        method: 'PATCH',
        body: JSON.stringify({
          old_file_name: args.oldFileName,
          new_file_name: args.newFileName,
        }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['library'] }),
  })
}

export function useDeleteFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (path: string) =>
      apiFetch<{ success: boolean; message: string }>(
        `/api/files?song=${encodeURIComponent(path)}`,
        { method: 'DELETE' }
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['library'] }),
  })
}
```

`LibraryPage.tsx`: input de busca (debounce reutilizando o hook/padrão do SearchPage), lista `LibraryFile` com três ações por item: enfileirar (`useEnqueue`), editar (abre `EditMetadataModal` com input pré-preenchido com `displayName`; submit → `useRenameFile` + toast com `message`), excluir (`ConfirmModal` dupla: primeiro clique arma, modal confirma → `useDeleteFile`). Paginação com `join` de botões DaisyUI usando `total`/`perPage`. Guard de rota: `if (!isAdmin) return <Navigate to="/settings" replace />`.

`App.tsx`: `<Route path="/library" element={<LibraryPage />} />` dentro do `AppLayout`. `SettingsPage`: card "Gerenciar Biblioteca" com `<Link to="/library">` (admin-only).

Chaves i18n: `library.title`, `library.search`, `library.enqueue`, `library.edit`, `library.delete`, `library.deleteConfirm`, `library.editTitle`.

- [ ] **Step 3: Rodar e ver passar**

Run: `cd bokusu-front && npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add bokusu-front/src
git commit -m "feat: library management page with search, edit and delete"
```

---

### Task 24: Página `/library/renamer` + idioma (paralela)

**Files:**
- Create: `bokusu-front/src/pages/RenamerPage.tsx`, `bokusu-front/src/hooks/useRenamer.ts`, `bokusu-front/src/components/settings/LanguageSection.tsx`
- Modify: `bokusu-front/src/App.tsx` (rota), `bokusu-front/src/pages/SettingsPage.tsx` (link + LanguageSection)
- Test: `bokusu-front/src/hooks/useRenamer.test.tsx`

**Interfaces:**
- Consumes: contratos `/api/renamer/*`; `setLanguage` de `lib/i18n` (T11); `useSetPreference` (`preferred_language` não está em DEFAULTS — o idioma da TV segue o flask-babel; a LanguageSection controla APENAS o idioma do app de gestão via i18next/localStorage).
- Produces:
  ```typescript
  useRenamerSongs(params: { page: number; onlyMismatched: boolean }): UseQueryResult<{ songs: { file: string; currentName: string; suggestedName: string; isEqual: boolean }[]; total: number; page: number }>
  useApplyRename(): UseMutationResult  // mutate({ oldName, newName })
  ```

- [ ] **Step 1: Teste que falha**

```typescript
// bokusu-front/src/hooks/useRenamer.test.tsx
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRenamerSongs, useApplyRename } from './useRenamer'
import type { ReactNode } from 'react'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

it('fetches renamer songs with filters', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ songs: [], total: 0, page: 1 }))
  )
  vi.stubGlobal('fetch', fetchMock)
  renderHook(() => useRenamerSongs({ page: 1, onlyMismatched: true }), { wrapper })
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/renamer/songs?page=1&only_mismatched=true',
      expect.anything()
    )
  )
})

it('applies a rename', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ success: true, message: 'ok' }))
  )
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => useApplyRename(), { wrapper })
  result.current.mutate({ oldName: '/x/bad.mp4', newName: 'Good' })
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/renamer/rename',
      expect.objectContaining({ method: 'POST' })
    )
  )
})
```

Run: `cd bokusu-front && npx vitest run src/hooks/useRenamer.test.tsx` — Expected: FAIL

- [ ] **Step 2: Implementar**

```typescript
// bokusu-front/src/hooks/useRenamer.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'

export interface RenamerSong {
  file: string
  currentName: string
  suggestedName: string
  isEqual: boolean
}

export function useRenamerSongs(params: { page: number; onlyMismatched: boolean }) {
  return useQuery({
    queryKey: ['renamer', params],
    queryFn: () =>
      apiFetch<{ songs: RenamerSong[]; total: number; page: number }>(
        `/api/renamer/songs?page=${params.page}&only_mismatched=${params.onlyMismatched}`
      ),
  })
}

export function useApplyRename() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { oldName: string; newName: string }) =>
      apiFetch<{ success: boolean; message: string }>('/api/renamer/rename', {
        method: 'POST',
        body: JSON.stringify({ old_name: args.oldName, new_name: args.newName }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['renamer'] }),
  })
}
```

`RenamerPage.tsx` (guard admin igual T23; rota `/library/renamer`): toggle "só divergentes" (default true), tabela antes/depois (`currentName` → `suggestedName`), checkbox por linha (default marcado quando `!isEqual`), botão "Aplicar selecionados" que itera as linhas marcadas chamando `useApplyRename().mutateAsync` em série com barra `progress` DaisyUI (`value`/`max`), toast final com total aplicado/falhas.

`LanguageSection.tsx`: select com `pt-BR`/`en` → `setLanguage()`; montar no SettingsPage (visível para todos).

Chaves i18n: `renamer.title`, `renamer.onlyMismatched`, `renamer.before`, `renamer.after`, `renamer.apply`, `renamer.done`, `settings.language`.

- [ ] **Step 3: Rodar e ver passar**

Run: `cd bokusu-front && npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add bokusu-front/src
git commit -m "feat: batch renamer page and app language selector"
```

---

## ═══ CHECKPOINT C — Review final + verificação ═══

- [ ] Suites completas: `uv run pytest tests/ -v`; `cd bokusu-front && npx vitest run && npm run lint && npm run build`; `uv run pre-commit run --all-files`
- [ ] UM subagent revisor no diff completo do plano (foco: cobertura da spec seção a seção, contratos consistentes, admin enforcement, i18n integral)
- [ ] Verificação manual integrada (test plan do PR):
  - [ ] Login admin persiste após refresh (cookie) e `GET /api/auth` hidrata o estado
  - [ ] Trocar "Modo da TV" no celular altera a pref no servidor (conferir `config.ini`)
  - [ ] Mini-player aparece ao tocar música; drawer controla volume/tom/restart
  - [ ] Fila: drag reordena, "tocar a seguir" move pro topo, apagar remove, limpar esvazia (com confirmação), aleatórias adiciona N
  - [ ] Download YouTube: item aparece em skeleton, erro aparece no card dispensável
  - [ ] Busca: autocomplete lista locais, preview reproduz, "só baixar" não enfileira
  - [ ] Library: buscar/editar/excluir arquivo; renamer aplica em lote com progresso
  - [ ] Settings: toggles refletem no servidor; stats de sistema atualizam; update-ytdl dispara toast
  - [ ] App inteiro em EN e PT-BR sem strings quebradas
  - [ ] Rotas legadas Jinja continuam respondendo (ex.: `/info`) — nada quebrou
- [ ] `superpowers:finishing-a-development-branch` para decidir merge/PR

## Notas para o dispatcher de subagents

- Subagents de tasks paralelas NÃO devem tocar arquivos fora da sua lista **Files** (previne conflito). `pikaraoke/routes/api/__init__.py` é ponto de contenção da Lane Backend: cada task adiciona UMA linha de import + UM item na lista — se rodar em paralelo real (worktrees), resolver o merge trivial ao integrar; alternativa: dispatcher aplica os registros ao final da fase.
- `bokusu-front/src/types/api.ts` e `useAppStore.ts` são compartilhados na Fase 1: T8/T9/T10 tocam ambos — se paralelizar de verdade, dar a T9 a posse de `types/api.ts` e a T10 a posse de `useAppStore.ts`; T8 declara `Preferences` num bloco isolado no fim do arquivo (conflito de merge trivial).
- Cada subagent roda apenas a suite relevante ao seu lado (pytest OU vitest); as suites completas rodam nos checkpoints.
