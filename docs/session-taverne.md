# Session `taverne` — le produit

Session de travail ouverte à la racine de ce dépôt.
Elle a pour objet **le logiciel** : ce que le MJ et les joueurs voient et utilisent.

---

## Ce qui se fait ici

- Fonctionnalités : personnages, campagnes, séances, combat, sorts, compendiums, partage.
- API Laravel, SPA React, migrations, tests, temps réel (Reverb).
- Le `docker-compose.yml` **de développement**, celui qui fait tourner l'app en local
  ou en auto-hébergement.
- **Toute la logique de plans**, même si elle n'existe que pour le SaaS :
  multi-tenant, quota de campagnes, limite de joueurs, gating de fonctionnalités,
  écran « votre plan ne permet pas… ». C'est du code produit.

Le critère est simple : **si ça touche `app/` ou `frontend/`, c'est ici.**

---

## Ce qui ne se fait pas ici

- Terraform, DNS, certificats, provisioning de serveurs.
- Stripe : clés, produits, webhooks, portail client, relances d'impayés.
- Monitoring, alerting, sauvegardes, CI de déploiement.

Ces sujets partent dans la session `taverne-cloud`.

---

## Frontière concrète : les plans tarifaires

C'est le seul endroit où les deux dépôts se parlent, et c'est là qu'on se marche
dessus si on n'est pas net.

| Question | Qui répond |
|---|---|
| « Cet utilisateur a-t-il le droit de créer une 2ᵉ campagne ? » | **taverne** — une règle métier, dans Laravel |
| « Cet utilisateur a-t-il payé ? » | **taverne-cloud** — Stripe |

`taverne` expose un **plan** sur le compte (`free`, `adventurer`, `guild`) et applique
les limites. Il **ne parle jamais à Stripe** : `taverne-cloud` écrit le plan, `taverne`
le lit et l'applique. Le produit reste auto-hébergeable sans aucune brique payante — un
utilisateur qui clone ce dépôt n'a pas de Stripe, et tout doit fonctionner.

---

## Rappels de discipline

Voir [CLAUDE.md](../CLAUDE.md) pour le détail. Les trois qui coûtent le plus cher :

1. `docker compose restart app` après toute modification PHP (opcache).
2. `npm run typecheck` — jamais `tsc --noEmit`, qui ne vérifie rien.
3. **Aucune vérification sur les vraies données.** Pas de sauvegarde, pas de PITR.
   Campagne jetable, puis suppression.
