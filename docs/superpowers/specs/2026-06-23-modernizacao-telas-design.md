# Design Doc: Telas e Fluxos do Pikaraoke React SPA

## Visão Geral

Este documento descreve a arquitetura visual, os fluxos de interação e o design das telas (Gestão e TV) que formarão o novo frontend do PiKaraoke.

As fundações do app (React Router, TailwindCSS v4, DaisyUI, Zustand e React Query) já estão configuradas. Este documento detalha como os componentes visuais farão uso dessas tecnologias.

## 1. Estrutura e Navegação (AppLayout - Gestão)

A interface de controle (usada nos celulares dos cantores ou PCs) usará um layout responsivo focado na usabilidade "One-Handed" (uso com uma mão).

- **Mobile-First (Bottom Navigation):** Em telas pequenas, a navegação principal ficará na parte inferior da tela, contendo 3 abas principais:
  1. **Fila (Home):** Visualização do "Now Playing" e das músicas pendentes.
  2. **Buscar:** Aba isolada para procurar músicas.
  3. **Configurações:** Controles administrativos e customizações.
- **Desktop/Tablet:** Em telas largas, a Bottom Navigation se transforma em uma elegante **Sidebar (Menu Lateral)**.
- **Identidade Visual (UI/UX):**
  - **Ícones:** Uso estrito do pacote `lucide-react`. Nenhum emoji deverá ser utilizado em menus ou botões.
  - **Estética Premium:** Uso das fontes `Michroma` (títulos/display) e `Space Grotesk` (corpo de texto), arredondamentos amplos (temas Aqua/Acid do DaisyUI).

## 2. Fluxos Principais

### A. Aba de Busca

- **Clean UI:** A tela conterá uma barra proeminente no topo.
- **Experiência Contínua:** Ao pesquisar, a lista rolável carrega os resultados vindos da API do Flask/YouTube.
- **Adição Rápida:** Ao clicar no ícone de "Adicionar" ao lado de um resultado, a ação ocorrerá imediatamente (com feedback via um pequeno "Toast" de sucesso no rodapé), sem tirar o usuário do fluxo de pesquisa.

### B. Aba de Fila (Home)

- **Destaque Superior:** Um card centralizado exibindo a música atual ("Now Playing") com grande destaque.
- **Lista de Próximas:** Logo abaixo, as músicas enfileiradas aparecerão em lista (ordem de cantores).
- **Controles Livres (Admin Trancado):** Botões estruturais como "Pular", "Reordenar" ou "Excluir" estarão sempre visíveis para indicar a funcionalidade. Porém, terão uma marca sutil de cadeado caso o usuário não seja Admin.

## 3. Autenticação (Admin Access)

A aplicação adota um modelo de segurança **"Just-in-Time" Híbrido** e amigável:

- **Fluxo Sob Demanda:** Se o usuário clicar em uma ação bloqueada (como apagar a música de outra pessoa) e a store do Zustand (`isAdmin`) for falsa, o app sobrepõe um modal minimalista perguntando: "Acesso Restrito: Digite a senha do Administrador".
- **Autenticação Imediata:** Caso a senha esteja correta, a store global liga o modo Admin instantaneamente, efetuando a ação desejada e liberando todas as outras (os cadeados somem).
- **Fluxo Preventivo:** Na aba de Configurações, existirá um botão direto para fazer login antecipado.

## 4. Tela da TV (PlayerLayout - Splash Screen)

A interface que será projetada na televisão (onde as letras do Karaokê vão rodar) funcionará sem nenhuma Navbar ou menus, ocupando 100% do layout.

- **Legibilidade Universal (Texto com Borda):** Absolutamente todas as fontes exibidas por cima de backgrounds de vídeo da TV usarão um **efeito visual de "Text Stroke" ou "Drop Shadow" agressivo**, criando uma borda de contraste puro ao redor da tipografia. Isso garante que a letra fique legível contra fundos muito claros ou escuros. (Efeito de legenda de filme).

- **Dois Modos Visuais:** Controláveis através do painel de configuração da Gestão, a Splash Screen poderá transitar entre dois designs:

  1. **Modo Integração/Boas-Vindas:** (Centralizado). Foco total em chamar os usuários. Um QR Code de tamanho heroico no meio da tela e mensagens "Escaneie para cantar". As próximas 3 músicas ficam pequenas embaixo.
  2. **Modo Cinemático:** (Minimalista). O QR Code e o endereço IP encolhem e vão para os cantos da tela. A lista da fila é reduzida a um ticker sutil. O foco passa a ser o vídeo de background.
