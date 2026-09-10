import { useState } from 'react'
import { Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'
import { apiFetch, ApiError } from '../lib/api'
import type { AuthStatus } from '../types/api'

export function AdminModal() {
  const { t } = useTranslation()
  const { showAdminModal, pendingAdminAction, closeAdminModal, setIsAdmin } = useAppStore()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isPending, setIsPending] = useState(false)

  if (!showAdminModal) return null

  const handleConfirm = async () => {
    if (isPending || !password) return
    setIsPending(true)
    setError('')
    try {
      await apiFetch<AuthStatus>('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      setIsAdmin(true)
      pendingAdminAction?.()
      closeAdminModal()
      setPassword('')
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError(t('admin.incorrect'))
      } else {
        setError(t('admin.error'))
      }
    } finally {
      setIsPending(false)
    }
  }

  const handleCancel = () => {
    if (isPending) return
    closeAdminModal()
    setPassword('')
    setError('')
  }

  return (
    <div className="modal modal-open modal-bottom sm:modal-middle z-50">
      <div className="modal-box">
        <div className="flex items-center gap-3 mb-4">
          <Lock size={20} className="text-warning" />
          <h3 className="font-display text-lg">{t('admin.restricted')}</h3>
        </div>
        <p className="text-base-content/70 text-sm mb-4">
          {t('admin.prompt')}
        </p>
        <input
          type="password"
          className="input w-full"
          placeholder={t('admin.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
          autoFocus
          disabled={isPending}
        />
        {error && <p className="text-error text-sm mt-2">{error}</p>}
        <div className="modal-action">
          <button
            className="btn btn-ghost"
            onClick={handleCancel}
            disabled={isPending}
            aria-label={t('admin.cancel')}
          >
            {t('admin.cancel')}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={isPending || password.length === 0}
            aria-label={t('admin.confirm')}
          >
            {isPending && <span className="loading loading-spinner loading-xs" />}
            {t('admin.confirm')}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={handleCancel} />
    </div>
  )
}
