# Design Doc: Gerenciamento de Arquivos Locais (Browser e Renomeador)

## Visão Geral
Este documento especifica a interface de gerenciamento das bibliotecas de arquivos locais (`/files`). Por tratar-se de uma funcionalidade focada em administração de servidor, sua UI será isolada da experiência "Festiva/Casual" dos cantores para prevenir modificações ou exclusões acidentais.

## 1. Localização na Arquitetura (Aba "Mais")
Diferente da aplicação original em Jinja, a nova SPA não terá uma aba global de "Navegador de Pastas".
*   **Onde Fica:** O acesso será via um painel localizado em `Configurações (Mais) > Gerenciar Bibliotecas Locais`.
*   **Acesso Restrito:** Apenas instâncias logadas como Admin conseguirão visualizar e interagir com este botão. Convidados que abrirem a aba "Configurações" verão apenas as opções de visualização (ex: trocar tema) ou o prompt de login de administrador.

## 2. File Browser (Explorador de Arquivos)
O frontend precisará renderizar os dados vindos de `/files/browse` de forma tabular e responsiva.
*   **UI/UX:** Uma lista de pastas e arquivos aninhados, com breadcrumbs no topo (ex: `Raiz > Musicas Nacionais > Samba`).
*   **Ações no Arquivo:** Ao clicar em um arquivo, ele revelará um sub-menu com as ações transacionais:
    1.  **Adicionar à Fila:** Envia a música para tocar imediatamente.
    2.  **Editar Metadados:** Abre um modal chamando `/files/edit` para corrigir título, artista, etc.
    3.  **Excluir (Destrutivo):** Chamada para `/files/delete` protegida por um modal rigoroso de confirmação dupla.

## 3. Batch Song Renamer (Renomeador em Lote)
O utilitário de limpeza de nomes (que processa a sujeira de nomes baixados em massa para torná-los compatíveis com a busca nativa) será portado na íntegra.
*   **Visualização A/B:** A UI exibirá uma tabela "Antes vs Depois", comparando o nome cru (ex: `metallica_-_nothing_else_matters_karaoke_version_720p.mp4`) com a sugestão da API `/metadata/suggest-names` (ex: `Metallica - Nothing Else Matters.mp4`).
*   **Fluxo de Aprovação:** O Admin pode revisar a tabela, desmarcar arquivos que não devem ser tocados, e confirmar a execução da rota de apply, limpando a base do HD local.
