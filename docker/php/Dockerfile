FROM php:8.4-cli-alpine

# pdo_pgsql — драйвер Postgres; unzip — чтобы Composer распаковывал пакеты
RUN apk add --no-cache postgresql-libs unzip \
    && apk add --no-cache --virtual .build-deps postgresql-dev \
    && docker-php-ext-install pdo_pgsql \
    && apk del .build-deps

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
