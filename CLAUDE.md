# Taverne — instructions de travail

Gestionnaire de campagnes de jeu de rôle 5e, en français, auto-hébergeable via Docker.
Ce fichier est lu à chaque session : il contient ce qui **ne se déduit pas du code**.

---

## Périmètre : deux dépôts, deux sessions

Le produit et son exploitation commerciale vivent dans deux dépôts distincts, et
donc dans **deux sessions Claude Code distinctes**. La frontière est le dépôt, pas le
thème :

- **Ce dépôt (`taverne`)** → tout ce qui change le produit. Y compris ce qui existe
  *à cause* du SaaS : multi-tenant, quotas, gating par plan, et le **code** de
  facturation — l'abonnement se lit et s'applique en base, donc c'est du Laravel.
  Voir [docs/session-taverne.md](docs/session-taverne.md).
- **`taverne-cloud`** (privé) → tout ce qui n'est pas le produit : infra, domaine,
  monitoring, sauvegardes, et la **configuration** de la facturation. Aucune logique
  métier. Sa documentation vit là-bas, pas ici.

La facturation doit rester **optionnelle** : sans configuration de paiement,
l'auto-hébergement fonctionne, sans plan ni limite. Le SaaS est une configuration du
produit, jamais une dépendance du produit.

Si une tâche « SaaS » te fait ouvrir un modèle Eloquent ou un composant React, elle
n'appartient pas à `taverne-cloud` : elle appartient ici.

---

## Architecture

| Couche | Techno | Où |
|---|---|---|
| API | Laravel 12 (PHP 8.4) | `app/` |
| SPA | React 19 + TS + Vite + Tailwind v4 | `frontend/` |
| Base | PostgreSQL 16 | service `db` |
| Temps réel | Laravel Reverb (WebSocket) | service `reverb` |
| Cache / files | Redis 7 | service `redis` |

7 conteneurs : `app` (PHP-FPM), `nginx` (API), `frontend` (nginx + build React),
`db`, `reverb`, `redis`, `mailpit`. Tous en `restart: always`.

Le conteneur `frontend` sert la SPA **et** relaie lui-même `/api` et `/storage` vers
le nginx applicatif. Une seule origine côté navigateur.

---

## Commandes

```bash
# Tests backend (125 tests) — SQLite sur fichier, pas la vraie base
docker compose exec app php artisan test
docker compose exec app php artisan test --filter=nom_du_test

# Typecheck frontend
cd frontend && npm run typecheck

# Voir une modification du front dans l'application (cf. piège 6)
docker compose up -d --build frontend
```

---

## Pièges qui ont déjà coûté des heures

**1. `docker compose restart app` après TOUTE modification PHP.**
`opcache.validate_timestamps = 0` (`docker/php.ini`) : les fichiers ne sont jamais
relus. Le CLI a opcache désactivé — **les tests peuvent passer pendant que l'app sert
l'ancien code**. Et si nginx renvoie 502 après ce restart, c'est qu'il a mis en cache
l'ancienne IP du conteneur : `docker compose restart nginx`.

**2. `tsc --noEmit` ne vérifie RIEN dans ce dépôt.**
Le `tsconfig.json` racine a `"files": []` et délègue à des références de projet. Un
`const x: number = "chaîne"` passe avec exit 0. La seule commande valable est
**`npm run typecheck`** (= `tsc -b`).

**3. `$request->validate()` supprime en silence les clés non déclarées.**
Deux pertes de données réelles sont venues de là (`damage_dice` des sorts, puis
`notes`/`magical`/`attuned` des inventaires) : le serveur répond 200, la donnée a
disparu. **Toute nouvelle clé d'un tableau JSON doit être déclarée dans la
FormRequest**, sinon elle sera effacée à chaque écriture.

**4. Jamais d'URL absolue construite sur `APP_URL`.**
Les images sont servies en URL **relative** (`/storage/…`). Une URL absolue passe
sur la machine hôte — le seul endroit où `localhost:8000` résout — et casse chez les
joueurs. Vérifier depuis une autre origine, au minimum la vue `/share/…`.

**5. Éprouver un outil de vérification avant de s'y fier.**
Y injecter une faute évidente, confirmer qu'il **échoue**, puis restaurer. Un « vert »
d'un outil jamais éprouvé ne vaut rien (cf. piège 2).

**6. Le conteneur `frontend` sert un bundle figé dans l'image.**
Modifier un fichier de `frontend/` ne change **rien** à ce que sert le port 3000 : le
build a eu lieu au `docker build`. Il n'y a pas de montage de volume, pas de HMR.
**`docker compose up -d --build frontend`** — sinon on croit à un cache navigateur et
on cherche des heures. (Cette commande redémarre aussi `app` par dépendance : si
l'API tombe en 502, c'est le piège 1, `docker compose restart nginx`.)
Pour vérifier une modification sans reconstruire, un `npm run dev -- --port 5174`
sert le front en direct et relaie `/api` vers le nginx applicatif — mais c'est le
conteneur, pas lui, que voient les joueurs.

---

## Données réelles : interdiction de les toucher

Il n'y a **ni dump, ni PITR** (`archive_mode = off`). Rien ne rattrape une erreur.
Une session passée a détruit définitivement des sorts d'un personnage joueur.

Pour vérifier quoi que ce soit : **créer une campagne / un personnage jetable**,
s'en servir, le supprimer. Jamais les vrais personnages.
Si une donnée réelle doit absolument être modifiée : la dumper intégralement d'abord
(sans troncature — attention aux `head` et aux `[:300]` qui donnent l'illusion d'avoir
tout vu).

---

## Conventions

- **Tout est en français** : interface, commentaires, messages de commit, tests.
- Commits conventionnels, sujet en français :
  `feat(inventaire): valeur en po sur les objets portés`
- Un commentaire explique **une contrainte que le code ne peut pas montrer** — jamais
  ce que fait la ligne suivante.
- Les valeurs monétaires sont des **nombres de pièces d'or** (`value_gp`), jamais du
  texte libre. Conversions dans `frontend/src/lib/gold.ts`.
- Vérification = faire tourner l'application dans un vrai navigateur. Un test vert
  n'est pas une vérification.
