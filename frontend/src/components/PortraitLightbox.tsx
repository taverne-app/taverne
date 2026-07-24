import { useEffect, useState } from 'react'

/**
 * Portrait cliquable : un double-clic l'ouvre en grand dans une modale. Sert de
 * remplacement direct à <img> partout où l'on affiche le portrait d'un personnage
 * (suivi de combat, fiche, vues joueurs). La vignette garde sa taille via `className` ;
 * seule la modale montre l'image à sa résolution réelle.
 *
 * Le double-clic (et non le simple) est délibéré : ces portraits vivent dans des lignes
 * cliquables et déplaçables, où un simple clic sert déjà à autre chose. On stoppe donc
 * la propagation pour ne pas déclencher la sélection ou le glisser de la ligne.
 */
export function PortraitLightbox({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false)

  // Échap ferme la modale, comme tout overlay de l'appli.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <img
        src={src}
        alt={alt}
        title="Double-cliquez pour agrandir"
        draggable={false}
        onDoubleClick={e => { e.stopPropagation(); e.preventDefault(); setOpen(true) }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        className={`${className ?? ''} cursor-zoom-in`}
      />
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 cursor-zoom-out"
        >
          <img
            src={src}
            alt={alt}
            onClick={e => e.stopPropagation()}
            className="max-w-[92vw] max-h-[92vh] object-contain rounded-xl shadow-2xl border border-stone-700"
          />
        </div>
      )}
    </>
  )
}
