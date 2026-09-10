import { useTranslation } from 'react-i18next'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({ open, title, message, onConfirm, onCancel }: ConfirmModalProps) {
  const { t } = useTranslation()

  if (!open) return null

  return (
    <div role="dialog" aria-modal="true" className="modal modal-open z-50">
      <div className="modal-box max-w-sm">
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="py-4 text-base-content/75">{message}</p>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-error" onClick={onConfirm}>
            {t('common.confirm')}
          </button>
        </div>
      </div>
      <button type="button" className="modal-backdrop" onClick={onCancel} aria-label={t('common.cancel')} />
    </div>
  )
}
