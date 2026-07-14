import { Link } from 'react-router-dom'
import { createCheckoutSession } from '../api/billing'
import { useState } from 'react'

const FEATURES = [
  {
    icon: '🗺️',
    title: 'Campagnes complètes',
    desc: 'PNJ, lieux, factions, quêtes, calendrier, trésor de groupe — tout en un seul endroit.',
  },
  {
    icon: '⚔️',
    title: 'Combat en temps réel',
    desc: 'Tracker d\'initiative, points de vie, conditions, rounds. Partagez le combat avec vos joueurs en direct.',
  },
  {
    icon: '📖',
    title: 'Préparation par chapitres',
    desc: 'Chapitres, scènes, ressources, tables aléatoires. Votre outil de prep tout-en-un.',
  },
  {
    icon: '🔗',
    title: 'Page partagée joueurs',
    desc: 'Générez un lien lecture seule pour vos joueurs : frise chronologique, quêtes actives, PNJ importants.',
  },
]

const PLANS = [
  {
    name: 'Gratuit',
    price: '0',
    period: '',
    highlight: false,
    features: ['1 campagne', '4 joueurs max', 'Toutes les fonctionnalités', 'Partage joueurs inclus'],
    cta: 'Commencer gratuitement',
    href: '/register',
    plan: null as null,
  },
  {
    name: 'Aventurier',
    price: '5',
    period: '/mois',
    highlight: true,
    features: ['Campagnes illimitées', 'Joueurs illimités', 'Toutes les fonctionnalités', 'Partage joueurs inclus'],
    cta: 'Choisir Aventurier',
    href: null,
    plan: 'adventurer' as const,
  },
  {
    name: 'Guilde',
    price: '10',
    period: '/mois',
    highlight: false,
    features: ['Tout Aventurier', 'Multi-tables', 'Support prioritaire', 'Accès anticipé aux nouveautés'],
    cta: 'Choisir Guilde',
    href: null,
    plan: 'guild' as const,
  },
]

export function LandingPage() {
  const [loadingPlan, setLoadingPlan] = useState<'adventurer' | 'guild' | null>(null)

  async function handlePaidPlan(plan: 'adventurer' | 'guild') {
    setLoadingPlan(plan)
    try {
      const url = await createCheckoutSession(plan)
      window.location.href = url
    } catch {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-stone-800/60 bg-stone-950/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <span className="text-amber-400 font-bold text-lg tracking-tight">La Taverne</span>
          <nav className="flex items-center gap-4">
            <Link to="/login" className="text-stone-400 hover:text-stone-200 text-sm transition-colors">
              Connexion
            </Link>
            <Link
              to="/register"
              className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm rounded-lg px-4 py-1.5 transition-colors"
            >
              Essayer gratuitement
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-5 pt-24 pb-20 text-center">
        <p className="text-amber-500 text-sm font-semibold uppercase tracking-widest mb-4">
          Pour les maîtres du donjon
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-5">
          Gérez vos campagnes D&D 5e<br className="hidden sm:block" /> sans vous éparpiller
        </h1>
        <p className="text-stone-400 text-lg leading-relaxed mb-8 max-w-xl mx-auto">
          PNJ, lieux, quêtes, combat, sessions — tout ce dont votre table a besoin, accessible en une seule appli.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/register"
            className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-base rounded-xl px-7 py-3 transition-colors"
          >
            Commencer gratuitement
          </Link>
          <Link
            to="/login"
            className="text-stone-400 hover:text-stone-200 text-sm transition-colors px-4 py-3"
          >
            Déjà un compte ? Connexion →
          </Link>
        </div>
        <p className="text-stone-600 text-xs mt-5">Gratuit pour toujours sur 1 campagne. Aucune carte bancaire requise.</p>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-5 py-16">
        <h2 className="text-center text-2xl font-bold mb-10">Tout ce qu'il vous faut à la table</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-stone-900 border border-stone-800 rounded-2xl p-6">
              <p className="text-3xl mb-3">{f.icon}</p>
              <h3 className="text-white font-semibold text-base mb-1">{f.title}</h3>
              <p className="text-stone-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-4xl mx-auto px-5 py-16">
        <h2 className="text-center text-2xl font-bold mb-2">Tarifs simples</h2>
        <p className="text-center text-stone-500 text-sm mb-10">Commencez gratuitement, passez Pro quand vous êtes prêt.</p>
        <div className="grid sm:grid-cols-3 gap-4">
          {PLANS.map(p => (
            <div
              key={p.name}
              className={`rounded-2xl p-6 flex flex-col gap-4 ${
                p.highlight
                  ? 'bg-amber-950/30 border-2 border-amber-600'
                  : 'bg-stone-900 border border-stone-800'
              }`}
            >
              {p.highlight && (
                <span className="self-start text-xs font-semibold bg-amber-500 text-stone-950 rounded-full px-2.5 py-0.5">
                  Populaire
                </span>
              )}
              <div>
                <p className={`font-semibold ${p.highlight ? 'text-amber-400' : 'text-stone-300'}`}>{p.name}</p>
                <p className="text-white font-bold text-3xl mt-1">
                  {p.price}€<span className="text-stone-500 text-sm font-normal">{p.period}</span>
                </p>
              </div>
              <ul className="space-y-1.5 flex-1">
                {p.features.map(f => (
                  <li key={f} className="text-stone-400 text-sm flex items-center gap-2">
                    <span className="text-amber-500">✓</span> {f}
                  </li>
                ))}
              </ul>
              {p.href ? (
                <Link
                  to={p.href}
                  className={`text-center font-semibold text-sm rounded-xl py-2.5 transition-colors ${
                    p.highlight
                      ? 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                      : 'bg-stone-800 hover:bg-stone-700 text-white'
                  }`}
                >
                  {p.cta}
                </Link>
              ) : (
                <button
                  onClick={() => p.plan && handlePaidPlan(p.plan)}
                  disabled={loadingPlan !== null}
                  className={`font-semibold text-sm rounded-xl py-2.5 transition-colors disabled:opacity-40 ${
                    p.highlight
                      ? 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                      : 'bg-stone-800 hover:bg-stone-700 text-white'
                  }`}
                >
                  {loadingPlan === p.plan ? '...' : p.cta}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-2xl mx-auto px-5 py-16 text-center">
        <h2 className="text-2xl font-bold mb-3">Prêt pour votre prochaine session ?</h2>
        <p className="text-stone-400 mb-6">Créez votre compte gratuitement et commencez à préparer votre campagne en quelques minutes.</p>
        <Link
          to="/register"
          className="inline-block bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-base rounded-xl px-8 py-3 transition-colors"
        >
          Créer un compte gratuit
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-800 py-6">
        <p className="text-center text-stone-600 text-xs flex items-center justify-center gap-3 flex-wrap">
          <span>© {new Date().getFullYear()} La Taverne — Outil de gestion de campagnes D&D 5e</span>
          <Link to="/legal"   className="hover:text-stone-400 transition-colors">CGV</Link>
          <Link to="/privacy" className="hover:text-stone-400 transition-colors">Confidentialité</Link>
        </p>
      </footer>
    </div>
  )
}
