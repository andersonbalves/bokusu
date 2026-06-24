# Design Doc: Controles do Player e Configurações (Admin System)

## Visão Geral
Este documento cobre a arquitetura das funcionalidades avançadas de controle do reprodutor (Remote Control) e as configurações administrativas (System Settings), que se comunicam com o backend para governar não só a música tocando, mas o estado do servidor host.

## 1. O Mini-Player Global (Componente Persistente)
Adotaremos a interface consagrada por apps de streaming (ex: Spotify, Apple Music) para resolver o desafio de acessar o controle remoto rapidamente sem precisar navegar entre abas.

*   **Posicionamento:** Um pequeno banner fixo (sticky bottom) posicionado imediatamente acima da Barra de Navegação Inferior (no celular) ou no rodapé da Sidebar (no desktop).
*   **Informação Exibida:** Mostrará a arte/thumbnail, o nome do cantor e o título da música atual rolando em letreiro (marquee) caso o título seja longo.
*   **Ações Rápidas (Apenas Admin):** Terá ícones rápidos para `Play/Pause` e `Skip` (Pular).
*   **Acesso Restrito:** Para usuários não-logados (sem senha admin), o Mini-Player atua apenas como um mostrador passivo ("Now Playing"). Os botões de controle podem não ser renderizados ou acionarão o modal de senha (Just-in-Time Auth) se clicados.

## 2. Expanded Remote Control (Painel Deslizante)
Como controles mais complexos como Volume e Tom (Pitch) não cabem em um Mini-Player fino, usaremos um modal deslizante.

*   **Interação:** Tocar em qualquer lugar do Mini-Player (exceto nos botões rápidos) fará um `Drawer` (BottomSheet) deslizar para cima, ocupando a tela quase inteira.
*   **Controles Avançados (APIs do Controller):**
    *   **Volume:** Slider ou Botões `+` e `-` que engatilham chamadas POST em debounce para `/vol_up` e `/vol_down`.
    *   **Transpose (Tom):** Botões `+1` (Sustenido) e `-1` (Bemol) para alterar a afinação (pitch shift) do player de áudio (chamadas à rota `/transpose`).
    *   **Reiniciar:** Botão dedicado para chamar a rota `/restart` se o cantor perder o tempo da introdução.
*   Ao deslizar o modal para baixo (fechar), o usuário retorna exatamente para a aba onde estava.

## 3. Painel de Configurações Administrativas
A aba de Configurações ("Mais") será o centro de comando do servidor host. A visibilidade dessa aba é garantida para todos (para poderem clicar no botão de "Fazer Login"), mas as seções avançadas ficarão ocultas ou bloqueadas para não-Admins.

*   **System Actions:** Botões de UI para disparar requisições perigosas ao servidor (exigindo dois cliques ou modal de confirmação):
    *   `/admin/reboot` e `/admin/shutdown`
    *   `/admin/update_ytdl` (Crucial para atualizar o extrator quando vídeos começam a falhar).
*   **Preferências (PiKaraoke Configs):** Formulários interativos (Toggles, Sliders) ligados à rota `/change_preferences` e lidos ao carregar a página na store global (ex: Tema, Volume de Música de Fundo, Modo da Tela de Score, Sync de Áudio/Vídeo).
