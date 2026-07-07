import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { RefreshCw, ChevronLeft, ChevronRight, ArrowRight, Library, CheckSquare, Square } from 'lucide-react'
import { useRenamerSongs, useApplyRename } from '../hooks/useRenamer'
import { useAppStore } from '../store/useAppStore'

export function RenamerPage() {
  const { t } = useTranslation()
  const isAdmin = useAppStore((s) => s.isAdmin)
  const pushToast = useAppStore((s) => s.pushToast)

  const [page, setPage] = useState(1)
  const [onlyMismatched, setOnlyMismatched] = useState(true)
  const [selectedSongs, setSelectedSongs] = useState<Record<string, boolean>>({})

  // Controle de progresso de batch rename
  const [renamingTotal, setRenamingTotal] = useState(0)
  const [renamingCurrent, setRenamingCurrent] = useState(0)
  const [isRenaming, setIsRenaming] = useState(false)

  const { data, isLoading, isError, refetch } = useRenamerSongs({ page, onlyMismatched })
  const applyRename = useApplyRename()

  // Aguarda o /api/auth resolver antes de decidir; evita expulsar admin no F5
  if (isAdmin === null) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/settings" replace />
  }

  const songs = data?.songs || []
  const total = data?.total || 0
  const perPage = 10 // Padrão da API Flask
  const totalPages = Math.ceil(total / perPage)

  const toggleSelectAll = () => {
    const allSelected = songs.every((s) => selectedSongs[s.file])
    const newSelected = { ...selectedSongs }
    songs.forEach((s) => {
      newSelected[s.file] = !allSelected
    })
    setSelectedSongs(newSelected)
  }

  const toggleSelectSong = (file: string) => {
    setSelectedSongs((prev) => ({
      ...prev,
      [file]: !prev[file],
    }))
  }

  const handleApplySelected = async () => {
    const toRename = songs.filter((s) => selectedSongs[s.file] && !s.isEqual)
    if (toRename.length === 0) return

    setIsRenaming(true)
    setRenamingTotal(toRename.length)
    setRenamingCurrent(0)

    let successCount = 0
    let failCount = 0

    for (const song of toRename) {
      try {
        await applyRename.mutateAsync({
          oldName: song.file,
          newName: song.suggestedName,
        })
        successCount++
      } catch {
        failCount++
      }
      setRenamingCurrent((prev) => prev + 1)
    }

    setIsRenaming(false)
    setRenamingTotal(0)
    setRenamingCurrent(0)
    setSelectedSongs({})

    if (failCount > 0) {
      pushToast(
        t('renamer.batchResultPartial', { success: successCount, fail: failCount }) ||
          `Renomeados: ${successCount} com sucesso, ${failCount} falhas`,
        'danger'
      )
    } else {
      pushToast(
        t('renamer.batchResultSuccess', { count: successCount }) ||
          `${successCount} arquivos renomeados com sucesso!`,
        'success'
      )
    }

    refetch()
  }

  return (
    <div className="p-4 max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header card */}
      <section className="card bg-base-200 border border-base-300">
        <div className="card-body gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw size={24} className="text-primary" />
            <h1 className="font-display text-xl font-bold">{t('renamer.title') || 'Renomeador Inteligente'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/library" className="btn btn-sm btn-ghost gap-1.5 text-base-content/70">
              <Library size={16} />
              {t('library.title') || 'Biblioteca'}
            </Link>
            <label className="label cursor-pointer gap-2 py-0">
              <span className="label-text text-sm font-semibold">{t('renamer.onlyMismatched') || 'Só divergentes'}</span>
              <input
                type="checkbox"
                className="checkbox checkbox-primary checkbox-sm"
                checked={onlyMismatched}
                onChange={(e) => {
                  setOnlyMismatched(e.target.checked)
                  setPage(1)
                  setSelectedSongs({})
                }}
              />
            </label>
          </div>
        </div>
      </section>

      {/* Progress bar during batch run */}
      {isRenaming && (
        <div className="card bg-base-200 border border-base-300 p-4 flex flex-col gap-2">
          <div className="flex justify-between text-sm font-semibold">
            <span>{t('renamer.renamingProgress') || 'Aplicando renomeações...'}</span>
            <span>{renamingCurrent} / {renamingTotal}</span>
          </div>
          <progress
            className="progress progress-primary w-full"
            value={renamingCurrent}
            max={renamingTotal}
          />
        </div>
      )}

      {/* Songs Table Section */}
      <section className="card bg-base-200 border border-base-300 overflow-hidden">
        {isLoading && (
          <div className="flex justify-center p-12">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        )}

        {isError && (
          <div className="alert alert-error m-4">
            <span>{t('library.loadError') || 'Erro ao carregar arquivos.'}</span>
          </div>
        )}

        {!isLoading && !isError && songs.length === 0 && (
          <div className="text-center p-12 text-base-content/50">
            {t('renamer.empty') || 'Nenhuma sugestão de renomeação pendente.'}
          </div>
        )}

        {!isLoading && !isError && songs.length > 0 && (
          <div className="overflow-x-auto w-full">
            <table className="table w-full text-sm">
              <thead>
                <tr className="border-b border-base-300">
                  <th className="w-12 text-center">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs btn-square"
                      onClick={toggleSelectAll}
                      aria-label="Select All"
                    >
                      {songs.every((s) => selectedSongs[s.file]) ? (
                        <CheckSquare size={16} className="text-primary" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                  <th>{t('renamer.before') || 'Nome Atual'}</th>
                  <th className="w-8"></th>
                  <th>{t('renamer.after') || 'Sugestão'}</th>
                </tr>
              </thead>
              <tbody>
                {songs.map((song) => {
                  const isSelected = !!selectedSongs[song.file]
                  return (
                    <tr
                      key={song.file}
                      className={`border-b border-base-300/40 hover:bg-base-300/20 transition-all ${
                        song.isEqual ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary checkbox-xs"
                          checked={isSelected}
                          disabled={song.isEqual}
                          onChange={() => toggleSelectSong(song.file)}
                          aria-label={`Select ${song.currentName}`}
                        />
                      </td>
                      <td className="font-medium max-w-xs truncate" title={song.currentName}>
                        {song.currentName}
                      </td>
                      <td className="text-base-content/30 text-center">
                        <ArrowRight size={14} />
                      </td>
                      <td className={`font-semibold max-w-xs truncate ${song.isEqual ? 'text-base-content/50' : 'text-success'}`} title={song.suggestedName}>
                        {song.suggestedName}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Footer controls & Action */}
      {!isLoading && !isError && songs.length > 0 && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-base-content/60">
                {t('library.pageOf', { current: page, total: totalPages })}
              </span>
              <div className="join">
                <button
                  className="btn btn-xs join-item"
                  disabled={page <= 1}
                  onClick={() => {
                    setPage((p) => p - 1)
                    setSelectedSongs({})
                  }}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  className="btn btn-xs join-item font-semibold"
                  disabled
                >
                  {page}
                </button>
                <button
                  className="btn btn-xs join-item"
                  disabled={page >= totalPages}
                  onClick={() => {
                    setPage((p) => p + 1)
                    setSelectedSongs({})
                  }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Action button */}
          <div className="flex justify-end flex-1">
            <button
              type="button"
              className="btn btn-primary btn-sm flex items-center gap-1.5 px-6"
              disabled={isRenaming || songs.filter((s) => selectedSongs[s.file] && !s.isEqual).length === 0}
              onClick={handleApplySelected}
            >
              <RefreshCw size={14} className={isRenaming ? 'animate-spin' : ''} />
              {t('renamer.apply') || 'Aplicar Selecionados'}
              <span className="badge badge-sm badge-secondary font-bold ml-1">
                {songs.filter((s) => selectedSongs[s.file] && !s.isEqual).length}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
