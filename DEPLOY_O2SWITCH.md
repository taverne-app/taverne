# Déploiement O2switch (hébergement mutualisé)

## Prérequis

- Accès SSH O2switch activé (cPanel → SSH Access)
- PHP 8.3+ activé via MultiPHP Manager dans cPanel
- Base de données créée dans cPanel (MySQL ou PostgreSQL)
- Compte Ably gratuit : https://ably.com (créer une app + récupérer la clé API)

---

## 1. Première installation

### 1a. Build du frontend en local

```bash
# Remplir VITE_ABLY_KEY dans .env local (partie publique de ta clé Ably)
# Format : appId.keyId  (sans le secret, ex: xVLyHw.ABCDEF)
VITE_ABLY_KEY=xVLyHw.ABCDEF npm run build --prefix frontend
```

Le build génère `frontend/dist/` — c'est ce dossier qu'on uploade.

### 1b. Upload des fichiers sur O2switch

Via SSH (méthode recommandée) :

```bash
# Copier le code Laravel
rsync -avz --exclude=vendor --exclude=node_modules \
  app/ user@mondomaine.com:~/www/api/

# Copier le build frontend
rsync -avz frontend/dist/ user@mondomaine.com:~/www/
```

Ou via FTP : uploader `app/` dans un sous-dossier (ex: `~/www/api/`) et `frontend/dist/` dans `~/www/`.

### 1c. Configurer Laravel sur le serveur

```bash
ssh user@mondomaine.com

cd ~/www/api

# Installer les dépendances PHP
composer install --no-dev --optimize-autoloader

# Copier et remplir le fichier .env
cp .env.prod.example .env
nano .env   # remplir APP_KEY, DB_*, ABLY_*, MAIL_*

# Générer la clé d'application
php artisan key:generate

# Migrations base de données
php artisan migrate --force

# Cache de configuration
php artisan config:cache
php artisan route:cache
php artisan event:cache

# Lien storage public
php artisan storage:link
```

### 1d. Configurer Apache (.htaccess)

Le fichier `app/public/.htaccess` est déjà présent (Laravel le génère).

Si le domaine principal pointe vers `~/www/`, créer un `.htaccess` à la racine pour router `/api/` :

```apache
# ~/www/.htaccess
RewriteEngine On

# API Laravel → sous-dossier api/public
RewriteCond %{REQUEST_URI} ^/api/
RewriteRule ^api/(.*)$ /api/public/$1 [L]

# SPA React → toujours servir index.html
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

---

## 2. Mises à jour (déploiements suivants)

```bash
# En local : build frontend si le code a changé
VITE_ABLY_KEY=xVLyHw.ABCDEF npm run build --prefix frontend
rsync -avz frontend/dist/ user@mondomaine.com:~/www/

# Sur le serveur
ssh user@mondomaine.com "cd ~/www/api && \
  git pull origin main && \
  composer install --no-dev --optimize-autoloader && \
  php artisan migrate --force && \
  php artisan config:cache && \
  php artisan route:cache && \
  php artisan event:cache"
```

---

## 3. Récupérer ta clé Ably

1. Aller sur https://ably.com → créer un compte gratuit
2. Créer une app (ex: "taverne")
3. Aller dans **API Keys** → copier la clé (format `xVLyHw.ABCDEF:secret`)
4. Décomposer :
   - `ABLY_APP_ID` = `xVLyHw` (avant le `.`)
   - `ABLY_PUSHER_KEY` = `xVLyHw.ABCDEF` (avant le `:`)
   - `ABLY_PUSHER_SECRET` = `secret` (après le `:`)
   - `VITE_ABLY_KEY` = `xVLyHw.ABCDEF` (même que `ABLY_PUSHER_KEY`, va dans le build frontend)

---

## 4. Cron job (optionnel — pour les tâches planifiées Laravel)

Dans cPanel → Cron Jobs, ajouter :

```
* * * * * php /home/USER/www/api/artisan schedule:run >> /dev/null 2>&1
```

Pas nécessaire si `QUEUE_CONNECTION=sync` (emails synchrones).
