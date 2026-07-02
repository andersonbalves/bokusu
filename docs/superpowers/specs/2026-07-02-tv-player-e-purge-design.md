# Design Doc: TV Player (paridade total) e Purge do Legado

## Visão Geral

Esta spec cobre a reprodução real de karaokê na tela da TV (`PlayerLayout`/`PlayerPage`) com **paridade total** com o `splash.js` legado, e a fase final de **purge** dos templates Jinja e assets estáticos legados.

Depende da infraestrutura da spec irmã `2026-07-02-api-mirror-e-gestao-design.md` (endpoints `/api/preferences`, `/api/player`, auth e toasts), mas pode ser implementada em paralelo ao restante daquela spec.

**Decisão que supersede a spec antiga de TV (2026-06-23):** não existe `<CDGPlayer />` com canvas no browser. O backend transcoda tudo — inclusive CDG — via ffmpeg para HLS ou MP4 progressivo (rotas `/stream/*`). O frontend só reproduz `<video>`; letras de CDG chegam como vídeo e legendas como ASS via `/subtitle/<id>`.

## D1. Protocolo com o backend (socket inalterado, espelha o splash.js)

- **Ao montar:** `socket.emit("register_splash")` → servidor responde `splash_role`. A tela primária controla o playback; telas extras registradas depois atuam como espelho passivo.
- **Escuta:** `play` (payload com URL do stream e metadados da faixa), `pause`, `restart`, `skip`, `volume`, `now_playing`, `notification`, `preferences_update`, `preferences_reset`, `score_phrases_update`, `playback_position` (para telas espelho).
- **Emite:** `start_song` (mídia carregada e reproduzindo), `playback_position` (heartbeat periódico de posição para sincronia e transcode), `end_song(reason)` (fim natural, skip ou erro), `clear_notification`.

Todos os listeners usam o hook `useSocketEvent` existente (cleanup automático no unmount).

## D2. Máquina de estados

Raiz do `PlayerPage`, implementada como hook puro testável (`usePlayerStateMachine`):

```
IDLE ──play──▶ LOADING ──canplay──▶ PLAYING ──ended──▶ SCORING ──timeout──▶ IDLE
                  │                    │                (se score ativo)
                  └── error/timeout ──▶ end_song("error") ──▶ IDLE
```

- **`IDLE`** — splash screen atual (modos integração/cinemático já implementados, agora dirigidos pela pref `splash_display_mode`), mais:
  - **Música de fundo:** `<audio>` alimentado por `/bg_playlist` (playlist randomizada), volume da pref `bg_music_volume`, desativável por `disable_bg_music`. Pausa quando sai de IDLE.
  - **Vídeo de fundo:** `/stream/bg_video` em loop mudo (`disable_bg_video` respeitada).
  - **Relógio:** pref `show_splash_clock`.
  - **Screensaver:** após `screensaver_timeout` segundos em IDLE; qualquer evento de socket ou mudança de estado dispensa.
- **`LOADING`** — recebeu `play`; instancia o player de mídia e aguarda `canplay`. Timeout de segurança de 10s → `end_song("error")`.
- **`PLAYING`** — `<KaraokePlayer />` fullscreen.
- **`SCORING`** — só se `disable_score` for falso; overlay de nota + frases; ~5s → IDLE.

## Componente de mídia: `<KaraokePlayer />`

- `<video>` ocupando 100% da tela, `object-fit: contain`, fundo preto.
- **HLS** (`streaming_format: "hls"`): `hls.js` via npm (substitui o `hls-1.6.15.min.js` vendorado), com attach/detach no ciclo de vida do componente. Safari/suporte nativo usa `src` direto.
- **MP4 progressivo** (`streaming_format: "mp4"`): `src` direto na rota de stream.
- **Legendas ASS:** `libass-wasm` (SubtitlesOctopus) via npm, carregando `/subtitle/<id>` quando a faixa tiver legenda; assets `.wasm` empacotados pelo Vite. Substitui o `subtitles-octopus` vendorado.
- **Volume e controles:** eventos `volume`, `pause`, `restart` do socket aplicados direto no elemento de mídia; `playback_position` emitido em intervalo enquanto reproduz.
- **Anti-travamento ("show must go on"):** `onError` do elemento de mídia, ou timeout de LOADING → emite `end_song("error")`; o backend registra a falha, notifica e avança a fila sem intervenção manual.

## Tela de score

- Nota randômica + frase sorteada da faixa correspondente (low/mid/high), vindas do estado mantido por `score_phrases_update` (fetch inicial via `GET /api/player/score-phrases`, definido na spec irmã).
- **Fireworks:** portar `fireworks.js` legado como módulo TypeScript com canvas próprio.
- **Áudio de aplausos/bateria** local durante a exibição.
- Timeout (~5s) → IDLE.

## D3. Overlays independentes do estado

- **Notificações do servidor:** evento `notification` → banner overlay com severidade (info/success/danger), dispensado por `clear_notification` ou timeout. Pref `hide_notifications` respeitada.
- **QR code + IP** (`/qrcode` + URL): tamanho heroico centralizado no modo integração; encolhido no canto no modo cinemático; `hide_url` respeitada. Durante PLAYING, segue a pref `hide_overlay`.
- **"A seguir":** próxima música + cantor (`up_next`/`next_user` do now_playing).
- **Legibilidade universal:** todo texto sobre vídeo usa text-stroke/drop-shadow agressivo (efeito legenda de cinema), regra já aplicada na splash atual.

## D4. Purge do legado (fase final)

Executar somente após paridade validada em TV real (checklist abaixo).

- **Deletar templates:** todos os `pikaraoke/templates/*.html` exceto `index.html` (gerado pelo Vite).
- **Deletar static legado:** `bulma*.css`, `custom.css`, `js/splash.js`, `hls-1.6.15.min.js`, `fireworks.js`, `screensaver.js`, `score.js`, `subtitles-octopus*` vendorado (worker/wasm/woff2), `fontello/`, e demais assets referenciados só pelos templates deletados.
- **Rotas Python ficam intocadas** (mergeability com upstream). Rotas Jinja órfãs retornariam erro de template se acessadas por HTTP cru, mas o catch-all da SPA intercepta toda navegação de browser.
- **Pré-condição:** grep confirmando que nenhum código Python referencia os templates/assets deletados (ex.: `render_template` fora das rotas órfãs, `url_for('static', ...)`).

## Erros e testes

- **Máquina de estados:** testes unitários do hook `usePlayerStateMachine` (vitest) cobrindo todas as transições, incluindo erro e timeout de LOADING, `disable_score`, e chegada de `play` durante SCORING.
- **Socket:** mockado nos testes; verificar registro (`register_splash`), emissão de `start_song`/`end_song`/`playback_position` nos momentos corretos.
- **Mídia:** elementos `<video>/<audio>` mockados (jsdom não reproduz mídia); testes verificam props, chamadas de attach do hls.js e reação a `onError`.
- **Verificação manual (test plan do PR):**
  - TV real reproduzindo `.mp4` e `.zip` (CDG) — letras visíveis, áudio sincronizado.
  - Transpose aplicado no meio da música (stream reinicia com pitch novo).
  - Skip, pause, restart e volume a partir do celular.
  - Score aparece com fireworks e frase; desativado quando `disable_score`.
  - Screensaver após timeout; bg music/vídeo no idle; modos integração/cinemático trocados pelo celular.
  - Arquivo corrompido → pula sozinho para a próxima.
  - Duas telas abertas: segunda vira espelho.
  - Após purge: app completa funcional, build limpo, nenhum 404 de asset.
