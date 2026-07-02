#!/bin/bash
# Script de déploiement — La Taverne
# Usage : ./deploy.sh
set -e

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

echo "→ Pull du code..."
git pull origin main

echo "→ Build du frontend (intègre les VITE_* vars)..."
$COMPOSE build frontend

echo "→ Démarrage des services..."
$COMPOSE up -d

echo "→ Migrations base de données..."
$COMPOSE exec app php artisan migrate --force

echo "→ Cache Laravel..."
$COMPOSE exec app php artisan config:cache
$COMPOSE exec app php artisan route:cache
$COMPOSE exec app php artisan event:cache

echo "→ Lien storage public..."
$COMPOSE exec app php artisan storage:link

echo "✓ Déploiement terminé."
