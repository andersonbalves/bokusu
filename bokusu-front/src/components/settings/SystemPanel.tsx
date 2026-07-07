import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Cpu, Database, HardDrive, RefreshCw, LogOut, Power, Minimize, ShieldAlert } from 'lucide-react'
import { useSystemInfo, useLibraryStats, useSystemAction, useConnectionInfo } from '../../hooks/useSystem'
import { useAppStore } from '../../store/useAppStore'
import { ConfirmModal } from '../ConfirmModal'

export function SystemPanel() {
  const { t } = useTranslation()
  const isAdmin = useAppStore((s) => s.isAdmin)
  const { data: info, isLoading: infoLoading } = useSystemInfo()
  const { data: stats, isLoading: statsLoading } = useLibraryStats()
  const { data: connectionInfo } = useConnectionInfo()
  const systemAction = useSystemAction()
  const pushToast = useAppStore((s) => s.pushToast)

  const [confirmAction, setConfirmAction] = useState<'quit' | 'shutdown' | 'reboot' | 'expand-fs' | null>(null)

  if (!isAdmin) return null

  const handleAction = (action: 'update-ytdl' | 'sync-library') => {
    systemAction.mutate(action, {
      onSuccess: () => {
        if (action === 'update-ytdl') {
          pushToast(t('toasts.updateYtdlStarted') || 'Atualização do yt-dlp iniciada!', 'success')
        } else {
          pushToast(t('toasts.syncStarted') || 'Sincronizando biblioteca...', 'info')
        }
      },
      onError: () => {
        pushToast(t('toasts.actionFailed') || 'Erro ao executar comando', 'danger')
      },
    })
  }

  const handleDangerAction = () => {
    if (!confirmAction) return
    systemAction.mutate(confirmAction, {
      onSuccess: () => {
        pushToast(t('toasts.actionDispatched') || 'Comando enviado ao servidor!', 'success')
        setConfirmAction(null)
      },
      onError: () => {
        pushToast(t('toasts.actionFailed') || 'Erro ao executar comando', 'danger')
        setConfirmAction(null)
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* System Stats Section */}
      <section className="card bg-base-200 border border-base-300">
        <div className="card-body gap-4">
          <div className="flex items-center gap-2 border-b border-base-300 pb-2">
            <Cpu size={18} className="text-primary" />
            <h2 className="font-display text-lg font-semibold">{t('system.title')}</h2>
          </div>

          {/* Stats Display Grid */}
          <div className="stats stats-vertical md:stats-horizontal shadow-sm bg-base-300/30 w-full rounded-box">
            <div className="stat">
              <div className="stat-figure text-primary">
                <Cpu size={24} />
              </div>
              <div className="stat-title text-xs font-semibold uppercase opacity-60">CPU</div>
              <div className="stat-value text-xl font-bold truncate">
                {infoLoading ? <span className="loading loading-dots loading-sm" /> : info?.cpu || 'N/A'}
              </div>
            </div>

            <div className="stat">
              <div className="stat-figure text-primary">
                <HardDrive size={24} />
              </div>
              <div className="stat-title text-xs font-semibold uppercase opacity-60">RAM & Disk</div>
              <div className="stat-desc text-xs truncate max-w-[200px]">
                {infoLoading ? 'Loading...' : info?.memory || 'Memory N/A'}
              </div>
              <div className="stat-desc text-xs truncate max-w-[200px] mt-0.5">
                {infoLoading ? 'Loading...' : info?.disk || 'Disk N/A'}
              </div>
            </div>

            <div className="stat">
              <div className="stat-figure text-primary">
                <Database size={24} />
              </div>
              <div className="stat-title text-xs font-semibold uppercase opacity-60">
                {t('system.songCount')}
              </div>
              <div className="stat-value text-xl font-bold">
                {statsLoading ? <span className="loading loading-dots loading-sm" /> : stats?.song_count ?? 0}
              </div>
              <div className="stat-desc text-xs font-medium opacity-50">
                v{info?.pikaraokeVersion || '0.0.0'} / ytdl v{info?.youtubedlVersion || 'N/A'}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              type="button"
              className="btn btn-outline btn-sm btn-primary flex items-center gap-1.5"
              onClick={() => handleAction('sync-library')}
              disabled={systemAction.isPending}
            >
              <RefreshCw size={14} className={systemAction.isPending ? 'animate-spin' : ''} />
              {t('system.syncLibrary')}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm btn-secondary flex items-center gap-1.5"
              onClick={() => handleAction('update-ytdl')}
              disabled={systemAction.isPending}
            >
              <RefreshCw size={14} />
              {t('system.updateYtdl')}
            </button>
          </div>
        </div>
      </section>

      {/* Danger Zone Section */}
      <section className="card bg-error/5 border border-error/20">
        <div className="card-body gap-4">
          <div className="flex items-center gap-2 border-b border-error/10 pb-2 text-error">
            <ShieldAlert size={18} />
            <h2 className="font-display text-lg font-semibold">{t('system.dangerZone')}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-sm btn-error btn-outline flex items-center gap-1.5"
              onClick={() => setConfirmAction('reboot')}
            >
              <RefreshCw size={14} />
              {t('system.reboot')}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-error btn-outline flex items-center gap-1.5"
              onClick={() => setConfirmAction('shutdown')}
            >
              <Power size={14} />
              {t('system.shutdown')}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-error btn-outline flex items-center gap-1.5"
              onClick={() => setConfirmAction('quit')}
            >
              <LogOut size={14} />
              {t('system.quit')}
            </button>
            {connectionInfo?.isRaspberryPi && (
              <button
                type="button"
                className="btn btn-sm btn-error btn-outline flex items-center gap-1.5"
                onClick={() => setConfirmAction('expand-fs')}
              >
                <Minimize size={14} />
                {t('system.expandFs')}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Confirm Action Modals */}
      <ConfirmModal
        open={confirmAction !== null}
        title={t(`system.${confirmAction || 'reboot'}` as any)}
        message={t('system.confirmDanger')}
        onConfirm={handleDangerAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}
