import { Music } from 'lucide-react'
import { useQueue } from '../hooks/useQueue'
import { useNowPlaying } from '../hooks/useNowPlaying'
import { usePlayerControls } from '../hooks/usePlayerControls'
import { useAppStore } from '../store/useAppStore'
import { NowPlayingCard } from '../components/NowPlayingCard'
import { QueueItem } from '../components/QueueItem'
import type { QueueItem as QueueItemType } from '../types/api'

export function QueuePage() {
  const { data: queue = [], isLoading } = useQueue()
  const { data: nowPlaying } = useNowPlaying()
  const { skip } = usePlayerControls()
  const { isAdmin, openAdminModal } = useAppStore()

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
            <p className="text-base-content/60">Fila vazia</p>
          </div>
        </div>
      )}

      {queue.length > 0 && (
        <section>
          <h3 className="font-display text-sm uppercase tracking-widest text-base-content/50 mb-3">
            A seguir
          </h3>
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
        </section>
      )}
    </div>
  )
}
