import { Link } from 'react-router-dom'

export function LegalPage() {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-300">
      <header className="border-b border-stone-800 bg-stone-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center gap-4">
          <Link to="/" className="text-stone-400 hover:text-stone-200 text-sm transition-colors">← Accueil</Link>
          <span className="text-amber-400 font-bold">Conditions Générales de Vente</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-12 space-y-8 text-sm leading-relaxed">
        <p className="text-stone-500 text-xs">Dernière mise à jour : juillet 2026</p>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">1. Éditeur du service</h2>
          <p>La Taverne est un service en ligne édité par Nicolas Pallas, auto-entrepreneur. Contact : <span className="text-amber-400">pallas.nicolas@gmail.com</span>.</p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">2. Description du service</h2>
          <p>La Taverne est un outil de gestion de campagnes pour jeux de rôle compatibles avec la 5e édition, accessible via abonnement mensuel. Un plan gratuit limité est disponible sans engagement.</p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">3. Plans et tarifs</h2>
          <p className="mb-2">Les plans payants sont les suivants :</p>
          <ul className="list-disc list-inside space-y-1 text-stone-400">
            <li><strong className="text-stone-300">Aventurier</strong> — 5,00 € TTC/mois, campagnes et joueurs illimités.</li>
            <li><strong className="text-stone-300">Guilde</strong> — 10,00 € TTC/mois, tout Aventurier + multi-tables + support prioritaire.</li>
          </ul>
          <p className="mt-2">Les prix incluent la TVA applicable. Le paiement est prélevé mensuellement via Stripe.</p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">4. Résiliation et remboursement</h2>
          <p>Vous pouvez résilier votre abonnement à tout moment depuis votre page compte. L'accès aux fonctionnalités payantes reste actif jusqu'à la fin de la période en cours. Conformément à l'article L221-28 du Code de la consommation, le droit de rétractation ne s'applique pas aux services numériques entièrement exécutés avant la fin du délai de rétractation, avec accord préalable de l'utilisateur.</p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">5. Disponibilité</h2>
          <p>Le service est fourni "en l'état". Nous nous efforçons de maintenir une disponibilité maximale mais ne garantissons pas un uptime à 100 %. Des maintenances peuvent interrompre temporairement le service.</p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">6. Propriété des données</h2>
          <p>Les données de campagne saisies par l'utilisateur lui appartiennent. En cas de fermeture du compte, un export JSON est possible depuis l'application. Nous ne revendiquons aucun droit sur le contenu créé.</p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">7. Droit applicable</h2>
          <p>Les présentes CGV sont soumises au droit français. Tout litige relèvera de la compétence des tribunaux français.</p>
        </section>
      </main>

      <footer className="border-t border-stone-800 py-6 text-center">
        <p className="text-stone-600 text-xs">© {new Date().getFullYear()} La Taverne — <Link to="/privacy" className="hover:text-stone-400 transition-colors">Politique de confidentialité</Link></p>
      </footer>
    </div>
  )
}
