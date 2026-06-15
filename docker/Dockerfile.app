# ── base ─────────────────────────────────────────────────────────────────────
FROM php:8.4-fpm-alpine AS base

RUN apk add --no-cache \
        libpq-dev \
        libzip-dev \
        icu-dev \
        sqlite-dev \
        linux-headers \
        $PHPIZE_DEPS \
    && docker-php-ext-install -j$(nproc) \
        pdo_pgsql \
        pgsql \
        pdo_sqlite \
        bcmath \
        intl \
        pcntl \
        zip \
        opcache \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apk del $PHPIZE_DEPS \
    && rm -rf /tmp/pear

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# ── production ────────────────────────────────────────────────────────────────
FROM base AS production

COPY --chown=www-data:www-data . .

RUN composer install \
        --optimize-autoloader \
        --no-dev \
        --no-interaction \
        --prefer-dist \
    && chown -R www-data:www-data storage bootstrap/cache

USER www-data

EXPOSE 9000
CMD ["php-fpm"]
