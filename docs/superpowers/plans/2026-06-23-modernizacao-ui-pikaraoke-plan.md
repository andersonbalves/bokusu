# Modernização UI Pikaraoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar o front-end do Pikaraoke para uma SPA em React (Vite, TypeScript, DaisyUI, Zustand, TanStack Query) com impacto mínimo no roteamento do backend.

**Architecture:** O código React residirá em `bokusu-front`. O Vite fará o build gerando o `index.html` em `pikaraoke/templates` e os assets em `pikaraoke/static/assets`. O Flask terá uma rota catch-all para servir a SPA. O React Router lidará com Layouts de Gestão e Player.

**Tech Stack:** React 18, Vite, TypeScript, TailwindCSS, DaisyUI, Lucide React, Zustand, TanStack Query, React Router DOM.

---

### Task 1: Inicialização do Projeto e Configuração do Vite

**Files:**
- Create: `bokusu-front/package.json`
- Create: `bokusu-front/vite.config.ts`

- [ ] **Step 1: Criar o projeto Vite**

```bash
npx -y create-vite@latest bokusu-front --template react-ts
```

- [ ] **Step 2: Configurar o build do Vite**

Editar `bokusu-front/vite.config.ts` para enviar o build para as pastas do Flask:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../pikaraoke/templates',
    emptyOutDir: false, // não apagar os outros templates jinja
    rollupOptions: {
      output: {
        entryFileNames: '../static/assets/js/[name]-[hash].js',
        chunkFileNames: '../static/assets/js/[name]-[hash].js',
        assetFileNames: '../static/assets/[ext]/[name]-[hash].[ext]'
      }
    }
  }
})
```

- [ ] **Step 3: Testar o build inicial**

```bash
cd bokusu-front
npm install
npm run build
```
Expected: Arquivos gerados em `pikaraoke/templates/index.html` e `pikaraoke/static/assets/`.

- [ ] **Step 4: Commit**

```bash
git add bokusu-front/package.json bokusu-front/vite.config.ts bokusu-front/tsconfig.json bokusu-front/index.html bokusu-front/src
git commit -m "chore: setup vite react-ts project for pikaraoke front"
```

### Task 2: Configuração TailwindCSS e DaisyUI

**Files:**
- Create: `bokusu-front/tailwind.config.js`
- Create: `bokusu-front/postcss.config.js`
- Modify: `bokusu-front/src/index.css`

- [ ] **Step 1: Instalar dependências**

```bash
cd bokusu-front
npm install -D tailwindcss postcss autoprefixer daisyui
npx tailwindcss init -p
npm install lucide-react
```

- [ ] **Step 2: Configurar Tailwind e DaisyUI**

Modificar `bokusu-front/tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["aqua", "acid"],
  },
}
```

- [ ] **Step 3: Adicionar CSS global (Tipografia e Border Radius)**

Modificar `bokusu-front/src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Michroma&family=Space+Grotesk:wght@400;600&display=swap');

:root {
  --font-display: "Michroma", sans-serif;
  --font-body: "Space Grotesk", sans-serif;
}

body {
  font-family: var(--font-body);
}

h1, h2, h3, h4, .font-display {
  font-family: var(--font-display);
}

[data-theme="acid"],
[data-theme="aqua"] {
  --radius-box: 1rem;
  --radius-field: 1.5rem;
  --radius-selector: 1.5rem;
}
```

- [ ] **Step 4: Commit**

```bash
git add bokusu-front/tailwind.config.js bokusu-front/postcss.config.js bokusu-front/src/index.css bokusu-front/package.json
git commit -m "chore: configure tailwind, daisyui and global css"
```

### Task 3: Gerenciamento de Estado (Zustand & TanStack Query)

**Files:**
- Create: `bokusu-front/src/store/useAppStore.ts`
- Modify: `bokusu-front/src/main.tsx`

- [ ] **Step 1: Instalar dependências**

```bash
cd bokusu-front
npm install zustand @tanstack/react-query
```

- [ ] **Step 2: Criar a Store do Zustand**

Criar `bokusu-front/src/store/useAppStore.ts`:

```typescript
import { create } from 'zustand'

interface AppState {
  theme: 'aqua' | 'acid'
  isAdmin: boolean
  setTheme: (theme: 'aqua' | 'acid') => void
  setIsAdmin: (isAdmin: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'aqua',
  isAdmin: false,
  setTheme: (theme) => set({ theme }),
  setIsAdmin: (isAdmin) => set({ isAdmin }),
}))
```

- [ ] **Step 3: Configurar o React Query no Provider**

Modificar `bokusu-front/src/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
```

- [ ] **Step 4: Commit**

```bash
git add bokusu-front/src/store/useAppStore.ts bokusu-front/src/main.tsx bokusu-front/package.json
git commit -m "feat: setup zustand and tanstack query"
```

### Task 4: React Router e Estrutura de Layouts

**Files:**
- Create: `bokusu-front/src/layouts/AppLayout.tsx`
- Create: `bokusu-front/src/layouts/PlayerLayout.tsx`
- Modify: `bokusu-front/src/App.tsx`

- [ ] **Step 1: Instalar React Router**

```bash
cd bokusu-front
npm install react-router-dom
```

- [ ] **Step 2: Criar Layout do App (Gestão)**

Criar `bokusu-front/src/layouts/AppLayout.tsx`:

```tsx
import { Outlet } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'

export function AppLayout() {
  const theme = useAppStore((state) => state.theme)
  
  return (
    <div data-theme={theme} className="min-h-screen bg-base-100 text-base-content">
      <nav className="navbar bg-base-200">
        <div className="flex-1">
          <a className="btn btn-ghost text-xl font-display">Pikaraoke</a>
        </div>
      </nav>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Criar Layout do Player**

Criar `bokusu-front/src/layouts/PlayerLayout.tsx`:

```tsx
import { Outlet } from 'react-router-dom'

export function PlayerLayout() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <Outlet />
    </div>
  )
}
```

- [ ] **Step 4: Configurar Rotas no App.tsx**

Modificar `bokusu-front/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { PlayerLayout } from './layouts/PlayerLayout'

function Home() { return <h2>Gestão Home</h2> }
function Player() { return <h2 className="font-display">Player Screen</h2> }

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/queue" element={<Home />} />
        </Route>
        <Route element={<PlayerLayout />}>
          <Route path="/player" element={<Player />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add bokusu-front/src/layouts bokusu-front/src/App.tsx bokusu-front/package.json
git commit -m "feat: setup react router with distinct layouts"
```

### Task 5: Rota Catch-all no Flask

**Files:**
- Modify: `pikaraoke/routes/home.py`

- [ ] **Step 1: Criar rota catch-all no Flask**

Modificar `pikaraoke/routes/home.py` para injetar um fallback para o front-end SPA.

Adicionar no final do arquivo:

```python
@home_bp.route('/', defaults={'path': ''})
@home_bp.route('/<path:path>')
def catch_all(path):
    """Fallback route for React SPA."""
    from flask import render_template
    # Evitar conflitos com rotas de API
    if path.startswith('api/') or path.startswith('static/'):
        from flask import abort
        abort(404)
    return render_template("index.html")
```

- [ ] **Step 2: Verificar a sintaxe do python**

```bash
python -m py_compile pikaraoke/routes/home.py
```
Expected: Nenhum erro de sintaxe.

- [ ] **Step 3: Commit**

```bash
git add pikaraoke/routes/home.py
git commit -m "feat: add catch-all route for React SPA"
```
