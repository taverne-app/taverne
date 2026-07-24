/**
 * Attribution du SRD 5.1, exigée par la licence Creative Commons Attribution 4.0
 * sous laquelle Wizards of the Coast l'a publié.
 *
 * Ce n'est pas une mention de courtoisie : c'est la condition qui rend l'usage licite.
 * Elle doit rester visible sur les pages publiques — celles que voient les joueurs
 * sans compte — et le texte anglais est celui de la licence, à ne pas traduire.
 *
 * La licence ne couvre NI les marques (« Dungeons & Dragons », les logos), NI le
 * contenu hors SRD : d'où la mention d'indépendance, qui écarte toute idée d'un
 * lien avec l'éditeur.
 */
export function SrdAttribution({ className }: { className?: string }) {
  return (
    <p className={`text-center text-[10px] leading-relaxed max-w-2xl mx-auto ${className ?? ''}`}>
      Projet indépendant, sans lien avec Wizards of the Coast LLC.{' '}
      This work includes material from the System Reference Document 5.1 (“SRD 5.1”) by
      Wizards of the Coast LLC, available under the{' '}
      <a
        href="https://creativecommons.org/licenses/by/4.0/legalcode"
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-dotted underline-offset-2 hover:opacity-80"
      >Creative Commons Attribution 4.0 International License</a>.
    </p>
  )
}
