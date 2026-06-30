import { Link } from 'react-router-dom'

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-300">
      <header className="border-b border-stone-800 bg-stone-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center gap-4">
          <Link to="/" className="text-stone-400 hover:text-stone-200 text-sm transition-colors">← Accueil</Link>
          <span className="text-amber-400 font-bold">Politique de confidentialité</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-12 space-y-8 text-sm leading-relaxed">
        <p className="text-stone-500 text-xs">Dernière mise à jour : juillet 2026</p>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">1. Responsable du traitement</h2>
          <p>Nicolas Pallas — <span className="text-amber-400">pallas.nicolas@gmail.com</span>. Traitement des données conforme au Règlement Général sur la Protection des Données (RGPD, UE 2016/679).</p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">2. Données collectées</h2>
          <ul className="list-disc list-inside space-y-1 text-stone-400">
            <li><strong className="text-stone-300">Compte</strong> : nom, adresse email, mot de passe haché.</li>
            <li><strong className="text-stone-300">Facturation</strong> : identifiant client Stripe (aucune carte bancaire n'est stockée sur nos serveurs).</li>
            <li><strong className="text-stone-300">Contenu</strong> : données de campagne saisies (PNJ, lieux, quêtes…).</li>
            <li><strong className="text-stone-300">Logs techniques</strong> : adresse IP, horodatage des requêtes, à des fins de sécurité.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">3. Finalités</h2>
          <ul className="list-disc list-inside space-y-1 text-stone-400">
            <li>Fourniture du service et gestion du compte utilisateur.</li>
            <li>Traitement des paiements via Stripe (sous-traitant conforme RGPD).</li>
            <li>Envoi d'emails transactionnels (bienvenue, confirmations).</li>
            <li>Sécurité et prévention des abus.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">4. Conservation</h2>
          <p>Les données sont conservées pendant la durée d'activité du compte, puis supprimées dans un délai de 30 jours après fermeture. Les données de facturation sont conservées 10 ans conformément aux obligations comptables.</p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">5. Sous-traitants</h2>
          <ul className="list-disc list-inside space-y-1 text-stone-400">
            <li><strong className="text-stone-300">Stripe</strong> — paiements (États-Unis, certifié PCI-DSS).</li>
            <li><strong className="text-stone-300">Hetzner</strong> — hébergement (Allemagne, UE).</li>
            <li><strong className="text-stone-300">Resend</strong> — envoi d'emails transactionnels.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">6. Vos droits</h2>
          <p>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, de suppression, de portabilité et d'opposition. Pour exercer ces droits : <span className="text-amber-400">pallas.nicolas@gmail.com</span>. Vous pouvez également exporter vos données directement depuis l'application.</p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-2">7. Cookies</h2>
          <p>L'application utilise uniquement le localStorage pour stocker le token d'authentification et les préférences d'interface. Aucun cookie tiers ou traceur publicitaire n'est utilisé.</p>
        </section>
      </main>

      <footer className="border-t border-stone-800 py-6 text-center">
        <p className="text-stone-600 text-xs">© {new Date().getFullYear()} La Taverne — <Link to="/legal" className="hover:text-stone-400 transition-colors">CGV</Link></p>
      </footer>
    </div>
  )
}
