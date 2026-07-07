import { useState } from 'react'
import { Music } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQueue, useReorderQueue, useClearQueue, useAddRandom } from '../hooks/useQueue'
import { useNowPlaying } from '../hooks/useNowPlaying'
import { usePlayerControls } from '../hooks/usePlayerControls'
import { useDownloads } from '../hooks/useDownloads'
import { useAppStore } from '../store/useAppStore'
import { NowPlayingCard } from '../components/NowPlayingCard'
import { QueueItem } from '../components/QueueItem'
import { DownloadErrorsCard } from '../components/DownloadErrorsCard'
import { ConfirmModal } from '../components/ConfirmModal'
import type { QueueItem as QueueItemType, DownloadItem } from '../types/api'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

export function QueuePage() {
  const { t } = useTranslation()
  const { data: queue = [], isLoading } = useQueue()
  const { data: nowPlaying } = useNowPlaying()
  const { data: downloads } = useDownloads()
  const { skip } = usePlayerControls()
  const reorderQueue = useReorderQueue()
  const clearQueue = useClearQueue()
  const addRandom = useAddRandom()
  const { isAdmin, openAdminModal } = useAppStore()

  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [randomModalOpen, setRandomModalOpen] = useState(false)
  const [randomAmount, setRandomAmount] = useState(5)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = queue.findIndex((item) => item.file === active.id)
    const newIndex = queue.findIndex((item) => item.file === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      reorderQueue.mutate({ oldIndex, newIndex })
    }
  }

  const handleSkip = () => {
    if (!isAdmin) {
      openAdminModal(() => skip.mutate())
      return
    }
    skip.mutate()
  }

  const isDownloading = (item: QueueItemType) => {
    if (!downloads) return false

    // Extract youtube 11-char ID if present (e.g. dQw4w9WgXcQ)
    const ytIdMatch = item.file.match(/(?:---([^.-]+)|\[([^\]]+)\])\.[^.]+$/)
    const ytId = ytIdMatch ? (ytIdMatch[1] || ytIdMatch[2]) : null

    const matches = (dl: DownloadItem | null | undefined) => {
      if (!dl) return false
      if (ytId && dl.url?.includes(ytId)) return true
      if (dl.title && item.title && dl.title.toLowerCase() === item.title.toLowerCase()) return true
      return false
    }

    if (matches(downloads.active)) return true
    return downloads.pending?.some(matches) ?? false
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  return (
    <div className="p-4 max-w-2xl mx-auto flex flex-col gap-6">
      {/* Download errors header card */}
      <DownloadErrorsCard />

      {nowPlaying?.now_playing ? (
        <NowPlayingCard nowPlaying={nowPlaying} onSkip={handleSkip} canSkip={isAdmin} />
      ) : (
        <div className="card bg-base-200 border border-base-300">
          <div className="card-body items-center text-center gap-2">
            <Music size={40} className="text-base-content/30" />
            <p className="text-base-content/60">{t('queue.empty')}</p>
          </div>
        </div>
      )}

      {/* Global Queue Action buttons */}
      {isAdmin && queue.length > 0 && (
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setRandomModalOpen(true)}
          >
            {t('queue.addRandom')}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-error btn-sm"
            onClick={() => setClearConfirmOpen(true)}
          >
            {t('queue.clear')}
          </button>
        </div>
      )}

      {queue.length > 0 && (
        <section>
          <h3 className="font-display text-sm uppercase tracking-widest text-base-content/50 mb-3">
            {t('queue.upNext')}
          </h3>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={queue.map((item) => item.file)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2">
                {queue.map((item, idx) => (
                  <QueueItem
                    key={item.file}
                    item={item}
                    position={idx + 1}
                    isAdmin={isAdmin}
                    isDownloading={isDownloading(item)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>
      )}

      {/* Confirm modals */}
      <ConfirmModal
        open={clearConfirmOpen}
        title={t('queue.clear')}
        message={t('queue.clearConfirm')}
        onConfirm={() => {
          clearQueue.mutate()
          setClearConfirmOpen(false)
        }}
        onCancel={() => setClearConfirmOpen(false)}
      />

      {/* Add Random modal */}
      {randomModalOpen && (
        <div role="dialog" aria-modal="true" className="modal modal-open z-50">
          <div className="modal-box max-w-xs">
            <h3 className="font-bold text-lg">{t('queue.addRandom')}</h3>
            <div className="py-4 flex flex-col gap-2">
              <label className="label text-sm text-base-content/70">
                {t('queue.randomAmount')}
              </label>
              <input
                type="number"
                min={1}
                max={20}
                className="input input-bordered w-full"
                value={randomAmount}
                onChange={(e) => setRandomAmount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
              />
            </div>
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setRandomModalOpen(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  addRandom.mutate(randomAmount)
                  setRandomModalOpen(false)
                }}
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={() => setRandomModalOpen(false)} aria-label={t('common.cancel')} />
        </div>
      )}
    </div>
  )
}
