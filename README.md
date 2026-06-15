# 🍺 Taverne

[![Licence MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![Stars](https://img.shields.io/github/stars/taverne-app/taverne?style=social)](https://github.com/taverne-app/taverne/stargazers)
[![Version](https://img.shields.io/github/v/release/taverne-app/taverne?label=version)](https://github.com/taverne-app/taverne/releases)

**Outil de gestion de campagnes Donjons & Dragons 5e en français — self-hostable via Docker.**

Taverne centralise tout ce dont un Maître du Donjon et ses joueurs ont besoin : fiches de personnage interactives, suivi des combats en temps réel, compendiums intégrés et partage instantané entre les participants d'une session.

> Version SaaS disponible sur [taverne.app](https://taverne.app)

---

## Fonctionnalités MVP

| Fonctionnalité | Description |
|---|---|
| **Fiche personnage interactive** | Saisie guidée, calculs automatiques des modificateurs, sauvegardées en temps réel |
| **Calculs automatiques** | Modificateurs de caractéristiques, bonus de maîtrise, CA, initiative |
| **Gestion des sorts** | Emplacements de sorts, listes filtrables par classe, descriptions complètes |
| **Combat Tracker** | Suivi de l'initiative, points de vie, conditions (empoisonné, étourdi…) |
| **Compendiums intégrés** | Monstres, sorts et objets magiques consultables en partie |
| **Multi-joueurs temps réel** | Synchronisation instantanée via WebSockets — tous les joueurs voient les mises à jour simultanément |

---

## Installation (self-host)

**Prérequis** : Docker et Docker Compose installés.

```bash
# 1. Cloner le dépôt
git clone https://github.com/taverne-app/taverne.git && cd taverne

# 2. Configurer l'environnement
cp .env.example .env
# Éditez .env pour définir APP_KEY, DB_PASSWORD, REVERB_APP_SECRET, etc.

# 3. Lancer les services
docker compose up -d
```

L'application est disponible sur `http://localhost:8000` et le frontend sur `http://localhost:3000`.

Pour générer la clé d'application Laravel :
```bash
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate --seed
```

---

## Stack technique

| Couche | Technologie |
|---|---|
| Backend | Laravel 12 (PHP 8.3) |
| Frontend | React 19 + Tailwind CSS v4 |
| Base de données | PostgreSQL 16 |
| WebSockets | Laravel Reverb |
| Conteneurisation | Docker / Docker Compose |
| Cache & Queues | Redis 7 |

---

## Contribuer

Les contributions sont les bienvenues ! Taverne est un projet communautaire — que vous soyez développeur, designer, ou simplement passionné de JDR, vous pouvez participer.

- **Signaler un bug** → [ouvrir une issue](https://github.com/taverne-app/taverne/issues)
- **Proposer une fonctionnalité** → [démarrer une discussion](https://github.com/taverne-app/taverne/discussions)
- **Soumettre du code** → fork → branche → pull request
- **Contribuer aux compendiums** → les données SRD sont dans `app/database/seeders/`

Consultez [CONTRIBUTING.md](CONTRIBUTING.md) pour les conventions de code et le workflow de contribution.

---

## Licence

Distribué sous [licence MIT](LICENSE). © 2026 taverne-app.
