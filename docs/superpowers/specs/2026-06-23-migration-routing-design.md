# Design Doc: Migração SPA e Upstream Mergeability (Rollout)

## Visão Geral
Este documento descreve a estratégia técnica para substituir a interface Jinja2 do PiKaraoke original pela nova Single Page Application (SPA) do Bokusu construída em React. O principal requisito arquitetural é **Zero Refatoração do Backend**, garantindo que o repositório Bokusu possa receber atualizações (`git pull upstream main`) do PiKaraoke sem gerar conflitos insolúveis nas rotas em Python.

## 1. O Desafio do Legado
O PiKaraoke clássico possui rotas híbridas. Por exemplo, a rota `/queue`:
*   Se for acessada pelo navegador (GET comum), retorna o template Jinja `queue.html`.
*   Se for um comando assíncrono (AJAX), processa ações e pode retornar JSON ou fazer redirecionamentos usando `flash()`.

Modificar todos os arquivos em `pikaraoke/routes/` para remover os `render_template` causaria uma divergência fatal com o repositório original.

## 2. Padrão de Interceptação Front-Controller (`before_request`)
Para resolver isso, utilizaremos um interceptador de requisições global no `app.py`.

*   **A Lógica:**
    ```python
    @app.before_request
    def intercept_html_routes():
        # Se não for uma requisição GET, deixa passar
        if request.method != "GET":
            return
            
        # Se for um arquivo estático ou API pura, deixa passar
        if request.path.startswith('/static') or request.path.startswith('/api'):
            return
            
        # Se a requisição for AJAX (React/Axios pedindo dados), deixa passar
        if request.headers.get("X-Requested-With") == "XMLHttpRequest":
            return
            
        # Se o cliente for um Navegador pedindo HTML, intercepta e devolve a SPA!
        if "text/html" in request.headers.get("Accept", ""):
            return render_template("index.html")
    ```

*   **Impacto:** Com essas míseras 15 linhas de código adicionadas no registro principal do Flask, o backend inteiro magicamente se transforma em uma API headless para as requisições AJAX do React, e em um servidor de SPA estático para qualquer rota acessada pelo usuário no navegador. As rotas velhas que contêm `render_template` nunca mais serão alcançadas por clientes humanos.

## 3. Comportamento do Cliente React (XHR)
Para que esse esquema funcione em harmonia com as rotas originais do PiKaraoke, a **Camada de Dados (Spec 1)** do Bokusu, seja via Axios ou Fetch API, deverá **sempre** embutir o header:
`X-Requested-With: XMLHttpRequest`

Isso aciona as condicionais já existentes no código original (ex: `is_ajax = request.headers.get("X-Requested-With") == "XMLHttpRequest"`) forçando o backend a devolver `JSON` ou responder com status HTTP corretos em vez de tentar renderizar HTML ou forçar redirecionamentos `302`.

## 4. Limpeza Focada (The Purge)
Arquivos que não geram conflito de código Python podem ser removidos com segurança para enxugar o tamanho do projeto:
*   Os arquivos `.css`, `.js` (exceto assets necessários para endpoints brutos, se houver) na pasta `static`.
*   As pastas de templates antigas podem ser mantidas ou ignoradas, já que o Git resolverá modificações em HTML sem quebrar a lógica do sistema. Recomendamos manter a pasta `templates` apenas com o nosso `index.html` injetado pelo build do Vite.
