export interface ConfirmRequest {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void | Promise<void>
}

interface Props {
  request: ConfirmRequest | null
  onCancel: () => void
}

/**
 * Garde-fou sur les actions destructives et irréversibles.
 *
 * On confirme plutôt qu'on ne propose d'annuler : les combattants sont supprimés
 * côté serveur, et les recréer leur donnerait de nouveaux identifiants — les pions
 * du plateau qui les référencent pointeraient dans le vide. Un « undo » serait donc
 * trompeur ; mieux vaut demander avant.
 */
export function ConfirmDialog({ request, onCancel }: Props) {
  if (!request) return null

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm bg-stone-900 border border-stone-700 rounded-xl shadow-2xl p-5 space-y-3"
      >
        <h2 className="text-white font-semibold">{request.title}</h2>
        <p className="text-stone-400 text-sm leading-relaxed">{request.message}</p>
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className="text-stone-400 hover:text-stone-200 text-sm px-3 py-1.5 transition-colors"
          >
            Annuler
          </button>
          <button
            autoFocus
            onClick={async () => { await request.onConfirm(); onCancel() }}
            className="bg-red-700 hover:bg-red-600 text-white text-sm font-semibold rounded-lg px-4 py-1.5 transition-colors"
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
