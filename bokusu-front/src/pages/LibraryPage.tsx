import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Library, Search, Edit3, Trash2, Plus, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { useLibrary, useRenameFile, useDeleteFile } from '../hooks/useLibrary'
import { useEnqueue } from '../hooks/useQueue'
import { useAppStore } from '../store/useAppStore'
import { ConfirmModal } from '../components/ConfirmModal'
import { EditMetadataModal } from '../components/EditMetadataModal'

export function LibraryPage() {
  const { t } = useTranslation()
  const isAdmin = useAppStore((s) => s.isAdmin)
  const pushToast = useAppStore((s) => s.pushToast)

  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  // Modais de ação
  const [deletePath, setDeletePath] = useState<string | null>(null)
  const [editFile, setEditFile] = useState<{ path: string; displayName: string } | null>(null)

  const { data, isLoading, isError } = useLibrary({ q: query, page })
  const enqueue = useEnqueue()
  const deleteFile = useDeleteFile()
  const renameFile = useRenameFile()

  // Se não for admin, redireciona para as configurações
  if (!isAdmin) {
    return <Navigate to="/settings" replace />
  }

  const handleEnqueue = (path: string, displayName: string) => {
    // O administrador adiciona com o nome "Admin"
    enqueue.mutate(
      { song_id: path, user: 'Admin' },
      {
        onSuccess: () => {
          pushToast(t('search.added', { title: displayName }), 'success')
        },
        onError: () => {
          pushToast(t('search.error'), 'danger')
        },
      }
    )
  }

  const handleDelete = () => {
    if (!deletePath) return
    deleteFile.mutate(deletePath, {
      onSuccess: () => {
        pushToast(t('library.deletedSuccess') || 'Arquivo excluído!', 'success')
        setDeletePath(null)
      },
      onError: (err: any) => {
        const msg = err?.message || t('library.deletedError') || 'Erro ao excluir o arquivo'
        pushToast(msg, 'danger')
        setDeletePath(null)
      },
    })
  }

  const handleRename = (newName: string) => {
    if (!editFile) return
    renameFile.mutate(
      { oldFileName: editFile.path, newFileName: newName },
      {
        onSuccess: () => {
          pushToast(t('library.renamedSuccess') || 'Arquivo renomeado com sucesso!', 'success')
          setEditFile(null)
        },
        onError: (err: any) => {
          const msg = err?.message || t('library.renamedError') || 'Erro ao renomear o arquivo'
          pushToast(msg, 'danger')
          setEditFile(null)
        },
      }
    )
  }

  const totalPages = data ? Math.ceil(data.total / data.perPage) : 1

  return (
    <div className="p-4 max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header card */}
      <section className="card bg-base-200 border border-base-300">
        <div className="card-body gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Library size={24} className="text-primary" />
            <h1 className="font-display text-xl font-bold">{t('library.title') || 'Gerenciar Biblioteca'}</h1>
            <Link to="/library/renamer" className="btn btn-xs btn-outline btn-secondary flex items-center gap-1" aria-label={t('renamer.title')}>
              <RefreshCw size={12} />
              {t('renamer.title') || 'Renomeador'}
            </Link>
          </div>
          {/* Barra de busca integrada */}
          <div className="relative w-full md:max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
            <input
              type="text"
              placeholder={t('library.searchPlaceholder') || 'Filtrar biblioteca...'}
              className="input input-bordered input-sm w-full pl-10"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
            />
          </div>
        </div>
      </section>

      {/* Main Files list */}
      <section className="flex flex-col gap-2">
        {isLoading && (
          <div className="flex justify-center p-8">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        )}

        {isError && (
          <div className="alert alert-error">
            <span>{t('library.loadError') || 'Erro ao carregar os arquivos da biblioteca.'}</span>
          </div>
        )}

        {!isLoading && !isError && data?.files.length === 0 && (
          <div className="text-center p-8 text-base-content/50">
            {t('library.empty') || 'Nenhuma música encontrada na biblioteca.'}
          </div>
        )}

        {!isLoading &&
          !isError &&
          data?.files.map((file) => (
            <div
              key={file.path}
              className="flex items-center justify-between p-3 bg-base-200 border border-base-300 rounded-box hover:bg-base-300/40 transition-all gap-4"
            >
              <div className="truncate flex-1">
                <p className="font-medium truncate text-sm md:text-base text-base-content">
                  {file.displayName}
                </p>
                <p className="text-xs text-base-content/40 truncate font-mono mt-0.5">{file.path}</p>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="btn btn-ghost btn-circle btn-sm text-primary"
                  onClick={() => handleEnqueue(file.path, file.displayName)}
                  title={t('library.enqueue') || 'Adicionar à Fila'}
                  disabled={enqueue.isPending}
                >
                  <Plus size={18} />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-circle btn-sm text-secondary"
                  onClick={() => setEditFile(file)}
                  title={t('library.edit') || 'Editar'}
                >
                  <Edit3 size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-circle btn-sm text-error"
                  onClick={() => setDeletePath(file.path)}
                  title={t('library.delete') || 'Excluir'}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
      </section>

      {/* Pagination controls */}
      {!isLoading && !isError && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-base-300 pt-4 mt-2">
          <span className="text-xs md:text-sm text-base-content/60">
            {t('library.pageOf', { current: page, total: totalPages }) || `Página ${page} de ${totalPages}`}
            <span className="ml-2 font-semibold">({data?.total} {t('library.totalSongs') || 'músicas'})</span>
          </span>
          <div className="join">
            <button
              className="btn btn-sm join-item"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="btn btn-sm join-item font-semibold"
              disabled
            >
              {page}
            </button>
            <button
              className="btn btn-sm join-item"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modais de Confirmação e Edição */}
      <ConfirmModal
        open={deletePath !== null}
        title={t('library.deleteTitle') || 'Excluir Música'}
        message={t('library.deleteConfirmMessage') || 'Deseja mesmo excluir permanentemente este arquivo da biblioteca? Esta ação não pode ser desfeita.'}
        onConfirm={handleDelete}
        onCancel={() => setDeletePath(null)}
      />

      {editFile && (
        <EditMetadataModal
          open={editFile !== null}
          displayName={editFile.displayName}
          onClose={() => setEditFile(null)}
          onSave={handleRename}
        />
      )}
    </div>
  )
}
