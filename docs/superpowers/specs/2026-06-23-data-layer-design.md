# Design Doc: Data Layer (Estado e WebSockets)

## Visão Geral

Este documento especifica a infraestrutura de comunicação de dados do frontend React do PiKaraoke. O objetivo é estabelecer uma ponte robusta, eficiente e reativa com o backend Flask, combinando o gerenciamento de estado assíncrono via TanStack Query (React Query) com atualizações em tempo real via Socket.IO.

## 1. Conexão Socket.IO (Singleton)

Para evitar múltiplas conexões simultâneas e vazamento de conexões, a instância do cliente Socket.IO será um **Singleton**.

- **Arquivo:** `src/lib/socket.ts`
- **Implementação:** Instanciaremos `const socket = io()` fora de qualquer ciclo de vida do React. Este arquivo exportará a conexão para todo o resto do app.

## 2. Padrão de Listeners Co-localizados

Ao invés de escutar todos os eventos do servidor na raiz da aplicação, usaremos uma arquitetura descentralizada, garantindo que o app apenas invalide os caches de queries que a tela atual se importa.

- **Custom Hook:** `useSocketEvent(eventName: string, callback: (...args) => void)`
- **Comportamento:** O hook usará `useEffect` para rodar `socket.on(eventName, callback)` quando o componente montar, e, mais criticamente, usará a função de retorno (cleanup function) para rodar `socket.off(eventName, callback)` no desmonte.
- **Sinergia com React Query:** O `callback` passado será tipicamente uma função chamando `queryClient.invalidateQueries({ queryKey: [...] })`, disparando um `fetch` leve e imediato assim que os dados ficarem defasados no servidor.

## 3. Conectividade e Resiliência

É vital que o usuário (especialmente em uma festa/karaokê usando Wi-Fi instável) saiba se as ações dele chegarão à fila.

- **Integração Global:** O `socket.ts` escutará nativamente os eventos `"connect"` e `"disconnect"`.
- **Estado Reativo:** Esses eventos farão chamadas direto para a store do `zustand` (ex: `useAppStore.getState().setIsConnected(false)`).
- **Feedback Visual:** A `AppLayout` observará `isConnected` e revelará um *banner fixed/sticky* sutil no topo (ex: "Sem conexão com o servidor") quando for falso. Ele some automaticamente quando o status reverter.

## 4. API Client (Chamadas REST)

Para interações transacionais (enviar música para fila, trocar configurações) usaremos um cliente padronizado.

- **Arquivo:** `src/lib/api.ts`
- **Implementação:** Usaremos o nativo `fetch` ou uma instância configurada do `axios`. Todas as requisições base (GET fila, POST download) serão importadas deste arquivo para garantir que tokens (se existirem) ou caminhos base sejam fáceis de modificar. O prefixo global não requer hostname pois o React será servido pelo próprio Flask, portanto chamadas para `/queue` ou `/api/...` serão resolvidas na mesma origem.
