import { Tv, Palette, ShieldCheck, LogOut } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

export function SettingsPage() {
  const { theme, setTheme, playerMode, setPlayerMode, isAdmin, openAdminModal, setIsAdmin } =
    useAppStore()

  return (
    <div className="p-4 max-w-2xl mx-auto flex flex-col gap-6">
      {/* Theme */}
      <section className="card bg-base-200 border border-base-300">
        <div className="card-body gap-4">
          <div className="flex items-center gap-2">
            <Palette size={18} className="text-primary" />
            <h2 className="font-display text-lg">Tema</h2>
          </div>
          <div className="flex gap-6">
            {(['aqua', 'acid'] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  className="radio radio-primary"
                  name="theme"
                  value={t}
                  checked={theme === t}
                  onChange={() => setTheme(t)}
                  aria-label={t.charAt(0).toUpperCase() + t.slice(1)}
                />
                <span className="capitalize">{t}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* TV / Player Mode */}
      <section className="card bg-base-200 border border-base-300">
        <div className="card-body gap-4">
          <div className="flex items-center gap-2">
            <Tv size={18} className="text-primary" />
            <h2 className="font-display text-lg">Modo da TV</h2>
          </div>
          <div className="flex flex-col gap-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                className="radio radio-primary mt-0.5"
                name="playerMode"
                value="integration"
                checked={playerMode === 'integration'}
                onChange={() => setPlayerMode('integration')}
                aria-label="Integração / Boas-vindas"
              />
              <div>
                <p className="font-medium">Integração / Boas-vindas</p>
                <p className="text-sm text-base-content/60">
                  QR Code centralizado. Foco em atrair novos cantores.
                </p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                className="radio radio-primary mt-0.5"
                name="playerMode"
                value="cinematic"
                checked={playerMode === 'cinematic'}
                onChange={() => setPlayerMode('cinematic')}
                aria-label="Cinemático"
              />
              <div>
                <p className="font-medium">Cinemático</p>
                <p className="text-sm text-base-content/60">
                  Minimalista. QR nos cantos. Foco no vídeo de fundo.
                </p>
              </div>
            </label>
          </div>
        </div>
      </section>

      {/* Admin */}
      <section className="card bg-base-200 border border-base-300">
        <div className="card-body gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary" />
            <h2 className="font-display text-lg">Administrador</h2>
          </div>
          {isAdmin ? (
            <div className="flex items-center justify-between">
              <span className="badge badge-success gap-1">
                <ShieldCheck size={12} />
                Modo Admin ativo
              </span>
              <button
                className="btn btn-sm btn-outline btn-error"
                onClick={() => setIsAdmin(false)}
                aria-label="Sair do modo Admin"
              >
                <LogOut size={16} />
                Sair do modo Admin
              </button>
            </div>
          ) : (
            <button
              className="btn btn-outline btn-primary w-fit"
              onClick={() => openAdminModal(() => {})}
              aria-label="Entrar como Admin"
            >
              <ShieldCheck size={16} />
              Entrar como Admin
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
