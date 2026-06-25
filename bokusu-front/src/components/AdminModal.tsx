import { useState } from 'react'
import { Lock } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

export function AdminModal() {
  const { showAdminModal, pendingAdminAction, closeAdminModal, setIsAdmin } = useAppStore()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isPending, setIsPending] = useState(false)

  if (!showAdminModal) return null

  const handleConfirm = async () => {
    if (!password) return
    setIsPending(true)
    setError('')
    let verified = false
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        setError('Senha incorreta')
        return
      }
      verified = true
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setIsPending(false)
    }
    if (verified) {
      setIsAdmin(true)
      pendingAdminAction?.()
      closeAdminModal()
      setPassword('')
    }
  }

  const handleCancel = () => {
    closeAdminModal()
    setPassword('')
    setError('')
  }

  return (
    <div className="modal modal-open modal-bottom sm:modal-middle z-50">
      <div className="modal-box">
        <div className="flex items-center gap-3 mb-4">
          <Lock size={20} className="text-warning" />
          <h3 className="font-display text-lg">Acesso Restrito</h3>
        </div>
        <p className="text-base-content/70 text-sm mb-4">
          Digite a senha do Administrador para continuar.
        </p>
        <input
          type="password"
          className="input w-full"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
          autoFocus
        />
        {error && <p className="text-error text-sm mt-2">{error}</p>}
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={handleCancel} aria-label="Cancelar">
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={isPending || password.length === 0}
            aria-label="Confirmar"
          >
            {isPending && <span className="loading loading-spinner loading-xs" />}
            Confirmar
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={handleCancel} />
    </div>
  )
}
