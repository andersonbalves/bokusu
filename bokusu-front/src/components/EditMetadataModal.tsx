import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Edit3 } from 'lucide-react'

interface EditMetadataModalProps {
  open: boolean
  displayName: string
  onClose: () => void
  onSave: (newName: string) => void
}

export function EditMetadataModal({ open, displayName, onClose, onSave }: EditMetadataModalProps) {
  const { t } = useTranslation()
  const [artist, setArtist] = useState('')
  const [title, setTitle] = useState('')

  useEffect(() => {
    if (open) {
      const parts = displayName.split(' - ')
      if (parts.length >= 2) {
        setArtist(parts[0].trim())
        setTitle(parts.slice(1).join(' - ').trim())
      } else {
        setArtist('')
        setTitle(displayName.trim())
      }
    }
  }, [open, displayName])

  if (!open) return null

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    const finalName = artist.trim() ? `${artist.trim()} - ${title.trim()}` : title.trim()
    if (finalName) {
      onSave(finalName)
    }
  }

  return (
    <div className="modal modal-open" role="dialog" aria-modal="true">
      <div className="modal-box max-w-md bg-base-200 border border-base-300 shadow-xl">
        <div className="flex items-center justify-between border-b border-base-300 pb-2 mb-4">
          <div className="flex items-center gap-2 text-primary">
            <Edit3 size={18} />
            <h3 className="font-display text-lg font-bold">{t('library.editMetadata') || 'Editar Metadados'}</h3>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-circle btn-sm"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">{t('library.artist') || 'Artista / Cantor'}</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full font-medium"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Ex: Queen"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">{t('library.title') || 'Título da Música'}</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full font-medium"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Bohemian Rhapsody"
              required
            />
          </div>

          <div className="modal-action mt-6 gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary px-6" disabled={!title.trim()}>
              {t('common.confirm')}
            </button>
          </div>
        </form>
      </div>
      <button type="button" className="modal-backdrop" onClick={onClose} aria-label={t('common.close')} />
    </div>
  )
}
