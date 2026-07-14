# Session `taverne-cloud` — l'exploitation

Session de travail ouverte **dans le dépôt `taverne-cloud`** (privé), pas ici.
Ce document en décrit le périmètre ; il vit dans ce dépôt parce que c'est ici qu'on se
demande « est-ce que ce ticket est pour moi ? ».

Objet : **faire tourner et vendre** taverne.app. Pas le logiciel — son exploitation.

---

## Ce qui se fait là-bas

- **Infra** : Terraform, serveurs, DNS, TLS, reverse proxy de production.
- **Déploiement** : CI/CD, images, migrations jouées en prod, rollback.
- **Facturation** : Stripe — produits, prix, checkout, portail client, webhooks,
  impayés, résiliations.
- **Exploitation** : monitoring, alerting, logs, **sauvegardes** (voir plus bas).

Structure prévue : `terraform/`, `ci-cd/`, `monitoring/`, `billing/`.

---

## Ce qui ne se fait pas là-bas

**Aucune logique métier. Aucune ligne de PHP ou de React du produit.**

Si une tâche « SaaS » oblige à ouvrir un modèle Eloquent, une FormRequest ou un
composant React, elle a franchi la frontière : elle appartient au dépôt `taverne`.
Deux sessions qui éditent le même code sans se voir, c'est comme ça qu'on se marche
dessus.

---

## Le contrat entre les deux dépôts

Un seul point de contact : **le plan de l'utilisateur**.

```
Stripe → webhook → taverne-cloud → écrit le plan sur le compte → taverne l'applique
```

- `taverne-cloud` sait qui a payé. Il **écrit** le plan (`free`, `adventurer`, `guild`).
- `taverne` ne sait pas ce qu'est Stripe. Il **lit** le plan et applique les limites
  (1 campagne / 4 joueurs en gratuit, illimité au-dessus).

Corollaire à ne jamais casser : **le produit doit rester auto-hébergeable sans aucune
brique de facturation.** Quelqu'un qui clone `taverne` n'a ni Stripe ni `taverne-cloud`,
et tout doit fonctionner.

---

## À traiter en priorité, avant d'ouvrir le chantier

Deux dettes connues, qui deviennent bloquantes dès qu'il y a des clients payants :

**1. Le temps réel ne fonctionne pas pour les joueurs distants.**
Le bundle contient `wsHost: "localhost"` et `forceTLS: false`
(`frontend/src/lib/echo.ts`), et aucun proxy n'expose le WebSocket. Un joueur distant
tente `ws://localhost:8080` → échec. Invisible depuis la machine hôte, seul endroit où
`localhost` résout. *Le correctif est du code produit : il se fait dans `taverne`.*

**2. Il n'y a aucune sauvegarde.**
Pas de dump, `archive_mode = off`, donc pas de PITR. En auto-hébergement c'est le
problème de l'utilisateur ; **en SaaS, c'est une faute.** Perdre la campagne d'un
client payant est irréparable. À régler avant le premier euro encaissé.
