import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { listImages, uploadImage, deleteImage, formatBytes, type LibraryImage, type ImageQuota } from '../api/images'
import { ApiError } from '../api/client'

interface Props {
  /** URL actuelle de l'image (peut venir de la bibliothèque ou être collée à la main). */
  value: string
  onChange: (url: string) => void
  placeholder?: string
  /** Contrôles propres au contexte, rendus dans la même barre (ex. Grille, + Pion). */
  children?: ReactNode
}

/**
 * Champ d'image unifié : saisie d'URL (conservée pour ne pas casser l'existant),
 * upload, et bibliothèque du compte — partagée entre battle map, carte de campagne
 * et portraits, d'où un quota cohérent sur tout le compte.
 */
export function ImagePicker({ value, onChange, placeholder = "URL de l'image…", children }: Props) {
  const [urlDraft, setUrlDraft] = useState(value)
  const [library, setLibrary] = useState<LibraryImage[]>([])
  const [quota, setQuota] = useState<ImageQuota | null>(null)
  const [showLibrary, setShowLibrary] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setUrlDraft(value) }, [value])

  useEffect(() => {
    listImages()
      .then(lib => { setLibrary(lib.images); setQuota(lib.quota) })
      .catch(() => { /* bibliothèque indisponible : la saisie d'URL reste utilisable */ })
  }, [])

  const commitUrl = () => {
    const next = urlDraft.trim()
    if (next !== value) onChange(next)
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const { image, quota: q } = await uploadImage(file)
      setLibrary(prev => [image, ...prev])
      setQuota(q)
      setUrlDraft(image.url)
      onChange(image.url)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Upload impossible')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const q = await deleteImage(id)
      setLibrary(prev => prev.filter(i => i.id !== id))
      setQuota(q)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Suppression impossible')
    }
  }

  const countFull = quota?.max !== null && quota !== null && quota.used >= quota.max
  const bytesFull = quota?.max_bytes != null && quota.used_bytes >= quota.max_bytes

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="url"
          value={urlDraft}
          onChange={e => setUrlDraft(e.target.value)}
          onBlur={commitUrl}
          onKeyDown={e => { if (e.key === 'Enter') commitUrl() }}
          placeholder={placeholder}
          className="flex-1 min-w-[200px] bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
        />

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) handleUpload(f)
            e.target.value = '' // permet de re-choisir le même fichier
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Uploader une image — elle est redimensionnée et recompressée automatiquement"
          className="bg-stone-800 border border-stone-700 text-stone-300 hover:text-white hover:border-stone-500 disabled:opacity-50 text-sm font-medium rounded-lg px-3 py-2 transition-colors"
        >{uploading ? '⏳ Envoi…' : '⬆ Uploader'}</button>
        <button
          onClick={() => setShowLibrary(v => !v)}
          title="Choisir une image déjà uploadée"
          className={`text-sm font-medium rounded-lg px-3 py-2 border transition-colors ${showLibrary ? 'bg-stone-700 border-stone-500 text-white' : 'bg-stone-800 border-stone-700 text-stone-300 hover:text-white'}`}
        >
          🖼 Bibliothèque
          {quota && <span className="text-stone-500 ml-1 tabular-nums">{quota.used}/{quota.max ?? '∞'}</span>}
        </button>

        {children}
      </div>

      {error && <p className="text-red-400 text-xs">⚠ {error}</p>}

      {showLibrary && (
        <div className="bg-stone-900 border border-stone-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-stone-400 text-xs font-semibold uppercase tracking-widest">Bibliothèque d’images</span>
            {quota && (
              <span className="text-xs tabular-nums flex items-center gap-2">
                <span className={countFull ? 'text-amber-400' : 'text-stone-500'}>
                  {quota.used}/{quota.max ?? '∞'} images
                </span>
                <span className="text-stone-700">·</span>
                <span className={bytesFull ? 'text-amber-400' : 'text-stone-500'}>
                  {formatBytes(quota.used_bytes)}{quota.max_bytes !== null && ` / ${formatBytes(quota.max_bytes)}`}
                </span>
                {(countFull || bytesFull) && (
                  <span className="text-amber-400">— supprimez une image pour libérer de la place</span>
                )}
              </span>
            )}
          </div>
          {library.length === 0 ? (
            <p className="text-stone-600 text-xs py-2">Aucune image. Utilisez « ⬆ Uploader » pour en ajouter une.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
              {library.map(img => {
                const inUse = value === img.url
                return (
                  <div key={img.id} className="relative group">
                    <button
                      onClick={() => { setUrlDraft(img.url); onChange(img.url) }}
                      title={img.original_name}
                      className={`block w-full rounded border overflow-hidden transition-colors ${inUse ? 'border-amber-500 ring-1 ring-amber-500/50' : 'border-stone-700 hover:border-stone-500'}`}
                    >
                      <img src={img.url} alt={img.original_name} className="w-full h-16 object-cover" />
                    </button>
                    <button
                      onClick={() => handleDelete(img.id)}
                      title="Supprimer de la bibliothèque (libère un emplacement)"
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-stone-800 border border-stone-600 text-stone-400 text-xs hover:bg-red-900/70 hover:text-red-300 hover:border-red-700 transition-colors opacity-0 group-hover:opacity-100"
                    >×</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
