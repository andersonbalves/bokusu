import { Music } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQueue, useReorderQueue } from '../hooks/useQueue'
import { useNowPlaying } from '../hooks/useNowPlaying'
import { usePlayerControls } from '../hooks/usePlayerControls'
import { useAppStore } from '../store/useAppStore'
import { NowPlayingCard } from '../components/NowPlayingCard'
import { QueueItem } from '../components/QueueItem'
import type { QueueItem as QueueItemType } from '../types/api'
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
  const { skip } = usePlayerControls()
  const reorderQueue = useReorderQueue()
  const { isAdmin, openAdminModal } = useAppStore()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // prevents accidental drags during simple clicks
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

  const handleRemove = (_item: QueueItemType) => {
    if (!isAdmin) {
      openAdminModal(() => {
        /* remove endpoint wired in future task — backend /api/queue/<id> DELETE */
      })
      return
    }
    /* remove endpoint wired in future task — backend /api/queue/<id> DELETE */
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
                    onRemove={() => handleRemove(item)}
                    removeDisabled={true}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>
      )}
    </div>
  )
}
