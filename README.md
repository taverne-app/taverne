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

### 1. Cloner le dépôt

```bash
git clone https://github.com/taverne-app/taverne.git
cd taverne
```

### 2. Configurer l'environnement

```bash
# Variables Docker Compose (DB, Reverb keys…)
cp .env.example .env

# Variables Laravel (dans le container app)
cp app/.env.example app/.env
```

Éditez `.env` pour définir des secrets robustes en production :

```dotenv
DB_PASSWORD=changeme
REVERB_APP_KEY=une-clé-aléatoire
REVERB_APP_SECRET=un-secret-aléatoire
```

Reportez les mêmes valeurs dans `app/.env` aux clés correspondantes (`DB_PASSWORD`, `REVERB_APP_KEY`, `REVERB_APP_SECRET`).

> **Note :** `APP_KEY` dans `app/.env` est générée automatiquement à l'étape suivante.

### 3. Démarrer les services

```bash
docker compose up -d
```

### 4. Initialiser l'application

```bash
# Génère la clé Laravel et lance les migrations
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate
```

L'application est disponible sur :
- **Backend (API)** → http://localhost:8000
- **Frontend (React)** → http://localhost:3000
- **WebSockets (Reverb)** → ws://localhost:8080

### Note production — Redis `vm.overcommit_memory`

Sur un VPS, Redis affiche au démarrage :

```
WARNING Memory overcommit must be enabled!
```

Sans ce réglage, une sauvegarde en arrière-plan peut échouer sous pression mémoire. À activer une fois sur l'hôte :

```bash
echo 'vm.overcommit_memory = 1' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

Sans impact en développement local.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Backend | Laravel 12 (PHP 8.4) |
| Frontend | React 19 + Tailwind CSS v4 |
| Base de données | PostgreSQL 16 |
| WebSockets | Laravel Reverb |
| Cache & Queues | Redis 7 |
| Conteneurisation | Docker / Docker Compose |
| Reverse proxy | Nginx |

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

### Contenu de jeu

Taverne s'appuie sur le **System Reference Document 5.1**, publié par Wizards of the
Coast sous licence Creative Commons Attribution 4.0. L'attribution ci-dessous est une
**obligation de cette licence**, pas une politesse : sans elle, l'usage sort du cadre
qui l'autorise.

> This work includes material from the System Reference Document 5.1 (“SRD 5.1”) by
> Wizards of the Coast LLC, available at
> <https://dnd.wizards.com/resources/systems-reference-document>. The SRD 5.1 is
> licensed under the Creative Commons Attribution 4.0 International License, available
> at <https://creativecommons.org/licenses/by/4.0/legalcode>.

Ce que cette licence **ne couvre pas**, et que le projet n'utilise donc pas :

- les **marques** — « Dungeons & Dragons », « D&D », les logos et l'identité visuelle
  de Wizards of the Coast. Taverne se décrit comme compatible avec la 5e édition ; il
  ne s'en réclame pas et n'est affilié à personne ;
- les créatures et éléments **hors SRD** (tyrannœil, flagelleur mental, githyanki…),
  volontairement absents du bestiaire ;
- les **traductions françaises officielles**, qui sont des œuvres dérivées relevant de
  leurs propres éditeurs. La terminologie française de Taverne doit rester une
  traduction du SRD anglais, jamais une reprise d'une VF publiée.

Taverne est un projet indépendant, sans lien avec Wizards of the Coast LLC.
