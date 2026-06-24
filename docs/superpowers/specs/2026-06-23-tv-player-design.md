# Design Doc: Player da TV (O Karaokê Engine)

## Visão Geral
Este documento especifica a arquitetura técnica da tela de exibição na TV (`PlayerLayout`). Ela atua como um visualizador puramente reativo (dumb component de alto nível), ouvindo os comandos de reprodução do backend e orquestrando o HTML5 e o Canvas para exibir as letras.

## 1. Arquitetura de Máquina de Estados
A raiz do `PlayerLayout` será controlada por uma State Machine simplificada com três possíveis estados visuais, garantindo que nunca dois componentes de mídia briguem pela tela.

*   `IDLE`: Renderiza o componente `<SplashScreen />` (ver spec de UI).
*   `PLAYING`: Renderiza o motor de mídia correspondente à faixa atual.
*   `SCORING`: Renderiza o overlay de pontuação (`<ScoreScreen />`).

## 2. Abstração de Motores de Mídia
Como o backend provê tanto `.mp4` (arquivos nativos com trilha de vídeo e áudio juntos) quanto `.cdg` (arquivos clássicos que separam os gráficos num arquivo e o áudio noutro), criaremos dois componentes isolados que respondem a uma mesma interface de `props` (ex: `onPlay`, `onEnded`, `onError`).

### A. `<VideoPlayer />`
*   Baseado na tag nativa `<video>` do HTML5.
*   Usado para extensões `.mp4` e `.webm`.
*   O player ocupará `100vw` e `100vh` em `object-fit: contain` (ou `cover` dependendo das bordas) com um fundo preto.

### B. `<CDGPlayer />`
*   Baseado na tag `<canvas>` associada a um arquivo `.mp3` de áudio (`<audio>`).
*   Encapsula a biblioteca legada em Javascript que processa o byte-code do `.cdg` e pinta as letras no canvas, sincronizada com o `currentTime` da tag de áudio.

## 3. Gestão de Fim de Música e Pontuação
Quando o motor de mídia emite o evento `onEnded`, a arquitetura toma o controle:

1.  O Frontend dispara a requisição para o Backend informando o término da faixa (para desencadear atualizações globais na fila).
2.  O React lê `useAppStore(s => s.preferences.showScore)`.
3.  **Se true:** O estado muda para `SCORING`. A tela reproduz o áudio local de pontuação (bateria/aplausos), apresenta uma nota randômica e um overlay texto. Após ~5 segundos (timeout), o estado muda para `IDLE`.
4.  **Se false:** O estado volta direto para `IDLE` aguardando a próxima instrução (ou começa a tocar a próxima faixa imediatamente se ela vier na sequência).

## 4. Estratégia "Show Must Go On" (Anti-Travamento)
Sistemas de mídia estão sujeitos a arquivos corrompidos ou não decodificáveis pelo browser (ex: codec proprietário de vídeo).
*   Ambos os componentes (`<VideoPlayer />` e `<CDGPlayer />`) escutam o evento `onError` nativo do HTML5.
*   Caso `onError` ocorra, um timeout de segurança (ex: 2 segundos) ou disparo imediato realiza uma chamada silenciosa via REST/Socket para a rota `/skip`.
*   Isso força o sistema a abortar a música defeituosa e ir para a próxima sem intervenção manual do DJ/Admin.
