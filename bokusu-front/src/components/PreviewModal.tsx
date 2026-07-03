import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'

interface PreviewModalProps {
  url: string | null
  onClose: () => void
}

export function PreviewModal({ url, onClose }: PreviewModalProps) {
  const { t } = useTranslation()
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!url) {
      setStreamUrl(null)
      return
    }

    setIsLoading(true)
    setError(null)
    apiFetch<{ stream_url: string }>(`/api/search/preview?url=${encodeURIComponent(url)}`)
      .then((data) => {
        setStreamUrl(data.stream_url)
      })
      .catch((err) => {
        console.error(err)
        setError(t('search.previewError') || 'Error loading preview')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [url, t])

  if (!url) return null

  return (
    <div role="dialog" aria-modal="true" className="modal modal-open z-50">
      <div className="modal-box max-w-2xl p-0 overflow-hidden relative bg-black aspect-video flex items-center justify-center">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/75 z-10">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-error bg-black/75 z-10 p-4 text-center">
            <p>{error}</p>
          </div>
        )}
        {streamUrl && (
          <video
            data-testid="preview-video"
            src={streamUrl}
            controls
            autoPlay
            className="w-full h-full object-contain"
          />
        )}
        <button
          type="button"
          className="btn btn-circle btn-sm absolute top-3 right-3 bg-black/50 border-none text-white hover:bg-black/80 z-20"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          <X size={18} />
        </button>
      </div>
      <button type="button" className="modal-backdrop" onClick={onClose} aria-label={t('common.close')} />
    </div>
  )
}
