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
- La **configuration** de la facturation : clés, produits, prix, secrets de production.
  Attention : le **code** de facturation, lui, est ici (voir la frontière plus bas).
- Monitoring, alerting, sauvegardes, CI de déploiement.

Ces sujets partent dans la session `taverne-cloud`.

---

## Frontière concrète : la facturation

C'est le seul endroit où les deux dépôts se parlent, et c'est là qu'on se marche
dessus si on n'est pas net.

La ligne ne passe pas entre « le paiement » et « le reste ». Elle passe entre **le
code** et **la configuration** :

- **le code est ici.** L'abonnement se traduit par un plan sur le compte, écrit et lu
  en base — et seul le produit a accès à la base. Le traitement du paiement, le plan et
  les limites sont donc du Laravel, dans ce dépôt.
- **la configuration est là-bas.** Clés, identifiants de produits et de prix, réglages
  du fournisseur de paiement : rien de tout ça ne s'écrit en PHP. C'est de
  l'exploitation, et sa documentation est dans `taverne-cloud`.

**Contrainte à ne jamais casser : la facturation doit rester optionnelle.** Quelqu'un
qui clone ce dépôt pour s'auto-héberger n'a aucune clé de paiement. Sans elles, la
facturation se désactive et l'application tourne — sans plan, sans limite, sans écran
d'abonnement. Le SaaS est une configuration du produit, pas une dépendance du produit.

---

## Rappels de discipline

Voir [CLAUDE.md](../CLAUDE.md) pour le détail. Les trois qui coûtent le plus cher :

1. `docker compose restart app` après toute modification PHP (opcache).
2. `npm run typecheck` — jamais `tsc --noEmit`, qui ne vérifie rien.
3. **Aucune vérification sur les vraies données.** Pas de sauvegarde, pas de PITR.
   Campagne jetable, puis suppression.
