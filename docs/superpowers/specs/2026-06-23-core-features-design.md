# Design Doc: Funcionalidades Core (Busca, Download e Fila)

## Visão Geral
Este documento especifica o comportamento, as interações e as bibliotecas a serem utilizadas na implementação das duas principais telas de engajamento do usuário do PiKaraoke React SPA: A **Busca** de Músicas e a **Gestão da Fila**.

## 1. Módulo de Busca (YouTube & Local)
A tela de busca precisa ser rápida e responsiva, evitando estrangular a API do Flask (e consequentemente a cota do YouTube).

*   **Padrão de Digitação (Debounce):** O input de busca não disparará chamadas de rede a cada tecla. Usaremos um "debounce" de `500ms` via hook customizado ou funcionalidade nativa do utilitário (ex: `useDebounce`). Somente quando o usuário parar de digitar por meio segundo, o `useQuery` do TanStack enviará a requisição para `/search`.
*   **Adição sem Interrupção:** Ao clicar no botão de "Adicionar" (ícone de `+`), a requisição de `/enqueue` é feita em background. O usuário recebe um toast animado confirmando a adição e pode continuar buscando outras músicas sem sair da tela.

## 2. A Fila Dinâmica e Estado de Download
O grande diferencial da reescrita em SPA é o monitoramento assíncrono do processamento da música.

*   **Estados Transitórios na Fila:**
    *   Ao ser adicionada, se a música depender de download pelo `yt-dlp`, ela ingressará na lista da Fila imediatamente.
    *   A interface mapeará o `status` do item. Se for `downloading`, a linha na lista ganhará um tratamento de *Skeleton* (opacidade reduzida, sem bordas definidas e com um Spinner substituindo a thumbnail).
*   **Integração com Eventos:** 
    *   A tela ouvirá o Socket.IO para atualizar uma barra de progresso ou texto (ex: `Baixando... 45%`) no exato card do item que está em trânsito.
    *   Ao receber o evento de sucesso, a opacidade transiciona e a música é liberada visualmente para ser cantada ou reordenada.

## 3. Gerenciamento e Reordenação da Fila
A tela principal da Fila precisará suportar interações avançadas de manipulação da ordem, respeitando as restrições de permissão do sistema híbrido (Spec UI).

*   **Drag and Drop (DND):**
    *   Utilizaremos a biblioteca `@dnd-kit/core` por ser leve, acessível e nativamente otimizada para toques em dispositivos móveis.
    *   Todo item da fila terá um `Drag Handle` fixo no canto esquerdo.
*   **Menu de Ações Contextual:**
    *   Para evitar a frustração de arrastar um item pelo scroll inteiro de uma fila enorme em telas pequenas, o canto direito possuirá o botão de "Mais Opções" (três pontos verticais).
    *   Se o usuário tiver privilégios (Admin), este menu exibirá ações rápidas: "Tocar a Seguir", "Apagar" e "Pular" (caso seja a música atual).
    *   "Tocar a Seguir" aplicará uma requisição PUT no backend movendo o index da música imediatamente para logo abaixo do "Now Playing".
