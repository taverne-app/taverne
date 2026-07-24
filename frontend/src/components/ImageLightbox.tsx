import { useEffect, useState } from 'react'

/**
 * Modale d'agrandissement d'une image, contrôlée par le parent. À utiliser quand le
 * déclencheur n'est pas l'image elle-même — typiquement une carte dont l'<img> est en
 * `pointer-events-none` sous une couche d'épingles : le double-clic est alors posé sur
 * le conteneur, qui ouvre cette modale. Pour une image autonome, préférer ImageLightbox.
 */
export function ImageZoomModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  // Échap ferme la modale, comme tout overlay de l'appli.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 cursor-zoom-out"
    >
      <img
        src={src}
        alt={alt}
        onClick={e => e.stopPropagation()}
        className="max-w-[92vw] max-h-[92vh] object-contain rounded-xl shadow-2xl border border-stone-700"
      />
    </div>
  )
}

/**
 * Image cliquable : un double-clic l'ouvre en grand dans une modale. Remplacement direct
 * de <img> partout où l'on affiche une image de contenu — portrait de personnage, carte
 * de lieu, vignette de monstre. La vignette garde sa taille via `className` ; seule la
 * modale montre l'image à sa résolution réelle.
 *
 * Le double-clic (et non le simple) est délibéré : ces images vivent souvent dans des
 * lignes ou des cartes cliquables, où un simple clic sert déjà à autre chose. On stoppe
 * donc la propagation pour ne pas déclencher la sélection ou le glisser du parent.
 */
export function ImageLightbox({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false)

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
      {open && <ImageZoomModal src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  )
}
