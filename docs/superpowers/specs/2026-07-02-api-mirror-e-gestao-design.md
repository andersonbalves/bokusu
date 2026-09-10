# Design Doc: API Mirror e App de Gestão

## Visão Geral

Esta spec consolida o restante da migração do frontend para React no que toca o **app de gestão** (celulares/PCs dos cantores e do admin). Cobre duas frentes:

1. **Backend:** um espelho REST `/api/*` novo no Flask, aditivo, que expõe contratos JSON limpos delegando para as classes de domínio existentes.
2. **Frontend:** infraestrutura compartilhada (preferências, now playing, notificações, auth, i18n) e as features de gestão restantes: mini-player + remote control, fila avançada, busca completa, arquivos locais e settings completo.

A tela da TV e o purge do legado estão na spec irmã `2026-07-02-tv-player-e-purge-design.md`, que depende apenas da parte de infraestrutura desta spec (endpoints `/api/preferences`, `/api/player` e auth).

Substitui e descarta as specs de 2026-06-23 não implementadas (`admin-controls`, `local-files`, `tv-player`, `migration-routing`) e todos os plans antigos. As specs de 2026-06-23 que documentam trabalho já implementado (`modernizacao-ui`, `modernizacao-telas`, `data-layer`, `core-features`) permanecem como registro histórico.

## Decisões que superseded as specs antigas

- **Contrato de API:** as specs antigas propunham falar com as rotas legadas via header `X-Requested-With` (padrão interceptação). Decisão nova: **espelho `/api/*`** — os hooks do frontend já foram escritos apontando para `/api/*`; o backend passa a prover exatamente esses contratos.
- **Modo da TV (integração/cinemático):** hoje vive no Zustand do dispositivo — errado, pois a TV é outro dispositivo. Vira preferência de backend nova (`splash_display_mode`), propagada via socket `preferences_update`.
- **i18n:** mantido. O SPA hoje tem strings hardcoded em pt-BR; ganha `react-i18next`.

## Mapa de completude (funcionalidades legadas não mapeadas antes)

| Funcionalidade | Rota/evento legado | Onde entra |
|---|---|---|
| Autocomplete na busca | `/autocomplete` | Busca (C4) |
| Preview de vídeo antes de adicionar | `/preview` | Busca (C4) |
| Download direto sem enfileirar | `/download` POST | Busca (C4) |
| Adicionar N músicas aleatórias | `/queue/addrandom/<n>` | Fila (C3) |
| Monitor de downloads + erros | `/queue/downloads`, DELETE erro | Fila (C3) |
| Login admin real | `/auth` POST (cookie `admin`) | Infra (C1) |
| Preferências completas (24 chaves) | `/change_preferences`, `/clear_preferences` | Settings (C5) |
| Stats de sistema (CPU/mem/disk) | `/info/stats` | Settings (C5) |
| Stats da biblioteca + sync | `/library_stats`, `/sync_library`, eventos `sync_started/finished` | Settings (C5) |
| Expandir filesystem (RPi) | `/expand_fs` | Settings (C5) |
| Notificações do servidor → toasts | socket `notification` | Infra (C1) |
| Idioma (i18n) | pref `preferred_language`, flask-babel | Infra (C1) |

Funcionalidades de TV não mapeadas (bg music, QR/logo, score phrases, relógio) estão na spec da TV.

## B. Backend: espelho `/api/*`

### Estrutura

Package novo `pikaraoke/routes/api/` — todos os arquivos são novos e aditivos. O único toque em código existente é o registro do blueprint no `app.py` (mergeability com upstream preservada; rotas legadas ficam intocadas até o purge).

```
pikaraoke/routes/api/
├── __init__.py      # blueprint pai /api, registro dos módulos
├── queue.py         # GET /api/queue · POST /api/queue (enqueue) · DELETE /api/queue/<id>
│                    # DELETE /api/queue (limpar fila) · PUT /api/queue/reorder · POST /api/queue/random
├── player.py        # GET /api/player (now_playing) · POST /api/player/skip · POST /api/player/pause
│                    # POST /api/player/restart · PUT /api/player/volume · PUT /api/player/transpose
│                    # GET /api/player/score-phrases (frases ativas de score, consumido pela TV)
├── search.py        # GET /api/search · GET /api/search/autocomplete · GET /api/search/preview
│                    # POST /api/downloads (download direto)
├── downloads.py     # GET /api/downloads (ativos + erros) · DELETE /api/downloads/errors/<id>
├── files.py         # GET /api/files/browse · PATCH /api/files (editar metadados) · DELETE /api/files
├── renamer.py       # GET /api/renamer/songs · GET /api/renamer/suggestions · POST /api/renamer/rename
├── preferences.py   # GET /api/preferences (todas) · PUT /api/preferences/<key> · DELETE /api/preferences (reset)
├── auth.py          # POST /api/auth (login, seta cookie admin) · GET /api/auth (status isAdmin)
└── system.py        # GET /api/system/info (CPU/mem/disk, versões) · GET /api/system/library-stats
                     # POST /api/system/update-ytdl · POST /api/system/sync-library
                     # POST /api/system/reboot · POST /api/system/shutdown · POST /api/system/quit
                     # POST /api/system/expand-fs
```

### Princípios

- **Delegação direta** às classes de domínio (`k.queue_manager`, `k.playback_controller`, `k.preferences`, `DownloadManager`) — nunca redirect interno para rotas legadas.
- **flask-smorest + Marshmallow** (padrão já usado no projeto): validação de entrada e documentação OpenAPI automática no pipeline existente.
- **Verbos HTTP corretos:** side effects usam POST/PUT/DELETE (legado usa GET para tudo).
- **JSON sempre.** Erro = `{"error": "<mensagem>"}` + status code: 403 sem admin, 404 recurso inexistente, 422 validação. Zero `flash()`/redirect.
- **Auth:** mesmo cookie `admin` do legado. `POST /api/auth` valida a senha e seta o cookie; `GET /api/auth` devolve `{"isAdmin": bool}` para hidratar o estado inicial. Rotas admin-only reutilizam o `is_admin()` existente e respondem 403.
- **`GET /api/preferences`** é o endpoint que falta hoje (legado só entrega preferências via template Jinja renderizado): devolve todas as chaves com valores efetivos (default quando não setado).
- **Preferência nova `splash_display_mode`** (`"integration" | "cinematic"`, default `"integration"`) adicionada ao `PreferenceManager.DEFAULTS` — única mudança fora do package `/api` além do registro de blueprint.
- **Socket.IO inalterado:** mesmos eventos (`queue_update`, `now_playing`, `preferences_update`, `preferences_reset`, `notification`, `download_started/stopped`, `sync_started/finished`, `score_phrases_update`).

## C. Frontend: App de Gestão

### C1. Infraestrutura compartilhada

- **`usePreferences()`:** query `['preferences']` → `GET /api/preferences`. Socket `preferences_update` aplica update pontual no cache; `preferences_reset` invalida. Mutação `PUT /api/preferences/<key>` com update otimista e rollback em erro.
- **`useNowPlaying()`:** query `['nowPlaying']` → `GET /api/player`, invalidada pelo socket `now_playing`. Alimenta mini-player, NowPlayingCard e a TV (spec irmã).
- **Toasts globais:** listener do socket `notification` → toast DaisyUI respeitando severidade (info/success/danger). `sync_started`/`sync_finished` idem. Substitui os `flash()` do legado.
- **Admin:** store Zustand guarda `isAdmin`, hidratado de `GET /api/auth` no boot. `AdminModal` (JIT, já existente) passa a chamar `POST /api/auth` — hoje aponta para endpoint fictício.
- **i18n:** `react-i18next` com `pt-BR` e `en`. Detecção pelo navegador com override manual em Settings. Chaves organizadas por página/componente; strings hardcoded atuais migradas. A pref `preferred_language` do backend continua governando o idioma da TV.

### C2. Mini-player + Remote drawer

- **`<MiniPlayer />`** montado no `AppLayout`: visível quando há música tocando; posicionado acima da bottom-nav (mobile) ou no rodapé da sidebar (desktop). Exibe thumbnail, título em marquee quando longo, e cantor. Botões play/pause e skip sempre visíveis, com cadeado JIT (abre `AdminModal`) quando não-admin. Oculto na rota `/player`.
- **`<RemoteDrawer />`** (bottom-sheet ~90vh) abre ao tocar no corpo do mini-player: controles grandes de play/pause, skip e restart; slider de volume → `PUT /api/player/volume` com debounce de 300ms; transpose −/+ com valor atual em semitons → `PUT /api/player/transpose`. Fechar (arrastar para baixo) devolve o usuário à aba onde estava.

### C3. Fila avançada

- **Drag and drop:** `@dnd-kit/sortable` com drag handle fixo à esquerda de cada item. Reordenação otimista no cache → `PUT /api/queue/reorder`; rollback e toast em erro.
- **Menu contextual** (3 pontos à direita): "Tocar a seguir" e "Apagar", ambos protegidos por admin JIT (regra legada confirmada: toda edição de fila é admin-only, sem exceção para o dono da música).
- **Limpar fila** (admin): botão no topo da página com confirmação dupla → `DELETE /api/queue` (equivale ao `action=clear` legado).
- **Estados de download:** item com `status: downloading` renderiza como skeleton (opacidade reduzida, spinner no lugar da thumbnail). Socket `download_started/stopped` dispara refetch; enquanto houver download ativo, polling leve de `GET /api/downloads`. Erros de download aparecem em card colapsável no topo da fila com botão de dispensar (`DELETE /api/downloads/errors/<id>`).
- **Adicionar aleatórias** (admin): botão com stepper de quantidade → `POST /api/queue/random`.

### C4. Busca completa

- **Autocomplete:** sugestões de `GET /api/search/autocomplete` com o debounce já existente; dropdown abaixo do input.
- **Preview:** botão de play no resultado abre modal com `<video>` apontando para `/api/search/preview` antes de adicionar.
- **Duas ações por resultado:** "Adicionar à fila" (enqueue + download, fluxo atual) e "Só baixar" (`POST /api/downloads`, admin-only).
- **Origem visível:** resultados locais vs YouTube distinguidos por badge.

### C5. Arquivos locais + Settings completo

Settings ganha seções (admin-only ocultas para convidados, exceto tema/idioma/login):

- **Preferências do Servidor:** forms para as chaves do `PreferenceManager` agrupadas em Player (volume, avsync, normalize, transcode, buffer), Splash (splash_delay, screensaver_timeout, hide_url, hide_overlay, relógio, bg music/video, `splash_display_mode`), Fila (limit_user_songs_by, enable_fair_queue), Score (disable_score, frases low/mid/high) e Avançado (high_quality, cdg_pixel_scaling, browse_results_per_page, enable_title_tidy). Toggles/sliders/inputs com update otimista. Botão "Restaurar padrões" → `DELETE /api/preferences` com confirmação.
- **Sistema:** stats de CPU/mem/disk (`GET /api/system/info`, refetch periódico) + versões; stats da biblioteca e botão de sync; ações update_ytdl, reboot, shutdown, quit e expand_fs — destrutivas exigem modal de confirmação dupla.
- **Idioma:** override do idioma do app de gestão + pref `preferred_language` (TV).
- **Gerenciar Biblioteca** → rota `/library`: lista paginada de `GET /api/files/browse` com campo de busca; ações por arquivo: enfileirar, editar metadados (modal → `PATCH /api/files`), excluir (`DELETE /api/files` com confirmação dupla).
- **Renomeador em Lote** → rota `/library/renamer`: tabela "antes vs depois" paginada (`GET /api/renamer/songs` + `GET /api/renamer/suggestions`), checkbox por linha, aplicar em lote (`POST /api/renamer/rename` por item) com indicador de progresso.

## Erros e testes

- **REST:** erro de API exibe toast com a mensagem retornada; mutações otimistas fazem rollback do cache.
- **Frontend:** vitest + React Testing Library (padrão do repo). Hooks de dados testados com fetch mockado; socket mockado nos testes de listeners; componentes de interação (drawer, menu contextual, forms de preferências) com testes de comportamento.
- **Backend:** pytest para cada módulo de `/api/*` — I/O e subprocess mockados; `PreferenceManager` e `EventSystem` reais (leves), conforme CLAUDE.md. Cobrir: 403 sem admin, validação 422, delegação correta ao domínio.
- **Test plan por PR:** checklist mínimo de verificação manual das mudanças (regra do repositório).

## Ordem de implementação

1. Backend `/api` (auth, preferences, player, queue) + correção dos hooks existentes para os contratos reais.
2. Infra frontend (C1) — pré-requisito da spec da TV, que pode iniciar em paralelo a partir daqui.
3. Mini-player + remote drawer (C2).
4. Fila avançada (C3) e busca completa (C4).
5. Backend `/api` restante (files, renamer, downloads, system) + arquivos locais e settings completo (C5).
