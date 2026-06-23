# Pikaraoke UI Modernization Design Spec

## 1. Visão Geral
A modernização da interface do Pikaraoke visa substituir as atuais templates HTML/Jinja por uma Single Page Application (SPA) reativa e dinâmica, mantendo as alterações no back-end (Flask) as menores possíveis para não conflitar com atualizações da aplicação original.

## 2. Arquitetura e Estrutura do Projeto
- **Pasta Raiz:** O front-end residirá na pasta `bokusu-front` na raiz do projeto.
- **Integração Front-Back:** O build do Vite (empacotador) será configurado para direcionar a saída (`index.html` e assets) diretamente para as pastas `pikaraoke/templates` e `pikaraoke/static/assets` que já são servidas pelo Flask.
- **Roteamento Flask:** Haverá um pequeno ajuste no backend Flask configurando um *catch-all route* para que ele retorne o `index.html` compilado para todas as rotas focadas no usuário, delegando a responsabilidade de navegação ao React.

## 3. Stack Tecnológica
- **Framework & Linguagem:** React 18+ com Vite e **TypeScript** estrito (sem uso indiscriminado de `Any`).
- **Roteamento:** React Router DOM (v6+).
- **Estilização:** TailwindCSS integrado com o DaisyUI.
  - **Temas:** `aqua` e `acid`.
  - **Customizações:** Aplicação de `border-radius` arredondados para boxes (1rem) e fields (1.5rem), conforme solicitação.
  - **Tipografia:** Fonte `Michroma` para os textos display (títulos) e `Space Grotesk` para o corpo do texto.
- **Ícones:** Lucide Icons (react-lucide) substituindo bibliotecas legadas.

## 4. Gestão de Estado e Comunicação de Dados
Para comunicar com o servidor existente do Pikaraoke, utilizaremos duas frentes:
- **Estado Local (UI):** **Zustand**. Cuidará do tema ativo, modais de confirmação, estado visual da barra lateral, etc.
- **Estado do Servidor (Dados):** **TanStack Query (React Query)**. Fará chamadas às APIs REST (já existentes) do Pikaraoke, como `/get_queue`, e manterá cache automático.
- **Tempo Real:** Utilizaremos a conexão nativa de **Socket.IO** já provida pelo Pikaraoke. Os hooks de socket vão acionar invalidações no cache do TanStack Query, mantendo a tela do usuário perfeitamente em sincronia com eventos do servidor (ex: "música pulada", "nova música na fila").

## 5. Múltiplos Layouts (Player vs Gestão)
O Pikaraoke tem dois focos principais de tela, que serão geridos pelo React Router com *Lazy Loading (Code Splitting)*:
- **App Layout (Gestão):** O layout mobile-first onde os usuários vão pesquisar, gerenciar a fila e realizar configurações. Contém a barra de topo, menus e temas do DaisyUI.
- **Player Layout (Apresentação):** O layout consumido por telas e projetores que exibirá as letras das músicas, o QR code e as notificações em tela cheia de forma contínua e imersiva. Sem botões de menu que distraiam a experiência de quem canta.

## 6. Autenticação e Restrição (Admin)
- O React consumirá a informação do status do usuário atual (se é Admin ou não) através da API (ou cookie já provido pelo Flask).
- Baseado na role de Admin, o front-end usará **Rotas Protegidas** e **Renderização Condicional** para exibir ou ocultar botões destrutivos (como "Limpar Fila", "Reordenar Fila", "Pular música alheia", etc.). 
- Essa lógica de front-end apenas oculta a interface; as travas de segurança definitivas (`is_admin()`) continuam residindo e validando ações no backend em Python.
